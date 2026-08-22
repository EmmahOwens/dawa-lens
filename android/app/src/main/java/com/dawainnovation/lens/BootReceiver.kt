package com.dawainnovation.lens

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        val now = System.currentTimeMillis()
        val prefs = context.getSharedPreferences("dawa_alarms", Context.MODE_PRIVATE)
        val scheduleJson = prefs.getString("dawa_alarm_schedule", null)

        var rescheduledCount = 0

        if (!scheduleJson.isNullOrEmpty()) {
            try {
                val array = JSONArray(scheduleJson)
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    val id = item.optInt("id", 0)
                    val title = item.optString("title", "Dawa Lens")
                    val body = item.optString("body", "Medication reminder")
                    val triggerAtMillis = item.optLong("triggerAtMillis", 0L)
                    val extra = if (item.has("extra")) item.getString("extra") else ""

                    if (triggerAtMillis > now && id != 0) {
                        scheduleOne(context, id, triggerAtMillis, title, body, extra)
                        rescheduledCount++
                    }
                }
            } catch (e: Exception) {
                // proceed to fallback
            }
        }

        // Fallback: If no schedule was saved in SharedPreferences, rebuild alarms directly from SQLite database
        if (rescheduledCount == 0) {
            val dbPath = context.getDatabasePath("dawa_lens.db")
            if (dbPath.exists()) {
                try {
                    val db = SQLiteDatabase.openDatabase(
                        dbPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY
                    )
                    val cursor = db.rawQuery(
                        """SELECT id, medicine_name, dose, time, repeat_schedule, repeat_days, patient_id 
                           FROM reminders 
                           WHERE enabled = 1""",
                        null
                    )
                    val fallbackSchedule = JSONArray()
                    val fallbackIds = mutableSetOf<String>()

                    val isoUtcFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }

                    while (cursor.moveToNext()) {
                        val reminderId = cursor.getString(cursor.getColumnIndexOrThrow("id"))
                        val medicineName = cursor.getString(cursor.getColumnIndexOrThrow("medicine_name")) ?: "Medication"
                        val dose = cursor.getString(cursor.getColumnIndexOrThrow("dose")) ?: ""
                        val timeStr = cursor.getString(cursor.getColumnIndexOrThrow("time")) ?: ""
                        val repeatSchedule = cursor.getString(cursor.getColumnIndexOrThrow("repeat_schedule")) ?: "daily"
                        val repeatDaysJson = cursor.getString(cursor.getColumnIndexOrThrow("repeat_days"))
                        val patientId = cursor.getString(cursor.getColumnIndexOrThrow("patient_id"))

                        val times = timeStr.split(",").map { it.trim() }.filter { it.contains(":") }

                        for (dayOffset in 0..7) {
                            for (t in times) {
                                val parts = t.split(":")
                                if (parts.size != 2) continue
                                val hour = parts[0].toIntOrNull() ?: continue
                                val min = parts[1].toIntOrNull() ?: continue

                                val cal = Calendar.getInstance()
                                cal.add(Calendar.DAY_OF_YEAR, dayOffset)
                                cal.set(Calendar.HOUR_OF_DAY, hour)
                                cal.set(Calendar.MINUTE, min)
                                cal.set(Calendar.SECOND, 0)
                                cal.set(Calendar.MILLISECOND, 0)

                                val triggerAt = cal.timeInMillis
                                if (triggerAt <= now) continue

                                if (repeatSchedule == "specific_days" && !repeatDaysJson.isNullOrEmpty()) {
                                    try {
                                        val daysArr = JSONArray(repeatDaysJson)
                                        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK) - 1
                                        var matches = false
                                        for (d in 0 until daysArr.length()) {
                                            if (daysArr.getInt(d) == dayOfWeek) {
                                                matches = true
                                                break
                                            }
                                        }
                                        if (!matches) continue
                                    } catch (e: Exception) {}
                                }

                                val scheduledIso = isoUtcFormat.format(Date(triggerAt))
                                val notifId = Math.abs((reminderId + scheduledIso).hashCode() % 2147483640) + 1
                                val title = "Time for $medicineName"
                                val body = "Dose: $dose. Remember to take your medicine!"
                                val extra = JSONObject().apply {
                                    put("reminderId", reminderId)
                                    put("medicineName", medicineName)
                                    put("dose", dose)
                                    put("scheduledTime", scheduledIso)
                                    if (patientId != null) put("patientId", patientId)
                                }.toString()

                                scheduleOne(context, notifId, triggerAt, title, body, extra)

                                val schedObj = JSONObject().apply {
                                    put("id", notifId)
                                    put("title", title)
                                    put("body", body)
                                    put("triggerAtMillis", triggerAt)
                                    put("extra", extra)
                                }
                                fallbackSchedule.put(schedObj)
                                fallbackIds.add(notifId.toString())

                                if (repeatSchedule == "once") break
                            }
                        }
                    }
                    cursor.close()
                    db.close()

                    if (fallbackSchedule.length() > 0) {
                        prefs.edit()
                            .putString("dawa_alarm_schedule", fallbackSchedule.toString())
                            .putStringSet("alarm_ids", fallbackIds)
                            .apply()
                    }
                } catch (e: Exception) {
                    // non-fatal
                }
            }
        }

        // Re-enqueue the missed-dose background worker
        try {
            val missedDoseWork = PeriodicWorkRequest.Builder(
                MissedDoseWorker::class.java, 15, TimeUnit.MINUTES
            ).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "missed_dose_check",
                ExistingPeriodicWorkPolicy.UPDATE,
                missedDoseWork
            )
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

        val showIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_id", id)
            putExtra("notification_extra", extra)
        }
        val showPendingIntent = PendingIntent.getActivity(
            context,
            id,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        var scheduledSuccessfully = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                scheduledSuccessfully = true
            } catch (e: Exception) {
                // fallback
            }
        }

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
                // fallback
            }
        }

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
                // ignore
            }
        }
    }
}
