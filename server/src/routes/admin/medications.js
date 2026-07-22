import { db } from '../../db.js';
import AppError from '../../utils/AppError.js';

/**
 * GET /api/v1/admin/medications/top
 * Most tracked medications across all users.
 */
export const getTopMedications = async (req, res, next) => {
  try {
    const snap = await db.collection('medicines').limit(2000).get();
    const nameCount = {};
    const categoryCount = {};

    snap.docs.forEach(doc => {
      const data = doc.data();
      const name = (data.name || 'Unknown').trim();
      const category = (data.category || data.type || 'Other').trim();
      nameCount[name] = (nameCount[name] || 0) + 1;
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    const topMedications = Object.entries(nameCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    const categoryBreakdown = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    res.json({
      status: 'success',
      data: { topMedications, categoryBreakdown, totalTracked: snap.size },
    });
  } catch (error) {
    console.error('[AdminMedications] getTopMedications error:', error);
    next(new AppError('Failed to fetch medication analytics', 500));
  }
};
