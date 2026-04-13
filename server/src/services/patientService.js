import { db } from '../db.js';

const patientsCol = db.collection('patients');

export const getAllPatients = async (managedBy) => {
  const snapshot = await patientsCol.where('managedBy', '==', managedBy).get();
  
  const patients = [];
  snapshot.forEach(doc => {
    patients.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });
  
  return patients;
};

export const createPatient = async (data) => {
  data.createdAt = new Date().toISOString();
  data.updatedAt = data.createdAt;
  
  const docRef = await patientsCol.add(data);
  return { id: docRef.id, _id: docRef.id, ...data };
};

export const updatePatient = async (id, data) => {
  data.updatedAt = new Date().toISOString();
  
  await patientsCol.doc(id).update(data);
  
  const docRef = await patientsCol.doc(id).get();
  return { id: docRef.id, _id: docRef.id, ...docRef.data() };
};

export const deletePatient = async (id) => {
  await patientsCol.doc(id).delete();
  return true;
};
