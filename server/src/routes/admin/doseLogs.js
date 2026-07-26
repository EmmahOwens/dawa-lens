import { db } from '../../db.js';
import AppError from '../../utils/AppError.js';

function parseLogDate(docData) {
  if (!docData) return null;
  const raw = docData.actionTime || docData.createdAt || docData.timestamp || docData.loggedAt || docData.time || docData.date;
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseLogStatus(docData) {
  if (!docData) return 'unknown';
  return docData.action || docData.status || 'unknown';
}

/**
 * GET /api/v1/admin/dose-logs/recent?limit=25
 * Returns the most recent dose logs as FeedEvents for live feeds.
 */
export const getRecentDoseLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '25', 10);
    // Try to order by actionTime (preferred) or createdAt, fallback to unordered
    let snap;
    try {
      snap = await db.collection('doseLogs').orderBy('actionTime', 'desc').limit(300).get();
    } catch (err) {
      console.warn('[getRecentDoseLogs] Failed to order by actionTime, trying unordered:', err.message);
      try {
        snap = await db.collection('doseLogs').orderBy('createdAt', 'desc').limit(300).get();
      } catch (err2) {
        console.warn('[getRecentDoseLogs] Failed to order by createdAt, using unordered:', err2.message);
        snap = await db.collection('doseLogs').limit(300).get();
      }
    }
    snap = snap || { docs: [] };

    const events = snap.docs.map(doc => {
      const data = doc.data();
      const status = parseLogStatus(data);
      const med = data.medicineName || data.name || data.medicine || 'Medication';
      const dateObj = parseLogDate(data) || new Date();
      const ts = dateObj.toISOString();

      let type = 'dose_taken';
      let label = `Took ${med}`;
      if (status === 'missed') {
        type = 'dose_missed';
        label = `Missed ${med}`;
      } else if (status === 'skipped') {
        type = 'dose_skipped';
        label = `Skipped ${med}`;
      }

      return {
        id: doc.id,
        type,
        userId: data.userId || '',
        medicineName: med,
        status,
        createdAt: ts,
        label,
      };
    });

    // If dose logs are empty, supplement with recent admin audit logs
    if (events.length === 0) {
      const auditSnap = await db.collection('adminAuditLog').limit(20).get().catch(() => ({ docs: [] }));
      auditSnap.docs.forEach(doc => {
        const data = doc.data();
        events.push({
          id: doc.id,
          type: 'scan',
          userId: data.adminUid || data.targetUid || 'System',
          status: 'logged',
          createdAt: data.timestamp || new Date().toISOString(),
          label: `System event: ${data.action || 'activity'}`,
        });
      });
    }

    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      status: 'success',
      data: events.slice(0, limit),
    });
  } catch (error) {
    console.error('[AdminDoseLogs] getRecentDoseLogs error:', error);
    next(new AppError('Failed to fetch recent dose logs', 500));
  }
};

/**
 * GET /api/v1/admin/dose-logs/aggregate
 * Returns:
 *  - heatmap: 7x24 grid of dose density (dayOfWeek x hourOfDay)
 *  - breakdown: taken/missed/skipped counts
 *  - topMissHours: hours with the highest miss rates
 */
export const getAggregateStats = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snap = await db.collection('doseLogs').limit(5000).get();
    const docs = snap.docs.map(d => d.data());

    // Build heatmap: [dayOfWeek 0-6][hour 0-23] = count
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    let taken = 0, missed = 0, skipped = 0;

    docs.forEach(doc => {
      const date = parseLogDate(doc);
      if (!date || date < since) return;

      const day = date.getDay(); // 0=Sun, 6=Sat
      const hour = date.getHours();
      heatmap[day][hour]++;

      const status = parseLogStatus(doc);
      if (status === 'taken') taken++;
      else if (status === 'missed') missed++;
      else if (status === 'skipped') skipped++;
    });

    const total = taken + missed + skipped;
    const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

    // Flatten heatmap for frontend consumption
    const heatmapFlat = [];
    const days7 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        heatmapFlat.push({ day: days7[d], dayIndex: d, hour: h, count: heatmap[d][h] });
      }
    }

    res.json({
      status: 'success',
      data: {
        heatmap: heatmapFlat,
        breakdown: { taken, missed, skipped, total },
        adherenceRate,
        periodDays: days,
      },
    });
  } catch (error) {
    console.error('[AdminDoseLogs] getAggregateStats error:', error);
    next(new AppError('Failed to fetch dose log stats', 500));
  }
};

/**
 * GET /api/v1/admin/dose-logs/by-date?date=YYYY-MM-DD
 * Returns all dose log events that occurred on the given calendar date (UTC).
 * Also includes new-user registrations and scan events for that day.
 */
export const getEventsByDate = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return next(new AppError('Query param `date` must be in YYYY-MM-DD format', 400));
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${date}T23:59:59.999Z`);

    // Fetch all dose logs (no date index — filter in-memory)
    let snap;
    try {
      snap = await db.collection('doseLogs').orderBy('actionTime', 'desc').limit(5000).get();
    } catch {
      try {
        snap = await db.collection('doseLogs').orderBy('createdAt', 'desc').limit(5000).get();
      } catch {
        snap = await db.collection('doseLogs').limit(5000).get();
      }
    }

    const events = [];

    snap.docs.forEach(doc => {
      const data = doc.data();
      const dateObj = parseLogDate(data);
      if (!dateObj || dateObj < dayStart || dateObj > dayEnd) return;

      const status = parseLogStatus(data);
      const med = data.medicineName || data.name || data.medicine || 'Medication';
      const ts = dateObj.toISOString();

      let type = 'dose_taken';
      let label = `Took ${med}`;
      if (status === 'missed') { type = 'dose_missed'; label = `Missed ${med}`; }
      else if (status === 'skipped') { type = 'dose_skipped'; label = `Skipped ${med}`; }

      events.push({
        id: doc.id,
        type,
        userId: data.userId || '',
        medicineName: med,
        status,
        createdAt: ts,
        label,
      });
    });

    // Also pull audit log entries for this date
    const auditSnap = await db.collection('adminAuditLog').limit(1000).get().catch(() => ({ docs: [] }));
    auditSnap.docs.forEach(doc => {
      const data = doc.data();
      const raw = data.timestamp;
      if (!raw) return;
      const d = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
      if (isNaN(d.getTime()) || d < dayStart || d > dayEnd) return;
      events.push({
        id: doc.id,
        type: 'scan',
        userId: data.adminUid || 'Admin',
        status: 'logged',
        createdAt: d.toISOString(),
        label: `Admin action: ${data.action || 'activity'}`,
      });
    });

    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ status: 'success', data: events });
  } catch (error) {
    console.error('[AdminDoseLogs] getEventsByDate error:', error);
    next(new AppError('Failed to fetch events by date', 500));
  }
};
