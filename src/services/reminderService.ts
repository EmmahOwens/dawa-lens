import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { Reminder, DoseLog, Medicine } from "@/contexts/AppContext";
import { addDays, isAfter, isBefore, startOfDay, endOfDay, setHours, setMinutes, setSeconds, setMilliseconds, getDay, addMinutes, subHours, parseISO } from "date-fns";

/**
 * Computes how many minutes off today's first taken dose was from its scheduled time.
 * Returns 0 if no log exists today, deviation < 5 min (noise), or > 240 min (cap).
 * Only `taken` actions count — snooze/skip do not shift the schedule.
 */
export function computeShiftOffset(reminder: Reminder, doseLogs: DoseLog[]): number {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  // Most recent taken log for this reminder today
  const todayTakenLog = [...doseLogs]
    .filter(l =>
      l.reminderId === reminder.id &&
      l.action === "taken" &&
      isAfter(new Date(l.actionTime), todayStart) &&
      isBefore(new Date(l.actionTime), todayEnd)
    )
    .sort((a, b) => new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime())[0];

  if (!todayTakenLog) return 0;

  const offsetMinutes = Math.round(
    (new Date(todayTakenLog.actionTime).getTime() - new Date(todayTakenLog.scheduledTime).getTime()) /
    (1000 * 60)
  );

  // Noise filter < 5 min; hard cap > 4 hours
  if (Math.abs(offsetMinutes) < 5 || Math.abs(offsetMinutes) > 240) return 0;
  return offsetMinutes;
}

// ... (existing exports)

/**
 * Checks for missed doses in the last 24 hours.
 * A dose is "missed" if it was scheduled more than 2 hours ago and no log exists.
 */
export const checkMissedDoses = async (
  reminders: Reminder[],
  doseLogs: DoseLog[],
  logDose: (log: Omit<DoseLog, "id" | "actionTime">) => Promise<void>
) => {
  // Guard: do nothing if there's no data yet (avoids false-positives on mount)
  if (reminders.length === 0) return;

  const now = new Date();
  const twoHoursAgo = subHours(now, 2);
  const twentyFourHoursAgo = subHours(now, 24);

  const activeReminders = reminders.filter(r => r.enabled);

  for (const r of activeReminders) {
    // Parse when this reminder was created so we never mark a dose
    // as missed before the reminder even existed.
    const reminderCreatedAt = r.createdAt ? parseISO(r.createdAt) : now;

    const times = r.time.split(",");
    
    for (const timeStr of times) {
      const [hours, minutes] = timeStr.trim().split(":").map(Number);

      // Check today and yesterday
      for (let i = -1; i <= 0; i++) {
        let scheduledDate = addDays(startOfDay(now), i);
        scheduledDate = setHours(scheduledDate, hours);
        scheduledDate = setMinutes(scheduledDate, minutes);
        scheduledDate = setSeconds(scheduledDate, 0);
        scheduledDate = setMilliseconds(scheduledDate, 0);

        // Rule 1: Must be within the last 24 hours but at least 2 hours old
        if (!isAfter(scheduledDate, twentyFourHoursAgo) || !isBefore(scheduledDate, twoHoursAgo)) {
          continue;
        }

        // Rule 2: The scheduled slot must be AFTER the reminder was created.
        // This prevents a reminder added at 11am from marking its 8am slot as missed.
        if (!isAfter(scheduledDate, reminderCreatedAt)) {
          continue;
        }

        // Rule 3: Check if a log already exists for this reminder at this specific scheduled time.
        // Also check the shifted time so we don't double-flag a dose taken at the adjusted slot.
        const shiftedScheduledDate = addMinutes(scheduledDate, computeShiftOffset(r, doseLogs));
        const logExists = doseLogs.some(log =>
          log.reminderId === r.id &&
          (log.scheduledTime === scheduledDate.toISOString() ||
           log.scheduledTime === shiftedScheduledDate.toISOString())
        );

        if (!logExists) {
          console.log(`Marking missed dose for ${r.medicineName} scheduled at ${scheduledDate.toISOString()}`);
          await logDose({
            reminderId: r.id,
            medicineName: r.medicineName,
            dose: r.dose,
            scheduledTime: scheduledDate.toISOString(),
            action: 'missed'
          });

          // Notify the user about the missed dose
          if (Capacitor.isNativePlatform()) {
            await LocalNotifications.schedule({
              notifications: [{
                title: `Missed Dose: ${r.medicineName}`,
                body: `You missed your ${r.dose} dose scheduled for ${timeStr.trim()}. Please stay on track!`,
                id: stringToHash(r.id + "missed" + scheduledDate.getTime()),
                smallIcon: "res://pill",
                channelId: 'dawa_reminders',
                sound: Capacitor.getPlatform() === 'ios' ? 'default' : undefined,
                extra: { type: 'missed_alert' }
              }]
            });
          }
        }
      }
    }
  }
};

export interface NextDoseInfo {
  reminder: Reminder;
  timeUntil: string;
  scheduledAt: Date;
}

const getNextOccurrence = (reminder: Reminder, fromDate: Date, doseLogs: DoseLog[]): Date | null => {
  const times = reminder.time.split(",").map(t => t.trim());
  const occurrences: Date[] = [];
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Compute today's adaptive shift offset (0 if within noise tolerance or outside cap)
  const offsetMinutes = computeShiftOffset(reminder, doseLogs);

  // Determine which base time slot was most recently taken today (to know what to shift)
  let takenSlotIndex = -1;
  if (offsetMinutes !== 0) {
    const todayTakenLog = [...doseLogs]
      .filter(l =>
        l.reminderId === reminder.id &&
        l.action === "taken" &&
        isAfter(new Date(l.actionTime), todayStart) &&
        isBefore(new Date(l.actionTime), todayEnd)
      )
      .sort((a, b) => new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime())[0];

    if (todayTakenLog) {
      const scheduledDate = new Date(todayTakenLog.scheduledTime);
      const hh = scheduledDate.getHours().toString().padStart(2, "0");
      const mm = scheduledDate.getMinutes().toString().padStart(2, "0");
      const scheduledTimeStr = `${hh}:${mm}`;
      takenSlotIndex = times.indexOf(scheduledTimeStr);

      // Fallback: match to nearest base slot by minute proximity
      if (takenSlotIndex === -1) {
        const scheduledMins = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
        let minDiff = Infinity;
        times.forEach((t, i) => {
          const [h, m] = t.split(":").map(Number);
          const diff = Math.abs(h * 60 + m - scheduledMins);
          if (diff < minDiff) { minDiff = diff; takenSlotIndex = i; }
        });
      }
    }
  }

  times.forEach((timeStr, index) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    let checkDate = new Date(fromDate);
    checkDate = setHours(checkDate, hours);
    checkDate = setMinutes(checkDate, minutes);
    checkDate = setSeconds(checkDate, 0);
    checkDate = setMilliseconds(checkDate, 0);

    for (let i = 0; i < 30; i++) {
      let candidate = addDays(checkDate, i);

      // Apply today's adaptive shift ONLY to slots that come after the taken slot (today only)
      const isToday = startOfDay(candidate).getTime() === todayStart.getTime();
      if (isToday && offsetMinutes !== 0 && takenSlotIndex !== -1 && index > takenSlotIndex) {
        candidate = addMinutes(candidate, offsetMinutes);
      }

      // 1. 'once' schedule
      if (reminder.repeatSchedule === "once") {
        if (!isBefore(candidate, fromDate)) {
          occurrences.push(candidate);
          break;
        }
        continue;
      }

      // 2. Skip past candidates
      if (isBefore(candidate, fromDate)) continue;

      // 3. Check if already taken for this scheduled time
      const wasTaken = doseLogs.some(log =>
        log.reminderId === reminder.id &&
        log.scheduledTime === candidate.toISOString()
      );
      if (wasTaken) continue;

      // 4. Schedule-type filtering
      // For shifted candidates, check day-of-week against the un-shifted date
      const refDate = isToday && offsetMinutes !== 0 ? addMinutes(candidate, -offsetMinutes) : candidate;

      if (reminder.repeatSchedule === "daily" || reminder.repeatSchedule === "custom" || !reminder.repeatSchedule) {
        if (reminder.repeatSchedule === "custom" && reminder.repeatDays && reminder.repeatDays.length > 0) {
          if (reminder.repeatDays.includes(getDay(refDate))) {
            occurrences.push(candidate);
            break;
          }
        } else {
          occurrences.push(candidate);
          break;
        }
      }

      if (reminder.repeatSchedule === "weekly") {
        if (!reminder.repeatDays || reminder.repeatDays.length === 0) {
          if (getDay(refDate) === getDay(new Date(reminder.createdAt))) {
            occurrences.push(candidate);
            break;
          }
        } else if (reminder.repeatDays.includes(getDay(refDate))) {
          occurrences.push(candidate);
          break;
        }
      }
    }
  });

  if (occurrences.length === 0) return null;
  occurrences.sort((a, b) => a.getTime() - b.getTime());
  return occurrences[0];
};

export const calculateNextDose = (reminders: Reminder[], doseLogs: DoseLog[]): NextDoseInfo | null => {
  if (reminders.length === 0) return null;

  const now = new Date();
  const activeReminders = reminders.filter(r => r.enabled);
  
  if (activeReminders.length === 0) return null;

  const upcoming: { reminder: Reminder; scheduledAt: Date }[] = [];

  activeReminders.forEach(r => {
    const next = getNextOccurrence(r, now, doseLogs);
    if (next) {
      upcoming.push({ reminder: r, scheduledAt: next });
    }
  });

  if (upcoming.length === 0) return null;

  upcoming.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const next = upcoming[0];

  const diffMs = next.scheduledAt.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;

  let timeUntil = h > 0 ? `${h}h ` : "";
  timeUntil += `${m}m`;

  return {
    reminder: next.reminder,
    timeUntil,
    scheduledAt: next.scheduledAt
  };
};

export const registerNotificationActions = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        id: 'dawa_reminders',
        name: 'Medicine Reminders',
        description: 'Notifications for medicine reminders',
        importance: 5, // High importance
        visibility: 1, // Public
        vibration: true,
      });
    }

    // registerActionTypes defines the UI buttons for the notifications
    
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'MEDICINE_REMINDER',
          actions: [
            {
              id: 'TAKE',
              title: 'Mark as Taken',
              foreground: true
            },
            {
              id: 'SKIP',
              title: 'Skip Dose',
              foreground: true
            },
            {
              id: 'SNOOZE',
              title: 'Snooze (15m)',
              foreground: true
            }
          ]
        }
      ]
    });
  } catch (err) {
    console.error("Failed to register notification actions:", err);
  }
};

const stringToHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export const scheduleReminders = async (reminders: Reminder[], doseLogs: DoseLog[], medicines?: Medicine[]) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // Cancel all pending notifications to refresh the schedule
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const notifications: any[] = [];
    const activeReminders = reminders.filter(r => r.enabled);
    const now = new Date();

    activeReminders.forEach(r => {
      const medicine = medicines?.find(m => m.id === r.medicineId);
      let currentStock = medicine?.currentQuantity || 999;
      const doseAmount = medicine?.dosagePerDose || 1;
      
      let nextFrom = now;
      // Schedule next 60 occurrences or up to 30 days — larger window means
      // fewer reschedule cycles needed if the user is offline for a long period.
      for (let i = 0; i < 60; i++) {
        const next = getNextOccurrence(r, nextFrom, doseLogs);
        if (!next || isAfter(next, addDays(now, 30))) break;

        // Stop scheduling if we are out of stock
        if (medicine && currentStock < doseAmount) {
          notifications.push({
            title: `Refill Needed: ${r.medicineName}`,
            body: `You are out of stock. Please refill to continue reminders.`,
            id: stringToHash(r.id + "refill"),
            schedule: { at: next, allowWhileIdle: true },
            smallIcon: "res://pill",
            channelId: 'dawa_reminders',
            sound: Capacitor.getPlatform() === 'ios' ? 'default' : undefined,
            extra: { type: "refill", medicineId: r.medicineId }
          });
          break;
        }

        notifications.push({
          title: `Time for ${r.medicineName}`,
          body: `Dose: ${r.dose}. Remember to take your medicine!`,
          id: stringToHash(r.id + next.toISOString()),
          // allowWhileIdle: fires even when Android is in Doze/battery-saver mode.
          // This is the key flag that makes notifications work fully offline.
          schedule: { at: next, allowWhileIdle: true },
          smallIcon: "res://pill",
          channelId: 'dawa_reminders',
          sound: Capacitor.getPlatform() === 'ios' ? 'default' : undefined,
          actionTypeId: "MEDICINE_REMINDER",
          extra: {
            reminderId: r.id,
            medicineName: r.medicineName,
            dose: r.dose,
            scheduledTime: next.toISOString()
          }
        });
        
        if (medicine) currentStock -= doseAmount;
        if (r.repeatSchedule === "once") break;
        
        nextFrom = addMinutes(next, 1);
      }
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.error("Failed to schedule notifications:", err);
  }
};

