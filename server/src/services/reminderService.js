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
  const { _id, ...rest } = data;
  rest.createdAt = rest.createdAt || new Date().toISOString();
  rest.updatedAt = rest.updatedAt || rest.createdAt;
  
  if (_id) {
    // If ID is provided, use it (prevents duplicates from frontend double-write)
    await remindersCol.doc(_id).set(rest, { merge: true });
    return { id: _id, _id, ...rest };
  } else {
    const docRef = await remindersCol.add(rest);
    return { id: docRef.id, _id: docRef.id, ...rest };
  }
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
