import { startOfDay, endOfDay, isAfter, isBefore } from "date-fns";
import { toDate } from "./utils";
import type { Reminder, DoseLog } from "@/contexts/AppContext";

/**
 * Converts a "HH:mm" 24h string into total minutes from midnight (0..1439).
 */
export function timeStrToMinutes(timeStr: string): number {
  const parts = (timeStr || "").trim().split(":");
  if (parts.length !== 2) return 0;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return ((h * 60 + m) % 1440 + 1440) % 1440;
}

/**
 * Converts total minutes from midnight into a normalized "HH:mm" string.
 */
export function minutesToTimeStr(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Parses and validates a comma-separated list of "HH:mm" time strings.
 */
export function parseReminderTimes(timeStr: string): string[] {
  if (!timeStr) return [];
  return timeStr
    .split(",")
    .map((t) => t.trim())
    .filter((t) => {
      const parts = t.split(":");
      if (parts.length !== 2) return false;
      const [h, m] = parts.map(Number);
      return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
    });
}

/**
 * Computes the interval in minutes between slot `fromIndex` and slot `toIndex`.
 * Handles wrap-around midnight naturally.
 */
export function getInterSlotInterval(
  times: string[],
  fromIndex: number,
  toIndex: number
): number {
  if (times.length <= 1) return 24 * 60;
  const fromMins = timeStrToMinutes(times[fromIndex]);
  const toMins = timeStrToMinutes(times[toIndex]);
  let diff = toMins - fromMins;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/**
 * Finds the slot index that corresponds to the given scheduled datetime or time string.
 * Uses exact match first, then falls back to nearest minute proximity.
 */
export function findSlotIndexForTime(
  times: string[],
  scheduledDateOrStr: Date | string
): number {
  if (times.length === 0) return -1;
  const dateObj =
    typeof scheduledDateOrStr === "string"
      ? toDate(scheduledDateOrStr)
      : scheduledDateOrStr;

  const targetHHmm = `${dateObj.getHours().toString().padStart(2, "0")}:${dateObj
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  const exactIdx = times.indexOf(targetHHmm);
  if (exactIdx !== -1) return exactIdx;

  const targetMins = dateObj.getHours() * 60 + dateObj.getMinutes();
  let minDiff = Infinity;
  let bestIdx = 0;

  times.forEach((t, i) => {
    const slotMins = timeStrToMinutes(t);
    let diff = Math.abs(slotMins - targetMins);
    if (diff > 12 * 60) diff = 24 * 60 - diff;
    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = i;
    }
  });

  return bestIdx;
}

/**
 * Calculates new reminder times when a dose is taken at `actualTakeTime`
 * instead of its scheduled slot `slotIndex`.
 *
 * Rules:
 * - Computes the time deviation between the actual take time and the scheduled slot.
 * - Updates the taken slot to `actualTakeTime`.
 * - Shifts all other slots by the same offset, strictly preserving the equal time spacing
 *   between all doses throughout the entire repeating daily schedule.
 */
export function calculateDynamicSchedule(
  times: string[],
  slotIndex: number,
  actualTakeTime: Date
): {
  newTimes: string[];
  newTimeStr: string;
  hasChanges: boolean;
  adjustedSubsequentCount: number;
} {
  if (times.length === 0 || slotIndex < 0 || slotIndex >= times.length) {
    return {
      newTimes: times,
      newTimeStr: times.join(","),
      hasChanges: false,
      adjustedSubsequentCount: 0,
    };
  }

  const actualMinutes =
    actualTakeTime.getHours() * 60 + actualTakeTime.getMinutes();
  const N = times.length;
  const intervalMinutes = Math.round((24 * 60) / N);

  const newTimes = times.map((_, idx) => {
    if (idx === slotIndex) {
      return minutesToTimeStr(actualMinutes);
    }
    const slotMins = actualMinutes + (idx - slotIndex) * intervalMinutes;
    return minutesToTimeStr(slotMins);
  });

  const newTimeStr = newTimes.join(",");
  const hasChanges = newTimeStr !== times.join(",");
  const adjustedSubsequentCount = times.length - 1;

  return {
    newTimes,
    newTimeStr,
    hasChanges,
    adjustedSubsequentCount,
  };
}

/**
 * Checks if a specific reminder slot has already been logged (taken, skipped, or missed)
 * on a given date (defaults to today).
 */
export function isSlotActionedOnDate(
  reminderId: string,
  slotBaseTime: string,
  slotIndex: number,
  doseLogs: DoseLog[],
  targetDate: Date = new Date()
): DoseLog | undefined {
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  const targetSlotMins = timeStrToMinutes(slotBaseTime);

  return doseLogs.find((log) => {
    if (log.reminderId !== reminderId) return false;
    const actionDate = toDate(log.actionTime);
    if (!isAfter(actionDate, dayStart) || !isBefore(actionDate, dayEnd)) {
      return false;
    }

    // Match by scheduledTime if available
    if (log.scheduledTime) {
      const scheduledDate = toDate(log.scheduledTime);
      const scheduledMins = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
      let diff = Math.abs(scheduledMins - targetSlotMins);
      if (diff > 12 * 60) diff = 24 * 60 - diff;
      if (diff <= 30) return true; // match within 30 min window of that slot
    }

    return false;
  });
}
