import cron from 'node-cron';
// Import workers
import { runWeeklyReports } from './workers/reportWorker.js';
import { runDailyCoachAnalysis } from './workers/coachWorker.js';

/**
 * Initialize background tasks.
 */
export const initScheduler = () => {
  console.log('⏰ Scheduler initialized.');

  // Weekly Reports: Every Sunday at 10:00 PM
  cron.schedule('0 22 * * 0', async () => {
    console.log('🏃 Running Weekly Care Reports worker...');
    try { await runWeeklyReports(); } catch (e) { console.error(e); }
  });

  // Daily Coach Analysis: Every day at 9:00 PM
  cron.schedule('0 21 * * *', async () => {
    console.log('🏃 Running Daily Coach Analysis worker...');
    try { await runDailyCoachAnalysis(); } catch (e) { console.error(e); }
  });

  // Optional: Hourly cleanup or inventory check
  cron.schedule('0 * * * *', async () => {
    // console.log('🏃 Running Hourly maintenance...');
  });
};
