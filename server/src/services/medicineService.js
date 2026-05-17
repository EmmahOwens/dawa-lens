import { db } from '../db.js';
import * as autonomousService from './autonomousService.js';

const medicinesCol = db.collection('medicines');

export const getMedicineById = async (id) => {
  const doc = await medicinesCol.doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, _id: doc.id, ...doc.data() };
};

export const getAllMedicines = async (userId, patientId) => {
  let query = medicinesCol.where('userId', '==', userId);
  if (patientId) {
    query = query.where('patientId', '==', patientId);
  }

  const snapshot = await query.orderBy('createdAt', 'desc').get();
  
  const medicines = [];
  snapshot.forEach(doc => {
    medicines.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });
  
  return medicines;
};

export const createMedicine = async (data) => {
  const { _id, ...rest } = data;
  rest.createdAt = rest.createdAt || rest.addedAt || new Date().toISOString();
  rest.updatedAt = rest.updatedAt || rest.createdAt;
  
  let result;
  if (_id) {
    // If ID is provided, use it (prevents duplicates from frontend double-write)
    await medicinesCol.doc(_id).set(rest, { merge: true });
    result = { id: _id, _id, ...rest };
  } else {
    const docRef = await medicinesCol.add(rest);
    result = { id: docRef.id, _id: docRef.id, ...rest };
  }

  // --- AUTONOMOUS SAFETY INTERCEPTOR ---
  // We run this in the background (no await) so it doesn't block the response
  autonomousService.interceptMedicineSafety(result.userId, result.patientId, result);

  return result;
};

export const updateMedicine = async (id, data) => {
  data.updatedAt = new Date().toISOString();
  
  await medicinesCol.doc(id).update(data);
  
  const docRef = await medicinesCol.doc(id).get();
  return { id: docRef.id, _id: docRef.id, ...docRef.data() };
};

export const deleteMedicine = async (id) => {
  await medicinesCol.doc(id).delete();
  return true;
};
