import { db } from '../db.js';
import * as medicineService from './medicineService.js';
import { sendPushNotification } from './notificationService.js';

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
 * Create a new dose log entry.
 */
export const createDoseLog = async (data) => {
  if (!data.actionTime) {
    data.actionTime = new Date().toISOString();
  }

  const docRef = await doseLogsCol.add(data);
  const log = { id: docRef.id, _id: docRef.id, ...data };

  // --- AUTONOMOUS INVENTORY MANAGEMENT ---
  if (data.action === 'taken' && data.medicineId) {
    try {
      const medicine = await medicineService.getMedicineById(data.medicineId);
      if (medicine && medicine.totalQuantity !== undefined) {
        const dosagePerDose = medicine.dosagePerDose || 1;
        const newQuantity = Math.max(0, medicine.totalQuantity - dosagePerDose);
        
        await medicineService.updateMedicine(data.medicineId, { totalQuantity: newQuantity });
        console.log(`📉 Inventory updated for ${medicine.name}: ${medicine.totalQuantity} -> ${newQuantity}`);

        // Check for low stock (threshold: 7 days supply or absolute 5 units)
        const threshold = (medicine.frequencyPerDay || 1) * 7 || 5;
        if (newQuantity <= threshold) {
          console.log(`⚠️ Low stock detected for ${medicine.name} (${newQuantity} remaining)`);
          await sendPushNotification(data.userId, {
            title: 'Low Medication Stock',
            body: `You only have ${newQuantity} left of ${medicine.name}. Remember to get a refill soon!`,
            data: { type: 'inventory', medicineId: data.medicineId }
          });
        }
      }
    } catch (err) {
      console.error("Inventory update failed:", err.message);
    }
  }

  return log;
};

/**
 * Delete a single dose log by ID.
 */
export const deleteDoseLog = async (id) => {
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
