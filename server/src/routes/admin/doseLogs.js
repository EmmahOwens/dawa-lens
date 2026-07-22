import { db } from '../../db.js';
import AppError from '../../utils/AppError.js';

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

    const snap = await db.collection('doseLogs')
      .where('createdAt', '>=', since)
      .limit(5000)
      .get();

    const docs = snap.docs.map(d => d.data());

    // Build heatmap: [dayOfWeek 0-6][hour 0-23] = count
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    let taken = 0, missed = 0, skipped = 0;

    docs.forEach(doc => {
      const date = doc.createdAt?.toDate?.() || new Date(doc.createdAt);
      if (isNaN(date)) return;
      const day = date.getDay(); // 0=Sun, 6=Sat
      const hour = date.getHours();
      heatmap[day][hour]++;

      if (doc.status === 'taken') taken++;
      else if (doc.status === 'missed') missed++;
      else if (doc.status === 'skipped') skipped++;
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
