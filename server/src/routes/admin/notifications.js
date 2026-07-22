import { db, messaging, authAdmin } from '../../db.js';
import AppError from '../../utils/AppError.js';

/**
 * POST /api/v1/admin/notifications/broadcast
 * Send FCM push notification to all users (or filtered segment).
 *
 * Body: { title, body, segment: 'all' | 'inactive_7d' | 'inactive_30d' }
 */
export const broadcastNotification = async (req, res, next) => {
  try {
    const { title, body, segment = 'all' } = req.body;

    if (!title || !body) {
      return next(new AppError('title and body are required', 400));
    }

    // Collect FCM tokens from user profiles
    let usersQuery = db.collection('users').limit(1000);

    if (segment === 'inactive_7d') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      usersQuery = usersQuery.where('lastActive', '<=', cutoff);
    } else if (segment === 'inactive_30d') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      usersQuery = usersQuery.where('lastActive', '<=', cutoff);
    }

    const snap = await usersQuery.get();
    const tokens = snap.docs
      .map(d => d.data().fcmToken)
      .filter(Boolean);

    let successCount = 0;
    let failureCount = 0;

    if (tokens.length > 0) {
      // FCM allows max 500 tokens per batch
      const BATCH_SIZE = 500;
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const result = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
        });
        successCount += result.successCount;
        failureCount += result.failureCount;
      }
    }

    // Audit log
    await db.collection('adminAuditLog').add({
      adminUid: req.user.uid,
      action: 'BROADCAST_NOTIFICATION',
      targetUid: null,
      timestamp: new Date(),
      metadata: { title, body, segment, successCount, failureCount, totalTargeted: tokens.length },
    });

    res.json({
      status: 'success',
      data: { successCount, failureCount, totalTargeted: tokens.length },
    });
  } catch (error) {
    console.error('[AdminNotifications] broadcastNotification error:', error);
    next(new AppError('Failed to send notification', 500));
  }
};

/**
 * GET /api/v1/admin/notifications/history
 * Recent broadcast history from audit log.
 */
export const getNotificationHistory = async (req, res, next) => {
  try {
    const snap = await db.collection('adminAuditLog')
      .where('action', '==', 'BROADCAST_NOTIFICATION')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const history = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null,
    }));

    res.json({ status: 'success', data: history });
  } catch (error) {
    next(new AppError('Failed to fetch notification history', 500));
  }
};
