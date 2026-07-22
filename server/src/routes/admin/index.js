import { Router } from 'express';
import { getOverviewStats, getGrowthStats, getAdherenceTrend } from './stats.js';
import { listUsers, getUser, updateUser, deleteUser } from './users.js';
import { getAggregateStats, getRecentDoseLogs } from './doseLogs.js';
import { getTopMedications } from './medications.js';
import { getAuditLog, getSystemHealth } from './system.js';
import { broadcastNotification, getNotificationHistory } from './notifications.js';
import { exportUsersCSV, exportAdherenceCSV, exportReportPDF } from './export.js';

const router = Router();

// Stats
router.get('/stats/overview', getOverviewStats);
router.get('/stats/growth', getGrowthStats);
router.get('/stats/adherence-trend', getAdherenceTrend);

// Users
router.get('/users', listUsers);
router.get('/users/:uid', getUser);
router.patch('/users/:uid', updateUser);
router.delete('/users/:uid', deleteUser);

// Dose logs
router.get('/dose-logs/recent', getRecentDoseLogs);
router.get('/dose-logs/aggregate', getAggregateStats);

// Medications
router.get('/medications/top', getTopMedications);

// System
router.get('/system/health', getSystemHealth);
router.get('/system/audit-log', getAuditLog);

// Notifications
router.post('/notifications/broadcast', broadcastNotification);
router.get('/notifications/history', getNotificationHistory);

// Exports
router.get('/export/users.csv', exportUsersCSV);
router.get('/export/adherence.csv', exportAdherenceCSV);
router.get('/export/report.pdf', exportReportPDF);

export default router;
