import { db } from '../db.js';
import * as autonomousService from './autonomousService.js';

const wellnessCol = db.collection('wellnessLogs');

export const getWellnessLogs = async (userId, patientId) => {
  let query = wellnessCol.where('userId', '==', userId);
  if (patientId) {
    query = query.where('patientId', '==', patientId);
  }
  
  const snapshot = await query.orderBy('timestamp', 'desc').limit(100).get();
  
  const logs = [];
  snapshot.forEach(doc => {
    logs.push({ id: doc.id, _id: doc.id, ...doc.data() });
  });
  
  return logs;
};

export const createWellnessLog = async (data) => {
  if (!data.timestamp) {
    data.timestamp = new Date().toISOString();
  }
  
  const docRef = await wellnessCol.add(data);
  const log = { id: docRef.id, _id: docRef.id, ...data };

  // --- AUTONOMOUS MEAL INTERACTION MONITOR ---
  if (data.type === 'food' && data.data && data.data.meal) {
    autonomousService.interceptMealSafety(data.userId, data.patientId, data.data.meal);
  }

  return log;
};

export const deleteWellnessLog = async (id) => {
  await wellnessCol.doc(id).delete();
  return true;
};
