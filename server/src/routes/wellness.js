import express from 'express';
import { db } from '../db.js';

const router = express.Router();
const wellnessCol = db.collection('wellness');

// GET all wellness logs (food/symptom) for a user
router.get('/', async (req, res) => {
  try {
    const { userId, patientId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    
    let query = wellnessCol.where('userId', '==', userId);
    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }
    
    const snapshot = await query.orderBy('timestamp', 'desc').limit(100).get();
    
    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, _id: doc.id, ...doc.data() });
    });
    
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST log a food or symptom entry
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data.userId) return res.status(400).json({ error: 'userId is required' });
    
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    
    const docRef = await wellnessCol.add(data);
    res.status(201).json({ id: docRef.id, _id: docRef.id, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a wellness log
router.delete('/:id', async (req, res) => {
  try {
    await wellnessCol.doc(req.params.id).delete();
    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
