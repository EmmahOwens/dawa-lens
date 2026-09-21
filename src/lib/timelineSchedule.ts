import { Reminder, DoseLog } from "@/contexts/AppContext";
import { computeShiftOffset } from "@/services/reminderService";
import { toDate } from "@/lib/utils";
import {
  parseReminderTimes,
  findSlotIndexForTime,
  getInterSlotInterval,
  minutesToTimeStr,
  timeStrToMinutes,
} from "@/lib/dynamicSchedule";

/** Build a Date for today (plus optional dayOffset) at HH:mm */
export function todayAt(hhmm: string, dayOffset = 0, baseDate: Date = new Date()): Date {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const now = baseDate;
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    isNaN(h) ? 0 : h,
    isNaN(m) ? 0 : m,
    0,
    0
  );
}

/**
 * Resolves a grouping key for a reminder representing the medication track for a patient.
 * Reminders sharing the same patient and medicine (either by normalized name or medicineId)
 * belong to the same medication regimen.
 */
export function getMedicationKey(r: Reminder): string {
  const patientKey = (r.patientId || "owner").trim();
  const medId = (r.medicineId || "").trim();
  const cleanName = (r.medicineName || "").trim().toLowerCase();
  return `${patientKey}:${medId || cleanName || r.id}`;
}

export function getLogMinutes(log: DoseLog): number | null {
  if (log.scheduledTime) {
    const trimmed = log.scheduledTime.trim();
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      return timeStrToMinutes(trimmed);
    }
    const d = toDate(trimmed);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }
  if (log.actionTime) {
    const d = toDate(log.actionTime);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }
  return null;
}

export function getCircularDiffMinutes(m1: number, m2: number): number {
  let diff = Math.abs(m1 - m2);
  if (diff > 12 * 60) diff = 24 * 60 - diff;
  return diff;
}

export interface TimelineSlotEntry {
  reminder: Reminder;
  slotIndex: number;
  baseTime: string;       // original HH:mm from reminder.time
  displayTime: string;    // effective time (shifted if applicable)
  scheduledDate: Date;    // accurate Date object for day-aware chronological sorting
  scheduledISO: string;   // ISO datetime to store in the dose log
  offsetMinutes: number;
  log: DoseLog | undefined;
  isActioned: boolean;
}

export interface DailyTimelineResult {
  slots: TimelineSlotEntry[];
  overallNextSlot: TimelineSlotEntry | null;
  activeSlotPerReminder: Map<string, TimelineSlotEntry>;
}

/**
 * Computes chronological daily timeline slots, matching logs and dynamic schedule adjustments.
 * Identifies the overall next dose slot across all active reminders.
 */
export function computeDailyTimelineSlots(
  reminders: Reminder[],
  doseLogs: DoseLog[],
  now: Date = new Date()
): DailyTimelineResult {
  const slots: TimelineSlotEntry[] = [];
  const claimedLogIds = new Set<string>();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayNum = now.getDay();
  const todayStr = now.toDateString();

  const activeReminders = [...reminders].filter((r) => {
    if (!r.enabled) return false;

    // 1. Filter out 'once' reminders if already completed on a previous day
    if (r.repeatSchedule === "once") {
      const createdDate = r.createdAt ? toDate(r.createdAt) : now;
      const isCreatedBeforeToday = createdDate.getTime() < todayStart.getTime();

      const previousDayLog = doseLogs.some((l) => {
        if (l.reminderId !== r.id) return false;
        if (!["taken", "skipped", "missed"].includes(l.action)) return false;
        const logDate = toDate(l.actionTime || l.scheduledTime);
        return logDate.getTime() < todayStart.getTime();
      });

      if (previousDayLog) {
        const hasTodayLog = doseLogs.some((l) => {
          if (l.reminderId !== r.id) return false;
          const logDate = toDate(l.actionTime || l.scheduledTime);
          return logDate.toDateString() === todayStr;
        });
        if (!hasTodayLog) return false;
      }

      if (isCreatedBeforeToday && previousDayLog) return false;
    }

    // 2. Filter out custom reminders if today is not in repeatDays
    if (r.repeatSchedule === "custom" && r.repeatDays && r.repeatDays.length > 0) {
      if (!r.repeatDays.includes(todayNum)) return false;
    }

    // 3. Filter out weekly reminders if today is not the scheduled day
    if (r.repeatSchedule === "weekly") {
      if (r.repeatDays && r.repeatDays.length > 0) {
        if (!r.repeatDays.includes(todayNum)) return false;
      } else {
        const createdDate = r.createdAt ? toDate(r.createdAt) : now;
        const createdDay = isNaN(createdDate.getTime()) ? todayNum : createdDate.getDay();
        if (createdDay !== todayNum) return false;
      }
    }

    return true;
  });

  activeReminders.forEach((r) => {
    const times = parseReminderTimes(r.time);
    if (times.length === 0) return;
    const offsetMinutes = computeShiftOffset(r, doseLogs);

    // Determine taken slot index from today's logs
    let takenSlotIndex = -1;
    const todayTakenLog = [...doseLogs]
      .filter((l) => {
        if (l.reminderId !== r.id || l.action !== "taken") return false;
        const logDate = toDate(l.actionTime || l.scheduledTime);
        return logDate.toDateString() === todayStr;
      })
      .sort((a, b) => toDate(b.actionTime).getTime() - toDate(a.actionTime).getTime())[0];

    if (todayTakenLog) {
      takenSlotIndex = findSlotIndexForTime(
        times,
        todayTakenLog.scheduledTime || todayTakenLog.actionTime
      );
    }

    // Pre-compute base dayOffset for each slot to handle midnight crossings.
    // When consecutive slots in a reminder cross midnight (e.g. 23:00 → 07:00),
    // the later-indexed slot belongs to the next calendar day.
    const baseDayOffsets: number[] = new Array(times.length).fill(0);
    for (let i = 1; i < times.length; i++) {
      const prevMins = timeStrToMinutes(times[i - 1]);
      const currMins = timeStrToMinutes(times[i]);
      baseDayOffsets[i] = baseDayOffsets[i - 1] + (currMins <= prevMins ? 1 : 0);
    }

    times.forEach((baseTime, idx) => {
      let displayTime = baseTime;
      let slotOffset = 0;
      let dayOffset = baseDayOffsets[idx];

      if (todayTakenLog && takenSlotIndex !== -1 && idx > takenSlotIndex) {
        let cumulativeInterval = 0;
        for (let s = takenSlotIndex; s < idx; s++) {
          cumulativeInterval += getInterSlotInterval(times, s, s + 1);
        }
        const actualTakeDate = toDate(todayTakenLog.actionTime);
        const totalMins =
          actualTakeDate.getHours() * 60 +
          actualTakeDate.getMinutes() +
          cumulativeInterval;

        dayOffset = Math.floor(totalMins / 1440);
        displayTime = minutesToTimeStr(totalMins);

        let diff = timeStrToMinutes(displayTime) - timeStrToMinutes(baseTime);
        if (diff > 12 * 60) diff -= 24 * 60;
        if (diff < -12 * 60) diff += 24 * 60;
        slotOffset = diff;
      } else if (todayTakenLog && idx === takenSlotIndex) {
        slotOffset = offsetMinutes;
      }

      const scheduledDate = todayAt(displayTime, dayOffset, now);
      const scheduledISO = scheduledDate.toISOString();
      const slotISO = todayAt(baseTime, baseDayOffsets[idx], now).toISOString();

      // Find matching log for this slot, prioritizing terminal actions over snoozed and sorting by latest actionTime
      const candidateLogs = doseLogs
        .filter((l) => {
          if (l.reminderId !== r.id) return false;
          if (claimedLogIds.has(l.id)) return false;
          const lDate = toDate(l.scheduledTime || l.actionTime);
          return (
            lDate.toDateString() === todayStr ||
            lDate.toDateString() === scheduledDate.toDateString()
          );
        })
        .sort((a, b) => {
          const terminalA = ["taken", "skipped", "missed"].includes(a.action) ? 1 : 0;
          const terminalB = ["taken", "skipped", "missed"].includes(b.action) ? 1 : 0;
          if (terminalA !== terminalB) return terminalB - terminalA;
          return toDate(b.actionTime).getTime() - toDate(a.actionTime).getTime();
        });

      const log = candidateLogs.find((l) => {
        if (l.scheduledTime === slotISO || l.scheduledTime === scheduledISO) return true;

        const logMins = getLogMinutes(l);
        if (logMins === null) return false;

        // If reminder only has 1 slot, any unclaimed log for this reminder on this date matches
        if (times.length === 1) return true;

        // For multi-slot reminders, verify this slot is the closest among all slots of the reminder
        const thisSlotDiff = getCircularDiffMinutes(timeStrToMinutes(baseTime), logMins);
        const isClosestSlot = times.every((otherTime, otherIdx) => {
          if (otherIdx === idx) return true;
          const otherDiff = getCircularDiffMinutes(timeStrToMinutes(otherTime), logMins);
          return thisSlotDiff <= otherDiff;
        });

        return isClosestSlot;
      });

      if (log) {
        claimedLogIds.add(log.id);
      }

      const isTaken = log?.action === "taken";
      const isSkipped = log?.action === "skipped";
      const isMissed = log?.action === "missed";
      const isActioned = isTaken || isSkipped || isMissed;

      slots.push({
        reminder: r,
        slotIndex: idx,
        baseTime,
        displayTime,
        scheduledDate,
        scheduledISO,
        offsetMinutes: slotOffset,
        log,
        isActioned,
      });
    });
  });

  // Sort ALL slots in day-aware chronological order based on scheduled Date timestamp
  slots.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

  // Each reminder has its own queue and the tick appears at the next dose of each queue.
  // Multiple doses belonging to the same reminder must be actioned sequentially.
  const activeSlotPerReminder = new Map<string, TimelineSlotEntry>();
  for (const entry of slots) {
    if (entry.isActioned) continue;
    const reminderId = entry.reminder.id;
    if (!activeSlotPerReminder.has(reminderId)) {
      activeSlotPerReminder.set(reminderId, entry);
    }
  }

  // Determine the overall "Next Dose" slot with date-awareness (for the featured badge and primary ring):
  //   1. Prefer the earliest slot whose scheduled time is still in the future (truly upcoming).
  //   2. Fall back to the earliest overdue un-actioned slot.
  const nowMs = now.getTime();
  const firstUpcoming = slots.find(
    (s) => !s.isActioned && s.scheduledDate.getTime() > nowMs
  );
  const earliestOverdue = slots.find(
    (s) => !s.isActioned && s.scheduledDate.getTime() <= nowMs
  );
  const overallNextSlot = firstUpcoming ?? earliestOverdue ?? null;

  return {
    slots,
    overallNextSlot,
    activeSlotPerReminder,
  };
}
