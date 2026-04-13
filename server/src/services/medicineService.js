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
  data.createdAt = new Date().toISOString();
  data.updatedAt = data.createdAt;
  
  const docRef = await medicinesCol.add(data);
  return { id: docRef.id, _id: docRef.id, ...data };
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
