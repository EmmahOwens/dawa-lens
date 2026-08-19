import { useEffect } from "react";
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupNotifications = async () => {
      // One-time migration: delete old silent channels and let v2 ones take over.
      // Safe to call every launch — guarded internally by a localStorage flag.
      await migrateNotificationChannels();
      await registerNotificationActions();

      // Handle notification received while app is in foreground.
      // IMPORTANT: Only intercept medication reminders (those carrying a
      // reminderId) and convert them to an in-app toast so the user can act
      // without leaving the current screen.
      const receivedListener = await LocalNotifications.addListener(
        'localNotificationReceived',
        (notification) => {
          console.log('Notification received in foreground:', notification);

          const extra = parseNotificationExtra(notification.extra);
          const isReminder = !!extra.reminderId;

          // Only show in-app toast for medication reminders
          if (isReminder) {
            toast.info(`Reminder: ${notification.title}`, {
              description: notification.body,
              duration: 5000,
            });
          }
        }
      );

      // Handle notification action (click or button press)
      const actionListener = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        async (action: ActionPerformed) => {
          try {
            const { notification, actionId } = action;
            const extra = parseNotificationExtra(notification.extra);
            const { reminderId, medicineName, dose, scheduledTime } = extra;

            console.log('Action performed:', actionId, notification, extra);

            // Lookup matching reminder if extra.patientId is not explicitly specified
            let targetPatientId = extra.patientId;
            if (targetPatientId === undefined && reminderId) {
              const matched = reminders.find((r) => r.id === reminderId);
              if (matched) {
                targetPatientId = matched.patientId ?? null;
              }
            }

            if (actionId === 'TAKE') {
              try {
                // Log the dose and let AppContext handle inventory & history
                await logDose({
                  reminderId,
                  medicineName,
                  dose,
                  scheduledTime: scheduledTime || new Date().toISOString(),
                  patientId: targetPatientId ?? null,
                  action: 'taken'
                });

                // Remove the specific notification so it doesn't linger
                if (notification.id) {
                  await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
                }

                toast.success(`Logged: ${medicineName || "Dose"} taken.`);
              } catch (err) {
                console.error('Failed to log dose from notification:', err);
              }
            } else if (actionId === 'SKIP') {
              try {
                await logDose({
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
              // Remove the original notification
              if (notification.id) {
                await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
              }

              // Use a deterministic ID: hash of reminderId + snooze timestamp
              const snoozeId = Math.abs(
                (String(reminderId || "med") + snoozeTime.getTime().toString())
                  .split('')
                  .reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)
              );

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
              
              try {
                await logDose({
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
              // Default action (tap on notification body)
              if (targetPatientId !== undefined) {
                setSelectedPatientId(targetPatientId);
              }

              // Navigate based on explicit route or notification type
              const notifType = extra.type as string | undefined;
              if (extra.route) {
                navigate(extra.route);
              } else if (notifType === 'low_stock' || notifType === 'refill') {
                navigate('/medvault');
              } else if (notifType === 'missed_alert') {
                navigate(targetPatientId ? '/family' : '/history');
              } else if (notifType === 'daily_quote' || notifType === 'encouragement' || notifType === 'hydration' || notifType === 'evening_checkin') {
                navigate('/');
              } else if (notifType === 'weekly_summary' || notifType === 'streak') {
                navigate('/history');
              } else if (notifType === 'wellness_nudge') {
                navigate('/wellness');
              } else if (reminderId) {
                navigate(targetPatientId ? '/family' : '/');
              }
            }
          } catch (handlerErr) {
            console.error('[NotificationHandler] Error processing action:', handlerErr);
          }
        }
      );

      return () => {
        receivedListener.remove();
        actionListener.remove();
      };
    };

    setupNotifications();
  }, [logDose, reminders, setSelectedPatientId, navigate]);

  return null;
};
