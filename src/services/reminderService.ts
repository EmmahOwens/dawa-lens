import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { Reminder, DoseLog, Medicine } from "@/contexts/AppContext";
import { addDays, isAfter, isBefore, startOfDay, endOfDay, setHours, setMinutes, setSeconds, setMilliseconds, getDay, addMinutes, subHours, parseISO } from "date-fns";

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
  const now = new Date();
  const twoHoursAgo = subHours(now, 2);
  const twentyFourHoursAgo = subHours(now, 24);

  const activeReminders = reminders.filter(r => r.enabled);

  for (const r of activeReminders) {
    const times = r.time.split(",");
    
    for (const timeStr of times) {
      const [hours, minutes] = timeStr.trim().split(":").map(Number);

      // Check today and yesterday
      for (let i = -1; i <= 0; i++) {
        let scheduledDate = addDays(startOfDay(now), i);
        scheduledDate = setHours(scheduledDate, hours);
        scheduledDate = setMinutes(scheduledDate, minutes);

        // Rule 1: Must be within the last 24 hours but at least 2 hours old
        if (isAfter(scheduledDate, twentyFourHoursAgo) && isBefore(scheduledDate, twoHoursAgo)) {

          // Rule 2: Check if a log already exists for this reminder at this specific scheduled time
          const logExists = doseLogs.some(log =>
            log.reminderId === r.id &&
            log.scheduledTime === scheduledDate.toISOString()
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
                  extra: { type: 'missed_alert' }
                }]
              });
            }
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
  const times = reminder.time.split(",");
  const occurrences: Date[] = [];

  times.forEach(timeStr => {
    const [hours, minutes] = timeStr.trim().split(":").map(Number);
    let checkDate = new Date(fromDate);
    checkDate = setHours(checkDate, hours);
    checkDate = setMinutes(checkDate, minutes);
    checkDate = setSeconds(checkDate, 0);
    checkDate = setMilliseconds(checkDate, 0);

    // Check up to 30 days in the future to find the next valid occurrence for THIS time
    for (let i = 0; i < 30; i++) {
      const candidate = addDays(checkDate, i);

      // 1. Check schedule-specific logic for 'once' first
      if (reminder.repeatSchedule === "once") {
        if (!isBefore(candidate, fromDate)) {
          occurrences.push(candidate);
          break;
        }
        continue;
      }

      // 2. Skip if candidate is in the past
      if (isBefore(candidate, fromDate)) continue;

      // 3. Check if already taken for this specific scheduled time
      const wasTakenOnCandidateTime = doseLogs.some(log =>
        log.reminderId === reminder.id &&
        log.scheduledTime === candidate.toISOString()
      );
      if (wasTakenOnCandidateTime) continue;

      // 4. Other schedules
      if (reminder.repeatSchedule === "daily" || reminder.repeatSchedule === "custom" || !reminder.repeatSchedule) {
        // If it's custom and we have specific days, check them
        if (reminder.repeatSchedule === "custom" && reminder.repeatDays && reminder.repeatDays.length > 0) {
          if (reminder.repeatDays.includes(getDay(candidate))) {
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
          const createdDay = getDay(new Date(reminder.createdAt));
          if (getDay(candidate) === createdDay) {
            occurrences.push(candidate);
            break;
          }
        } else if (reminder.repeatDays.includes(getDay(candidate))) {
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
      const times = r.time.split(",");
      const medicine = medicines?.find(m => m.id === r.medicineId);
      let currentStock = medicine?.currentQuantity || 999;
      const doseAmount = medicine?.dosagePerDose || 1;

      times.forEach(timeStr => {
        const [hours, minutes] = timeStr.trim().split(":").map(Number);
        
        // Schedule for the next 14 days or until stock runs out
        for (let i = 0; i < 14; i++) {
          let scheduleDate = addDays(startOfDay(now), i);
          scheduleDate = setHours(scheduleDate, hours);
          scheduleDate = setMinutes(scheduleDate, minutes);

          if (isBefore(scheduleDate, now)) continue;

          // Skip if already taken for THIS specific scheduled time
          const wasTaken = doseLogs.some(log =>
            log.reminderId === r.id &&
            log.scheduledTime === scheduleDate.toISOString()
          );
          if (wasTaken) continue;

          // Stop scheduling if we are out of stock
          if (medicine && currentStock < doseAmount) {
            notifications.push({
              title: `Refill Needed: ${r.medicineName}`,
              body: `You are out of stock. Please refill to continue reminders.`,
              id: stringToHash(r.id + "refill"),
              schedule: { at: scheduleDate },
              smallIcon: "res://pill",
              extra: { type: "refill", medicineId: r.medicineId }
            });
            break;
          }

          // Check frequency
          let shouldSchedule = false;
          if (r.repeatSchedule === "daily" || !r.repeatSchedule) {
            shouldSchedule = true;
          } else if (r.repeatSchedule === "custom") {
            if (r.repeatDays && r.repeatDays.length > 0) {
              shouldSchedule = r.repeatDays.includes(getDay(scheduleDate));
            } else {
              shouldSchedule = true;
            }
          } else if (r.repeatSchedule === "once") {
            const firstValid = getNextOccurrence(r, now, doseLogs);
            if (firstValid && firstValid.toDateString() === scheduleDate.toDateString() && firstValid.getTime() === scheduleDate.getTime()) {
              shouldSchedule = true;
            }
          } else if (r.repeatSchedule === "weekly") {
            const dayOfWeek = getDay(scheduleDate);
            if (r.repeatDays && r.repeatDays.length > 0) {
              shouldSchedule = r.repeatDays.includes(dayOfWeek);
            } else {
              shouldSchedule = dayOfWeek === getDay(new Date(r.createdAt));
            }
          }

          if (shouldSchedule) {
            notifications.push({
              title: `Time for ${r.medicineName}`,
              body: `Dose: ${r.dose}. Remember to take your medicine!`,
              id: stringToHash(r.id + scheduleDate.toISOString()),
              schedule: { at: scheduleDate },
              smallIcon: "res://pill",
              actionTypeId: "MEDICINE_REMINDER",
              extra: {
                reminderId: r.id,
                medicineName: r.medicineName,
                dose: r.dose,
                scheduledTime: scheduleDate.toISOString()
              }
            });
            
            if (medicine) currentStock -= doseAmount;
            if (r.repeatSchedule === "once") break;
          }
        }
      });
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.error("Failed to schedule notifications:", err);
  }
};

