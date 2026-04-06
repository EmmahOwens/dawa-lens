import express from 'express';
import { db } from '../db.js';

const router = express.Router();
const medicinesCol = db.collection('medicines');

// GET all medicines for a user
router.get('/', async (req, res) => {
  try {
    const { userId, patientId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    
    let query = medicinesCol.where('userId', '==', userId);
    if (patientId) {
      query = query.where('patientId', '==', patientId);
    } else {
      // If no patientId provided, we could return all or just "self" meds. 
      // For now, let's treat no patientId as "all meds" for that user.
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    
    const medicines = [];
    snapshot.forEach(doc => {
      medicines.push({ id: doc.id, _id: doc.id, ...doc.data() });
    });
    
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new medicine
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    data.createdAt = new Date().toISOString(); // manually set timestamp
    data.updatedAt = data.createdAt;
    
    const docRef = await medicinesCol.add(data);
    res.status(201).json({ id: docRef.id, _id: docRef.id, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update a medicine by id
router.patch('/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();
    
    await medicinesCol.doc(uid).update(updates);
    
    const docRef = await medicinesCol.doc(uid).get();
    res.json({ id: docRef.id, _id: docRef.id, ...docRef.data() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE remove a medicine by id
router.delete('/:id', async (req, res) => {
  try {
    await medicinesCol.doc(req.params.id).delete();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
