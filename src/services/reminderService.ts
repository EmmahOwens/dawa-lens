import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { NativeAlarm, AlarmNotification } from "@/plugins/nativeAlarm";
import { notify } from "@/lib/notifications";
import { Capacitor } from "@capacitor/core";
import { Reminder, DoseLog, Medicine } from "@/contexts/AppContext";
import { calculateRefillStatus, CRITICAL_STOCK_THRESHOLD } from "@/services/refillService";
import {
  addDays,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  getDay,
  addMinutes,
  subHours,
  parseISO,
} from "date-fns";
import { toDate } from "@/lib/utils";
import {
  parseReminderTimes,
  findSlotIndexForTime,
  getInterSlotInterval,
  calculateDynamicSchedule,
  isSlotActionedOnDate,
  timeStrToMinutes,
} from "@/lib/dynamicSchedule";

// ─── Notification channel IDs ────────────────────────────────────────────────
// v2 channels carry the correct default sound. The old channels were created
// without an explicit sound URI and Android locks those settings permanently.
// Bumping the ID forces Android to create a fresh channel with sound enabled.
const CHANNEL_OWNER       = "dawa_owner_v2";
const CHANNEL_REFILL      = "dawa_refill_alerts_v2";
const CHANNEL_REMINDERS   = "dawa_reminders_v2";   // used by registerNotificationActions
const CHANNEL_MISSED      = "dawa_missed_doses_v2"; // dedicated channel for missed-dose alerts
const patientChannelId    = (id: string) => `dawa_patient_v2_${id}`;

/** Legacy IDs that may already be cached on existing devices (silent — no sound). */
const LEGACY_CHANNELS = [
  "dawa_owner",
  "dawa_refill_alerts",
  "dawa_reminders",
];
const MIGRATION_KEY = "dawa_notif_channels_v2_migrated";

/**
 * Run once on app launch (after permissions are confirmed).
 * Deletes the old silent channels so Android creates fresh v2 ones with sound.
 * Guarded by a localStorage flag — a no-op after the first run.
 */
export const migrateNotificationChannels = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  try {
    // Delete every legacy channel. deleteChannel is a no-op if the ID doesn't exist.
    for (const id of LEGACY_CHANNELS) {
      await LocalNotifications.deleteChannel({ id });
    }
    // Also clean up any patient-scoped legacy channels that may exist.
    // We can't enumerate them, but their absence is harmless — Android will
    // just not show them in settings until the next schedule() call creates v2 ones.
    localStorage.setItem(MIGRATION_KEY, "1");
    console.log("[reminderService] Notification channel migration to v2 complete.");
  } catch (err) {
    console.warn("[reminderService] Channel migration failed (non-fatal):", err);
  }
};

/**
 * Computes how many minutes off today's most recent taken dose was from its scheduled time.
 * Returns 0 if no log exists today or deviation > 240 min (4-hour cap).
 * Only `taken` actions count — snooze/skip do not shift the schedule.
 */
export function computeShiftOffset(
  reminder: Reminder,
  doseLogs: DoseLog[]
): number {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const todayTakenLog = [...doseLogs]
    .filter(
      (l) =>
        l.reminderId === reminder.id &&
        l.action === "taken" &&
        isAfter(toDate(l.actionTime), todayStart) &&
        isBefore(toDate(l.actionTime), todayEnd)
    )
    .sort(
      (a, b) => toDate(b.actionTime).getTime() - toDate(a.actionTime).getTime()
    )[0];

  if (!todayTakenLog) return 0;

  const offsetMinutes = Math.round(
    (toDate(todayTakenLog.actionTime).getTime() -
      toDate(todayTakenLog.scheduledTime).getTime()) /
      (1000 * 60)
  );

  // Hard cap: ignore deviation > 24 hours (likely an unrelated log from a different day)
  if (Math.abs(offsetMinutes) > 1440) return 0;
  return offsetMinutes;
}

/**
 * Returns the most recent taken log for a reminder today, or undefined.
 */
function getTodayTakenLog(
  reminderId: string,
  doseLogs: DoseLog[]
): DoseLog | undefined {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  return [...doseLogs]
    .filter(
      (l) =>
        l.reminderId === reminderId &&
        l.action === "taken" &&
        isAfter(toDate(l.actionTime), todayStart) &&
        isBefore(toDate(l.actionTime), todayEnd)
    )
    .sort(
      (a, b) => toDate(b.actionTime).getTime() - toDate(a.actionTime).getTime()
    )[0];
}

/**
 * Given an ordered list of HH:mm time strings, returns the interval in minutes
 * between consecutive slots (or between the last and first if only 1 slot, falls back to 24h).
 */
function getIntervalMinutes(
  times: string[],
  fromIndex: number,
  toIndex: number
): number {
  const toMins = (t: string) => {
    const parts = (t || "").split(":");
    if (parts.length !== 2) return 0;
    const [h, m] = parts.map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };
  if (times.length <= 1) return 24 * 60;
  let diff = toMins(times[toIndex]) - toMins(times[fromIndex]);
  if (diff <= 0) diff += 24 * 60; // wrap around midnight
  return diff;
}

// ... (existing exports)

/**
 * Checks for missed doses in the last 24 hours.
 * A dose is "missed" if it was scheduled more than 2 hours ago and no log exists.
 */
export const checkMissedDoses = async (
  reminders: Reminder[],
  doseLogs: DoseLog[],
  logDose: (log: Omit<DoseLog, "id" | "actionTime">) => Promise<void>,
  patientId?: string | null // Optional: scope to a specific patient. null = owner only.
) => {
  // Guard: do nothing if there's no data yet (avoids false-positives on mount)
  if (reminders.length === 0) return;

  const now = new Date();
  const twoHoursAgo = subHours(now, 2);
  const twentyFourHoursAgo = subHours(now, 24);

  // Scope to the requested patient
  const activeReminders = reminders.filter((r) => {
    if (!r.enabled) return false;
    if (patientId !== undefined) {
      // Explicit scope requested: match null (owner) or specific patient ID
      const rPatientId = r.patientId ?? null;
      return rPatientId === (patientId ?? null);
    }
    return true; // No filter — check all
  });

  for (const r of activeReminders) {
    // Parse when this reminder was created so we never mark a dose
    // as missed before the reminder even existed.
    const reminderCreatedAt = r.createdAt ? parseISO(r.createdAt) : now;

    const times = r.time
      .split(",")
      .map((t) => t.trim())
      .filter((t) => {
        const parts = t.split(":");
        if (parts.length !== 2) return false;
        const [h, m] = parts.map(Number);
        return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
      });

    for (const timeStr of times) {
      const [hours, minutes] = timeStr.split(":").map(Number);

      // Check today and yesterday
      for (let i = -1; i <= 0; i++) {
        let scheduledDate = addDays(startOfDay(now), i);
        scheduledDate = setHours(scheduledDate, hours);
        scheduledDate = setMinutes(scheduledDate, minutes);
        scheduledDate = setSeconds(scheduledDate, 0);
        scheduledDate = setMilliseconds(scheduledDate, 0);

        // Rule 1: Must be within the last 24 hours but at least 2 hours old
        if (
          !isAfter(scheduledDate, twentyFourHoursAgo) ||
          !isBefore(scheduledDate, twoHoursAgo)
        ) {
          continue;
        }

        // Rule 2: The scheduled slot must be AFTER the reminder was created.
        // This prevents a reminder added at 11am from marking its 8am slot as missed.
        if (!isAfter(scheduledDate, reminderCreatedAt)) {
          continue;
        }

        // Rule 3: Check if a log already exists for this reminder at this specific scheduled time.
        // Also check the shifted time so we don't double-flag a dose taken at the adjusted slot.
        const shiftedScheduledDate = addMinutes(
          scheduledDate,
          computeShiftOffset(r, doseLogs)
        );
        const logExists = doseLogs.some(
          (log) =>
            log.reminderId === r.id &&
            (log.scheduledTime === scheduledDate.toISOString() ||
              log.scheduledTime === shiftedScheduledDate.toISOString())
        );

        if (!logExists) {
          console.log(
            `Marking missed dose for ${
              r.medicineName
            } scheduled at ${scheduledDate.toISOString()}`
          );
          await logDose({
            reminderId: r.id,
            medicineName: r.medicineName,
            dose: r.dose,
            scheduledTime: scheduledDate.toISOString(),
            action: "missed",
          });

          // Notify the user about the missed dose
          if (Capacitor.isNativePlatform()) {
            try {
              const missedPerm = await LocalNotifications.checkPermissions();
              if (missedPerm.display === "granted") {
                // Ensure the missed-dose channel exists before scheduling
                if (Capacitor.getPlatform() === "android") {
                  await LocalNotifications.createChannel({
                    id: CHANNEL_MISSED,
                    name: "Missed Dose Alerts",
                    description: "Alerts when a scheduled dose was not logged",
                    importance: 4,
                    vibration: true,
                    sound: "default",
                  });
                  if (r.patientId) {
                    await LocalNotifications.createChannel({
                      id: patientChannelId(r.patientId),
                      name: r.patientName ? `${r.patientName}'s Reminders` : "Family Member Reminders",
                      description: `Medication reminders for ${r.patientName ?? "a family member"}`,
                      importance: 5,
                      visibility: 1,
                      vibration: true,
                      sound: "default",
                    });
                  }
                }

                const missedTitle = r.patientName
                  ? `\u26a0\ufe0f Missed Dose: ${r.patientName}'s ${r.medicineName}`
                  : `\u26a0\ufe0f Missed Dose: ${r.medicineName}`;
                const missedBody = r.patientName
                  ? `${r.patientName} missed their ${r.dose} dose scheduled at ${timeStr.trim()}. Please follow up.`
                  : `You missed your ${r.dose} dose scheduled for ${timeStr.trim()}. Please stay on track!`;
                const missedId = stringToHash(r.id + "missed" + scheduledDate.getTime());
                const missedChannelId = r.patientId ? patientChannelId(r.patientId) : CHANNEL_MISSED;
                // schedule.at + allowWhileIdle is required for delivery in Doze/offline mode
                const fireAt = new Date(Date.now() + 2000);

                await LocalNotifications.schedule({
                  notifications: [{
                    title: missedTitle,
                    body: missedBody,
                    id: missedId,
                    schedule: { at: fireAt, allowWhileIdle: true },
                    channelId: missedChannelId,
                    sound: "default",
                    extra: { type: "missed_alert", patientId: r.patientId ?? null, route: "/history" },
                  }],
                });

                // Mirror to NativeAlarm so it fires after reboot / when app is killed
                try {
                  await NativeAlarm.scheduleAlarms({
                    notifications: [{
                      id: missedId,
                      title: missedTitle,
                      body: missedBody,
                      triggerAtMillis: fireAt.getTime(),
                      extra: JSON.stringify({
                        type: "missed_alert",
                        reminderId: r.id,
                        patientId: r.patientId ?? null,
                        route: "/history",
                      }),
                    }],
                  });
                } catch (alarmErr) {
                  console.warn("[reminderService] NativeAlarm missed-dose fallback failed (non-fatal):", alarmErr);
                }
              }
            } catch (notifErr) {
              console.warn("[reminderService] Failed to schedule missed-dose notification:", notifErr);
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

const getNextOccurrence = (
  reminder: Reminder,
  fromDate: Date,
  doseLogs: DoseLog[]
): Date | null => {
  const times = parseReminderTimes(reminder.time);
  if (times.length === 0) return null;

  const occurrences: Date[] = [];
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Check if there's a taken dose today — use interval-preservation model
  const takenLog = getTodayTakenLog(reminder.id, doseLogs);
  const offsetMinutes = computeShiftOffset(reminder, doseLogs);

  // Find which slot index was taken today
  let takenSlotIndex = -1;
  if (takenLog) {
    takenSlotIndex = findSlotIndexForTime(
      times,
      takenLog.scheduledTime || takenLog.actionTime
    );
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
      const isToday = startOfDay(candidate).getTime() === todayStart.getTime();

      // --- Interval-preservation model for today ---
      if (isToday && takenLog && takenSlotIndex !== -1) {
        if (index <= takenSlotIndex) {
          // This slot (or prior) has already been actioned today
          continue;
        }
        // Subsequent slot today: anchor to actual take time + cumulative inter-slot interval
        const actualTakeTime = toDate(takenLog.actionTime);
        let cumulativeInterval = 0;
        for (let s = takenSlotIndex; s < index; s++) {
          cumulativeInterval += getInterSlotInterval(times, s, s + 1);
        }
        candidate = addMinutes(actualTakeTime, cumulativeInterval);
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

      // 3. Check if already handled (taken, skipped, or missed)
      const candDayStart = startOfDay(candidate);
      const candDayEnd = endOfDay(candidate);
      const candMins = candidate.getHours() * 60 + candidate.getMinutes();

      const terminalLog = doseLogs.find((log) => {
        if (log.reminderId !== reminder.id) return false;
        if (!["taken", "skipped", "missed"].includes(log.action)) return false;
        if (log.scheduledTime === candidate.toISOString()) return true;

        const actionD = toDate(log.actionTime);
        const schedD = log.scheduledTime ? toDate(log.scheduledTime) : actionD;

        if (
          (isAfter(actionD, candDayStart) && isBefore(actionD, candDayEnd)) ||
          (isAfter(schedD, candDayStart) && isBefore(schedD, candDayEnd))
        ) {
          const logMins = schedD.getHours() * 60 + schedD.getMinutes();
          let diff = Math.abs(logMins - candMins);
          if (diff > 12 * 60) diff = 24 * 60 - diff;
          if (diff <= 30) return true;
        }
        return false;
      });

      if (terminalLog) continue;

      // 3.5 Check if currently snoozed
      const snoozedLog = doseLogs
        .sort(
          (a, b) =>
            toDate(b.actionTime).getTime() - toDate(a.actionTime).getTime()
        )
        .find(
          (log) =>
            log.reminderId === reminder.id &&
            log.scheduledTime === candidate.toISOString() &&
            log.action === "snoozed"
        );
      if (snoozedLog && snoozedLog.snoozeUntil) {
        candidate = new Date(snoozedLog.snoozeUntil);
        if (isBefore(candidate, fromDate)) continue;
      }

      // 4. Schedule-type filtering
      const refDate =
        isToday && offsetMinutes !== 0
          ? addMinutes(candidate, -offsetMinutes)
          : candidate;

      if (
        reminder.repeatSchedule === "daily" ||
        reminder.repeatSchedule === "custom" ||
        !reminder.repeatSchedule
      ) {
        if (
          reminder.repeatSchedule === "custom" &&
          reminder.repeatDays &&
          reminder.repeatDays.length > 0
        ) {
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

export const calculateNextDose = (
  reminders: Reminder[],
  doseLogs: DoseLog[]
): NextDoseInfo | null => {
  if (reminders.length === 0) return null;

  const now = new Date();
  const activeReminders = reminders.filter((r) => r.enabled);

  if (activeReminders.length === 0) return null;

  const upcoming: { reminder: Reminder; scheduledAt: Date }[] = [];

  activeReminders.forEach((r) => {
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
    scheduledAt: next.scheduledAt,
  };
};

export const registerNotificationActions = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: CHANNEL_REMINDERS,
        name: "Medicine Reminders",
        description: "Notifications for medicine reminders",
        importance: 5, // High importance
        visibility: 1, // Public
        vibration: true,
        sound: "default",
      });
    }

    // registerActionTypes defines the UI buttons for the notifications

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: "MEDICINE_REMINDER",
          actions: [
            {
              id: "TAKE",
              title: "Mark as Taken",
              foreground: true,
            },
            {
              id: "SKIP",
              title: "Skip Dose",
              foreground: true,
            },
            {
              id: "SNOOZE",
              title: "Snooze (15m)",
              foreground: true,
            },
          ],
        },
      ],
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

/**
 * Fires a "Schedule Adjusted" notification that works identically to a regular
 * medicine reminder — it will deliver even when:
 *   • The app is in the background or fully killed
 *   • The device is in Android Doze / battery-saver mode (allowWhileIdle)
 *   • The device is completely offline (OS-level alarm, no network needed)
 *   • The device reboots (NativeAlarm re-registers on boot via BootReceiver)
 *
 * The notification fires 2 seconds in the future so the OS has time to register
 * it before the current JS thread exits, and to avoid immediate-vs-scheduled race
 * conditions on Android.
 */
export const scheduleAdjustmentNotification = async ({
  reminderId,
  medicineName,
  patientId,
  patientName,
  adjustedTimesLabel,
  absDiff,
  direction,
  hasSubsequentSlots,
}: {
  reminderId: string;
  medicineName: string;
  patientId?: string | null;
  patientName?: string | null;
  adjustedTimesLabel: string;
  absDiff: number;
  direction: "earlier" | "later";
  hasSubsequentSlots: boolean;
}): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    const title = patientName
      ? `⏰ Schedule Adjusted — ${patientName}'s ${medicineName}`
      : `⏰ Schedule Adjusted — ${medicineName}`;

    const body = hasSubsequentSlots
      ? patientName
        ? `${patientName} took ${medicineName} ${absDiff}m ${direction}. Next doses adjusted to: ${adjustedTimesLabel}.`
        : `Dose taken ${absDiff}m ${direction}. Next doses adjusted to: ${adjustedTimesLabel}.`
      : `Dose taken ${absDiff}m ${direction}. Schedule updated for ${medicineName}.`;

    // Fire 2 seconds in the future so Android can register it before the
    // current execution context ends (required for allowWhileIdle to work).
    const fireAt = new Date(Date.now() + 2000);
    const notifId = stringToHash(reminderId + "schedule_adjusted" + fireAt.getTime().toString());
    const channelId = patientId ? `dawa_patient_v2_${patientId}` : CHANNEL_OWNER;

    // ── Path 1: Capacitor LocalNotifications ────────────────────────────────
    // schedule.at + allowWhileIdle ensures delivery in Doze mode / offline.
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: notifId,
          schedule: { at: fireAt, allowWhileIdle: true },
          channelId,
          sound: "default",
          extra: {
            type: "schedule_adjusted",
            reminderId,
            patientId: patientId ?? null,
            route: patientId ? "/family" : "/reminders",
          },
        },
      ],
    });

    // ── Path 2: NativeAlarm (AlarmManager.setExactAndAllowWhileIdle) ────────
    // Mirrors to the native AlarmManager so the notification also fires after
    // a device reboot or when the Capacitor plugin is not responsive.
    try {
      await NativeAlarm.scheduleAlarms({
        notifications: [
          {
            id: notifId,
            title,
            body,
            triggerAtMillis: fireAt.getTime(),
            extra: JSON.stringify({
              type: "schedule_adjusted",
              reminderId,
              patientId: patientId ?? null,
            }),
          },
        ],
      });
    } catch (alarmErr) {
      // NativeAlarm is a best-effort fallback — non-fatal if unavailable.
      console.warn(
        "[reminderService] NativeAlarm fallback for adjustment notification failed (non-fatal):",
        alarmErr
      );
    }
  } catch (err) {
    console.warn("[reminderService] scheduleAdjustmentNotification failed:", err);
  }
};

/**
 * Schedules a one-time native push notification for each medicine that is
 * critically low (≤ CRITICAL_STOCK_THRESHOLD days remaining).
 * Deduped per medicine per day via localStorage so it doesn't spam on every
 * foreground resume.
 */
export const scheduleRefillNotifications = async (
  medicines: Medicine[],
  reminders: Reminder[]
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    // Ensure the refill alert channel exists on Android
    if (Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: CHANNEL_REFILL,
        name: "Med Vault Refill Alerts",
        description: "Notifies you when medicine stock is critically low",
        importance: 4, // High
        vibration: true,
        sound: "default",
      });
    }

    const todayKey = new Date().toDateString();
    const notifications: LocalNotificationSchema[] = [];

    for (const med of medicines) {
      const status = calculateRefillStatus(med, reminders);
      if (!status) continue;
      if (status.daysRemaining === null || status.daysRemaining <= 0 || status.daysRemaining > CRITICAL_STOCK_THRESHOLD) continue;

      // Dedupe: only fire once per medicine per calendar day
      const sentKey = `medvault_refill_notif_${med.id}_${todayKey}`;
      const alreadySent = localStorage.getItem(sentKey);
      if (alreadySent) continue;

      notifications.push({
        title: `⚠️ Refill Soon: ${med.name}`,
        body: `Only ~${status.daysRemaining} day${status.daysRemaining !== 1 ? "s" : ""} of ${med.name} left (${status.currentQuantity} ${med.unit || "units"}). Open Med Vault to refill.`,
        id: stringToHash(med.id + "low_stock" + todayKey),
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true }, // fire after 3s
        channelId: CHANNEL_REFILL,
        sound: "default",
        extra: { type: "low_stock", medicineId: med.id, patientId: med.patientId ?? null, route: "/medvault" },
      });

      localStorage.setItem(sentKey, "1");
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });

      // Mirror every refill notification to NativeAlarm so they fire after a
      // reboot or when the Capacitor plugin is not responsive (Bug fix).
      try {
        await NativeAlarm.scheduleAlarms({
          notifications: notifications.map((n) => ({
            id: n.id as number,
            title: n.title ?? "Refill Reminder",
            body: n.body ?? "",
            triggerAtMillis: (n.schedule?.at as Date)?.getTime() ?? Date.now() + 3000,
            extra: JSON.stringify(n.extra ?? {}),
          })),
        });
      } catch (alarmErr) {
        console.warn("[reminderService] NativeAlarm refill fallback failed (non-fatal):", alarmErr);
      }
    }
  } catch (err) {
    console.warn("[reminderService] Failed to schedule refill notifications:", err);
  }
};

export const scheduleReminders = async (
  reminders: Reminder[],
  doseLogs: DoseLog[],
  medicines?: Medicine[]
) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      await LocalNotifications.requestPermissions();
    }

    // Schedule low-stock refill notifications for Med Vault
    if (medicines && medicines.length > 0) {
      await scheduleRefillNotifications(medicines, reminders);
    }

    const activeReminders = reminders.filter((r) => r.enabled);

    // Ensure the channel exists before scheduling on Android
    if (Capacitor.getPlatform() === "android") {
      // Always ensure the owner channel exists
      await LocalNotifications.createChannel({
        id: CHANNEL_OWNER,
        name: "My Reminders",
        description: "Your personal medication reminders",
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: "default",
      });

      // Create one channel per managed patient
      const seenPatientIds = new Set<string>();
      for (const r of activeReminders) {
        if (r.patientId && !seenPatientIds.has(r.patientId)) {
          seenPatientIds.add(r.patientId);
          const channelName = r.patientName
            ? `${r.patientName}'s Reminders`
            : "Family Member Reminders";
          await LocalNotifications.createChannel({
            id: patientChannelId(r.patientId),
            name: channelName,
            description: `Medication reminders for ${
              r.patientName ?? "a family member"
            }`,
            importance: 5,
            visibility: 1,
            vibration: true,
            sound: "default",
          });
        }
      }
    }

    // Cancel all pending notifications to refresh the schedule
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    // Also cancel all native alarms to ensure ghost notifications are removed
    try {
      await NativeAlarm.cancelAllAlarms();
    } catch (alarmErr) {
      console.warn("[reminderService] Failed to cancel native alarms:", alarmErr);
    }

    const notifications: LocalNotificationSchema[] = [];
    const alarmNotifications: AlarmNotification[] = [];
    const now = new Date();

    activeReminders.forEach((r) => {
      const medicine = medicines?.find((m) => m.id === r.medicineId);
      let currentStock = medicine?.currentQuantity ?? 999;
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
            channelId: r.patientId
              ? patientChannelId(r.patientId)
              : CHANNEL_OWNER,
            sound: "default",
            extra: {
              type: "refill",
              medicineId: r.medicineId,
              patientId: r.patientId ?? null,
              route: "/medvault",
            },
          });
          alarmNotifications.push({
            id: stringToHash(r.id + "refill"),
            title: `Refill Needed: ${r.medicineName}`,
            body: `You are out of stock. Please refill to continue reminders.`,
            triggerAtMillis: next.getTime(),
            extra: JSON.stringify({
              type: "refill",
              reminderId: r.id,
              medicineId: r.medicineId,
              medicineName: r.medicineName,
              patientId: r.patientId ?? null,
              route: "/medvault",
            }),
          });
          break;
        }

        notifications.push({
          title: r.patientName
            ? `Time for ${r.patientName}'s ${r.medicineName}`
            : `Time for ${r.medicineName}`,
          body: r.patientName
            ? `${r.patientName}'s dose: ${r.dose}. Don't miss it!`
            : `Dose: ${r.dose}. Remember to take your medicine!`,
          id: stringToHash(r.id + next.toISOString()),
          // allowWhileIdle: fires even when Android is in Doze/battery-saver mode.
          // This is the key flag that makes notifications work fully offline.
          schedule: { at: next, allowWhileIdle: true },
          channelId: r.patientId ? patientChannelId(r.patientId) : CHANNEL_OWNER,
          sound: "default",
          actionTypeId: "MEDICINE_REMINDER",
          extra: {
            reminderId: r.id,
            medicineName: r.medicineName,
            patientName: r.patientName || null,
            patientId: r.patientId ?? null,
            dose: r.dose,
            scheduledTime: next.toISOString(),
            route: "/",
          },
        });
        alarmNotifications.push({
          id: stringToHash(r.id + next.toISOString()),
          title: r.patientName
            ? `Time for ${r.patientName}'s ${r.medicineName}`
            : `Time for ${r.medicineName}`,
          body: r.patientName
            ? `${r.patientName}'s dose: ${r.dose}. Don't miss it!`
            : `Dose: ${r.dose}. Remember to take your medicine!`,
          triggerAtMillis: next.getTime(),
          extra: JSON.stringify({
            reminderId: r.id,
            medicineName: r.medicineName,
            patientName: r.patientName || null,
            patientId: r.patientId ?? null,
            dose: r.dose,
            scheduledTime: next.toISOString(),
            route: "/",
          }),
        });

        if (medicine) currentStock -= doseAmount;
        if (r.repeatSchedule === "once") break;

        nextFrom = addMinutes(next, 1);
      }
    });

    if (notifications.length > 0) {
      console.log(`Scheduling ${notifications.length} notifications...`);
      await LocalNotifications.schedule({ notifications });
      // Mirror schedule to native AlarmManager for post-reboot reliability
      if (alarmNotifications.length > 0) {
        try {
          await NativeAlarm.scheduleAlarms({
            notifications: alarmNotifications,
          });
        } catch (alarmErr: any) {
          console.warn(
            "[reminderService] NativeAlarm fallback failed (non-fatal):",
            alarmErr
          );
          if (alarmErr?.message === "EXACT_ALARM_PERMISSION_REQUIRED") {
            notify.warning(
              "Permission Required",
              "Please grant exact alarm permission for reliable reminders."
            );
          }
        }
      }
    } else {
      console.log("No notifications to schedule.");
    }
  } catch (err) {
    console.error("Failed to schedule notifications:", err);
  }
};
