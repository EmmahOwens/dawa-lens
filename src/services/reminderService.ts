import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { Reminder, DoseLog } from "@/contexts/AppContext";
import { addDays, isAfter, isBefore, startOfDay, endOfDay, setHours, setMinutes, setSeconds, setMilliseconds, getDay, addMinutes } from "date-fns";

export interface NextDoseInfo {
  reminder: Reminder;
  timeUntil: string;
  scheduledAt: Date;
}

const getNextOccurrence = (reminder: Reminder, fromDate: Date, doseLogs: DoseLog[]): Date | null => {
  const [hours, minutes] = reminder.time.split(":").map(Number);
  let checkDate = new Date(fromDate);
  checkDate = setHours(checkDate, hours);
  checkDate = setMinutes(checkDate, minutes);
  checkDate = setSeconds(checkDate, 0);
  checkDate = setMilliseconds(checkDate, 0);

  // Check up to 30 days in the future to find the next valid occurrence
  for (let i = 0; i < 30; i++) {
    const candidate = addDays(checkDate, i);

    // 1. Skip if candidate is in the past
    if (isBefore(candidate, fromDate)) continue;

    // 2. Check if already taken for this specific day (if candidate is today)
    const wasTakenOnCandidateDay = doseLogs.some(log =>
      log.reminderId === reminder.id &&
      isAfter(new Date(log.actionTime), startOfDay(candidate)) &&
      isBefore(new Date(log.actionTime), endOfDay(candidate))
    );
    if (wasTakenOnCandidateDay) continue;

    // 3. Check schedule-specific logic
    if (reminder.repeatSchedule === "once") {
      // If we found a candidate (now or future), return it
      return candidate;
    }

    if (reminder.repeatSchedule === "daily") {
      return candidate;
    }

    if (reminder.repeatSchedule === "weekly") {
      // If repeatDays is not set, assume current day of week as the target
      if (!reminder.repeatDays || reminder.repeatDays.length === 0) {
        const createdDay = getDay(new Date(reminder.createdAt));
        if (getDay(candidate) === createdDay) return candidate;
      } else if (reminder.repeatDays.includes(getDay(candidate))) {
        return candidate;
      }
    }

    // Default for 'custom' or others
    if (reminder.repeatSchedule === "custom" || !reminder.repeatSchedule) {
      return candidate;
    }
  }

  return null;
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

export const scheduleReminders = async (reminders: Reminder[], doseLogs: DoseLog[]) => {
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
      const [hours, minutes] = r.time.split(":").map(Number);
      
      // Schedule for the next 7 days based on repeat pattern
      for (let i = 0; i < 7; i++) {
        let scheduleDate = addDays(startOfDay(now), i);
        scheduleDate = setHours(scheduleDate, hours);
        scheduleDate = setMinutes(scheduleDate, minutes);

        if (isBefore(scheduleDate, now)) continue;

        // Skip if already taken today
        const wasTakenToday = doseLogs.some(log =>
          log.reminderId === r.id &&
          isAfter(new Date(log.actionTime), startOfDay(scheduleDate)) &&
          isBefore(new Date(log.actionTime), endOfDay(scheduleDate))
        );
        if (wasTakenToday) continue;

        // Check frequency
        let shouldSchedule = false;
        if (r.repeatSchedule === "daily" || r.repeatSchedule === "custom" || !r.repeatSchedule) {
          shouldSchedule = true;
        } else if (r.repeatSchedule === "once") {
          // For 'once', we schedule it only for the first valid future candidate found in the 7-day window
          // But since we are in a loop of 7 days, we only want the absolute first one.
          // To simplify: if it's the first time we're here and it's in the future, it's the 'once' event.
          // However, we need to ensure we don't schedule it 7 times.
          const firstValid = getNextOccurrence(r, now, doseLogs);
          if (firstValid && firstValid.toDateString() === scheduleDate.toDateString()) {
            shouldSchedule = true;
          }
        } else if (r.repeatSchedule === "weekly") {
          const dayOfWeek = getDay(scheduleDate);
          if (r.repeatDays && r.repeatDays.length > 0) {
            shouldSchedule = r.repeatDays.includes(dayOfWeek);
          } else {
            // Default to same day of week it was created
            shouldSchedule = dayOfWeek === getDay(new Date(r.createdAt));
          }
        }

        if (shouldSchedule) {
          notifications.push({
            title: `Time for ${r.medicineName}`,
            body: `Dose: ${r.dose}. Remember to take your medicine!`,
            id: stringToHash(r.id + scheduleDate.toDateString()), // More unique ID
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
          
          // If it's a 'once' reminder, we stop after scheduling the first occurrence
          if (r.repeatSchedule === "once") break;
        }
      }
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.error("Failed to schedule notifications:", err);
  }
};

