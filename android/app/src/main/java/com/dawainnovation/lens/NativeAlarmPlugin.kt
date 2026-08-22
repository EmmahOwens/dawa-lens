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
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "NativeAlarm")
class NativeAlarmPlugin : Plugin() {

    companion object {
        const val PREFS_NAME = "dawa_alarms"
        const val KEY_SCHEDULE = "dawa_alarm_schedule"
        const val KEY_IDS = "alarm_ids"
    }

    private fun openAutostartSettingsInternal(ctx: Context): Boolean {
        val packageName = ctx.packageName
        val manufacturer = Build.MANUFACTURER.lowercase()

        val intents = mutableListOf<Intent>()

        when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
                    putExtra("package_name", packageName)
                    putExtra("package_label", "Dawa Lens")
                })
            }
            manufacturer.contains("transsion") || manufacturer.contains("tecno") || manufacturer.contains("infinix") || manufacturer.contains("itel") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.transsion.phonemanager", "com.transsion.phonemanager.shortcut.AutoStartManagementActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.transsion.phonemanager", "com.transsion.phonemanager.battery.view.BatteryOptimizationActivity")
                })
            }
            manufacturer.contains("oppo") || manufacturer.contains("realme") || manufacturer.contains("oneplus") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.oplus.battery", "com.oplus.battery.BatteryMainActivity")
                })
            }
            manufacturer.contains("vivo") || manufacturer.contains("iqoo") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
                })
            }
            manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
                })
            }
            manufacturer.contains("samsung") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.samsung.android.sm_cn", "com.samsung.android.sm.ui.battery.BatteryActivity")
                })
            }
        }

        // Generic fallbacks
        intents.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:$packageName")
        })
        intents.add(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        intents.add(Intent(Settings.ACTION_SETTINGS))

        for (intent in intents) {
            try {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                ctx.startActivity(intent)
                return true
            } catch (e: Exception) {
                // Try next intent
            }
        }
        return false
    }

    private fun openBatteryOptimizationSettingsInternal(ctx: Context): Boolean {
        val packageName = ctx.packageName

        // 1. Try ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS dialog if not already ignored
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
                if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                    val reqIntent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    ctx.startActivity(reqIntent)
                    return true
                }
            } catch (e: Exception) {
                // proceed
            }
        }

        // 2. Try OEM Autostart & background power management
        if (openAutostartSettingsInternal(ctx)) {
            return true
        }

        // 3. Fallback to standard App Details
        return try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
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

        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existingAlarmIds = prefs.getStringSet(KEY_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        val alarmIds = HashSet(existingAlarmIds)

        // Merge schedule JSON array, keeping active future alarms
        val existingScheduleStr = prefs.getString(KEY_SCHEDULE, null)
        val scheduleMap = mutableMapOf<Int, JSONObject>()
        val now = System.currentTimeMillis()

        if (!existingScheduleStr.isNullOrEmpty()) {
            try {
                val existingArray = JSONArray(existingScheduleStr)
                for (j in 0 until existingArray.length()) {
                    val obj = existingArray.getJSONObject(j)
                    val objId = obj.optInt("id", 0)
                    val triggerAt = obj.optLong("triggerAtMillis", 0L)
                    if (objId != 0 && triggerAt > now) {
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
                val id = if (idLong != 0L) (Math.abs(idLong % 2147483647L)).toInt() else item.optInt("id", 0)
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

                // Intent to open app when user clicks the alarm clock info in system UI
                val showIntent = Intent(ctx, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("notification_id", id)
                    putExtra("notification_extra", extra)
                }
                val showPendingIntent = PendingIntent.getActivity(
                    ctx,
                    id,
                    showIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                var scheduledSuccessfully = false

                // 1. Primary Gold Standard: setAlarmClock (wakes from deep Doze, immune to OEM background killers)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    try {
                        val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent)
                        alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                        scheduledSuccessfully = true
                    } catch (e: Exception) {
                        // Fall through to fallback
                    }
                }

                // 2. Secondary Fallback: setExactAndAllowWhileIdle
                if (!scheduledSuccessfully) {
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
                        scheduledSuccessfully = true
                    } catch (e: Exception) {
                        // Fall through to inexact fallback
                    }
                }

                // 3. Final Inexact Fallback: setAndAllowWhileIdle / set
                if (!scheduledSuccessfully) {
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

                alarmIds.add(id.toString())
                scheduleMap[id] = item
            } catch (itemErr: Exception) {
                // Ignore individual item parse error and continue
            }
        }

        try {
            val mergedScheduleArray = JSONArray()
            for (obj in scheduleMap.values) {
                mergedScheduleArray.put(obj)
            }
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
    fun cancelReminderAlarms(call: PluginCall) {
        try {
            val ctx = context
            val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existingScheduleStr = prefs.getString(KEY_SCHEDULE, null)
            val remainingIds = mutableSetOf<String>()
            val remainingSchedule = JSONArray()

            if (!existingScheduleStr.isNullOrEmpty()) {
                val array = JSONArray(existingScheduleStr)
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    val id = item.optInt("id", 0)
                    val extraStr = item.optString("extra", "")
                    var isEvent = false
                    if (extraStr.isNotEmpty()) {
                        try {
                            val extraObj = JSONObject(extraStr)
                            val type = extraObj.optString("type", "")
                            if (type in listOf("encouragement", "streak", "missed_alert", "schedule_adjusted", "wellness_nudge", "hydration", "daily_quote", "evening_checkin", "weekly_summary", "refill", "low_stock")) {
                                isEvent = true
                            }
                        } catch (e: Exception) {}
                    }

                    if (isEvent) {
                        // Preserve event alarms
                        remainingIds.add(id.toString())
                        remainingSchedule.put(item)
                    } else {
                        // Cancel reminder alarm
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
                        } catch (e: Exception) {}
                    }
                }
            }

            prefs.edit()
                .putString(KEY_SCHEDULE, remainingSchedule.toString())
                .putStringSet(KEY_IDS, remainingIds)
                .apply()
        } catch (e: Exception) {
            // ignore
        }
        call.resolve()
    }

    @PluginMethod
    fun cancelAllAlarms(call: PluginCall) {
        val remindersOnly = call.getBoolean("remindersOnly", false) ?: false
        if (remindersOnly) {
            cancelReminderAlarms(call)
            return
        }

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

    @PluginMethod
    fun openAutostartSettings(call: PluginCall) {
        try {
            val launched = openAutostartSettingsInternal(context)
            if (launched) {
                call.resolve()
            } else {
                call.reject("Could not open autostart settings")
            }
        } catch (e: Exception) {
            call.reject("Failed to open autostart settings: ${e.message}", e)
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
