import { db } from '../db.js';
import AppError from '../utils/AppError.js';

const remindersCol = db.collection('reminders');

/**
 * Fetch reminders for a user.
 * - If patientId is provided: return only that patient's reminders.
 * - If patientId is absent: return ALL reminders for the user (owner + family).
 *   The client filters to the active profile via patientId on each record.
 */
export const getAllReminders = async (userId, patientId) => {
  let query = remindersCol.where('userId', '==', userId);

  if (patientId && patientId !== 'null') {
    query = query.where('patientId', '==', patientId);
  }
  // When no patientId provided, return all (owner + family) so AppContext
  // can load all data in a single fetch and filter client-side.

  const snapshot = await query.orderBy('createdAt', 'desc').get();

  const reminders = [];
  snapshot.forEach(doc => {
    reminders.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });

  return reminders;
};

/**
 * Create a new reminder.
 */
export const createReminder = async (data) => {
  const { _id, ...rest } = data;
  rest.createdAt = rest.createdAt || new Date().toISOString();
  rest.updatedAt = rest.updatedAt || rest.createdAt;

  if (_id) {
    // Prevents duplicates from frontend double-write (Firestore + API both called)
    await remindersCol.doc(_id).set(rest, { merge: true });
    return { id: _id, _id, ...rest };
  } else {
    const docRef = await remindersCol.add(rest);
    return { id: docRef.id, _id: docRef.id, ...rest };
  }
};

/**
 * Update an existing reminder — verifies ownership before update.
 */
export const updateReminder = async (id, data, requestingUserId) => {
  // Ownership check: ensure the reminder belongs to the requesting user
  if (requestingUserId) {
    const docSnap = await remindersCol.doc(id).get();
    if (!docSnap.exists) {
      throw new AppError('Reminder not found', 404);
    }
    if (docSnap.data().userId !== requestingUserId) {
      throw new AppError('You do not have permission to modify this reminder', 403);
    }
  }

  data.updatedAt = new Date().toISOString();
  await remindersCol.doc(id).update(data);

  const docRef = await remindersCol.doc(id).get();
  return { id: docRef.id, _id: docRef.id, ...docRef.data() };
};

/**
 * Delete a single reminder — verifies ownership before delete.
 */
export const deleteReminder = async (id, requestingUserId) => {
  if (requestingUserId) {
    const docSnap = await remindersCol.doc(id).get();
    if (!docSnap.exists) {
      throw new AppError('Reminder not found', 404);
    }
    if (docSnap.data().userId !== requestingUserId) {
      throw new AppError('You do not have permission to delete this reminder', 403);
    }
  }

  await remindersCol.doc(id).delete();
  return true;
};

/**
 * Delete all reminders belonging to a specific patient (used in cascade delete).
 * Uses batched deletes for atomicity.
 */
export const deleteRemindersByPatient = async (patientId) => {
  const snapshot = await remindersCol.where('patientId', '==', patientId).get();
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
