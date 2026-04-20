import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { Reminder, DoseLog } from "@/contexts/AppContext";
import { parse, addDays, isAfter, format, isBefore, startOfDay, endOfDay } from "date-fns";

export interface NextDoseInfo {
  reminder: Reminder;
  timeUntil: string; // e.g. "2 hours 15 mins"
  scheduledAt: Date;
}

export const calculateNextDose = (reminders: Reminder[], doseLogs: DoseLog[]): NextDoseInfo | null => {
  if (reminders.length === 0) return null;

  const now = new Date();
  const activeReminders = reminders.filter(r => r.enabled);
  
  if (activeReminders.length === 0) return null;

  // 1. Get all scheduled times for today and tomorrow
  const upcoming: { reminder: Reminder; scheduledAt: Date }[] = [];

  activeReminders.forEach(r => {
    // Parse the time (HH:mm)
    const [hours, minutes] = r.time.split(":").map(Number);
    
    // Today's occurrence
    const todayOccurrence = new Date();
    todayOccurrence.setHours(hours, minutes, 0, 0);

    // Tomorrow's occurrence
    const tomorrowOccurrence = addDays(todayOccurrence, 1);

    // Check if taken today
    const wasTakenToday = doseLogs.some(log => 
      log.reminderId === r.id && 
      isAfter(new Date(log.actionTime), startOfDay(now)) &&
      isBefore(new Date(log.actionTime), endOfDay(now))
    );

    if (!wasTakenToday && isAfter(todayOccurrence, now)) {
      upcoming.push({ reminder: r, scheduledAt: todayOccurrence });
    } else {
      upcoming.push({ reminder: r, scheduledAt: tomorrowOccurrence });
    }
  });

  if (upcoming.length === 0) return null;

  // 2. Sort by time
  upcoming.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const next = upcoming[0];

  // 3. Calculate time until
  const diffMs = next.scheduledAt.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;

  let timeUntil = "";
  if (h > 0) timeUntil += `${h}h `;
  timeUntil += `${m}m`;

  return {
    reminder: next.reminder,
    timeUntil,
    scheduledAt: next.scheduledAt
  };
};

const stringToHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export const scheduleReminders = async (reminders: Reminder[], doseLogs: DoseLog[]) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Request permissions if needed
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 2. Cancel existing notifications to avoid duplicates
    await LocalNotifications.cancel({ notifications: (await LocalNotifications.getPending()).notifications });

    // 3. Schedule new ones (next 7 days for daily reminders)
    const notifications: any[] = [];
    const activeReminders = reminders.filter(r => r.enabled);
    const now = new Date();

    activeReminders.forEach(r => {
      const [hours, minutes] = r.time.split(":").map(Number);
      
      // Check if taken today
      const wasTakenToday = doseLogs.some(log => 
        log.reminderId === r.id && 
        isAfter(new Date(log.actionTime), startOfDay(now)) &&
        isBefore(new Date(log.actionTime), endOfDay(now))
      );

      // Schedule for the next 7 days
      for (let i = 0; i < 7; i++) {
        const scheduleDate = addDays(new Date(), i);
        scheduleDate.setHours(hours, minutes, 0, 0);

        if (isBefore(scheduleDate, now)) continue;
        
        // Skip today if already taken
        if (i === 0 && wasTakenToday) continue;

        notifications.push({
          title: `Time for ${r.medicineName}`,
          body: `Dose: ${r.dose}. Remember to take your medicine!`,
          id: stringToHash(r.id + i), // Unique ID per day
          schedule: { at: scheduleDate },
          smallIcon: "res://pill",
          actionTypeId: "OPEN_APP",
          extra: {
            reminderId: r.id,
            medicineName: r.medicineName
          }
        });
      }
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.error("Failed to schedule notifications:", err);
  }
};
