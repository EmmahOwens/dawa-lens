import { useEffect } from "react";
import { LocalNotifications, ActionPerformed } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { useApp } from "@/contexts/AppContext";
import { registerNotificationActions } from "@/services/reminderService";
import { toast } from "sonner";
import { addMinutes } from "date-fns";

export const NotificationHandler = () => {
  const { logDose, reminders } = useApp();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupNotifications = async () => {
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
          const { reminderId, medicineName, dose, scheduledTime } = notification.extra;

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
            // Remove the specific notification so it doesn't linger
            if (notification.id) {
              await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
            }

            await LocalNotifications.schedule({
              notifications: [
                {
                  title: `Snoozed: ${medicineName}`,
                  body: `Time to take your ${dose} of ${medicineName}`,
                  id: Math.floor(Math.random() * 1000000),
                  schedule: { at: snoozeTime },
                  actionTypeId: 'MEDICINE_REMINDER',
                  extra: notification.extra
                }
              ]
            });
            toast.info(`Snoozed ${medicineName} for 15 minutes.`);
          } else {
            // Default action (tap on notification body)
            // Navigation is handled by the router if we wanted, 
            // but for now, opening the app is enough.
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
