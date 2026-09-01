package com.dawainnovation.lens

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
        private const val LEGACY_CHANNEL_ID = "dawa_reminders"
    }

    override fun onReceive(context: Context, intent: Intent) {
        // Acquire a temporary WakeLock to keep CPU running during SQLite verification & notification posting
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "DawaLens:AlarmReceiverWakeLock"
        )
        wakeLock?.acquire(5000L) // 5 second timeout safety

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

            // 1. If this is a routine medicine reminder (not a standalone event), verify with SQLite database
            if (!isEventNotification && reminderId.isNotEmpty()) {
                val dbPath = context.getDatabasePath("dawa_lens.db")
                if (dbPath.exists()) {
                    try {
                        val db = android.database.sqlite.SQLiteDatabase.openDatabase(
                            dbPath.absolutePath, null, android.database.sqlite.SQLiteDatabase.OPEN_READONLY
                        )

                        // Check if reminder still exists and is enabled
                        val reminderCursor = db.rawQuery(
                            "SELECT id, enabled FROM reminders WHERE id = ? LIMIT 1",
                            arrayOf(reminderId)
                        )
                        val exists = reminderCursor.moveToFirst()
                        val isEnabled = if (exists) reminderCursor.getInt(reminderCursor.getColumnIndexOrThrow("enabled")) == 1 else false
                        reminderCursor.close()

                        if (!exists || !isEnabled) {
                            db.close()
                            // Silent return: reminder was deleted or turned off
                            return
                        }

                        // Check if dose was already taken early for this scheduled slot
                        if (scheduledTime.isNotEmpty()) {
                            val dosePrefix = if (scheduledTime.length >= 16) scheduledTime.substring(0, 16) else scheduledTime
                            val doseCursor = db.rawQuery(
                                """SELECT id FROM dose_logs 
                                   WHERE reminder_id = ? 
                                     AND scheduled_time LIKE ? 
                                     AND action IN ('taken', 'skipped') 
                                   LIMIT 1""",
                                arrayOf(reminderId, "$dosePrefix%")
                            )
                            val alreadyTaken = doseCursor.moveToFirst()
                            doseCursor.close()

                            if (alreadyTaken) {
                                db.close()
                                // User already took or skipped this dose early; skip alarm
                                return
                            }
                        }

                        db.close()
                    } catch (dbErr: Exception) {
                        // Non-fatal DB read error — proceed with alarm delivery
                    }
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
        } finally {
            if (wakeLock?.isHeld == true) {
                try {
                    wakeLock.release()
                } catch (e: Exception) {}
            }
        }
    }
}
