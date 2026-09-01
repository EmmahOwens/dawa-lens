package com.dawainnovation.lens

import java.util.Calendar

/**
 * Authoritative Native Recurrence Engine for Dawa Lens.
 *
 * Replaces client-side static 30-day alarm batching with native, dynamic recurrence
 * calculation. Computes strictly the single next exact trigger time for any active reminder.
 *
 * Convention:
 * - repeatSchedule: "daily" | "weekly" | "custom" | "once"
 * - repeatDays: List of integers [0..6] where 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 *   (matches JavaScript Date.prototype.getDay() exactly).
 * - time: Comma-separated 24-hour time strings, e.g. "08:00, 14:00, 20:00".
 */
object NativeRecurrenceEngine {

    data class ReminderSchedule(
        val id: String,
        val time: String,
        val repeatSchedule: String,
        val repeatDays: List<Int>? = null,
        val enabled: Boolean = true,
        val createdAt: Long = System.currentTimeMillis()
    )

    data class TimeSlot(val hour: Int, val minute: Int)

    /**
     * Parses comma-separated 24-hour time string into sorted TimeSlot instances.
     * e.g. "08:00, 14:30" -> [TimeSlot(8, 0), TimeSlot(14, 30)]
     */
    fun parseTimeSlots(timeString: String): List<TimeSlot> {
        if (timeString.isBlank()) return emptyList()
        return timeString.split(",")
            .map { it.trim() }
            .filter { it.contains(":") }
            .mapNotNull { part ->
                val pieces = part.split(":")
                if (pieces.size >= 2) {
                    val h = pieces[0].toIntOrNull()
                    val m = pieces[1].toIntOrNull()
                    if (h != null && m != null && h in 0..23 && m in 0..59) {
                        TimeSlot(h, m)
                    } else null
                } else null
            }
            .sortedWith(compareBy({ it.hour }, { it.minute }))
    }

    /**
     * Computes strictly the earliest trigger time (epoch ms) after [fromMillis].
     * Returns null if the reminder is disabled or will never fire again (e.g. past one-time reminder).
     */
    fun computeNextOccurrence(reminder: ReminderSchedule, fromMillis: Long): Long? {
        if (!reminder.enabled) return null
        val timeSlots = parseTimeSlots(reminder.time)
        if (timeSlots.isEmpty()) return null

        val scheduleType = reminder.repeatSchedule.lowercase().trim().ifEmpty { "daily" }
        val searchHorizonDays = when (scheduleType) {
            "once" -> 2
            "weekly" -> 21
            else -> 14
        }

        val fromCal = Calendar.getInstance().apply {
            timeInMillis = fromMillis
        }

        var earliestCandidate: Long? = null

        // Evaluate from dayOffset = 0 up to searchHorizonDays
        for (dayOffset in 0..searchHorizonDays) {
            val dayCal = Calendar.getInstance().apply {
                timeInMillis = fromMillis
                add(Calendar.DAY_OF_YEAR, dayOffset)
            }

            // JavaScript getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
            val jsDayOfWeek = dayCal.get(Calendar.DAY_OF_WEEK) - 1

            when (scheduleType) {
                "once" -> {
                    val createdCal = Calendar.getInstance().apply {
                        timeInMillis = if (reminder.createdAt > 0L) reminder.createdAt else fromMillis
                    }
                    val isSameDayAsCreation = dayCal.get(Calendar.ERA) == createdCal.get(Calendar.ERA) &&
                            dayCal.get(Calendar.YEAR) == createdCal.get(Calendar.YEAR) &&
                            dayCal.get(Calendar.DAY_OF_YEAR) == createdCal.get(Calendar.DAY_OF_YEAR)

                    if (!isSameDayAsCreation && dayOffset > 0) {
                        // "once" reminders never recur past their target creation day
                        continue
                    }
                }
                "weekly" -> {
                    val targetDays = if (!reminder.repeatDays.isNullOrEmpty()) {
                        reminder.repeatDays
                    } else {
                        val createdCal = Calendar.getInstance().apply {
                            timeInMillis = if (reminder.createdAt > 0L) reminder.createdAt else fromMillis
                        }
                        listOf(createdCal.get(Calendar.DAY_OF_WEEK) - 1)
                    }
                    if (!targetDays.contains(jsDayOfWeek)) {
                        continue
                    }
                }
                "custom" -> {
                    if (!reminder.repeatDays.isNullOrEmpty()) {
                        if (!reminder.repeatDays.contains(jsDayOfWeek)) {
                            continue
                        }
                    }
                    // If repeatDays is null/empty, custom defaults to daily behavior
                }
                "daily" -> {
                    // Fires every day; no day-of-week filtering
                }
                else -> {
                    // Fallback to daily
                }
            }

            for (slot in timeSlots) {
                val candidateCal = Calendar.getInstance().apply {
                    set(Calendar.ERA, dayCal.get(Calendar.ERA))
                    set(Calendar.YEAR, dayCal.get(Calendar.YEAR))
                    set(Calendar.DAY_OF_YEAR, dayCal.get(Calendar.DAY_OF_YEAR))
                    set(Calendar.HOUR_OF_DAY, slot.hour)
                    set(Calendar.MINUTE, slot.minute)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }

                val candidateMillis = candidateCal.timeInMillis
                if (candidateMillis > fromMillis) {
                    if (earliestCandidate == null || candidateMillis < earliestCandidate) {
                        earliestCandidate = candidateMillis
                    }
                }
            }

            // Once we have found at least one valid candidate in an earlier day, return it
            if (earliestCandidate != null && earliestCandidate <= dayCal.timeInMillis + 86400000L) {
                return earliestCandidate
            }
        }

        return earliestCandidate
    }
}
