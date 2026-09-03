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
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * AdherenceGuardianService
 *
 * Optional foreground service that provides user-visible adherence monitoring
 * and active status for users who explicitly opt-in.
 *
 * Note: Local alarms in Dawa Lens rely authoritatively on AlarmManager and
 * device-protected Direct Boot recovery; this foreground service is purely optional
 * and does not claim to override system force-stops or OEM power modes.
 */
class AdherenceGuardianService : Service() {

    companion object {
        const val CHANNEL_ID = "dawa_guardian_v1"
        const val NOTIFICATION_ID = 9901
        const val ACTION_START = "com.dawainnovation.lens.ACTION_START_GUARDIAN"
        const val ACTION_STOP = "com.dawainnovation.lens.ACTION_STOP_GUARDIAN"

        @Volatile
        var isRunning = false
            private set
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
            isRunning = false
            return START_NOT_STICKY
        }

        startForegroundServiceInternal()
        isRunning = true
        return START_STICKY
    }

    private fun startForegroundServiceInternal() {
        createNotificationChannel()

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Dawa Lens Protection Active")
            .setContentText("Medication alarms & offline dose reminders are protected")
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

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
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Dawa Lens Adherence Protection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps medication adherence monitoring and offline alarms active"
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
            val pendingIntent = PendingIntent.getService(
                this,
                NOTIFICATION_ID + 1,
                restartIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
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
        isRunning = false
        super.onDestroy()
    }
}
