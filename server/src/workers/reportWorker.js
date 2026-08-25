import { db } from '../db.js';
import * as aiService from '../services/aiService.js';
import * as medicineService from '../services/medicineService.js';
import * as doseLogService from '../services/doseLogService.js';
import * as wellnessService from '../services/wellnessService.js';
import { sendPushNotification } from '../services/notificationService.js';
import { acquireLock, releaseLock } from '../utils/distributedLock.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const BATCH_SIZE = 50;
const WORKER_DELAY_MS = 2000; // 2 seconds between users

/**
 * Weekly Care Report Worker
 * Runs through all users and generates a Care Report.
 * Protected by distributed lock to prevent duplicate runs across clustered instances.
 */
export const runWeeklyReports = async () => {
  const LOCK_KEY = 'weekly_care_reports';
  const hasLock = await acquireLock(LOCK_KEY, 60 * 60 * 1000); // 60 minute lease

  if (!hasLock) {
    console.log('🔒 Weekly Care Reports already running on another instance. Skipping.');
    return;
  }

  console.log('📊 Weekly Report Worker Started with distributed lock...');

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

        try {
          // 1. Fetch relevant data for the past 7 days
          const medicines = await medicineService.getAllMedicines(userId);
          if (medicines.length === 0) continue;

          const doseLogs = await doseLogService.getDoseLogs(userId, null, 100);
          const wellnessLogs = await wellnessService.getWellnessLogs(userId, null, 50);

          // 2. Generate Insight via AI
          const insight = await aiService.getWellnessInsight(doseLogs, wellnessLogs, medicines, 'low');

          if (insight) {
            // 3. Save to Firestore
            const reportData = {
              userId,
              ...insight,
              createdAt: new Date().toISOString(),
              type: 'weekly_summary'
            };

            await db.collection('careReports').add(reportData);

            // 4. Notify User
            await sendPushNotification(userId, {
              title: 'Weekly Care Report Ready',
              body: `Your adherence score was ${insight.correlationScore || 100}%. Tap to see your full clinical summary.`,
              data: { type: 'report', reportId: userId }
            });

            console.log(`✅ Weekly report generated for user ${userId}`);
          }
        } catch (err) {
          console.error(`❌ Failed to generate report for user ${userId}:`, err.message);
        }

        // Throttle: never more than 30 users/minute on background work
        await sleep(WORKER_DELAY_MS);
      }

      if (users.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
  } finally {
    await releaseLock(LOCK_KEY);
    console.log('🏁 Weekly Report Worker Finished and lock released.');
  }
};

