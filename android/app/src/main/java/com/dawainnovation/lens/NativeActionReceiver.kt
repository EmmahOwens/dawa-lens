package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.os.PowerManager
import android.util.Log
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Headless BroadcastReceiver for offline notification tray actions (TAKE, SKIP, SNOOZE).
 * Executes 100% natively without launching the WebView or requiring active JavaScript execution.
 * Direct Boot Aware and safe under aggressive memory constraints.
 */
class NativeActionReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "NativeActionReceiver"
        const val ACTION_TAKE = "com.dawainnovation.lens.ACTION_TAKE"
        const val ACTION_SKIP = "com.dawainnovation.lens.ACTION_SKIP"
        const val ACTION_SNOOZE = "com.dawainnovation.lens.ACTION_SNOOZE"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "DawaLens:NativeActionReceiverWakeLock"
        )
        wakeLock?.acquire(5000L)

        try {
            val action = intent.action ?: return
            val notificationId = intent.getIntExtra("notificationId", 0)
            val reminderId = intent.getStringExtra("reminderId") ?: ""
            val medicineName = intent.getStringExtra("medicineName") ?: "Medication"
            val dose = intent.getStringExtra("dose") ?: ""
            val scheduledTime = intent.getStringExtra("scheduledTime") ?: ""
            val patientId = intent.getStringExtra("patientId")
            val extraStr = intent.getStringExtra("extra") ?: ""

            // 1. Immediately dismiss the notification from system drawer
            if (notificationId != 0) {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                nm?.cancel(notificationId)
            }

            val now = System.currentTimeMillis()
            val isoUtcFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val nowIso = isoUtcFormat.format(Date(now))
            val effectiveScheduledIso = if (scheduledTime.isNotEmpty()) scheduledTime else nowIso

            val dbPath = context.getDatabasePath("dawa_lens.db")
            if (dbPath.exists()) {
                var db: SQLiteDatabase? = null
                try {
                    db = SQLiteDatabase.openDatabase(
                        dbPath.absolutePath, null, SQLiteDatabase.OPEN_READWRITE
                    )

                    when (action) {
                        ACTION_TAKE -> {
                            val logId = "take-${now}-${(1000..9999).random()}"
                            db.execSQL(
                                """INSERT INTO dose_logs 
                                   (id, reminder_id, medicine_name, dose, scheduled_time, action_time, action, is_snoozed, snooze_until, patient_id) 
                                   VALUES (?, ?, ?, ?, ?, ?, 'taken', 0, NULL, ?)""",
                                arrayOf(logId, reminderId, medicineName, dose, effectiveScheduledIso, nowIso, patientId)
                            )

                            // Automatically decrement medicine stock if linked
                            if (reminderId.isNotEmpty()) {
                                try {
                                    db.execSQL(
                                        """UPDATE medicines 
                                           SET current_quantity = MAX(0, current_quantity - dosage_per_dose),
                                               updated_at = ?
                                           WHERE id = (SELECT medicine_id FROM reminders WHERE id = ?)""",
                                        arrayOf(nowIso, reminderId)
                                    )
                                } catch (e: Exception) {
                                    Log.w(TAG, "Failed to decrement medicine stock: ${e.message}")
                                }
                            }
                            Log.i(TAG, "Logged dose TAKE for $medicineName ($reminderId)")
                        }

                        ACTION_SKIP -> {
                            val logId = "skip-${now}-${(1000..9999).random()}"
                            db.execSQL(
                                """INSERT INTO dose_logs 
                                   (id, reminder_id, medicine_name, dose, scheduled_time, action_time, action, is_snoozed, snooze_until, patient_id) 
                                   VALUES (?, ?, ?, ?, ?, ?, 'skipped', 0, NULL, ?)""",
                                arrayOf(logId, reminderId, medicineName, dose, effectiveScheduledIso, nowIso, patientId)
                            )
                            Log.i(TAG, "Logged dose SKIP for $medicineName ($reminderId)")
                        }

                        ACTION_SNOOZE -> {
                            val snoozeDurationMs = 15L * 60L * 1000L // 15 minutes
                            val snoozeEpoch = now + snoozeDurationMs
                            val snoozeIso = isoUtcFormat.format(Date(snoozeEpoch))
                            val logId = "snooze-${now}-${(1000..9999).random()}"

                            db.execSQL(
                                """INSERT INTO dose_logs 
                                   (id, reminder_id, medicine_name, dose, scheduled_time, action_time, action, is_snoozed, snooze_until, patient_id) 
                                   VALUES (?, ?, ?, ?, ?, ?, 'snoozed', 1, ?, ?)""",
                                arrayOf(logId, reminderId, medicineName, dose, effectiveScheduledIso, nowIso, snoozeIso, patientId)
                            )

                            // Schedule native snooze alarm for 15 minutes later
                            scheduleSnoozeAlarm(
                                context,
                                reminderId,
                                medicineName,
                                dose,
                                snoozeEpoch,
                                effectiveScheduledIso,
                                patientId,
                                extraStr
                            )
                            Log.i(TAG, "Logged dose SNOOZE for $medicineName ($reminderId) until $snoozeIso")
                        }
                    }
                } catch (dbErr: Exception) {
                    Log.e(TAG, "Database operation failed for action $action: ${dbErr.message}", dbErr)
                } finally {
                    try { db?.close() } catch (e: Exception) {}
                }
            } else {
                Log.w(TAG, "dawa_lens.db not found; proceeding with fallback action execution")
                if (action == ACTION_SNOOZE) {
                    val snoozeEpoch = now + (15L * 60L * 1000L)
                    scheduleSnoozeAlarm(
                        context,
                        reminderId,
                        medicineName,
                        dose,
                        snoozeEpoch,
                        effectiveScheduledIso,
                        patientId,
                        extraStr
                    )
                }
            }
        } finally {
            if (wakeLock?.isHeld == true) {
                try {
                    wakeLock.release()
                } catch (e: Exception) {}
            }
        }
    }

    private fun scheduleSnoozeAlarm(
        context: Context,
        reminderId: String,
        medicineName: String,
        dose: String,
        snoozeEpoch: Long,
        scheduledTime: String,
        patientId: String?,
        extraStr: String
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val snoozeId = Math.abs(("${reminderId}_snooze_${snoozeEpoch}").hashCode() % 2147483647) + 1

        val updatedExtra = try {
            val obj = if (extraStr.isNotEmpty()) JSONObject(extraStr) else JSONObject()
            obj.put("type", "reminder")
            obj.put("reminderId", reminderId)
            obj.put("medicineName", medicineName)
            obj.put("dose", dose)
            obj.put("scheduledTime", scheduledTime)
            obj.put("isSnoozed", true)
            if (patientId != null) obj.put("patientId", patientId)
            obj.toString()
        } catch (e: Exception) {
            extraStr
        }

        val alarmIntent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra("notificationId", snoozeId)
            putExtra("title", "Snoozed: $medicineName")
            putExtra("body", if (dose.isNotEmpty()) "Time to take your $dose dose of $medicineName" else "Time to take your $medicineName")
            putExtra("extra", updatedExtra)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            snoozeId,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val showIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_id", snoozeId)
            putExtra("notification_extra", updatedExtra)
        }
        val showPendingIntent = PendingIntent.getActivity(
            context,
            snoozeId,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        var scheduled = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                val alarmClockInfo = AlarmManager.AlarmClockInfo(snoozeEpoch, showPendingIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                scheduled = true
            } catch (e: Exception) {
                Log.w(TAG, "setAlarmClock failed for snooze: ${e.message}")
            }
        }

        if (!scheduled) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        snoozeEpoch,
                        pendingIntent
                    )
                } else {
                    alarmManager.setExact(
                        AlarmManager.RTC_WAKEUP,
                        snoozeEpoch,
                        pendingIntent
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to schedule exact snooze alarm: ${e.message}")
            }
        }
    }
}
