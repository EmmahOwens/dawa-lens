import { db } from '../../db.js';
import AppError from '../../utils/AppError.js';

function parseLogDate(docData) {
  if (!docData) return null;
  const raw = docData.actionTime || docData.createdAt;
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
    const snap = await db.collection('doseLogs').limit(300).get();

    const events = snap.docs.map(doc => {
      const data = doc.data();
      const status = parseLogStatus(data);
      const med = data.medicineName || data.name || 'medication';
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
