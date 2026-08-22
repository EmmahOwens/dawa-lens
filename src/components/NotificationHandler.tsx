import { useEffect, useRef } from "react";
import { LocalNotifications, ActionPerformed } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { useApp } from "@/contexts/AppContext";
import { registerNotificationActions, migrateNotificationChannels } from "@/services/reminderService";
import { toast } from "sonner";
import { addMinutes } from "date-fns";
import { useNavigate } from "react-router-dom";

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
  const { logDose, reminders, setSelectedPatientId } = useApp();

  // Use refs so the single effect closure always sees the latest values
  // without needing to re-register Capacitor listeners on every change.
  const navigateRef = useRef(navigate);
  const logDoseRef = useRef(logDose);
  const remindersRef = useRef(reminders);
  const setSelectedPatientIdRef = useRef(setSelectedPatientId);

  navigateRef.current = navigate;
  logDoseRef.current = logDose;
  remindersRef.current = reminders;
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

            if (notifType === "missed_alert") {
              toast.error(notification.title || "Missed Dose Alert", {
                description: notification.body,
                duration: 6000,
              });
              return;
            } else if (notifType === "streak" || notifType === "encouragement") {
              toast.success(notification.title || "Health Milestone", {
                description: notification.body,
                duration: 5000,
              });
              return;
            } else if (notifType === "schedule_adjusted" || notifType === "daily_quote" || notifType === "wellness_nudge" || notifType === "hydration") {
              toast.info(notification.title || "Health Reminder", {
                description: notification.body,
                duration: 5000,
              });
              return;
            }

            const isReminder = !!extra.reminderId;

            if (isReminder) {
              const exists = remindersRef.current.some((r) => r.id === extra.reminderId && r.enabled);
              if (!exists) {
                console.log(`[NotificationHandler] Discarding notification for deleted/disabled reminder: ${extra.reminderId}`);
                if (notification.id) {
                  LocalNotifications.cancel({ notifications: [{ id: notification.id }] }).catch(console.warn);
                }
                return;
              }

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
                        channelId: 'dawa_reminders_v2',
                        sound: 'default',
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

        if (isCancelled) {
          actionListener.remove();
        } else {
          actionListenerHandle = actionListener;
        }
      } catch (listenerErr) {
        console.warn("[NotificationHandler] Failed to attach notification listeners:", listenerErr);
      }
    };

    setupNotifications();

    return () => {
      isCancelled = true;
      if (receivedListenerHandle) {
        receivedListenerHandle.remove();
      }
      if (actionListenerHandle) {
        actionListenerHandle.remove();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};
