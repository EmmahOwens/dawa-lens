package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.os.UserManager
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONArray

/**
 * AdherenceGuardianService
 *
 * Foreground service that provides:
 * 1. Process protection against aggressive OEM battery managers (Transsion XOS, Xiaomi MIUI,
 *    Samsung One UI, Huawei EMUI, Oppo ColorOS, Vivo Funtouch, etc.)
 * 2. An "upcoming alarm" countdown notification showing the next scheduled dose
 *    with a live countdown timer, similar to how native alarm clock apps display
 *    "Alarm in 3h 42m" in the notification bar.
 *
 * The service is auto-started on aggressive OEM devices at boot (via BootReceiver)
 * and on app process creation (via DawaLensApplication). Users can also manually
 * toggle it from the Settings diagnostic center.
 */
class AdherenceGuardianService : Service() {

    companion object {
        const val CHANNEL_ID = "dawa_guardian_v1"
        const val NOTIFICATION_ID = 9901
        const val ACTION_START = "com.dawainnovation.lens.ACTION_START_GUARDIAN"
        const val ACTION_STOP = "com.dawainnovation.lens.ACTION_STOP_GUARDIAN"
        const val ACTION_REFRESH = "com.dawainnovation.lens.ACTION_REFRESH_GUARDIAN"
        const val ACTION_DISMISS = "com.dawainnovation.lens.ACTION_DISMISS_GUARDIAN_NOTIF"

        const val PREFS_NAME = "dawa_guardian_prefs"
        const val KEY_NOTIF_DISMISSED = "guardian_notif_dismissed"
        const val KEY_DISMISSED_TRIGGER = "guardian_dismissed_trigger_ms"

        @Volatile
        var isRunning = false
            private set

        @Volatile
        var dismissedTriggerMs: Long = 0L
            private set

        fun setNotificationDismissedForTrigger(context: Context, triggerMs: Long) {
            dismissedTriggerMs = triggerMs
            try {
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putLong(KEY_DISMISSED_TRIGGER, triggerMs)
                    .putBoolean(KEY_NOTIF_DISMISSED, triggerMs != 0L)
                    .apply()
            } catch (e: Exception) {
                // Ignore storage failure
            }
        }

        fun resetDismissedState(context: Context) {
            dismissedTriggerMs = 0L
            try {
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putLong(KEY_DISMISSED_TRIGGER, 0L)
                    .putBoolean(KEY_NOTIF_DISMISSED, false)
                    .apply()
            } catch (e: Exception) {
                // Ignore storage failure
            }
        }

        fun setNotificationDismissedState(context: Context, dismissed: Boolean) {
            if (!dismissed) {
                resetDismissedState(context)
            } else {
                setNotificationDismissedForTrigger(context, -1L)
            }
        }

        fun isDismissedForTrigger(context: Context, triggerMs: Long?): Boolean {
            if (triggerMs == null || triggerMs <= 0L) {
                return try {
                    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        .getBoolean(KEY_NOTIF_DISMISSED, false)
                } catch (e: Exception) {
                    false
                }
            }
            if (dismissedTriggerMs == triggerMs) return true
            val savedTrigger = try {
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getLong(KEY_DISMISSED_TRIGGER, 0L)
            } catch (e: Exception) {
                0L
            }
            dismissedTriggerMs = savedTrigger
            return savedTrigger == triggerMs
        }

        fun isNotificationDismissed(context: Context): Boolean {
            return isDismissedForTrigger(context, null)
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val countdownRunnable = object : Runnable {
        override fun run() {
            updateUpcomingAlarmNotification()
            handler.postDelayed(this, 60_000L) // Update every 60 seconds
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            handler.removeCallbacks(countdownRunnable)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
            isRunning = false
            setNotificationDismissedState(this, false)
            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_DISMISS) {
            val dismissedTrigger = intent.getLongExtra("dismiss_trigger_ms", -1L)
            setNotificationDismissedForTrigger(this, dismissedTrigger)
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIFICATION_ID)
            if (Build.VERSION.SDK_INT < 34) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(false)
                }
            }
            return START_STICKY
        }

        if (intent?.action == ACTION_REFRESH) {
            if (intent.getBooleanExtra("reset_dismissed", false)) {
                resetDismissedState(this)
            }
            if (!isRunning) {
                startForegroundServiceInternal()
                isRunning = true
                handler.removeCallbacks(countdownRunnable)
                handler.post(countdownRunnable)
            } else {
                updateUpcomingAlarmNotification()
            }
            return START_STICKY
        }

        if (intent?.getBooleanExtra("reset_dismissed", false) == true) {
            resetDismissedState(this)
        }

        startForegroundServiceInternal()
        isRunning = true

        // Start the countdown update loop
        handler.removeCallbacks(countdownRunnable)
        handler.post(countdownRunnable)

        return START_STICKY
    }

    private fun startForegroundServiceInternal() {
        createNotificationChannel()

        val notification = buildNotification(
            contentText = "Monitoring medication schedule...",
            upcomingTriggerMs = null
        )

        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            try {
                startForeground(NOTIFICATION_ID, notification)
            } catch (fallbackErr: Exception) {
                // Non-fatal service start fallback
            }
        }

        // If previously dismissed for current upcoming trigger, suppress notification while keeping service alive
        val stored = NativeRecurrenceStore.getReminders(this)
        var nextTrigger: Long? = null
        val now = System.currentTimeMillis()
        for (r in stored) {
            if (!r.enabled) continue
            val trig = NativeRecurrenceEngine.computeNextOccurrence(r.toEngineSchedule(), now) ?: continue
            if (trig > now && (nextTrigger == null || trig < nextTrigger)) {
                nextTrigger = trig
            }
        }
        if (isDismissedForTrigger(this, nextTrigger)) {
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIFICATION_ID)
            if (Build.VERSION.SDK_INT < 34) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(false)
                }
            }
        }
    }

    /**
     * Queries NativeRecurrenceStore for the next upcoming alarm trigger across all active
     * reminders and updates the persistent notification with a human-readable countdown.
     */
    private fun updateUpcomingAlarmNotification() {
        try {
            var storedReminders = NativeRecurrenceStore.getReminders(this)
            val now = System.currentTimeMillis()

            // If NativeRecurrenceStore has no active reminders, hydrate directly from SQLite database (dawa_lens.db)
            if (storedReminders.none { it.enabled }) {
                val dbPath = getDatabasePath("dawa_lens.db")
                val userManager = getSystemService(Context.USER_SERVICE) as? UserManager
                val isUserUnlocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    userManager?.isUserUnlocked ?: true
                } else true

                if (isUserUnlocked && dbPath.exists()) {
                    try {
                        val db = SQLiteDatabase.openDatabase(dbPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY)
                        val cursor = db.rawQuery(
                            """SELECT id, medicine_name, dose, time, repeat_schedule, repeat_days, enabled, patient_id 
                               FROM reminders 
                               WHERE enabled = 1""",
                            null
                        )
                        val hydrated = mutableListOf<NativeRecurrenceStore.StoredReminder>()
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
                                } catch (e: Exception) { null }
                            } else null

                            val genericTitle = if (medicineName.isNotEmpty()) "Time for $medicineName" else "Medication Reminder"
                            val genericBody = if (dose.isNotEmpty()) "Dose: $dose. Remember to take your medicine!" else "You have a scheduled medication dose to take."

                            hydrated.add(
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
                        db.close()

                        if (hydrated.isNotEmpty()) {
                            NativeRecurrenceStore.saveReminders(this, hydrated)
                            storedReminders = hydrated
                        }
                    } catch (e: Exception) {
                        // Non-fatal SQLite fallback hydration failure
                    }
                }
            }

            var earliestTrigger: Long? = null
            var earliestTitle: String? = null

            for (reminder in storedReminders) {
                if (!reminder.enabled) continue

                // 1. Active Watchdog Check:
                // If AlarmManager was suppressed or delayed by Transsion XOS / MIUI battery managers,
                // the running guardian service detects due doses (within the last 2 minutes) and
                // directly triggers the alarm notification. AlarmReceiver.markSlotFired() guarantees
                // no duplicate alarms if AlarmManager also fires.
                val recentTrigger = NativeRecurrenceEngine.computeNextOccurrence(
                    reminder.toEngineSchedule(), now - 120_000L
                )
                if (recentTrigger != null && recentTrigger <= now && (now - recentTrigger) <= 120_000L) {
                    val medName = reminder.genericTitle.removePrefix("Time for ").trim()
                    val doseStr = reminder.genericBody.substringAfter("Dose: ", "").substringBefore(". Remember")
                    AlarmReceiver.triggerDirectReminderNotification(
                        context = this,
                        reminderId = reminder.id,
                        medicineName = medName,
                        dose = doseStr,
                        scheduledTimeMs = recentTrigger,
                        patientId = reminder.patientId
                    )
                }

                // 2. Compute upcoming future trigger for countdown display
                val nextTrigger = NativeRecurrenceEngine.computeNextOccurrence(
                    reminder.toEngineSchedule(), now
                ) ?: continue
                if (nextTrigger > now && (earliestTrigger == null || nextTrigger < earliestTrigger)) {
                    earliestTrigger = nextTrigger
                    earliestTitle = reminder.genericTitle
                }
            }

            // Check if user has dismissed the notification specifically for this upcoming trigger.
            // When a new dose becomes upcoming (earliestTrigger changes), countdown notification automatically re-appears.
            if (isDismissedForTrigger(this, earliestTrigger)) {
                return
            }

            val contentText = if (earliestTrigger != null && earliestTitle != null) {
                val diff = earliestTrigger - now
                val hours = diff / 3_600_000
                val minutes = (diff % 3_600_000) / 60_000
                val timeStr = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(earliestTrigger))
                val medicineName = earliestTitle.removePrefix("Time for ")

                if (hours > 0) {
                    "Next: $medicineName in ${hours}h ${minutes}m ($timeStr)"
                } else if (minutes > 0) {
                    "Next: $medicineName in ${minutes}m ($timeStr)"
                } else {
                    "Next: $medicineName — imminent ($timeStr)"
                }
            } else {
                "Medication alarms & offline dose reminders are protected"
            }

            val notification = buildNotification(contentText, earliestTrigger)
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            // Non-fatal notification update failure
        }
    }

    /**
     * Builds the foreground notification with optional chronometer countdown.
     * Note: ongoing is set to false, autoCancel is enabled, and a deleteIntent/action
     * is attached so users can dismiss the notification freely for the current dose.
     */
    private fun buildNotification(contentText: String, upcomingTriggerMs: Long?): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val dismissIntent = Intent(this, AdherenceGuardianService::class.java).apply {
            action = ACTION_DISMISS
            if (upcomingTriggerMs != null) {
                putExtra("dismiss_trigger_ms", upcomingTriggerMs)
            }
        }
        val dismissPendingIntent = PendingIntent.getService(
            this,
            NOTIFICATION_ID + 2,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val contentTitle = if (upcomingTriggerMs != null) "Upcoming Medication Dose" else "Dawa Lens Protection Active"

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(contentTitle)
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentIntent(pendingIntent)
            .setDeleteIntent(dismissPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
            .setOngoing(false)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setShowWhen(false)

        // Use system chronometer countdown on API 24+ for real-time countdown
        if (upcomingTriggerMs != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val elapsedTarget = SystemClock.elapsedRealtime() + (upcomingTriggerMs - System.currentTimeMillis())
            builder.setUsesChronometer(true)
            builder.setChronometerCountDown(true)
            builder.setWhen(elapsedTarget)
            builder.setShowWhen(true)
        }

        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Dawa Lens Adherence Protection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps medication adherence monitoring and offline alarms active. Shows countdown to next dose."
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * OEM devices (Xiaomi MIUI, Transsion XOS, Huawei EMUI) can kill foreground services when
     * the user swipes the app from recents. onTaskRemoved() is the last lifecycle hook called
     * before the service dies in this scenario. We schedule a one-shot alarm 5 seconds in the
     * future to restart the service, giving the OEM kill cycle time to complete before we
     * attempt a restart.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        try {
            val restartIntent = Intent(this, AdherenceGuardianService::class.java).apply {
                action = ACTION_START
            }
            val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PendingIntent.getForegroundService(
                    this,
                    NOTIFICATION_ID + 1,
                    restartIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            } else {
                PendingIntent.getService(
                    this,
                    NOTIFICATION_ID + 1,
                    restartIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            }
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            val restartAt = System.currentTimeMillis() + 5000L // 5 second delay
            if (alarmManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        restartAt,
                        pendingIntent
                    )
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, restartAt, pendingIntent)
                }
            }
        } catch (e: Exception) {
            // Non-fatal; service will remain stopped if restart scheduling fails
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(countdownRunnable)
        isRunning = false
        super.onDestroy()
    }
}
