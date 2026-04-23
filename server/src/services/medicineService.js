import { db } from '../db.js';

const medicinesCol = db.collection('medicines');

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
  
  if (_id) {
    // If ID is provided, use it (prevents duplicates from frontend double-write)
    await medicinesCol.doc(_id).set(rest, { merge: true });
    return { id: _id, _id, ...rest };
  } else {
    const docRef = await medicinesCol.add(rest);
    return { id: docRef.id, _id: docRef.id, ...rest };
  }
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
