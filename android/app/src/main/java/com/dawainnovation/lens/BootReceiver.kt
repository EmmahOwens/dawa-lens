package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) return

        val prefs = context.getSharedPreferences("dawa_alarms", Context.MODE_PRIVATE)
        val scheduleJson = prefs.getString("dawa_alarm_schedule", null) ?: return

        try {
            val array = JSONArray(scheduleJson)
            val now = System.currentTimeMillis()

            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                val id = item.getInt("id")
                val title = item.getString("title")
                val body = item.getString("body")
                val triggerAtMillis = item.getLong("triggerAtMillis")
                val extra = if (item.has("extra")) item.getString("extra") else ""

                // Only reschedule alarms that haven't already fired
                if (triggerAtMillis > now) {
                    scheduleOne(context, id, triggerAtMillis, title, body, extra)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun scheduleOne(
        context: Context,
        id: Int,
        triggerAtMillis: Long,
        title: String,
        body: String,
        extra: String
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

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
        } catch (e: SecurityException) {
            // Fallback when SCHEDULE_EXACT_ALARM permission is not granted (Android 12+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }
        }
    }
}
