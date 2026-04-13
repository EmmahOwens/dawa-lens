import { db } from '../db.js';

const remindersCol = db.collection('reminders');

export const getAllReminders = async (userId, patientId) => {
  let query = remindersCol.where('userId', '==', userId);
  if (patientId) {
    query = query.where('patientId', '==', patientId);
  }
  
  const snapshot = await query.orderBy('createdAt', 'desc').get();
  
  const reminders = [];
  snapshot.forEach(doc => {
    reminders.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });
  
  return reminders;
};

export const createReminder = async (data) => {
  data.createdAt = new Date().toISOString();
  data.updatedAt = data.createdAt;
  
  const docRef = await remindersCol.add(data);
  return { id: docRef.id, _id: docRef.id, ...data };
};

export const updateReminder = async (id, data) => {
  data.updatedAt = new Date().toISOString();
  
  await remindersCol.doc(id).update(data);
  
  const docRef = await remindersCol.doc(id).get();
  return { id: docRef.id, _id: docRef.id, ...docRef.data() };
};

export const deleteReminder = async (id) => {
  await remindersCol.doc(id).delete();
  return true;
};
