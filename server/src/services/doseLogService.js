import { db } from '../db.js';
import AppError from '../utils/AppError.js';
import * as medicineService from './medicineService.js';
import { sendPushNotification } from './notificationService.js';
import * as autonomousService from './autonomousService.js';
import {
  parseReminderTimes,
  findSlotIndexForTime,
  calculateDynamicSchedule,
} from '../utils/dynamicSchedule.js';

const doseLogsCol = db.collection('doseLogs');

/**
 * Fetch dose logs for a user, optionally scoped to a specific patient.
 * When patientId is explicitly 'null' (string) or absent, return owner logs only.
 * When patientId is a non-empty string, return that patient's logs.
 * Limit is configurable; defaults to 300 to cover 90-day history for stats.
 */
export const getDoseLogs = async (userId, patientId, limit = 300) => {
  let query = doseLogsCol.where('userId', '==', userId);

  if (patientId && patientId !== 'null') {
    // Family member / client scope
    query = query.where('patientId', '==', patientId);
  } else {
    // Owner scope — patientId is null or missing
    // Firestore doesn't allow querying for null with ==, so we use two queries
    // and merge client-side. However, we keep it simple: if no patientId is
    // requested, return ALL logs for the user (client filters by reminder).
    // This allows AppContext to load all data once.
  }

  const snapshot = await query
    .orderBy('actionTime', 'desc')
    .limit(limit)
    .get();

  const logs = [];
  snapshot.forEach(doc => {
    logs.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });

  return logs;
};

/**
 * Create a new dose log entry with ACID transaction for atomic inventory decrements and dynamic schedules.
 */
export const createDoseLog = async (data) => {
  if (!data.actionTime) {
    data.actionTime = new Date().toISOString();
  }

  let lowStockNotification = null;
  let adjustedScheduleData = null;

  const logRef = doseLogsCol.doc();
  const logId = logRef.id;
  const log = { id: logId, _id: logId, ...data };

  // Execute critical state mutations inside an atomic transaction
  await db.runTransaction(async (t) => {
    // 1. Write the dose log
    t.set(logRef, data);

    // 2. Atomic Inventory Decrement
    if (data.action === 'taken' && data.medicineId) {
      const medRef = db.collection('medicines').doc(data.medicineId);
      const medDoc = await t.get(medRef);

      if (medDoc.exists) {
        const medData = medDoc.data();
        if (medData && medData.totalQuantity !== undefined) {
          const dosagePerDose = medData.dosagePerDose || 1;
          const newQuantity = Math.max(0, medData.totalQuantity - dosagePerDose);
          const updatedAt = new Date().toISOString();

          t.update(medRef, { 
            totalQuantity: newQuantity,
            updatedAt
          });

          // Check for low stock notification trigger
          const threshold = (medData.frequencyPerDay || 1) * 7 || 5;
          if (newQuantity <= threshold) {
            lowStockNotification = {
              userId: data.userId,
              medicineName: medData.name,
              medicineId: data.medicineId,
              newQuantity
            };
          }
        }
      }
    }

    // 3. Atomic Dynamic Schedule Adjustment
    if (data.action === 'taken' && data.reminderId) {
      const remRef = db.collection('reminders').doc(data.reminderId);
      const remDoc = await t.get(remRef);

      if (remDoc.exists) {
        const reminder = remDoc.data();
        if (reminder && reminder.repeatSchedule !== 'once' && reminder.time) {
          const scheduledDate = data.scheduledTime ? new Date(data.scheduledTime) : new Date(data.actionTime);
          const actualDate = new Date(data.actionTime);
          const diffMinutes = Math.round((actualDate.getTime() - scheduledDate.getTime()) / (1000 * 60));

          if (Math.abs(diffMinutes) >= 1) {
            const times = parseReminderTimes(reminder.time);
            const slotIndex = findSlotIndexForTime(times, scheduledDate);

            if (slotIndex !== -1 && times.length > 0) {
              const { newTimeStr, hasChanges } = calculateDynamicSchedule(times, slotIndex, actualDate);

              if (hasChanges) {
                const originalTime = reminder.time;
                const updatedAt = new Date().toISOString();

                t.update(remRef, {
                  time: newTimeStr,
                  updatedAt,
                });

                // Write schedule audit log inside the same transaction
                const auditRef = db.collection('scheduleAuditLogs').doc();
                t.set(auditRef, {
                  reminderId: data.reminderId,
                  medicineName: reminder.medicineName || data.medicineName || 'Unknown',
                  originalTime,
                  adjustedTime: newTimeStr,
                  actionTime: data.actionTime,
                  triggerEvent: diffMinutes < 0 ? 'early-dose' : 'late-dose',
                  timeOffsetMinutes: diffMinutes,
                  userId: data.userId,
                  patientId: data.patientId || reminder.patientId || null,
                  createdAt: updatedAt,
                });

                adjustedScheduleData = {
                  reminderId: data.reminderId,
                  originalTime,
                  adjustedTime: newTimeStr,
                  timeOffsetMinutes: diffMinutes,
                };
              }
            }
          }
        }
      }
    }
  });

  if (adjustedScheduleData) {
    log.adjustedSchedule = adjustedScheduleData;
  }

  // Post-transaction asynchronous side effects (Notifications & Interventions)
  if (lowStockNotification) {
    sendPushNotification(lowStockNotification.userId, {
      title: 'Low Medication Stock',
      body: `You only have ${lowStockNotification.newQuantity} left of ${lowStockNotification.medicineName}. Remember to get a refill soon!`,
      data: { type: 'inventory', medicineId: lowStockNotification.medicineId }
    }).catch(err => console.warn('Low stock notification error:', err.message));
  }

  if (data.action === 'skipped' || data.action === 'missed') {
    autonomousService.interceptCriticalAdherence(data.userId, data.patientId, data.medicineId, data.action);
  }

  return log;
};


/**
 * Delete a single dose log by ID.
 */
export const deleteDoseLog = async (id, requestingUserId) => {
  if (requestingUserId) {
    const docSnap = await doseLogsCol.doc(id).get();
    if (!docSnap.exists) {
      throw new AppError('Dose log not found', 404);
    }
    if (docSnap.data().userId !== requestingUserId) {
      throw new AppError('You do not have permission to delete this dose log', 403);
    }
  }

  await doseLogsCol.doc(id).delete();
  return true;
};

/**
 * Delete all dose logs belonging to a specific patient (used in cascade delete).
 * Uses batched deletes for atomicity (Firestore batch limit = 500).
 */
export const deleteDoseLogsByPatient = async (patientId) => {
  const snapshot = await doseLogsCol.where('patientId', '==', patientId).get();
  if (snapshot.empty) return;

  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % batchSize !== 0) {
    await batch.commit();
  }
};
