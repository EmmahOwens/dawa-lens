import { db, authAdmin } from '../../db.js';
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

    const [
      allUsersResult,
      medicinesResult,
      activeRemindersResult,
      doseLogsSnap,
    ] = await Promise.all([
      authAdmin.listUsers(1000),
      db.collection('medicines').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('reminders').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('doseLogs')
        .where('actionTime', '>=', startOf30Days)
        .limit(5000).get().catch(() => ({ docs: [] })),
    ]);

    const users = allUsersResult.users || [];
    const totalUsers = users.length;

    let newToday = 0;
    let newThisWeek = 0;
    users.forEach(u => {
      const created = u.metadata?.creationTime ? new Date(u.metadata.creationTime) : null;
      if (created) {
        if (created >= startOfToday) newToday++;
        if (created >= startOfWeek) newThisWeek++;
      }
    });

    const totalMedicines = medicinesResult.data().count;
    const activeReminders = activeRemindersResult.data().count;

    let taken = 0, missed = 0, skipped = 0;
    doseLogsSnap.docs.forEach(d => {
      const data = d.data();
      const date = parseLogDate(data);
      if (!date || date < startOf30Days) return;

      const status = parseLogStatus(data);
      if (status === 'taken') taken++;
      else if (status === 'missed') missed++;
      else if (status === 'skipped') skipped++;
    });

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
    const allUsersResult = await authAdmin.listUsers(1000).catch(() => ({ users: [] }));
    const users = allUsersResult.users || [];

    const points = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = users.filter(u => {
        if (!u.metadata?.creationTime) return false;
        const created = new Date(u.metadata.creationTime);
        return created >= dayStart && created < dayEnd;
      }).length;

      points.push({
        date: dayStart.toISOString().split('T')[0],
        count,
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
    const snap = await db.collection('doseLogs').limit(5000).get().catch(() => ({ docs: [] }));
    const logs = snap.docs.map(d => ({ data: d.data(), date: parseLogDate(d.data()), status: parseLogStatus(d.data()) }));

    let lastKnownRate = null;
    const points = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      let taken = 0;
      let total = 0;

      logs.forEach(l => {
        if (!l.date || l.date < dayStart || l.date >= dayEnd) return;
        if (l.status === 'taken') taken++;
        if (['taken', 'missed', 'skipped'].includes(l.status)) total++;
      });

      let rate = total > 0 ? Math.round((taken / total) * 100) : null;
      if (rate !== null) {
        lastKnownRate = rate;
      } else if (lastKnownRate !== null) {
        rate = lastKnownRate;
      }

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

/**
 * POST /api/v1/admin/ai/query
 * Query Gemini 2.0 Flash model using the Render backend's GEMINI_API_KEY.
 */
export const queryAdminAi = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      throw new AppError('Prompt is required', 400);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
    if (!apiKey) {
      throw new AppError('GEMINI_API_KEY is not configured on backend server.', 500);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{
            text: 'You are Dawa-Lens AI, an intelligent administrative and clinical analytics companion for the Dawa-Lens platform. Provide concise, clear, accurate, and professional answers for health, medication adherence, platform analytics, and user growth queries. Keep responses structured, helpful, and under 150 words.'
          }]
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new AppError(data?.error?.message || `Gemini API HTTP ${response.status}`, response.status);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AppError('Gemini API returned an empty response.', 502);
    }

    res.json({ status: 'success', text });
  } catch (error) {
    console.error('[AdminAI] queryAdminAi error:', error);
    next(error.isOperational ? error : new AppError(error.message || 'Failed to query Gemini AI', 500));
  }
};

