import express from 'express';
import { db } from '../db.js';

const router = express.Router();
const remindersCol = db.collection('reminders');

// GET all reminders for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    
    const snapshot = await remindersCol.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    
    const reminders = [];
    snapshot.forEach(doc => {
      reminders.push({ id: doc.id, _id: doc.id, ...doc.data() });
    });
    
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new reminder
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    data.createdAt = new Date().toISOString(); 
    data.updatedAt = data.createdAt;
    
    const docRef = await remindersCol.add(data);
    res.status(201).json({ id: docRef.id, _id: docRef.id, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update a reminder
router.patch('/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();
    
    await remindersCol.doc(uid).update(updates);
    
    const docRef = await remindersCol.doc(uid).get();
    res.json({ id: docRef.id, _id: docRef.id, ...docRef.data() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a reminder
router.delete('/:id', async (req, res) => {
  try {
    await remindersCol.doc(req.params.id).delete();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
