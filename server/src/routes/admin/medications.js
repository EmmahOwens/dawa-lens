import { db } from '../../db.js';
import AppError from '../../utils/AppError.js';
import { getCache, setCache, withTimeout } from '../../utils/cache.js';

const CACHE_KEY = 'admin_medications_top';
const CACHE_TTL = 300; // 5 minutes

/**
 * GET /api/v1/admin/medications/top
 * Most tracked medications across all users.
 */
export const getTopMedications = async (req, res, next) => {
  try {
    // 1. Check in-memory TTL cache for instantaneous response
    const cached = getCache(CACHE_KEY);
    if (cached) {
      return res.json({ status: 'success', data: cached });
    }

    // 2. Fetch from Firestore with timeout protection (max 4 seconds)
    const snap = await withTimeout(
      db.collection('medicines').limit(2000).get(),
      4000,
      { docs: [], size: 0 }
    );

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

    const responseData = { topMedications, categoryBreakdown, totalTracked: snap.size };

    // Cache the aggregated response if we got valid documents
    if (snap.size > 0) {
      setCache(CACHE_KEY, responseData, CACHE_TTL);
    }

    res.json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    console.error('[AdminMedications] getTopMedications error:', error);
    next(new AppError('Failed to fetch medication analytics', 500));
  }
};

