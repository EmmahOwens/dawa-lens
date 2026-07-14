import { useEffect } from "react";
import { LocalNotifications, ActionPerformed } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { useApp } from "@/contexts/AppContext";
import { registerNotificationActions, migrateNotificationChannels } from "@/services/reminderService";
import { toast } from "sonner";
import { addMinutes } from "date-fns";
import { useNavigate } from "react-router-dom";

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

      // Handle notification received while app is in foreground
      const receivedListener = await LocalNotifications.addListener(
        'localNotificationReceived',
        (notification) => {
          console.log('Notification received in foreground:', notification);
          toast.info(`Reminder: ${notification.title}`, {
            description: notification.body,
            duration: 5000,
          });
        }
      );

      // Handle notification action (click or button press)
      const actionListener = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        async (action: ActionPerformed) => {
          const { notification, actionId } = action;
          const { reminderId, medicineName, dose, scheduledTime } = notification.extra || {};

          console.log('Action performed:', actionId, notification);

          if (actionId === 'TAKE') {
            try {
              // Log the dose and let AppContext handle inventory & history
              await logDose({
                reminderId,
                medicineName,
                dose,
                scheduledTime: scheduledTime || new Date().toISOString(),
                action: 'taken'
              });

              // Remove the specific notification so it doesn't linger
              if (notification.id) {
                await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
              }

              toast.success(`Logged: ${medicineName} taken.`);
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
                action: 'skipped'
              });
              toast.warning(`${medicineName} skipped.`);
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
            // Avoids ID collisions when a user snoozes multiple reminders.
            const snoozeId = Math.abs(
              (reminderId + snoozeTime.getTime().toString())
                .split('')
                .reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)
            );

            await LocalNotifications.schedule({
              notifications: [
                {
                  title: `Snoozed: ${medicineName}`,
                  body: `Time to take your ${dose} of ${medicineName}`,
                  id: snoozeId,
                  // allowWhileIdle so the snooze fires even in Doze/offline mode
                  schedule: { at: snoozeTime, allowWhileIdle: true },
                  channelId: 'dawa_reminders_v2',
                  sound: 'default',
                  actionTypeId: 'MEDICINE_REMINDER',
                  extra: notification.extra
                }
              ]
            });
            
            try {
              await logDose({
                reminderId,
                medicineName,
                dose,
                scheduledTime: scheduledTime || new Date().toISOString(),
                action: 'snoozed',
                isSnoozed: true,
                snoozeUntil: snoozeTime.toISOString()
              });
            } catch (err) {
              console.error('Failed to log snooze from notification:', err);
            }
            
            toast.info(`Snoozed ${medicineName} for 15 minutes.`);
          } else {
            // Default action (tap on notification body)
            const extra = notification.extra || {};
            
            // 1. Sync the active patient context if patientId is provided
            if ('patientId' in extra) {
              setSelectedPatientId(extra.patientId);
            }

            // 2. Navigate to the target route if specified
            if (extra.route) {
              navigate(extra.route);
            } else if (extra.type === 'low_stock' || extra.type === 'refill') {
              navigate('/medvault');
            } else if (extra.type === 'missed_alert') {
              if (extra.patientId) {
                navigate('/family');
              } else {
                navigate('/history');
              }
            } else if (extra.reminderId) {
              // It's a standard reminder
              if (extra.patientId) {
                navigate('/family');
              } else {
                navigate('/');
              }
            }
          }
        }
      );

      return () => {
        receivedListener.remove();
        actionListener.remove();
      };
    };

    setupNotifications();
  }, [logDose, reminders]);

  return null;
};
