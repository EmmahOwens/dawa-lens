import { messaging, db } from '../db.js';

/**
 * Send a push notification to a specific user.
 * @param {string} userId - The user ID to notify.
 * @param {object} payload - The notification payload { title, body, data }.
 */
export const sendPushNotification = async (userId, { title, body, data = {} }) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const fcmToken = userDoc.data().fcmToken;
    if (!fcmToken) {
      console.log(`No FCM token found for user ${userId}`);
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Legacy but sometimes helps
      },
      token: fcmToken,
      // Capacitor / Android specific high priority
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.send(message);
    console.log(`Notification sent to ${userId}: ${response}`);
    return response;
  } catch (error) {
    console.error(`Error sending notification to ${userId}:`, error.message);
  }
};

/**
 * Broadcast notification to multiple users.
 */
export const broadcastNotification = async (userIds, payload) => {
  return Promise.all(userIds.map(id => sendPushNotification(id, payload)));
};
