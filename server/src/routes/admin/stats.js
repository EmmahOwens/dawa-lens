import { db, authAdmin } from '../../db.js';
import AppError from '../../utils/AppError.js';

/**
 * GET /api/v1/admin/stats/overview
 * Aggregate platform-wide statistics.
 */
export const getOverviewStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOf30Days = new Date(startOfToday);
    startOf30Days.setDate(startOf30Days.getDate() - 30);

    // Run all queries in parallel
    const [
      allUsersResult,
      newTodayResult,
      newWeekResult,
      medicinesResult,
      activeRemindersResult,
      takenLogsResult,
      missedLogsResult,
      skippedLogsResult,
    ] = await Promise.all([
      // Total user count via Auth (paginated, collect all)
      authAdmin.listUsers(1000),
      // New users today / this week via Firestore users collection
      db.collection('users')
        .where('createdAt', '>=', startOfToday)
        .count().get(),
      db.collection('users')
        .where('createdAt', '>=', startOfWeek)
        .count().get(),
      // Total medicines tracked
      db.collection('medicines').count().get(),
      // Active reminders (isActive flag or no disabled flag)
      db.collection('reminders').count().get(),
      // Dose adherence over last 30 days
      db.collection('doseLogs')
        .where('createdAt', '>=', startOf30Days)
        .where('status', '==', 'taken')
        .count().get(),
      db.collection('doseLogs')
        .where('createdAt', '>=', startOf30Days)
        .where('status', '==', 'missed')
        .count().get(),
      db.collection('doseLogs')
        .where('createdAt', '>=', startOf30Days)
        .where('status', '==', 'skipped')
        .count().get(),
    ]);

    const totalUsers = allUsersResult.users.length;
    const newToday = newTodayResult.data().count;
    const newThisWeek = newWeekResult.data().count;
    const totalMedicines = medicinesResult.data().count;
    const activeReminders = activeRemindersResult.data().count;

    const taken = takenLogsResult.data().count;
    const missed = missedLogsResult.data().count;
    const skipped = skippedLogsResult.data().count;
    const totalLogs = taken + missed + skipped;
    const adherenceRate = totalLogs > 0 ? Math.round((taken / totalLogs) * 100) : 0;

    res.json({
      status: 'success',
      data: {
        users: {
          total: totalUsers,
          newToday,
          newThisWeek,
        },
        medications: {
          total: totalMedicines,
          activeReminders,
        },
        adherence: {
          rate: adherenceRate,
          taken,
          missed,
          skipped,
          total: totalLogs,
        },
      },
    });
  } catch (error) {
    console.error('[AdminStats] getOverviewStats error:', error);
    next(new AppError('Failed to fetch overview stats', 500));
  }
};

/**
 * GET /api/v1/admin/stats/growth?days=30
 * Daily new user signups for the sparkline/area chart.
 */
export const getGrowthStats = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const points = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const snap = await db.collection('users')
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .count().get();

      points.push({
        date: dayStart.toISOString().split('T')[0],
        count: snap.data().count,
      });
    }

    res.json({ status: 'success', data: points });
  } catch (error) {
    console.error('[AdminStats] getGrowthStats error:', error);
    next(new AppError('Failed to fetch growth stats', 500));
  }
};

/**
 * GET /api/v1/admin/stats/adherence-trend?days=30
 * Daily adherence % for the trend line chart.
 */
export const getAdherenceTrend = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const points = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [takenSnap, totalSnap] = await Promise.all([
        db.collection('doseLogs')
          .where('createdAt', '>=', dayStart)
          .where('createdAt', '<', dayEnd)
          .where('status', '==', 'taken')
          .count().get(),
        db.collection('doseLogs')
          .where('createdAt', '>=', dayStart)
          .where('createdAt', '<', dayEnd)
          .count().get(),
      ]);

      const taken = takenSnap.data().count;
      const total = totalSnap.data().count;
      const rate = total > 0 ? Math.round((taken / total) * 100) : null;

      points.push({
        date: dayStart.toISOString().split('T')[0],
        rate,
        taken,
        total,
      });
    }

    res.json({ status: 'success', data: points });
  } catch (error) {
    console.error('[AdminStats] getAdherenceTrend error:', error);
    next(new AppError('Failed to fetch adherence trend', 500));
  }
};
