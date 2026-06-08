import { db } from '../db.js';
import AppError from '../utils/AppError.js';
import { deleteRemindersByPatient } from './reminderService.js';
import { deleteDoseLogsByPatient } from './doseLogService.js';

const patientsCol = db.collection('patients');
const medicinesCol = db.collection('medicines');

/**
 * Get all patient profiles managed by a specific user.
 */
export const getAllPatients = async (managedBy) => {
  const snapshot = await patientsCol.where('managedBy', '==', managedBy).get();

  const patients = [];
  snapshot.forEach(doc => {
    patients.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });

  return patients;
};

/**
 * Create a new patient profile.
 */
export const createPatient = async (data) => {
  data.createdAt = new Date().toISOString();
  data.updatedAt = data.createdAt;

  const docRef = await patientsCol.add(data);
  return { id: docRef.id, _id: docRef.id, ...data };
};

/**
 * Update an existing patient profile.
 */
export const updatePatient = async (id, data, requestingUserId) => {
  if (requestingUserId) {
    const docSnap = await patientsCol.doc(id).get();
    if (!docSnap.exists) {
      throw new AppError('Patient profile not found', 404);
    }
    if (docSnap.data().managedBy !== requestingUserId) {
      throw new AppError('You do not have permission to modify this patient profile', 403);
    }
  }

  data.updatedAt = new Date().toISOString();

  await patientsCol.doc(id).update(data);

  const docRef = await patientsCol.doc(id).get();
  return { id: docRef.id, _id: docRef.id, ...docRef.data() };
};

/**
 * Delete a patient profile and CASCADE delete all associated data:
 * - Reminders scoped to this patient
 * - Medicine inventory scoped to this patient
 * - Dose logs scoped to this patient
 * 
 * All three cascade deletions run in parallel for performance,
 * then the patient profile itself is deleted.
 */
export const deletePatient = async (id, requestingUserId) => {
  if (requestingUserId) {
    const docSnap = await patientsCol.doc(id).get();
    if (!docSnap.exists) {
      throw new AppError('Patient profile not found', 404);
    }
    if (docSnap.data().managedBy !== requestingUserId) {
      throw new AppError('You do not have permission to delete this patient profile', 403);
    }
  }

  // Run cascade deletions in parallel
  await Promise.all([
    deleteRemindersByPatient(id),
    deleteMedicinesByPatient(id),
    deleteDoseLogsByPatient(id),
  ]);

  // Delete the patient profile itself
  await patientsCol.doc(id).delete();
  return true;
};

/**
 * Delete all medicines belonging to a specific patient.
 * Uses batched deletes for atomicity.
 */
async function deleteMedicinesByPatient(patientId) {
  const snapshot = await medicinesCol.where('patientId', '==', patientId).get();
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
}
