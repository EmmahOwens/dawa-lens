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
import androidx.core.app.NotificationCompat

import org.json.JSONArray

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        // v2: bumped to force Android to create a new channel with sound.
        // The old "dawa_reminders" channel was silent (no sound was set on it).
        // Android locks channel settings after first creation, so the only
        // fix for existing installs is a new channel ID.
        const val CHANNEL_ID = "dawa_reminders_v2"
        private const val LEGACY_CHANNEL_ID = "dawa_reminders"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val notificationId = intent.getIntExtra("notificationId", 0)

        // Validation guard: check if the notification is still in the active schedule
        val prefs = context.getSharedPreferences("dawa_alarms", Context.MODE_PRIVATE)
        val scheduleJson = prefs.getString("dawa_alarm_schedule", null)
        if (scheduleJson == null) {
            // No active schedule at all (e.g. all reminders deleted or disabled)
            return
        }

        try {
            val array = JSONArray(scheduleJson)
            var reminderExists = false
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                if (item.getInt("id") == notificationId) {
                    reminderExists = true
                    break
                }
            }
            if (!reminderExists) {
                // Silent return: reminder was deleted or rescheduled
                return
            }
        } catch (e: Exception) {
            // Default to showing the notification if parsing fails (fail-safe)
            e.printStackTrace()
        }

        val title = intent.getStringExtra("title") ?: "Dawa Lens"
        val body = intent.getStringExtra("body") ?: "Time to take your medicine"

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Delete the old silent channel so users aren't left with a dead
        // "Medicine Reminders" entry in their system notification settings.
        // deleteNotificationChannel() is a no-op if the channel doesn't exist.
        notificationManager.deleteNotificationChannel(LEGACY_CHANNEL_ID)

        // Create notification channel on Android O+ (safe to call multiple times; no-op if exists)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Medicine Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for medicine reminder alarms"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
                setSound(alarmSound, audioAttributes)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Intent to re-open the app when the notification is tapped
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context,
            notificationId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // On Android O+ sound is controlled by the channel; setSound() is kept for
        // pre-O devices (API < 26) which do not use channels.
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 500, 200, 500))
            .setSound(defaultSoundUri)
            .build()

        notificationManager.notify(notificationId, notification)
    }
}
