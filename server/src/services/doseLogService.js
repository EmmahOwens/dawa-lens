import { db } from '../db.js';

const doseLogsCol = db.collection('doseLogs');

export const getDoseLogs = async (userId) => {
  const snapshot = await doseLogsCol.where('userId', '==', userId).orderBy('actionTime', 'desc').limit(200).get();
  
  const logs = [];
  snapshot.forEach(doc => {
    logs.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });
  
  return logs;
};

export const createDoseLog = async (data) => {
  if (!data.actionTime) {
    data.actionTime = new Date().toISOString();
  }
  
  const docRef = await doseLogsCol.add(data);
  return { id: docRef.id, _id: docRef.id, ...data };
};
