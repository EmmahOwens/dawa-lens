import express from 'express';
import { db } from '../db.js';

const router = express.Router();
const doseLogsCol = db.collection('doseLogs');

// GET all dose logs for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    
    const snapshot = await doseLogsCol.where('userId', '==', userId).orderBy('actionTime', 'desc').limit(200).get();
    
    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, _id: doc.id, ...doc.data() });
    });
    
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST log a dose action
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data.actionTime) {
      data.actionTime = new Date().toISOString();
    }
    
    const docRef = await doseLogsCol.add(data);
    res.status(201).json({ id: docRef.id, _id: docRef.id, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
