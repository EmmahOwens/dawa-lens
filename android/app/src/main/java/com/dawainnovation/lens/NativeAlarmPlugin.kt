package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeAlarm")
class NativeAlarmPlugin : Plugin() {

    companion object {
        const val PREFS_NAME = "dawa_alarms"
        const val KEY_SCHEDULE = "dawa_alarm_schedule"
        const val KEY_IDS = "alarm_ids"
    }

    @PluginMethod
    fun scheduleAlarms(call: PluginCall) {
        val notifications = call.getArray("notifications") ?: run {
            call.reject("notifications array is required")
            return
        }

        val ctx = context
        val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val alarmIds = mutableSetOf<String>()

        for (i in 0 until notifications.length()) {
            val item = notifications.getJSONObject(i)
            val id = item.getInt("id")
            val title = item.getString("title")
            val body = item.getString("body")
            val triggerAtMillis = item.getLong("triggerAtMillis")
            val extra = if (item.has("extra")) item.getString("extra") else ""

            val intent = Intent(ctx, AlarmReceiver::class.java).apply {
                putExtra("notificationId", id)
                putExtra("title", title)
                putExtra("body", body)
                putExtra("extra", extra)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                ctx,
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
                // Fallback for Android 12+ when SCHEDULE_EXACT_ALARM permission is not granted
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

            alarmIds.add(id.toString())
        }

        // Persist both the full schedule (for BootReceiver) and the ID set (for cancellation)
        prefs.edit()
            .putString(KEY_SCHEDULE, notifications.toString())
            .putStringSet(KEY_IDS, alarmIds)
            .apply()

        call.resolve()
    }

    @PluginMethod
    fun cancelAllAlarms(call: PluginCall) {
        val ctx = context
        val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val alarmIds = prefs.getStringSet(KEY_IDS, emptySet()) ?: emptySet()

        for (idStr in alarmIds) {
            val id = idStr.toIntOrNull() ?: continue
            val intent = Intent(ctx, AlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                ctx,
                id,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            pendingIntent?.let { alarmManager.cancel(it) }
        }

        prefs.edit().clear().apply()
        call.resolve()
    }

    @PluginMethod
    fun isSupported(call: PluginCall) {
        val result = JSObject()
        result.put("supported", true)
        call.resolve(result)
    }
}
