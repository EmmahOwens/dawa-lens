package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.os.PowerManager
import android.os.UserManager
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Boot, Direct-Boot, and Permission State Change Receiver.
 *
 * Responsibilities:
 * 1. LOCKED_BOOT_COMPLETED: Device is powered on but locked with PIN/pattern. Credential-protected
 *    storage (SQLite) is inaccessible. Reconstructs and schedules single next alarms strictly
 *    from NativeRecurrenceStore in Device-Protected Storage.
 * 2. USER_UNLOCKED / BOOT_COMPLETED: User has unlocked the device. Credential-protected storage
 *    is available. Reconciles Device-Protected Storage against SQLite (dawa_lens.db), enriches metadata,
 *    and refreshes scheduled alarms.
 * 3. ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED: Responds immediately when exact alarm
 *    permission is granted or revoked in system settings, promoting or demoting alarms dynamically.
 * 4. Re-enqueues the periodic MissedDoseWorker.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_USER_UNLOCKED &&
            action != AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED
        ) return

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "DawaLens:BootReceiverWakeLock"
        )
        wakeLock?.acquire(15000L) // 15 second safety timeout

        try {
            val now = System.currentTimeMillis()
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarmManager.canScheduleExactAlarms()
            } else true

            val userManager = context.getSystemService(Context.USER_SERVICE) as? UserManager
            val isUserUnlocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                userManager?.isUserUnlocked ?: true
            } else true

            // Step 1: If unlocked, reconcile NativeRecurrenceStore with SQLite database if needed
            if (isUserUnlocked && (action == Intent.ACTION_USER_UNLOCKED || action == Intent.ACTION_BOOT_COMPLETED)) {
                reconcileWithSqliteIfUnlocked(context)
            }

            // Step 2: Read active authoritative reminders from Device-Protected Storage
            val storedReminders = NativeRecurrenceStore.getReminders(context)
            for (reminder in storedReminders) {
                if (!reminder.enabled) continue

                val nextTrigger = NativeRecurrenceEngine.computeNextOccurrence(
                    reminder.toEngineSchedule(),
                    now
                ) ?: continue

                if (nextTrigger <= now) continue

                val numericId = Math.abs(reminder.id.hashCode() % 2147483647).let { if (it == 0) 1 else it }
                val extraJson = JSONObject().apply {
                    put("type", "reminder")
                    put("reminderId", reminder.id)
                    put("scheduledTime", nextTrigger)
                    if (reminder.patientId != null) put("patientId", reminder.patientId)
                }.toString()

                scheduleOneAlarm(
                    context = context,
                    alarmManager = alarmManager,
                    id = numericId,
                    triggerAtMillis = nextTrigger,
                    title = reminder.genericTitle,
                    body = reminder.genericBody,
                    extra = extraJson,
                    canExact = canExact
                )

                NativeRecurrenceStore.updateReminderNextTrigger(context, reminder.id, nextTrigger)
            }
        } finally {
            if (wakeLock?.isHeld == true) {
                try {
                    wakeLock.release()
                } catch (e: Exception) {}
            }
        }

        // Step 3: Ensure periodic missed-dose reconciliation worker is enqueued
        try {
            val missedDoseWork = PeriodicWorkRequest.Builder(
                MissedDoseWorker::class.java, 15, TimeUnit.MINUTES
            ).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "missed_dose_check",
                ExistingPeriodicWorkPolicy.KEEP,
                missedDoseWork
            )
        } catch (e: Exception) {
            // Non-fatal WorkManager init
        }
    }

    /**
     * When credential-protected storage is unlocked, verifies that active reminders in SQLite
     * are synchronized with NativeRecurrenceStore.
     */
    private fun reconcileWithSqliteIfUnlocked(context: Context) {
        val dbPath = context.getDatabasePath("dawa_lens.db")
        if (!dbPath.exists()) return

        var db: SQLiteDatabase? = null
        try {
            db = SQLiteDatabase.openDatabase(dbPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY)
            val cursor = db.rawQuery(
                """SELECT id, medicine_name, dose, time, repeat_schedule, repeat_days, enabled, patient_id 
                   FROM reminders 
                   WHERE enabled = 1""",
                null
            )

            val reconciledList = mutableListOf<NativeRecurrenceStore.StoredReminder>()
            while (cursor.moveToNext()) {
                val id = cursor.getString(cursor.getColumnIndexOrThrow("id"))
                val medicineName = cursor.getString(cursor.getColumnIndexOrThrow("medicine_name")) ?: ""
                val dose = cursor.getString(cursor.getColumnIndexOrThrow("dose")) ?: ""
                val timeStr = cursor.getString(cursor.getColumnIndexOrThrow("time")) ?: ""
                val repeatSchedule = cursor.getString(cursor.getColumnIndexOrThrow("repeat_schedule")) ?: "daily"
                val repeatDaysJson = cursor.getString(cursor.getColumnIndexOrThrow("repeat_days"))
                val patientId = cursor.getString(cursor.getColumnIndexOrThrow("patient_id"))

                val repeatDaysList = if (!repeatDaysJson.isNullOrEmpty()) {
                    try {
                        val arr = JSONArray(repeatDaysJson)
                        (0 until arr.length()).map { arr.getInt(it) }
                    } catch (e: Exception) {
                        null
                    }
                } else null

                val genericTitle = if (medicineName.isNotEmpty()) "Time for $medicineName" else "Medication Reminder"
                val genericBody = if (dose.isNotEmpty()) "Dose: $dose. Remember to take your medicine!" else "You have a scheduled medication dose to take."

                reconciledList.add(
                    NativeRecurrenceStore.StoredReminder(
                        id = id,
                        time = timeStr,
                        repeatSchedule = repeatSchedule,
                        repeatDays = repeatDaysList,
                        enabled = true,
                        createdAt = System.currentTimeMillis(),
                        genericTitle = genericTitle,
                        genericBody = genericBody,
                        lastScheduledTrigger = 0L,
                        patientId = patientId
                    )
                )
            }
            cursor.close()

            if (reconciledList.isNotEmpty()) {
                NativeRecurrenceStore.saveReminders(context, reconciledList)
            }
        } catch (e: Exception) {
            // Non-fatal SQLite read error
        } finally {
            try { db?.close() } catch (e: Exception) {}
        }
    }

    private fun scheduleOneAlarm(
        context: Context,
        alarmManager: AlarmManager,
        id: Int,
        triggerAtMillis: Long,
        title: String,
        body: String,
        extra: String,
        canExact: Boolean
    ) {
        if (triggerAtMillis <= 0L) return

        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra("notificationId", id)
            putExtra("title", title)
            putExtra("body", body)
            putExtra("extra", extra)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Use setExactAndAllowWhileIdle if exact alarms are permitted.
        // Fall back gracefully to setAndAllowWhileIdle for degraded inexact timing.
        if (canExact) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    )
                } else {
                    alarmManager.setExact(
                        AlarmManager.RTC_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    )
                }
                return
            } catch (e: SecurityException) {
                // Exact alarm permission not available; fallback to degraded mode
            } catch (e: Exception) {
                // Non-fatal error; fallback to inexact
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }
        } catch (e: Exception) {
            // ignore individual alarm failure
        }
    }
}
