import { db, authAdmin } from '../../db.js';
import AppError from '../../utils/AppError.js';

/**
 * GET /api/v1/admin/audit-log?limit=50
 * Returns recent admin audit log entries.
 */
export const getAuditLog = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const snap = await db.collection('adminAuditLog')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const entries = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null,
    }));

    res.json({ status: 'success', data: entries });
  } catch (error) {
    console.error('[AdminSystem] getAuditLog error:', error);
    next(new AppError('Failed to fetch audit log', 500));
  }
};

/**
 * GET /api/v1/admin/system/health
 * Simple health check + Firestore connection test.
 */
export const getSystemHealth = async (req, res, next) => {
  try {
    const start = Date.now();
    await db.collection('adminAuditLog').limit(1).get();
    const firestoreLatencyMs = Date.now() - start;

    const userCount = await authAdmin.listUsers(1);

    res.json({
      status: 'success',
      data: {
        api: 'healthy',
        firestoreLatencyMs,
        timestamp: new Date().toISOString(),
        userCount: userCount.users.length > 0 ? 'ok' : 'no-users',
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      data: {
        api: 'degraded',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};
