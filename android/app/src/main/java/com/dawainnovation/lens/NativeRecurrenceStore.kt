package com.dawainnovation.lens

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native Device-Protected Recurrence Store.
 *
 * Persists the authoritative, sanitized recurrence metadata into Android Device-Protected
 * SharedPreferences. This storage is readable during Direct Boot (LOCKED_BOOT_COMPLETED)
 * before user PIN entry, without attempting to access credential-protected SQLite databases.
 *
 * Privacy & Security:
 * Only opaque reminder IDs, timing intervals, repeat rules, and generic notification wording
 * are stored here. Plaintext clinical medication names and specific dosage instructions
 * remain in credential-protected storage and are enriched once the device is unlocked.
 */
object NativeRecurrenceStore {

    private const val PREFS_NAME = "dawa_authoritative_recurrence"
    private const val KEY_SCHEMA_VERSION = "schema_version"
    private const val KEY_RECURRENCE_DATA = "recurrence_data"
    private const val CURRENT_VERSION = 1

    data class StoredReminder(
        val id: String,
        val time: String,
        val repeatSchedule: String,
        val repeatDays: List<Int>?,
        val enabled: Boolean,
        val createdAt: Long,
        val genericTitle: String = "Medication Reminder",
        val genericBody: String = "You have a scheduled medication dose to take.",
        val lastScheduledTrigger: Long = 0L,
        val patientId: String? = null
    ) {
        fun toEngineSchedule(): NativeRecurrenceEngine.ReminderSchedule {
            return NativeRecurrenceEngine.ReminderSchedule(
                id = id,
                time = time,
                repeatSchedule = repeatSchedule,
                repeatDays = repeatDays,
                enabled = enabled,
                createdAt = createdAt
            )
        }
    }

    fun getDeviceProtectedPrefs(context: Context): SharedPreferences {
        val dpContext = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            context.createDeviceProtectedStorageContext()
        } else {
            context
        }
        return dpContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Atomically stores the list of authoritative reminders in device-protected preferences.
     */
    fun saveReminders(context: Context, reminders: List<StoredReminder>) {
        val prefs = getDeviceProtectedPrefs(context)
        val array = JSONArray()

        for (r in reminders) {
            val obj = JSONObject().apply {
                put("id", r.id)
                put("time", r.time)
                put("repeatSchedule", r.repeatSchedule)
                if (r.repeatDays != null) {
                    put("repeatDays", JSONArray(r.repeatDays))
                }
                put("enabled", r.enabled)
                put("createdAt", r.createdAt)
                put("genericTitle", r.genericTitle)
                put("genericBody", r.genericBody)
                put("lastScheduledTrigger", r.lastScheduledTrigger)
                if (r.patientId != null) {
                    put("patientId", r.patientId)
                }
            }
            array.put(obj)
        }

        prefs.edit()
            .putInt(KEY_SCHEMA_VERSION, CURRENT_VERSION)
            .putString(KEY_RECURRENCE_DATA, array.toString())
            .apply()
    }

    /**
     * Reads all stored reminder configurations from device-protected preferences.
     */
    fun getReminders(context: Context): List<StoredReminder> {
        val prefs = getDeviceProtectedPrefs(context)
        val jsonStr = prefs.getString(KEY_RECURRENCE_DATA, null) ?: return emptyList()

        val list = mutableListOf<StoredReminder>()
        try {
            val array = JSONArray(jsonStr)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isEmpty()) continue

                val repeatDaysList = if (obj.has("repeatDays")) {
                    val daysArr = obj.getJSONArray("repeatDays")
                    (0 until daysArr.length()).map { daysArr.getInt(it) }
                } else null

                list.add(
                    StoredReminder(
                        id = id,
                        time = obj.optString("time", ""),
                        repeatSchedule = obj.optString("repeatSchedule", "daily"),
                        repeatDays = repeatDaysList,
                        enabled = obj.optBoolean("enabled", true),
                        createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
                        genericTitle = obj.optString("genericTitle", "Medication Reminder"),
                        genericBody = obj.optString("genericBody", "You have a scheduled medication dose to take."),
                        lastScheduledTrigger = obj.optLong("lastScheduledTrigger", 0L),
                        patientId = if (obj.has("patientId") && !obj.isNull("patientId")) obj.getString("patientId") else null
                    )
                )
            }
        } catch (e: Exception) {
            // Non-fatal parse fallback
        }
        return list
    }

    /**
     * Updates the last scheduled trigger timestamp for a specific reminder.
     */
    fun updateReminderNextTrigger(context: Context, reminderId: String, nextTriggerAtMillis: Long) {
        val reminders = getReminders(context)
        val updated = reminders.map { r ->
            if (r.id == reminderId) r.copy(lastScheduledTrigger = nextTriggerAtMillis) else r
        }
        saveReminders(context, updated)
    }

    fun clearAll(context: Context) {
        getDeviceProtectedPrefs(context).edit().clear().apply()
    }
}
