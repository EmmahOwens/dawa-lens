package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import android.os.UserManager
import androidx.core.app.NotificationCompat
import org.json.JSONObject

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_REMINDERS = "dawa_reminders_v2"
        const val CHANNEL_MISSED = "dawa_missed_v2"
        const val CHANNEL_STREAKS = "dawa_streaks_v2"
        const val CHANNEL_QUOTES = "dawa_quotes_v2"
        const val CHANNEL_WELLNESS = "dawa_wellness_v2"
        const val CHANNEL_HYDRATION = "dawa_hydration_v2"
        const val CHANNEL_REFILL = "dawa_refill_v2"
        const val CHANNEL_UPCOMING = "dawa_upcoming_v1"
        private const val LEGACY_CHANNEL_ID = "dawa_reminders"

        // Thread-safe map to prevent double-firing between AlarmManager and AdherenceGuardianService watchdog
        private val recentlyFiredSlots = java.util.concurrent.ConcurrentHashMap<String, Long>()

        fun markSlotFired(reminderId: String, triggerMs: Long): Boolean {
            val key = "$reminderId:${triggerMs / 60_000L}" // minute precision
            val now = System.currentTimeMillis()
            recentlyFiredSlots.entries.removeIf { now - it.value > 1_800_000L } // purge after 30 min
            return recentlyFiredSlots.putIfAbsent(key, now) == null
        }

        /**
         * Direct notification trigger helper usable by AdherenceGuardianService or other background watchdogs.
         */
        fun triggerDirectReminderNotification(
            context: Context,
            reminderId: String,
            medicineName: String,
            dose: String,
            scheduledTimeMs: Long,
            patientId: String? = null
        ) {
            if (!markSlotFired(reminderId, scheduledTimeMs)) {
                return
            }
            val numericId = Math.abs(reminderId.hashCode() % 2147483647).let { if (it == 0) 1 else it }
            val extraJson = org.json.JSONObject().apply {
                put("type", "reminder")
                put("reminderId", reminderId)
                put("medicineName", medicineName)
                put("dose", dose)
                put("scheduledTime", scheduledTimeMs)
                if (patientId != null) put("patientId", patientId)
            }.toString()

            val intent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("notificationId", numericId)
                putExtra("title", "Time for $medicineName")
                val bodyText = if (dose.isNotEmpty()) "Dose: $dose. Remember to take your medicine!" else "You have a scheduled medication dose to take."
                putExtra("body", bodyText)
                putExtra("extra", extraJson)
            }
            context.sendBroadcast(intent)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()

        // Acquire a temporary WakeLock to keep CPU running during verification, notification posting & atomic reschedule
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "DawaLens:AlarmReceiverWakeLock"
        )
        wakeLock?.acquire(20000L) // 20 second timeout: handles slow Transsion/Infinix eMMC I/O

        try {
            val notificationId = intent.getIntExtra("notificationId", 0)
            val extraStr = intent.getStringExtra("extra") ?: ""
            var notifType = ""
            var reminderId = ""
            var medicineName = ""
            var dose = ""
            var scheduledTime = ""
            var patientId: String? = null

            if (extraStr.isNotEmpty()) {
                try {
                    val extraObj = JSONObject(extraStr)
                    notifType = extraObj.optString("type", "")
                    reminderId = extraObj.optString("reminderId", "")
                    medicineName = extraObj.optString("medicineName", "")
                    dose = extraObj.optString("dose", "")
                    scheduledTime = extraObj.optString("scheduledTime", "")
                    if (extraObj.has("patientId") && !extraObj.isNull("patientId")) {
                        patientId = extraObj.optString("patientId")
                    }
                } catch (e: Exception) {
                    // Non-fatal JSON parse error
                }
            }

            val isEventNotification = notifType in listOf(
                "encouragement",
                "streak",
                "missed_alert",
                "schedule_adjusted",
                "wellness_nudge",
                "hydration",
                "daily_quote",
                "evening_checkin",
                "weekly_summary",
                "refill",
                "low_stock"
            )

            val scheduledTimeMs = try {
                scheduledTime.toLongOrNull() ?: 0L
            } catch (e: Exception) { 0L }
            if (scheduledTimeMs > 0L && reminderId.isNotEmpty() && !isEventNotification) {
                if (!markSlotFired(reminderId, scheduledTimeMs)) {
                    // Already handled by watchdog or duplicate broadcast
                    return
                }
            }

            // 1. If this is a routine medicine reminder (not a standalone event), verify with SQLite database & NativeRecurrenceStore
            if (!isEventNotification && reminderId.isNotEmpty()) {
                val userManager = context.getSystemService(Context.USER_SERVICE) as? UserManager
                val isUserUnlocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    userManager?.isUserUnlocked ?: true
                } else true

                val storedReminders = NativeRecurrenceStore.getReminders(context)
                val storeMatch = storedReminders.find { it.id == reminderId }

                var reminderExists = false
                var isExplicitlyDisabled = false
                var isExplicitlyTaken = false
                val dbPath = context.getDatabasePath("dawa_lens.db")

                if (isUserUnlocked && dbPath.exists()) {
                    try {
                        val db = android.database.sqlite.SQLiteDatabase.openDatabase(
                            dbPath.absolutePath, null, android.database.sqlite.SQLiteDatabase.OPEN_READONLY
                        )

                        val reminderCursor = db.rawQuery(
                            "SELECT id, enabled FROM reminders WHERE id = ? LIMIT 1",
                            arrayOf(reminderId)
                        )
                        if (reminderCursor.moveToFirst()) {
                            reminderExists = true
                            val isEnabled = reminderCursor.getInt(reminderCursor.getColumnIndexOrThrow("enabled")) == 1
                            if (!isEnabled) {
                                isExplicitlyDisabled = true
                            }
                        } else {
                            // Row was not found in SQLite reminders table.
                            // DO NOT assume deleted! SQLite may be uninitialized or lagging.
                            // Fall back to authoritative NativeRecurrenceStore in Device-Protected Storage!
                            if (storeMatch != null) {
                                reminderExists = true
                                if (!storeMatch.enabled) isExplicitlyDisabled = true
                            } else {
                                reminderExists = false
                            }
                        }
                        reminderCursor.close()

                        // Check if dose was already taken early for this scheduled slot
                        if (reminderExists && !isExplicitlyDisabled && scheduledTime.isNotEmpty()) {
                            val dosePrefix = if (scheduledTime.length >= 16) scheduledTime.substring(0, 16) else scheduledTime
                            try {
                                val doseCursor = db.rawQuery(
                                    """SELECT id FROM dose_logs 
                                       WHERE reminder_id = ? 
                                         AND scheduled_time LIKE ? 
                                         AND action IN ('taken', 'skipped') 
                                       LIMIT 1""",
                                    arrayOf(reminderId, "$dosePrefix%")
                                )
                                if (doseCursor.moveToFirst()) {
                                    isExplicitlyTaken = true
                                }
                                doseCursor.close()
                            } catch (doseErr: Exception) {
                                // non-fatal dose_logs check
                            }
                        }

                        db.close()
                    } catch (dbErr: Exception) {
                        // Non-fatal DB read error — fallback to NativeRecurrenceStore verification
                        if (storeMatch != null) {
                            reminderExists = true
                            if (!storeMatch.enabled) isExplicitlyDisabled = true
                        } else {
                            reminderExists = false
                        }
                    }
                } else {
                    // Direct Boot (user locked) or DB not created yet: verify via Device-Protected NativeRecurrenceStore
                    if (storeMatch != null) {
                        reminderExists = true
                        if (!storeMatch.enabled) {
                            isExplicitlyDisabled = true
                        }
                    } else {
                        reminderExists = false
                    }
                }

                if (!reminderExists || isExplicitlyDisabled || isExplicitlyTaken) {
                    // Cancel this exact alarm from AlarmManager so it never fires again
                    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                    if (notificationId != 0 && alarmManager != null) {
                        try {
                            val cancelIntent = Intent(context, AlarmReceiver::class.java)
                            val pi = PendingIntent.getBroadcast(
                                context,
                                notificationId,
                                cancelIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                            alarmManager.cancel(pi)
                            pi.cancel()
                        } catch (e: Exception) {}
                    }

                    // Only purge from NativeRecurrenceStore if we are 100% sure it was deleted (absent from store or disabled)
                    if (!reminderExists) {
                        NativeRecurrenceStore.removeReminder(context, reminderId)
                    }

                    // Dismiss any active notification for this ID
                    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                    nm?.cancel(notificationId)

                    return
                }
            }

            val title = intent.getStringExtra("title") ?: "Dawa Lens"
            val body = intent.getStringExtra("body") ?: "Medication reminder"

            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Remove legacy silent channel if present
            try {
                notificationManager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
            } catch (e: Exception) {}

            // Determine target channel
            val channelId = when (notifType) {
                "missed_alert" -> CHANNEL_MISSED
                "streak" -> CHANNEL_STREAKS
                "encouragement", "daily_quote", "weekly_summary" -> CHANNEL_QUOTES
                "wellness_nudge", "evening_checkin" -> CHANNEL_WELLNESS
                "hydration" -> CHANNEL_HYDRATION
                "refill", "low_stock" -> CHANNEL_REFILL
                else -> CHANNEL_REMINDERS
            }

            // Create notification channels on Android O+ (safe & idempotent)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val notifSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

                val alarmAudioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()

                val notifAudioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build()

                // 1. Reminders Channel (High Importance, Alarm Sound, Vibration)
                val reminderChannel = NotificationChannel(
                    CHANNEL_REMINDERS,
                    "Medicine Reminders",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Critical alarms and reminders to take medication"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 500, 200, 500)
                    setSound(alarmSound, alarmAudioAttributes)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(reminderChannel)

                // 2. Missed Dose Channel (High Importance, Alarm Sound, Vibration)
                val missedChannel = NotificationChannel(
                    CHANNEL_MISSED,
                    "Missed Dose Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Urgent alerts when a scheduled medication dose was missed"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                    setSound(alarmSound, alarmAudioAttributes)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(missedChannel)

                // 3. Streaks & Achievements Channel
                val streakChannel = NotificationChannel(
                    CHANNEL_STREAKS,
                    "Achievements & Streaks",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Medication adherence milestones and celebration alerts"
                    enableVibration(true)
                    setSound(notifSound, notifAudioAttributes)
                }
                notificationManager.createNotificationChannel(streakChannel)

                // 4. Quotes & Encouragement Channel
                val quotesChannel = NotificationChannel(
                    CHANNEL_QUOTES,
                    "Health Quotes & Encouragement",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Motivational quotes, daily wisdom, and adherence summaries"
                    setSound(notifSound, notifAudioAttributes)
                }
                notificationManager.createNotificationChannel(quotesChannel)

                // 5. Wellness Channel
                val wellnessChannel = NotificationChannel(
                    CHANNEL_WELLNESS,
                    "Wellness Check-Ins",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Evening health check-ins and wellness log prompts"
                    setSound(notifSound, notifAudioAttributes)
                }
                notificationManager.createNotificationChannel(wellnessChannel)

                // 6. Hydration Channel
                val hydrationChannel = NotificationChannel(
                    CHANNEL_HYDRATION,
                    "Hydration Reminders",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Periodic hydration breaks and water tracking"
                    setSound(notifSound, notifAudioAttributes)
                }
                notificationManager.createNotificationChannel(hydrationChannel)

                // 7. Refill Alerts Channel
                val refillChannel = NotificationChannel(
                    CHANNEL_REFILL,
                    "Refill Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Low stock medication warnings and refill reminders"
                    enableVibration(true)
                    setSound(notifSound, notifAudioAttributes)
                }
                notificationManager.createNotificationChannel(refillChannel)
            }

            // Launch intent when tapped
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("notification_extra", extraStr)
                putExtra("notification_id", notificationId)
            }
            val contentIntent = PendingIntent.getActivity(
                context,
                notificationId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val defaultSoundUri = RingtoneManager.getDefaultUri(
                if (notifType == "missed_alert" || !isEventNotification) RingtoneManager.TYPE_ALARM else RingtoneManager.TYPE_NOTIFICATION
            ) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val isHighPriority = notifType in listOf("missed_alert", "streak", "refill", "low_stock") || !isEventNotification

            // Public privacy-preserving version displayed on secure lock screens
            val publicNotification = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("Medication Reminder")
                .setContentText("You have a scheduled dose to take.")
                .setPriority(if (isHighPriority) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .build()

            val builder = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(if (isHighPriority) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(if (!isEventNotification || notifType == "missed_alert") NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicNotification)
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 500, 200, 500))
                .setSound(defaultSoundUri)

            // Heads-up / Full-screen alert for routine medication alarms & missed dose alerts:
            // Displays prominent floating banner over other apps and on lock screen
            if (!isEventNotification || notifType == "missed_alert") {
                builder.setFullScreenIntent(contentIntent, true)
            }

            // Attach native action buttons for offline headless execution on routine reminders
            if (!isEventNotification && reminderId.isNotEmpty()) {
                val effectiveMedicineName = if (medicineName.isNotEmpty()) medicineName else title.replace("Time for ", "")

                // 1. Take Action
                val takeIntent = Intent(context, NativeActionReceiver::class.java).apply {
                    action = NativeActionReceiver.ACTION_TAKE
                    putExtra("notificationId", notificationId)
                    putExtra("reminderId", reminderId)
                    putExtra("medicineName", effectiveMedicineName)
                    putExtra("dose", dose)
                    putExtra("scheduledTime", scheduledTime)
                    if (patientId != null) putExtra("patientId", patientId)
                    putExtra("extra", extraStr)
                }
                val takePendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId * 10 + 1,
                    takeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(
                    android.R.drawable.ic_menu_agenda,
                    "Mark as Taken",
                    takePendingIntent
                )

                // 2. Skip Action
                val skipIntent = Intent(context, NativeActionReceiver::class.java).apply {
                    action = NativeActionReceiver.ACTION_SKIP
                    putExtra("notificationId", notificationId)
                    putExtra("reminderId", reminderId)
                    putExtra("medicineName", effectiveMedicineName)
                    putExtra("dose", dose)
                    putExtra("scheduledTime", scheduledTime)
                    if (patientId != null) putExtra("patientId", patientId)
                    putExtra("extra", extraStr)
                }
                val skipPendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId * 10 + 2,
                    skipIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    "Skip Dose",
                    skipPendingIntent
                )

                // 3. Snooze Action
                val snoozeIntent = Intent(context, NativeActionReceiver::class.java).apply {
                    action = NativeActionReceiver.ACTION_SNOOZE
                    putExtra("notificationId", notificationId)
                    putExtra("reminderId", reminderId)
                    putExtra("medicineName", effectiveMedicineName)
                    putExtra("dose", dose)
                    putExtra("scheduledTime", scheduledTime)
                    if (patientId != null) putExtra("patientId", patientId)
                    putExtra("extra", extraStr)
                }
                val snoozePendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId * 10 + 3,
                    snoozeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(
                    android.R.drawable.ic_popup_sync,
                    "Snooze (15m)",
                    snoozePendingIntent
                )
            }

            notificationManager.notify(notificationId, builder.build())

            // 2. Promptly calculate and schedule the single next recurrence for this reminder
            if (!isEventNotification && reminderId.isNotEmpty()) {
                rescheduleSuccessorAlarm(context, reminderId, medicineName, dose, patientId)
            }
        } finally {
            if (wakeLock?.isHeld == true) {
                try {
                    wakeLock.release()
                } catch (e: Exception) {}
            }
            try {
                pendingResult.finish()
            } catch (e: Exception) {}
        }
    }

    /**
     * Authoritative atomic successor scheduler.
     * Computes the immediate next dose slot after now + 60s and schedules exactly one alarm.
     */
    private fun rescheduleSuccessorAlarm(
        context: Context,
        reminderId: String,
        medicineName: String,
        dose: String,
        patientId: String?
    ) {
        try {
            // If device is unlocked, verify that the reminder still exists and is enabled in SQLite
            val userManager = context.getSystemService(Context.USER_SERVICE) as? UserManager
            val isUserUnlocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                userManager?.isUserUnlocked ?: true
            } else true

            if (isUserUnlocked) {
                val dbPath = context.getDatabasePath("dawa_lens.db")
                if (dbPath.exists()) {
                    try {
                        val db = android.database.sqlite.SQLiteDatabase.openDatabase(
                            dbPath.absolutePath, null, android.database.sqlite.SQLiteDatabase.OPEN_READONLY
                        )
                        val cursor = db.rawQuery(
                            "SELECT id, enabled FROM reminders WHERE id = ? LIMIT 1",
                            arrayOf(reminderId)
                        )
                        var isExplicitlyDisabledInSqlite = false
                        if (cursor.moveToFirst()) {
                            val isEnabled = cursor.getInt(cursor.getColumnIndexOrThrow("enabled")) == 1
                            if (!isEnabled) {
                                isExplicitlyDisabledInSqlite = true
                            }
                        }
                        cursor.close()
                        db.close()

                        if (isExplicitlyDisabledInSqlite) {
                            NativeRecurrenceStore.removeReminder(context, reminderId)
                            return
                        }
                    } catch (e: Exception) {}
                }
            }

            val storedReminders = NativeRecurrenceStore.getReminders(context)
            val matched = storedReminders.find { it.id == reminderId && it.enabled } ?: return

            val now = System.currentTimeMillis()
            // Look strictly after current dose slot (add 60 seconds buffer)
            val nextTrigger = NativeRecurrenceEngine.computeNextOccurrence(
                matched.toEngineSchedule(),
                now + 60000L
            ) ?: return

            if (nextTrigger <= now) return

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarmManager.canScheduleExactAlarms()
            } else true

            val nextNumericId = Math.abs(reminderId.hashCode() % 2147483647).let { if (it == 0) 1 else it }
            val nextExtra = JSONObject().apply {
                put("type", "reminder")
                put("reminderId", reminderId)
                put("medicineName", medicineName)
                put("dose", dose)
                put("scheduledTime", nextTrigger)
                if (patientId != null) put("patientId", patientId)
            }.toString()

            val nextIntent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("notificationId", nextNumericId)
                putExtra("title", matched.genericTitle)
                putExtra("body", matched.genericBody)
                putExtra("extra", nextExtra)
            }

            val nextPendingIntent = PendingIntent.getBroadcast(
                context,
                nextNumericId,
                nextIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Safe offset that will never overflow signed 32-bit integer
            val safeShowIntentId = (nextNumericId and 0x3FFFFFFF) + 50000

            // Use setAlarmClock() as the primary path for medicine reminders — this is the
            // highest-priority alarm type and is suppressed far less often by OEM battery managers.
            if (canExact && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    val showIntent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    val showPendingIntent = PendingIntent.getActivity(
                        context,
                        safeShowIntentId,
                        showIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    val alarmInfo = AlarmManager.AlarmClockInfo(nextTrigger, showPendingIntent)
                    alarmManager.setAlarmClock(alarmInfo, nextPendingIntent)
                    NativeRecurrenceStore.updateReminderNextTrigger(context, reminderId, nextTrigger)
                    refreshGuardianCountdown(context)
                    return
                } catch (e: Exception) {
                    // Fall through to setExactAndAllowWhileIdle
                }
            }

            // Fallback: setExactAndAllowWhileIdle when exact is granted but setAlarmClock fails
            if (canExact) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            nextTrigger,
                            nextPendingIntent
                        )
                    } else {
                        alarmManager.setExact(
                            AlarmManager.RTC_WAKEUP,
                            nextTrigger,
                            nextPendingIntent
                        )
                    }
                } catch (e: Exception) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            nextTrigger,
                            nextPendingIntent
                        )
                    } else {
                        alarmManager.set(AlarmManager.RTC_WAKEUP, nextTrigger, nextPendingIntent)
                    }
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        nextTrigger,
                        nextPendingIntent
                    )
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, nextTrigger, nextPendingIntent)
                }
            }

            NativeRecurrenceStore.updateReminderNextTrigger(context, reminderId, nextTrigger)
            refreshGuardianCountdown(context)
        } catch (e: Exception) {
            // Non-fatal reschedule failure
        }
    }

    private fun refreshGuardianCountdown(context: Context) {
        try {
            val refreshIntent = Intent(context, AdherenceGuardianService::class.java).apply {
                action = AdherenceGuardianService.ACTION_REFRESH
            }
            context.startService(refreshIntent)
        } catch (e: Exception) {}
    }
}
