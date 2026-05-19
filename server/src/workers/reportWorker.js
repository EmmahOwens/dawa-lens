import { db } from '../db.js';
import * as aiService from '../services/aiService.js';
import * as medicineService from '../services/medicineService.js';
import * as doseLogService from '../services/doseLogService.js';
import * as wellnessService from '../services/wellnessService.js';
import { sendPushNotification } from '../services/notificationService.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Weekly Care Report Worker
 * Runs through all users and generates a Care Report.
 */
export const runWeeklyReports = async () => {
  console.log('📊 Weekly Report Worker Started...');
  
  const usersSnapshot = await db.collection('users').get();
  
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    try {
      // 1. Fetch relevant data for the past 7 days
      const medicines = await medicineService.getAllMedicines(userId);
      const doseLogs = await doseLogService.getDoseLogs(userId, null, 100);
      const wellnessLogs = await wellnessService.getWellnessLogs(userId, null, 50);
      
      // 2. Generate Insight via AI
      const insight = await aiService.getWellnessInsight(doseLogs, wellnessLogs, medicines, 'low');
      
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
        body: `Your adherence score was ${insight.correlationScore}%. Tap to see your full clinical summary.`,
        data: { type: 'report', reportId: userId } // Simplified
      });
      
      console.log(`✅ Weekly report generated for user ${userId}`);
    } catch (err) {
      console.error(`❌ Failed to generate report for user ${userId}:`, err.message);
    }
  }
};
