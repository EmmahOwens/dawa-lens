package com.dawainnovation.lens

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Autonomous background CoroutineWorker executing every 15 minutes.
 * Operates 100% offline directly against the SQLite database (dawa_lens.db).
 * Queries active reminders, calculates scheduled dose times over the past 24 hours,
 * identifies unlogged doses older than 2 hours, inserts missed dose logs,
 * and posts high-priority missed dose notifications.
 */
class MissedDoseWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    companion object {
        private const val PREFS_NAME = "dawa_missed_doses"
        private const val KEY_NOTIFIED_SLOTS = "notified_slots"
    }

    override suspend fun doWork(): Result {
        val userManager = applicationContext.getSystemService(Context.USER_SERVICE) as? android.os.UserManager
        val isUserUnlocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            userManager?.isUserUnlocked ?: true
        } else true
        if (!isUserUnlocked) return Result.success()

        val dbPath = applicationContext.getDatabasePath("dawa_lens.db")
        if (!dbPath.exists()) return Result.success()

        val db = try {
            SQLiteDatabase.openDatabase(
                dbPath.absolutePath, null, SQLiteDatabase.OPEN_READWRITE
            )
        } catch (e: Exception) {
            // Retry later via WorkManager exponential backoff
            return Result.retry()
        }

        try {
            val now = System.currentTimeMillis()
            val twoHoursAgo = now - (2L * 60L * 60L * 1000L)
            val twentyFourHoursAgo = now - (24L * 60L * 60L * 1000L)

            val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val notifiedSlots = prefs.getStringSet(KEY_NOTIFIED_SLOTS, emptySet())?.toMutableSet() ?: mutableSetOf()

            val isoUtcFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val isoLocalFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())

            val reminderCursor = db.rawQuery(
                """SELECT id, medicine_name, dose, time, repeat_schedule, repeat_days, created_at, patient_id 
                   FROM reminders 
                   WHERE enabled = 1""",
                null
            )

            while (reminderCursor.moveToNext()) {
                val reminderId = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("id"))
                val medicineName = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("medicine_name")) ?: "Medication"
                val dose = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("dose")) ?: ""
                val timeString = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("time")) ?: ""
                val repeatSchedule = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("repeat_schedule")) ?: "daily"
                val repeatDaysJson = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("repeat_days"))
                val createdAtStr = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("created_at")) ?: ""
                val patientId = reminderCursor.getString(reminderCursor.getColumnIndexOrThrow("patient_id"))

                val createdAtMs = if (createdAtStr.isNotEmpty()) {
                    try {
                        isoUtcFormat.parse(createdAtStr)?.time ?: (now - (30L * 86400000L))
                    } catch (e: Exception) {
                        try {
                            isoLocalFormat.parse(createdAtStr)?.time ?: (now - (30L * 86400000L))
                        } catch (e2: Exception) {
                            now - (30L * 86400000L)
                        }
                    }
                } else 0L

                val times = timeString.split(",").map { it.trim() }.filter { it.contains(":") }

                for (t in times) {
                    val parts = t.split(":")
                    if (parts.size != 2) continue
                    val hour = parts[0].toIntOrNull() ?: continue
                    val minute = parts[1].toIntOrNull() ?: continue

                    // Check both today and yesterday (the past 24 hours)
                    for (dayOffset in listOf(-1, 0)) {
                        val cal = Calendar.getInstance()
                        cal.add(Calendar.DAY_OF_YEAR, dayOffset)
                        cal.set(Calendar.HOUR_OF_DAY, hour)
                        cal.set(Calendar.MINUTE, minute)
                        cal.set(Calendar.SECOND, 0)
                        cal.set(Calendar.MILLISECOND, 0)

                        val scheduledEpochMs = cal.timeInMillis

                        // Must be between 2 hours and 24 hours ago
                        if (scheduledEpochMs < twentyFourHoursAgo || scheduledEpochMs > twoHoursAgo) {
                            continue
                        }

                        // Must be after the reminder was created
                        if (scheduledEpochMs < createdAtMs) {
                            continue
                        }

                        // Check repeat schedule specific days if applicable.
                        // "custom" and "weekly" schedules use repeatDays to restrict which
                        // days of the week the reminder fires. "specific_days" was an old
                        // schema name — it is now always stored as "custom" or "weekly".
                        if ((repeatSchedule == "custom" || repeatSchedule == "weekly") &&
                            !repeatDaysJson.isNullOrEmpty()) {
                            try {
                                val daysArray = JSONArray(repeatDaysJson)
                                val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK) - 1 // 0 = Sunday, 6 = Saturday
                                var matchesDay = false
                                for (d in 0 until daysArray.length()) {
                                    if (daysArray.getInt(d) == dayOfWeek) {
                                        matchesDay = true
                                        break
                                    }
                                }
                                if (!matchesDay) continue
                            } catch (e: Exception) {
                                // proceed if parse fails
                            }
                        }

                        val scheduledIso = isoUtcFormat.format(Date(scheduledEpochMs))
                        val slotKey = "${reminderId}_${scheduledEpochMs}"

                        if (notifiedSlots.contains(slotKey)) {
                            continue
                        }

                        // Check if a log already exists in dose_logs table
                        val datePrefix = SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.US).apply {
                            timeZone = TimeZone.getTimeZone("UTC")
                        }.format(Date(scheduledEpochMs))

                        val logCursor = db.rawQuery(
                            """SELECT id, action FROM dose_logs 
                               WHERE reminder_id = ? 
                                 AND (scheduled_time LIKE ? OR action_time LIKE ?) 
                               LIMIT 1""",
                            arrayOf(reminderId, "$datePrefix%", "$datePrefix%")
                        )

                        val logExists = logCursor.moveToFirst()
                        logCursor.close()

                        if (!logExists) {
                            // 1. Post native notification
                            val notifId = Math.abs(slotKey.hashCode() % 2147483640) + 1
                            postMissedNotification(medicineName, dose, notifId, t)

                            // 2. Insert record into dose_logs table in SQLite
                            val actionTimeIso = isoUtcFormat.format(Date())
                            val logId = "missed-${System.currentTimeMillis()}-${(1000..9999).random()}"
                            try {
                                db.execSQL(
                                    """INSERT INTO dose_logs (id, reminder_id, medicine_name, dose, scheduled_time, action_time, action, is_snoozed, snooze_until, patient_id)
                                       VALUES (?, ?, ?, ?, ?, ?, 'missed', 0, NULL, ?)""",
                                    arrayOf(logId, reminderId, medicineName, dose, scheduledIso, actionTimeIso, patientId)
                                )
                            } catch (insertErr: Exception) {
                                // ignore DB insert error
                            }

                            // 3. Mark as notified
                            notifiedSlots.add(slotKey)
                        }
                    }
                }
            }
            reminderCursor.close()

            // Prune slots older than 48 hours to prevent unbounded growth
            val pruneCutoff = now - (48L * 60L * 60L * 1000L)
            val cleanedSlots = notifiedSlots.filter { entry ->
                val ts = entry.substringAfterLast("_").toLongOrNull() ?: 0L
                ts >= pruneCutoff
            }.toSet()

            prefs.edit()
                .putStringSet(KEY_NOTIFIED_SLOTS, cleanedSlots)
                .putLong("last_reconciliation_timestamp", now)
                .apply()

        } catch (e: Exception) {
            // Non-fatal worker catch
        } finally {
            db.close()
        }

        return Result.success()
    }

    private fun postMissedNotification(medicineName: String, dose: String, notifId: Int, timeStr: String) {
        val nm = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create channel on Android O+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()
            val channel = NotificationChannel(
                AlarmReceiver.CHANNEL_MISSED,
                "Missed Dose Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Urgent alerts when a scheduled medication dose was missed"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                setSound(alarmSound, audioAttributes)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            nm.createNotificationChannel(channel)
        }

        val launchIntent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_type", "missed_alert")
            putExtra("route", "/history")
        }
        val pi = PendingIntent.getActivity(
            applicationContext,
            notifId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val doseLabel = if (dose.isNotEmpty()) " ($dose)" else ""
        val alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(applicationContext, AlarmReceiver.CHANNEL_MISSED)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("⚠️ Missed Dose Follow-Up: $medicineName")
            .setContentText("Dose follow-up: $medicineName$doseLabel scheduled at $timeStr was not logged. Stay on track!")
            .setStyle(NotificationCompat.BigTextStyle().bigText("Dose follow-up: You have an unlogged dose of $medicineName$doseLabel from $timeStr. Tap to review your adherence record or log this dose."))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 400, 200, 400, 200, 400))
            .setSound(alarmSoundUri)
            .build()

        nm.notify(notifId, notification)
    }
}
