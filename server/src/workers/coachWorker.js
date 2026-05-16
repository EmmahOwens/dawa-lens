import { db } from '../db.js';
import * as aiService from '../services/aiService.js';
import * as medicineService from '../services/medicineService.js';
import * as doseLogService from '../services/doseLogService.js';
import { sendPushNotification } from '../services/notificationService.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Daily Coach Analysis Worker
 * Identifies patterns and suggests schedule adjustments.
 */
export const runDailyCoachAnalysis = async () => {
  console.log('🧠 Daily Coach Analysis Started...');
  
  const usersSnapshot = await db.collection('users').get();
  
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    try {
      const medicines = await medicineService.getAllMedicines(userId);
      const doseLogs = await doseLogService.getDoseLogs(userId, null, 20); // Last 20 logs are enough for pattern detection
      
      const coachAdvice = await aiService.getCoachAdvice(doseLogs, medicines, userData.name);
      
      // If AI detects a significant pattern/suggestion
      if (coachAdvice.patterns && coachAdvice.patterns.length > 0) {
        // Save as a "suggestion" for the frontend to display
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
      
      // Throttle: Wait 2 seconds before next user to avoid AI rate limits
      await sleep(2000);
    } catch (err) {
      console.error(`❌ Coach analysis failed for user ${userId}:`, err.message);
    }
  }
};
