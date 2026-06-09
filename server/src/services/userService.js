import { db } from '../db.js';
import * as autonomousService from './autonomousService.js';

const usersCol = db.collection('users');

export const getUserProfile = async (uid) => {
  const docRef = await usersCol.doc(uid).get();
  if (!docRef.exists) return null;
  return { id: docRef.id, ...docRef.data() };
};

export const upsertUserProfile = async (uid, data) => {
  const payload = {
    name: data.name || '',
    dateOfBirth: data.dateOfBirth || null,
    gender: data.gender || null,
    isProfessional: data.isProfessional ?? false,
    language: data.language || 'en',
    timezone: data.timezone || null,
    currentCity: data.currentCity || null,
    updatedAt: new Date().toISOString()
  };

  await usersCol.doc(uid).set(payload, { merge: true });
  
  // --- AUTONOMOUS TIMEZONE ADAPTATION ---
  if (data.timezone) {
    autonomousService.interceptTimezoneChange(uid, data.timezone, data.currentCity);
  }

  const updatedRef = await usersCol.doc(uid).get();
  return { id: updatedRef.id, ...updatedRef.data() };
};
