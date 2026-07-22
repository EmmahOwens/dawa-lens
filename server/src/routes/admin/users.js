import { db, authAdmin } from '../../db.js';
import AppError from '../../utils/AppError.js';

/**
 * POST /api/v1/admin/bootstrap-claim
 * Allows setting the admin claim using a secret key (runs directly on Render server).
 * Body: { uid: string, secret: string }
 */
export const bootstrapClaim = async (req, res, next) => {
  try {
    const { uid, secret } = req.body;
    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || process.env.FIREBASE_PROJECT_ID || 'dawa-lens-admin-secret';

    if (!uid || !secret) {
      return next(new AppError('uid and secret are required', 400));
    }

    if (secret !== expectedSecret) {
      return next(new AppError('Invalid bootstrap secret', 403));
    }

    await authAdmin.setCustomUserClaims(uid, { admin: true });
    const user = await authAdmin.getUser(uid);

    // Write audit log
    await db.collection('adminAuditLog').add({
      adminUid: uid,
      action: 'BOOTSTRAP_ADMIN_CLAIM',
      targetUid: uid,
      timestamp: new Date(),
      metadata: { email: user.email },
    }).catch(() => {});

    res.json({
      status: 'success',
      message: `Admin claim granted to ${user.email || user.uid}`,
      uid: user.uid,
    });
  } catch (error) {
    console.error('[AdminUsers] bootstrapClaim error:', error);
    next(new AppError('Failed to grant admin claim: ' + error.message, 500));
  }
};

/**
 * GET /api/v1/admin/users?page=1&search=&from=&to=
 * Paginated list of all users (Auth + Firestore profile merged).
 */
export const listUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = 50;
    const search = (req.query.search || '').toLowerCase();

    const listResult = await authAdmin.listUsers(1000);
    let users = listResult.users.map(u => ({
      uid: u.uid,
      email: u.email || '',
      displayName: u.displayName || '',
      photoURL: u.photoURL || null,
      disabled: u.disabled,
      createdAt: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime,
      emailVerified: u.emailVerified,
      customClaims: u.customClaims || {},
    }));

    if (search) {
      users = users.filter(u =>
        u.email.toLowerCase().includes(search) ||
        u.displayName.toLowerCase().includes(search)
      );
    }

    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = users.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginated = users.slice((page - 1) * pageSize, page * pageSize);

    const enriched = await Promise.all(paginated.map(async u => {
      try {
        const [medCount, doseSnap] = await Promise.all([
          db.collection('medicines').where('userId', '==', u.uid).count().get(),
          db.collection('doseLogs')
            .where('userId', '==', u.uid)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get(),
        ]);
        return {
          ...u,
          medicineCount: medCount.data().count,
          lastActivity: doseSnap.empty ? null : doseSnap.docs[0].data().createdAt?.toDate?.()?.toISOString() || null,
        };
      } catch {
        return { ...u, medicineCount: 0, lastActivity: null };
      }
    }));

    res.json({
      status: 'success',
      data: enriched,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    console.error('[AdminUsers] listUsers error:', error);
    next(new AppError('Failed to fetch users', 500));
  }
};

/**
 * GET /api/v1/admin/users/:uid
 * Single user profile + stats.
 */
export const getUser = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const [authUser, profileSnap, medCount, doseStats] = await Promise.all([
      authAdmin.getUser(uid),
      db.collection('users').doc(uid).get(),
      db.collection('medicines').where('userId', '==', uid).count().get(),
      db.collection('doseLogs').where('userId', '==', uid).limit(500).get(),
    ]);

    const doses = doseStats.docs.map(d => d.data());
    const taken = doses.filter(d => d.status === 'taken').length;
    const total = doses.length;
    const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

    res.json({
      status: 'success',
      data: {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        disabled: authUser.disabled,
        emailVerified: authUser.emailVerified,
        createdAt: authUser.metadata.creationTime,
        lastSignIn: authUser.metadata.lastSignInTime,
        customClaims: authUser.customClaims || {},
        profile: profileSnap.exists ? profileSnap.data() : null,
        stats: {
          medicineCount: medCount.data().count,
          doseLogCount: total,
          adherenceRate,
        },
      },
    });
  } catch (error) {
    console.error('[AdminUsers] getUser error:', error);
    next(new AppError('Failed to fetch user', 500));
  }
};

/**
 * PATCH /api/v1/admin/users/:uid
 * Suspend or unsuspend a user account.
 */
export const updateUser = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { disabled } = req.body;

    if (typeof disabled !== 'boolean') {
      return next(new AppError('`disabled` must be a boolean', 400));
    }

    await authAdmin.updateUser(uid, { disabled });

    await db.collection('adminAuditLog').add({
      adminUid: req.user.uid,
      action: disabled ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
      targetUid: uid,
      timestamp: new Date(),
      metadata: { disabled },
    });

    res.json({
      status: 'success',
      message: disabled ? 'User suspended.' : 'User unsuspended.',
    });
  } catch (error) {
    console.error('[AdminUsers] updateUser error:', error);
    next(new AppError('Failed to update user', 500));
  }
};

/**
 * DELETE /api/v1/admin/users/:uid
 * Hard delete: removes Auth account + all Firestore user data.
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const COLLECTIONS = ['medicines', 'reminders', 'doseLogs', 'wellnessLogs', 'patients'];

    await Promise.all(COLLECTIONS.map(async col => {
      const snap = await db.collection(col).where('userId', '==', uid).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }));

    await db.collection('users').doc(uid).delete().catch(() => {});
    await authAdmin.deleteUser(uid);

    await db.collection('adminAuditLog').add({
      adminUid: req.user.uid,
      action: 'DELETE_USER',
      targetUid: uid,
      timestamp: new Date(),
      metadata: {},
    });

    res.json({ status: 'success', message: 'User and all associated data deleted.' });
  } catch (error) {
    console.error('[AdminUsers] deleteUser error:', error);
    next(new AppError('Failed to delete user', 500));
  }
};
