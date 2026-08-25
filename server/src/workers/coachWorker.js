import { db } from '../db.js';
import * as aiService from '../services/aiService.js';
import * as medicineService from '../services/medicineService.js';
import * as doseLogService from '../services/doseLogService.js';
import { sendPushNotification } from '../services/notificationService.js';
import { acquireLock, releaseLock } from '../utils/distributedLock.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const BATCH_SIZE = 50;
const WORKER_DELAY_MS = 2000; // 2 seconds throttle between users

/**
 * Daily Coach Analysis Worker
 * Identifies patterns and suggests schedule adjustments.
 * Protected by distributed lock to prevent duplicate runs across clustered instances.
 */
export const runDailyCoachAnalysis = async () => {
  const LOCK_KEY = 'coach_daily_analysis';
  const hasLock = await acquireLock(LOCK_KEY, 45 * 60 * 1000); // 45 minute lease

  if (!hasLock) {
    console.log('🔒 Daily Coach Analysis already running on another instance or cycle active. Skipping.');
    return;
  }

  console.log('🧠 Daily Coach Analysis Started with distributed lock...');

  try {
    let lastDoc = null;
    let hasMore = true;

    while (hasMore) {
      let query = db.collection('users').orderBy('__name__').limit(BATCH_SIZE);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const users = snapshot.docs;
      lastDoc = users[users.length - 1];

      for (let i = 0; i < users.length; i++) {
        const userDoc = users[i];
        const userId = userDoc.id;
        const userData = userDoc.data();

        try {
          const medicines = await medicineService.getAllMedicines(userId);
          if (medicines.length === 0) continue; // Skip users with no medications

          const doseLogs = await doseLogService.getDoseLogs(userId, null, 20);
          if (doseLogs.length === 0) continue;

          const coachAdvice = await aiService.getCoachAdvice(doseLogs, medicines, userData.name, 'low');

          // If AI detects a significant pattern/suggestion
          if (coachAdvice && coachAdvice.patterns && coachAdvice.patterns.length > 0) {
            const suggestion = {
              userId,
              title: 'Smart Schedule Suggestion',
              content: coachAdvice.advice,
              patterns: coachAdvice.patterns,
              adherenceScore: coachAdvice.adherenceScore,
              createdAt: new Date().toISOString(),
              status: 'pending'
            };

            await db.collection('suggestions').add(suggestion);

            // Notify User
            await sendPushNotification(userId, {
              title: 'Dawa Coach Suggestion',
              body: 'We noticed a pattern in your medication times. Tap to see a suggested improvement!',
              data: { type: 'suggestion' }
            });

            console.log(`✅ Coach suggestion generated for user ${userId}`);
          }
        } catch (err) {
          console.error(`❌ Coach analysis failed for user ${userId}:`, err.message);
        }

        // Throttle to protect AI and DB rate limits
        await sleep(WORKER_DELAY_MS);
      }

      if (users.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
  } finally {
    await releaseLock(LOCK_KEY);
    console.log('🏁 Daily Coach Analysis Finished and lock released.');
  }
};

