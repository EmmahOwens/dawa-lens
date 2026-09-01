package com.dawainnovation.lens

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
 * Persistent Foreground Service that grants the app process a PERCEPTIBLE_APP /
 * foreground OOM priority (oom_score_adj ~200).
 *
 * This immunizes the app from aggressive task killers on Infinix (Transsion XOS),
 * Xiaomi (MIUI/HyperOS), Samsung (One UI), and Oppo/Vivo, preventing the OS
 * from force-stopping the app and wiping AlarmManager alarms when swiped from recents.
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

    override fun onDestroy() {
        isRunning = false
        super.onDestroy()
    }
}
