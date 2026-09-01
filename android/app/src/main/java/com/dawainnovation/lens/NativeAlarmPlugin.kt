package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
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
        val brand = Build.BRAND.lowercase()
        val pm = ctx.packageManager

        val candidateIntents = mutableListOf<Intent>()

        // 1. Transsion (Infinix, Tecno, itel) - Modern Phone Master + legacy fallbacks
        if (manufacturer.contains("transsion") || manufacturer.contains("tecno") || manufacturer.contains("infinix") || manufacturer.contains("itel") || brand.contains("infinix") || brand.contains("tecno")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.transsion.phonemaster", "com.transsion.phonemaster.shortcut.AutoStartManagementActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.transsion.phonemaster", "com.cyin.himgr.power.PowerManagerActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.transsion.phonemaster", "com.cyin.himgr.battery.BatteryActivity")
            })
            candidateIntents.add(Intent("com.transsion.phonemaster.ACTION_AUTOSTART"))
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.itel.autobootmanager", "com.itel.autobootmanager.activity.AutoBootMgrActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.transsion.phonemanager", "com.transsion.phonemanager.shortcut.AutoStartManagementActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.transsion.phonemanager", "com.transsion.phonemanager.battery.view.BatteryOptimizationActivity")
            })
        }

        // 2. Xiaomi, Redmi, Poco (MIUI, HyperOS)
        if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") || brand.contains("xiaomi") || brand.contains("redmi") || brand.contains("poco")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
            })
            candidateIntents.add(Intent("miui.intent.action.OP_AUTO_START").apply {
                addCategory(Intent.CATEGORY_DEFAULT)
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
                putExtra("package_name", packageName)
                putExtra("package_label", "Dawa Lens")
            })
        }

        // 3. Samsung (One UI)
        if (manufacturer.contains("samsung")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.samsung.android.sm_cn", "com.samsung.android.sm.ui.battery.BatteryActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.AppSleepListActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.samsung.android.app.battery.ui", "com.samsung.android.app.battery.ui.AppBatteryUsageActivity")
            })
        }

        // 4. Huawei & Honor (EMUI / MagicOS)
        if (manufacturer.contains("huawei") || manufacturer.contains("honor") || brand.contains("huawei") || brand.contains("honor")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
            })
        }

        // 5. Oppo & Realme (ColorOS / Realme UI)
        if (manufacturer.contains("oppo") || manufacturer.contains("realme") || brand.contains("realme")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.oplus.battery", "com.oplus.battery.BatteryMainActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity")
            })
        }

        // 6. OnePlus (OxygenOS)
        if (manufacturer.contains("oneplus") || brand.contains("oneplus")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.oplus.battery", "com.oplus.battery.BatteryMainActivity")
            })
        }

        // 7. Vivo & iQOO (Funtouch OS / OriginOS)
        if (manufacturer.contains("vivo") || manufacturer.contains("iqoo") || brand.contains("vivo") || brand.contains("iqoo")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.vivo.abe", "com.vivo.applicationbehaviorengine.ui.ExcessivePowerManagerActivity")
            })
        }

        // 8. Asus (ZenUI / ROG)
        if (manufacturer.contains("asus")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity")
            })
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity")
            })
        }

        // 9. Sony (Xperia)
        if (manufacturer.contains("sony")) {
            candidateIntents.add(Intent().apply {
                component = ComponentName("com.sonymobile.superstamina", "com.sonymobile.superstamina.XperiaBatterySavingSettings")
            })
        }

        // 10. Universal Standard Android Fallbacks
        candidateIntents.add(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        candidateIntents.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:$packageName")
        })
        candidateIntents.add(Intent(Settings.ACTION_SETTINGS))

        // Query PackageManager to find the first candidate that can be resolved
        for (intent in candidateIntents) {
            try {
                val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong())).isNotEmpty()
                } else {
                    @Suppress("DEPRECATION")
                    pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY).isNotEmpty()
                }

                if (resolved || intent.action == Settings.ACTION_APPLICATION_DETAILS_SETTINGS || intent.action == Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS) {
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    ctx.startActivity(intent)
                    return true
                }
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

    private fun getDeviceProtectedPrefs(ctx: Context): android.content.SharedPreferences {
        val storageContext = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ctx.createDeviceProtectedStorageContext()
        } else {
            ctx
        }
        return storageContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
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
        val dpPrefs = getDeviceProtectedPrefs(ctx)

        val existingAlarmIds = prefs.getStringSet(KEY_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        val alarmIds = HashSet(existingAlarmIds)

        // Merge schedule JSON array, keeping active future alarms
        val existingScheduleStr = prefs.getString(KEY_SCHEDULE, null)
            ?: dpPrefs.getString(KEY_SCHEDULE, null)
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
            val scheduleJsonStr = mergedScheduleArray.toString()

            // Save to standard SharedPreferences
            prefs.edit()
                .putString(KEY_SCHEDULE, scheduleJsonStr)
                .putStringSet(KEY_IDS, alarmIds)
                .apply()

            // Save to Device-Protected SharedPreferences for Direct Boot recovery
            dpPrefs.edit()
                .putString(KEY_SCHEDULE, scheduleJsonStr)
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
            val dpPrefs = getDeviceProtectedPrefs(ctx)

            val existingScheduleStr = prefs.getString(KEY_SCHEDULE, null)
                ?: dpPrefs.getString(KEY_SCHEDULE, null)
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

            val remainingStr = remainingSchedule.toString()
            prefs.edit()
                .putString(KEY_SCHEDULE, remainingStr)
                .putStringSet(KEY_IDS, remainingIds)
                .apply()

            dpPrefs.edit()
                .putString(KEY_SCHEDULE, remainingStr)
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
            val dpPrefs = getDeviceProtectedPrefs(ctx)

            val alarmIds = prefs.getStringSet(KEY_IDS, emptySet()) ?: dpPrefs.getStringSet(KEY_IDS, emptySet()) ?: emptySet()

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
            dpPrefs.edit().clear().apply()
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
    fun canScheduleExactAlarms(call: PluginCall) {
        val result = JSObject()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            result.put("canSchedule", alarmManager.canScheduleExactAlarms())
        } else {
            result.put("canSchedule", true)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun openExactAlarmSettings(call: PluginCall) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:${context.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                call.resolve()
                return
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open exact alarm settings: ${e.message}", e)
        }
    }

    @PluginMethod
    fun checkAllPermissions(call: PluginCall) {
        val result = JSObject()
        val ctx = context
        
        // 1. Battery Optimization
        val isBatteryIgnored = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
            pm.isIgnoringBatteryOptimizations(ctx.packageName)
        } else {
            true
        }
        result.put("batteryIgnored", isBatteryIgnored)

        // 2. Exact Alarms
        val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.canScheduleExactAlarms()
        } else {
            true
        }
        result.put("exactAlarmCanSchedule", canExact)

        // 3. Notifications Enabled
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        val notifsEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            nm.areNotificationsEnabled()
        } else {
            true
        }
        result.put("notificationsEnabled", notifsEnabled)

        // 4. Overall status
        result.put("isFullyCompliant", isBatteryIgnored && canExact && notifsEnabled)
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

    @PluginMethod
    fun getDeviceOemInfo(call: PluginCall) {
        val result = JSObject()
        val m = Build.MANUFACTURER.lowercase()
        val b = Build.BRAND.lowercase()
        result.put("manufacturer", Build.MANUFACTURER)
        result.put("brand", Build.BRAND)
        result.put("model", Build.MODEL)
        result.put("isTranssion", m.contains("transsion") || m.contains("infinix") || m.contains("tecno") || m.contains("itel") || b.contains("infinix") || b.contains("tecno"))
        result.put("isXiaomi", m.contains("xiaomi") || m.contains("redmi") || m.contains("poco") || b.contains("xiaomi") || b.contains("redmi") || b.contains("poco"))
        result.put("isSamsung", m.contains("samsung"))
        result.put("isHuawei", m.contains("huawei") || m.contains("honor") || b.contains("huawei") || b.contains("honor"))
        result.put("isOppoRealme", m.contains("oppo") || m.contains("realme") || b.contains("realme"))
        result.put("isOnePlus", m.contains("oneplus") || b.contains("oneplus"))
        result.put("isVivo", m.contains("vivo") || m.contains("iqoo") || b.contains("vivo") || b.contains("iqoo"))
        result.put("isAsus", m.contains("asus"))
        call.resolve(result)
    }

    @PluginMethod
    fun startGuardianService(call: PluginCall) {
        try {
            val ctx = context
            val intent = Intent(ctx, AdherenceGuardianService::class.java).apply {
                action = AdherenceGuardianService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(ctx, intent)
            } else {
                ctx.startService(intent)
            }
            val res = JSObject()
            res.put("running", true)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Failed to start Adherence Guardian service: ${e.message}", e)
        }
    }

    @PluginMethod
    fun stopGuardianService(call: PluginCall) {
        try {
            val ctx = context
            val intent = Intent(ctx, AdherenceGuardianService::class.java).apply {
                action = AdherenceGuardianService.ACTION_STOP
            }
            ctx.startService(intent)
            val res = JSObject()
            res.put("running", false)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Failed to stop Adherence Guardian service: ${e.message}", e)
        }
    }

    @PluginMethod
    fun isGuardianServiceRunning(call: PluginCall) {
        val res = JSObject()
        res.put("running", AdherenceGuardianService.isRunning)
        call.resolve(res)
    }

    @PluginMethod
    fun openAppInfoSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open app info settings: ${e.message}", e)
        }
    }
}
