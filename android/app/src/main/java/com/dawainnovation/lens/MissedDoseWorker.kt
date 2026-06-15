package com.dawainnovation.lens

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * CoroutineWorker enqueued as a 15-minute periodic task by MainActivity.
 * While the app is in the background, it opens the SQLite DB directly
 * (no Capacitor bridge), reads the alarm schedule written by NativeAlarmPlugin,
 * and posts a notification for any dose that was scheduled > 2 hours ago
 * with no corresponding dose_logs record.
 */
class MissedDoseWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // ── 1. Bail out early if the DB doesn't exist yet ─────────────────────
        val dbPath = applicationContext.getDatabasePath("dawa_lens.db")
        if (!dbPath.exists()) return Result.success()

        // ── 2. Read alarm schedule written by NativeAlarmPlugin ───────────────
        val prefs = applicationContext.getSharedPreferences("dawa_alarms", Context.MODE_PRIVATE)
        val scheduleJson = prefs.getString("dawa_alarm_schedule", null)
            ?: return Result.success()

        // ── 3. Open the DB read-only — no Capacitor bridge needed ─────────────
        val db = try {
            SQLiteDatabase.openDatabase(
                dbPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY
            )
        } catch (e: Exception) {
            return Result.success()   // DB locked or corrupt — skip this cycle
        }

        try {
            val schedule = JSONArray(scheduleJson)
            val now         = System.currentTimeMillis()
            val twoHoursMs  = 2L  * 60L * 60L * 1000L
            val oneDayMs    = 24L * 60L * 60L * 1000L
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())

            for (i in 0 until schedule.length()) {
                val alarm           = schedule.getJSONObject(i)
                val extraStr        = alarm.optString("extra", "{}")
                val extra           = try { JSONObject(extraStr) } catch (e: Exception) { JSONObject() }

                val reminderId       = extra.optString("reminderId",   "")
                val medicineName     = extra.optString("medicineName", "Your medicine")
                val scheduledTimeStr = extra.optString("scheduledTime", "")
                val dose             = extra.optString("dose", "")

                if (reminderId.isEmpty() || scheduledTimeStr.isEmpty()) continue

                val scheduledMs = try {
                    sdf.parse(scheduledTimeStr)?.time ?: continue
                } catch (e: Exception) { continue }

                val elapsed = now - scheduledMs

                // Only act on alarms that fired between 2 h and 24 h ago
                if (elapsed < twoHoursMs || elapsed > oneDayMs) continue

                // ── 4. Check dose_logs for a taken/snoozed action ─────────────
                val cursor = db.rawQuery(
                    """SELECT id FROM dose_logs
                       WHERE reminder_id = ?
                         AND scheduled_time = ?
                         AND action IN ('taken', 'snoozed')
                       LIMIT 1""",
                    arrayOf(reminderId, scheduledTimeStr)
                )
                val alreadyLogged = cursor.moveToFirst()
                cursor.close()

                // ── 5. Post notification if no log found ──────────────────────
                if (!alreadyLogged) {
                    // Stable, unique notification ID derived from reminder + time
                    val notifId = (reminderId + scheduledTimeStr).hashCode()
                    postMissedNotification(medicineName, dose, notifId)
                }
            }
        } catch (e: Exception) {
            // Swallow parsing errors — do not crash the worker
        } finally {
            db.close()
        }

        return Result.success()
    }

    // ── Private helper ────────────────────────────────────────────────────────

    private fun postMissedNotification(medicineName: String, dose: String, notifId: Int) {
        val nm = applicationContext
            .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create channel on Android O+ (idempotent — safe to call every time)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                AlarmReceiver.CHANNEL_ID,
                "Medicine Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for medicine reminder alarms"
            }
            nm.createNotificationChannel(channel)
        }

        val launchIntent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            applicationContext,
            notifId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val doseLabel = if (dose.isNotEmpty()) " ($dose)" else ""
        val notification = NotificationCompat.Builder(applicationContext, AlarmReceiver.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Missed Dose")
            .setContentText("You missed your $medicineName$doseLabel dose")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()

        // Offset by 10 000 so IDs never collide with AlarmReceiver notifications
        nm.notify(notifId + 10_000, notification)
    }
}
