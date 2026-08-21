package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
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

    private fun openBatteryOptimizationSettingsInternal(ctx: Context): Boolean {
        val packageName = ctx.packageName

        // 1. Try ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS (system battery optimization list)
        try {
            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(intent)
            return true
        } catch (e: Exception) {
            // continue to fallbacks
        }

        // 2. Try OEM-specific battery management settings if applicable
        val manufacturer = Build.MANUFACTURER.lowercase()
        try {
            when {
                manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") -> {
                    val miuiIntent = Intent().apply {
                        component = ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
                        putExtra("package_name", packageName)
                        putExtra("package_label", "Dawa Lens")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    ctx.startActivity(miuiIntent)
                    return true
                }
                manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                    val huaweiIntent = Intent().apply {
                        component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    ctx.startActivity(huaweiIntent)
                    return true
                }
            }
        } catch (e: Exception) {
            // OEM-specific intent not found, fallback to standard App Details
        }

        // 3. Try ACTION_APPLICATION_DETAILS_SETTINGS (App Info page -> Battery -> Unrestricted)
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(intent)
            return true
        } catch (e: Exception) {
            // continue to general settings
        }

        // 4. Final fallback to system Settings
        return try {
            val intent = Intent(Settings.ACTION_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(intent)
            true
        } catch (e: Exception) {
            false
        }
    }

    @PluginMethod
    fun scheduleAlarms(call: PluginCall) {
        val notifications = call.getArray("notifications") ?: run {
            call.reject("notifications array is required")
            return
        }

        val ctx = context
        val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        var canScheduleExact = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            canScheduleExact = try {
                alarmManager.canScheduleExactAlarms()
            } catch (e: Exception) {
                false
            }
        }

        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existingAlarmIds = prefs.getStringSet(KEY_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        val alarmIds = HashSet(existingAlarmIds)

        // Merge schedule JSON array
        val existingScheduleStr = prefs.getString(KEY_SCHEDULE, null)
        val scheduleMap = mutableMapOf<Int, org.json.JSONObject>()

        if (!existingScheduleStr.isNullOrEmpty()) {
            try {
                val existingArray = org.json.JSONArray(existingScheduleStr)
                for (j in 0 until existingArray.length()) {
                    val obj = existingArray.getJSONObject(j)
                    val objId = obj.optInt("id", 0)
                    if (objId != 0) {
                        scheduleMap[objId] = obj
                    }
                }
            } catch (e: Exception) {
                // ignore
            }
        }

        for (i in 0 until notifications.length()) {
            try {
                val item = notifications.getJSONObject(i)
                val idLong = item.optLong("id", 0L)
                val id = if (idLong != 0L) (idLong % 2147483647).toInt() else item.optInt("id", 0)
                val title = item.optString("title", "Dawa Lens")
                val body = item.optString("body", "Medication reminder")
                val triggerAtMillis = item.optLong("triggerAtMillis", 0L)
                val extra = if (item.has("extra")) item.getString("extra") else ""

                if (triggerAtMillis <= 0L) continue

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
                    if (canScheduleExact) {
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
                    } else {
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
                } catch (e: SecurityException) {
                    // Fallback for Android 12+ when exact alarm permission is not available
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
                scheduleMap[id] = item
            } catch (itemErr: Exception) {
                // Ignore individual item parse error and continue
            }
        }

        try {
            val mergedScheduleArray = org.json.JSONArray()
            for (obj in scheduleMap.values) {
                mergedScheduleArray.put(obj)
            }
            // Persist both the full schedule (for BootReceiver) and the merged ID set (for cancellation)
            prefs.edit()
                .putString(KEY_SCHEDULE, mergedScheduleArray.toString())
                .putStringSet(KEY_IDS, alarmIds)
                .apply()
        } catch (prefsErr: Exception) {
            // Ignore prefs write error
        }

        call.resolve()
    }

    @PluginMethod
    fun cancelAllAlarms(call: PluginCall) {
        try {
            val ctx = context
            val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val alarmIds = prefs.getStringSet(KEY_IDS, emptySet()) ?: emptySet()

            for (idStr in alarmIds) {
                val id = idStr.toIntOrNull() ?: continue
                try {
                    val intent = Intent(ctx, AlarmReceiver::class.java)
                    val pendingIntent = PendingIntent.getBroadcast(
                        ctx,
                        id,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    alarmManager.cancel(pendingIntent)
                    pendingIntent.cancel()
                } catch (cancelErr: Exception) {
                    // ignore individual cancel error
                }
            }

            prefs.edit().clear().apply()
        } catch (e: Exception) {
            // ignore
        }
        call.resolve()
    }

    @PluginMethod
    fun isSupported(call: PluginCall) {
        val result = JSObject()
        result.put("supported", true)
        call.resolve(result)
    }

    @PluginMethod
    fun requestIgnoreBatteryOptimization(call: PluginCall) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
                    try {
                        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                            data = Uri.parse("package:${context.packageName}")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        context.startActivity(intent)
                        call.resolve()
                        return
                    } catch (e1: Exception) {
                        openBatteryOptimizationSettingsInternal(context)
                        call.resolve()
                        return
                    }
                } else {
                    // Already ignoring Doze optimizations, open settings screen so user can verify/set Unrestricted mode
                    openBatteryOptimizationSettingsInternal(context)
                    call.resolve()
                    return
                }
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open battery optimization settings: ${e.message}", e)
        }
    }

    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        try {
            val launched = openBatteryOptimizationSettingsInternal(context)
            if (launched) {
                call.resolve()
            } else {
                call.reject("Could not open device settings")
            }
        } catch (e: Exception) {
            call.reject("Failed to open battery optimization settings: ${e.message}", e)
        }
    }

    /** Returns whether the OS is currently ignoring battery optimizations for this app. */
    @PluginMethod
    fun isBatteryOptimizationIgnored(call: PluginCall) {
        val result = JSObject()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            result.put("ignored", pm.isIgnoringBatteryOptimizations(context.packageName))
        } else {
            result.put("ignored", true)
        }
        call.resolve(result)
    }
}
