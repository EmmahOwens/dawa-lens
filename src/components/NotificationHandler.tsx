import { useEffect, useRef } from "react";
import { LocalNotifications, ActionPerformed } from "@capacitor/local-notifications";
import { PushNotifications, ActionPerformed as PushActionPerformed } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { useApp } from "@/contexts/AppContext";
import { registerNotificationActions, migrateNotificationChannels } from "@/services/reminderService";
import { soundService } from "@/services/soundService";
import { toast } from "sonner";
import {
  addMinutes,
  isSameDay,
  startOfDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";
import { useNavigate } from "react-router-dom";
import { isReminderScheduledOnDate } from "@/services/reminderService";

export const parseNotificationExtra = (rawExtra: unknown): Record<string, any> => {
  if (!rawExtra) return {};
  if (typeof rawExtra === "object") return rawExtra as Record<string, any>;
  if (typeof rawExtra === "string") {
    try {
      const parsed = JSON.parse(rawExtra);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

export const NotificationHandler = () => {
  const navigate = useNavigate();
  const {
    logDose,
    reminders,
    doseLogs,
    patients,
    selectedPatientId,
    setSelectedPatientId,
  } = useApp();

  // Use refs so the single effect closure always sees the latest values
  // without needing to re-register Capacitor listeners on every change.
  const navigateRef = useRef(navigate);
  const logDoseRef = useRef(logDose);
  const remindersRef = useRef(reminders);
  const doseLogsRef = useRef(doseLogs);
  const patientsRef = useRef(patients);
  const selectedPatientIdRef = useRef(selectedPatientId);
  const setSelectedPatientIdRef = useRef(setSelectedPatientId);

  navigateRef.current = navigate;
  logDoseRef.current = logDose;
  remindersRef.current = reminders;
  doseLogsRef.current = doseLogs;
  patientsRef.current = patients;
  selectedPatientIdRef.current = selectedPatientId;
  setSelectedPatientIdRef.current = setSelectedPatientId;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let receivedListenerHandle: { remove: () => void } | null = null;
    let actionListenerHandle: { remove: () => void } | null = null;
    let isCancelled = false;

    const setupNotifications = async () => {
      try {
        await migrateNotificationChannels();
        await registerNotificationActions();
      } catch (setupErr) {
        console.warn("[NotificationHandler] Setup warning:", setupErr);
      }

      if (isCancelled) return;

      try {
        const receivedListener = await LocalNotifications.addListener(
          'localNotificationReceived',
          (notification) => {
            console.log('Notification received in foreground:', notification);
            const extra = parseNotificationExtra(notification.extra);
            const notifType = extra.type as string | undefined;

            // Strict check: if this notification references a reminder, verify it exists and is enabled
            if (extra.reminderId) {
              const exists = remindersRef.current.some((r) => r.id === extra.reminderId && r.enabled);
              if (!exists) {
                console.log(`[NotificationHandler] Discarding notification for deleted/disabled reminder: ${extra.reminderId}`);
                if (notification.id) {
                  LocalNotifications.cancel({ notifications: [{ id: notification.id }] }).catch(console.warn);
                }
                return;
              }
            }

            if (notifType === "missed_alert") {
              // If there are no active reminders at all, do not show missed dose alerts
              if (remindersRef.current.length === 0 || remindersRef.current.every((r) => !r.enabled)) {
                if (notification.id) {
                  LocalNotifications.cancel({ notifications: [{ id: notification.id }] }).catch(console.warn);
                }
                return;
              }
              soundService.tryPlayForCategory("missed");
              toast.error(notification.title || "Missed Dose Alert", {
                description: notification.body,
                duration: 6000,
              });
              return;
            } else if (notifType === "streak" || notifType === "encouragement") {
              soundService.tryPlayForCategory("taken");
              toast.success(notification.title || "Health Milestone", {
                description: notification.body,
                duration: 5000,
              });
              return;
            } else if (notifType === "hydration") {
              soundService.tryPlayForCategory("hydration");
              toast.info(notification.title || "Hydration Reminder", {
                description: notification.body,
                duration: 5000,
              });
              return;
            } else if (notifType === "schedule_adjusted" || notifType === "daily_quote" || notifType === "wellness_nudge") {
              soundService.tryPlayForCategory("quotes");
              toast.info(notification.title || "Health Reminder", {
                description: notification.body,
                duration: 5000,
              });
              return;
            } else if (notifType === "refill") {
              soundService.tryPlayForCategory("refill");
              toast.warning(notification.title || "Refill Alert", {
                description: notification.body,
                duration: 5000,
              });
              return;
            } else if (notifType === "low_stock") {
              // Bug 5 fix: low_stock was silently falling through without a sound
              soundService.tryPlayForCategory("refill");
              toast.warning(notification.title || "Low Stock Alert", {
                description: notification.body,
                duration: 5000,
              });
              return;
            } else if (notifType === "evening_checkin") {
              // Bug 5 fix: evening_checkin was silently falling through without a sound
              soundService.tryPlayForCategory("quotes");
              toast.info(notification.title || "Evening Check-In", {
                description: notification.body,
                duration: 5000,
              });
              return;
            }

            const isReminder = !!extra.reminderId;
            if (isReminder) {
              soundService.tryPlayForCategory("medication");
              toast.info(`Reminder: ${notification.title}`, {
                description: notification.body,
                duration: 5000,
              });
            }
          }
        );

        if (isCancelled) {
          receivedListener.remove();
        } else {
          receivedListenerHandle = receivedListener;
        }

        const actionListener = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          async (action: ActionPerformed) => {
            try {
              const { notification, actionId } = action;
              const extra = parseNotificationExtra(notification.extra);
              const { reminderId, medicineName, dose, scheduledTime } = extra;

              console.log('Action performed:', actionId, notification, extra);

              let targetPatientId = extra.patientId;
              if (reminderId) {
                const matched = remindersRef.current.find((r) => r.id === reminderId);
                if (!matched) {
                  console.log(`[NotificationHandler] Ignoring action for deleted reminder: ${reminderId}`);
                  if (notification.id) {
                    await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
                  }
                  return;
                }
                if (targetPatientId === undefined) {
                  targetPatientId = matched.patientId ?? null;
                }
              }

              if (actionId === 'TAKE') {
                try {
                  await logDoseRef.current({
                    reminderId,
                    medicineName,
                    dose,
                    scheduledTime: scheduledTime || new Date().toISOString(),
                    patientId: targetPatientId ?? null,
                    action: 'taken'
                  });

                  if (notification.id) {
                    await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
                  }

                  toast.success(`Logged: ${medicineName || "Dose"} taken.`);
                } catch (err) {
                  console.error('Failed to log dose from notification:', err);
                }
              } else if (actionId === 'SKIP') {
                try {
                  await logDoseRef.current({
                    reminderId,
                    medicineName,
                    dose,
                    scheduledTime: scheduledTime || new Date().toISOString(),
                    patientId: targetPatientId ?? null,
                    action: 'skipped'
                  });
                  toast.warning(`${medicineName || "Dose"} skipped.`);
                } catch (err) {
                  console.error('Failed to skip dose from notification:', err);
                }
              } else if (actionId === 'SNOOZE') {
                const snoozeTime = addMinutes(new Date(), 15);
                if (notification.id) {
                  try {
                    await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
                  } catch (e) {
                    console.warn("[NotificationHandler] cancel failed:", e);
                  }
                }

                // Use safe 32-bit positive integer
                const hashRaw = (String(reminderId || "med") + snoozeTime.getTime().toString())
                  .split('')
                  .reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
                const snoozeId = (Math.abs(hashRaw % 2147483647) || 1);

                try {
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        title: `Snoozed: ${medicineName || "Medication"}`,
                        body: `Time to take your ${dose || "prescribed"} dose of ${medicineName || "medicine"}`,
                        id: snoozeId,
                        schedule: { at: snoozeTime, allowWhileIdle: true },
                        channelId: soundService.getChannelIdForCategory("medication"),
                        sound: soundService.getAndroidResourceForCategory("medication") || "default",
                        actionTypeId: 'MEDICINE_REMINDER',
                        extra: extra
                      }
                    ]
                  });
                } catch (schedErr) {
                  console.warn("[NotificationHandler] Failed to schedule snooze:", schedErr);
                }
                
                try {
                  await logDoseRef.current({
                    reminderId,
                    medicineName,
                    dose,
                    scheduledTime: scheduledTime || new Date().toISOString(),
                    patientId: targetPatientId ?? null,
                    action: 'snoozed',
                    isSnoozed: true,
                    snoozeUntil: snoozeTime.toISOString()
                  });
                } catch (err) {
                  console.error('Failed to log snooze from notification:', err);
                }
                
                toast.info(`Snoozed ${medicineName || "medication"} for 15 minutes.`);
              } else {
                if (targetPatientId !== undefined) {
                  setSelectedPatientIdRef.current(targetPatientId);
                }

                const notifType = extra.type as string | undefined;
                if (extra.route) {
                  navigateRef.current(extra.route);
                } else if (notifType === 'low_stock' || notifType === 'refill') {
                  navigateRef.current('/medvault');
                } else if (notifType === 'missed_alert') {
                  navigateRef.current(targetPatientId ? '/family' : '/history');
                } else if (notifType === 'daily_quote' || notifType === 'encouragement' || notifType === 'hydration' || notifType === 'evening_checkin') {
                  navigateRef.current('/');
                } else if (notifType === 'weekly_summary' || notifType === 'streak') {
                  navigateRef.current('/history');
                } else if (notifType === 'wellness_nudge') {
                  navigateRef.current('/wellness');
                } else if (reminderId) {
                  navigateRef.current(targetPatientId ? '/family' : '/');
                }
              }
            } catch (handlerErr) {
              console.error('[NotificationHandler] Error processing action:', handlerErr);
            }
          }
        );

        // Push notification listeners (FCM)
        const pushReceivedListener = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            console.log("[NotificationHandler] FCM Push received in foreground:", notification);
            toast.info(notification.title || "Health Alert", {
              description: notification.body,
              duration: 6000,
            });
          }
        );

        const pushActionListener = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action: PushActionPerformed) => {
            console.log("[NotificationHandler] FCM Push tapped:", action);
            const data = action.notification.data || {};
            if (data.route) {
              navigateRef.current(data.route);
            } else if (data.channelId?.startsWith("dawa_missed_") || data.channelId === "dawa_missed_v2" || data.type === "missed_alert") {
              navigateRef.current("/history");
            } else {
              navigateRef.current("/");
            }
          }
        );

        if (isCancelled) {
          actionListener.remove();
          pushReceivedListener.remove();
          pushActionListener.remove();
        } else {
          actionListenerHandle = actionListener;
          pushReceivedHandle = pushReceivedListener;
          pushActionHandle = pushActionListener;
        }
      } catch (listenerErr) {
        console.warn("[NotificationHandler] Failed to attach notification listeners:", listenerErr);
      }
    };

    let pushReceivedHandle: { remove: () => void } | null = null;
    let pushActionHandle: { remove: () => void } | null = null;

    setupNotifications();

    return () => {
      isCancelled = true;
      if (receivedListenerHandle) {
        receivedListenerHandle.remove();
      }
      if (actionListenerHandle) {
        actionListenerHandle.remove();
      }
      if (pushReceivedHandle) {
        pushReceivedHandle.remove();
      }
      if (pushActionHandle) {
        pushActionHandle.remove();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Request web notification permissions when supported
  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() &&
      typeof window !== "undefined" &&
      "Notification" in window
    ) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Universal in-app due dose reminder engine (runs across both web & native)
  useEffect(() => {
    const checkDueReminders = () => {
      const activeReminders = remindersRef.current.filter((r) => r.enabled);
      if (activeReminders.length === 0) return;

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const nowTotalMin = currentHours * 60 + currentMinutes;

      for (const r of activeReminders) {
        if (!isReminderScheduledOnDate(r, now, doseLogsRef.current)) {
          continue;
        }

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
          const [h, m] = timeStr.split(":").map(Number);
          const slotTotalMin = h * 60 + m;
          const diffMinutes = nowTotalMin - slotTotalMin;

          // Alert if slot was scheduled within the last 15 minutes (diff 0 to 15)
          if (diffMinutes < 0 || diffMinutes > 15) {
            continue;
          }

          let scheduledDate = setHours(startOfDay(now), h);
          scheduledDate = setMinutes(scheduledDate, m);
          scheduledDate = setSeconds(scheduledDate, 0);
          scheduledDate = setMilliseconds(scheduledDate, 0);

          // Check if dose was already actioned (taken, skipped, or snoozed)
          const targetPatientId = r.patientId ?? null;
          const alreadyLogged = doseLogsRef.current.some((l) => {
            if ((l.patientId ?? null) !== targetPatientId) return false;
            const matchesMed =
              l.reminderId === r.id ||
              (Boolean(l.medicineName) &&
                Boolean(r.medicineName) &&
                l.medicineName.toLowerCase().trim() === r.medicineName.toLowerCase().trim());
            if (!matchesMed) return false;

            const logDate = new Date(l.scheduledTime || l.actionTime);
            if (!isSameDay(logDate, now)) return false;

            const logMin = logDate.getHours() * 60 + logDate.getMinutes();
            if (Math.abs(logMin - slotTotalMin) <= 15) {
              if (l.isSnoozed && l.snoozeUntil && new Date(l.snoozeUntil).getTime() > now.getTime()) {
                return true; // currently snoozed
              }
              return true; // already taken / skipped
            }
            return false;
          });

          if (alreadyLogged) continue;

          // Deduplicate in-app alert for this slot today
          const sessionKey = `dawa_inapp_alert_${r.id}_${now.toDateString()}_${timeStr}`;
          if (sessionStorage.getItem(sessionKey)) {
            continue;
          }
          sessionStorage.setItem(sessionKey, "1");

          const isOwner = !r.patientId;
          const resolvedPatientName =
            r.patientName ||
            (r.patientId ? patientsRef.current.find((p) => p.id === r.patientId)?.name : null);

          const title = isOwner
            ? `Personal Reminder: ${r.medicineName}`
            : `${resolvedPatientName || "Patient"}'s Reminder: ${r.medicineName}`;

          const description = isOwner
            ? `Time to take your ${r.dose} dose (${timeStr})`
            : `Time for ${resolvedPatientName || "patient"}'s ${r.dose} dose (${timeStr})`;

          soundService.tryPlayForCategory("medication");

          // Web notification if available and permission granted
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification(title, {
                body: description,
                icon: "/icon-192.png",
                tag: sessionKey,
              });
            } catch (e) {}
          }

          toast.info(title, {
            description,
            duration: 12000,
            action: {
              label: "Mark Taken",
              onClick: async () => {
                try {
                  await logDoseRef.current({
                    reminderId: r.id,
                    medicineName: r.medicineName,
                    dose: r.dose,
                    scheduledTime: scheduledDate.toISOString(),
                    patientId: targetPatientId,
                    action: "taken",
                  });
                  toast.success(`Logged: ${r.medicineName} taken.`);
                } catch (err) {
                  console.error("Failed to log dose from in-app alert:", err);
                }
              },
            },
            cancel: {
              label: "Snooze (15m)",
              onClick: async () => {
                try {
                  const snoozeTime = addMinutes(new Date(), 15);
                  await logDoseRef.current({
                    reminderId: r.id,
                    medicineName: r.medicineName,
                    dose: r.dose,
                    scheduledTime: scheduledDate.toISOString(),
                    patientId: targetPatientId,
                    action: "snoozed",
                    isSnoozed: true,
                    snoozeUntil: snoozeTime.toISOString(),
                  });
                  toast.info(`Snoozed ${r.medicineName} for 15 minutes.`);
                } catch (err) {
                  console.error("Failed to snooze dose from in-app alert:", err);
                }
              },
            },
          });
        }
      }
    };

    // Run immediately on mount
    checkDueReminders();

    // Check periodically every 20 seconds
    const intervalId = setInterval(checkDueReminders, 20_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkDueReminders();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, []);

  return null;
};
