package com.dawainnovation.lens

import android.content.Context
import android.net.Uri
import android.os.Build
import org.json.JSONObject

/**
 * SoundPrefsReader — reads user sound preferences persisted by the Option-A bridge
 * (NativeAlarmPlugin.saveSoundPrefs → SharedPreferences "dawa_sound_prefs").
 *
 * Callable from AlarmReceiver and MissedDoseWorker (both run without the WebView alive)
 * so they can apply the correct custom WAV sound even when the app is killed, backgrounded,
 * or the device is fully offline.
 *
 * Preference keys mirror the TypeScript SoundCategoryKey type:
 *   "medication" | "hydration" | "quotes" | "taken" | "skipped" | "missed" | "refill"
 *
 * Values are Android raw resource names WITHOUT extension, e.g.:
 *   "mixkit_bell_notification_933"
 * A value of "default" means use the system default ringtone.
 * An empty string means silent (no sound).
 */
object SoundPrefsReader {

    private const val PREFS_NAME = "dawa_sound_prefs"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_CATEGORIES = "categories"

    /** Category → raw resource name mapping. Matches DEFAULT_SOUND_PREFERENCES in soundService.ts. */
    val DEFAULTS = mapOf(
        "medication" to "mixkit_software_interface_start_2574",
        "hydration"  to "mixkit_long_pop_2358",
        "quotes"     to "mixkit_uplifting_flute_notification_2317",
        "taken"      to "mixkit_positive_notification_951",
        "skipped"    to "mixkit_software_interface_back_2575",
        "missed"     to "mixkit_urgent_simple_tone_loop_2976",
        "refill"     to "mixkit_guitar_notification_alert_2320"
    )

    /** Notification type → SoundCategoryKey mapping (mirrors AlarmReceiver channel routing). */
    val TYPE_TO_CATEGORY = mapOf(
        "reminder"          to "medication",
        "missed_alert"      to "missed",
        "hydration"         to "hydration",
        "daily_quote"       to "quotes",
        "wellness_nudge"    to "quotes",
        "evening_checkin"   to "quotes",
        "schedule_adjusted" to "quotes",
        "streak"            to "taken",
        "encouragement"     to "taken",
        "weekly_summary"    to "quotes",
        "refill"            to "refill",
        "low_stock"         to "refill",
        "test_alarm"        to "medication"
    )

    /**
     * SharedPreferences backed by Device-Protected Storage so the prefs are readable
     * even before the user unlocks the device (Direct Boot / LOCKED_BOOT_COMPLETED).
     */
    private fun getPrefs(context: Context): android.content.SharedPreferences {
        val ctx = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            context.createDeviceProtectedStorageContext()
        } else {
            context
        }
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /** Returns true if notification sounds are globally enabled by the user. */
    fun isSoundEnabled(context: Context): Boolean =
        getPrefs(context).getBoolean(KEY_ENABLED, true)

    /** Returns true if sound is disabled globally or set to silent for the category. */
    fun isSilent(context: Context, category: String): Boolean {
        if (!isSoundEnabled(context)) return true
        val resource = getResourceNameForCategory(context, category)
        return resource.isEmpty() || resource == "silent"
    }

    /**
     * Returns the Android raw resource name for a given category key.
     * Falls back to the hardcoded default for that category if the preference is not set.
     * Returns empty string if the user chose "silent" or sounds are globally disabled.
     */
    fun getResourceNameForCategory(context: Context, category: String): String {
        if (!isSoundEnabled(context)) return ""
        val prefs = getPrefs(context)
        val categoriesJson = prefs.getString(KEY_CATEGORIES, null)
        if (!categoriesJson.isNullOrEmpty()) {
            try {
                val obj = JSONObject(categoriesJson)
                if (obj.has(category)) {
                    val value = obj.optString(category, "")
                    if (value == "silent") return ""
                    if (value.isNotEmpty()) return value
                }
            } catch (e: Exception) {
                // Fall through to default
            }
        }
        return DEFAULTS[category] ?: "default"
    }

    /**
     * Returns the deterministic sound-hashed NotificationChannel ID for a category.
     * Matches soundService.getChannelIdForCategory and NativeAlarmPlugin.saveSoundPrefs:
     *   "dawa_${category}_silent_v1"
     *   "dawa_${category}_default_v1"
     *   "dawa_${category}_${resourceName}_v1"
     */
    fun getChannelIdForCategory(context: Context, category: String): String {
        val resourceName = getResourceNameForCategory(context, category)
        return when {
            resourceName.isEmpty() || resourceName == "silent" -> "dawa_${category}_silent_v1"
            resourceName == "default" -> "dawa_${category}_default_v1"
            else -> "dawa_${category}_${resourceName}_v1"
        }
    }

    /** Convenience: sound-hashed NotificationChannel ID for a notification type. */
    fun getChannelIdForNotificationType(context: Context, notifType: String): String {
        val category = TYPE_TO_CATEGORY[notifType] ?: "medication"
        return getChannelIdForCategory(context, category)
    }

    /**
     * Returns the Android raw resource name for the notification type parsed from
     * an alarm's extra JSON (e.g. "missed_alert" → "missed" → resource name).
     */
    fun getResourceNameForNotificationType(context: Context, notifType: String): String {
        val category = TYPE_TO_CATEGORY[notifType] ?: "medication"
        return getResourceNameForCategory(context, category)
    }

    /**
     * Builds an android.resource:// Uri for a given raw resource name.
     * Returns null if empty (silent) or "default" — caller should use RingtoneManager then.
     */
    fun buildSoundUri(context: Context, resourceName: String): Uri? {
        if (resourceName.isEmpty() || resourceName == "silent") return null
        if (resourceName == "default") return null
        return Uri.parse("android.resource://${context.packageName}/raw/$resourceName")
    }

    /** Convenience: sound Uri for a notification type, or null if silent/default. */
    fun getSoundUriForNotificationType(context: Context, notifType: String): Uri? {
        val resourceName = getResourceNameForNotificationType(context, notifType)
        return buildSoundUri(context, resourceName)
    }

    /** Convenience: sound Uri for a category key, or null if silent/default. */
    fun getSoundUriForCategory(context: Context, category: String): Uri? {
        val resourceName = getResourceNameForCategory(context, category)
        return buildSoundUri(context, resourceName)
    }

    /**
     * Persists sound preferences to Device-Protected SharedPreferences.
     * Called by NativeAlarmPlugin.saveSoundPrefs() from the JS bridge (Option A).
     */
    fun save(context: Context, enabled: Boolean, categoriesJson: String) {
        getPrefs(context).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putString(KEY_CATEGORIES, categoriesJson)
            .apply()
    }
}
