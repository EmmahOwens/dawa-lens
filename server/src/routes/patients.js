import express from 'express';
import { db } from '../db.js';

const router = express.Router();
const patientsCol = db.collection('patients');

// GET all patients managed by a user
router.get('/', async (req, res) => {
  try {
    const { managedBy } = req.query;
    if (!managedBy) return res.status(400).json({ error: 'managedBy query param required' });
    
    const snapshot = await patientsCol.where('managedBy', '==', managedBy).get();
    
    const patients = [];
    snapshot.forEach(doc => {
      patients.push({ id: doc.id, _id: doc.id, ...doc.data() });
    });
    
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new patient profile
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data.managedBy) return res.status(400).json({ error: 'managedBy is required' });
    
    data.createdAt = new Date().toISOString();
    data.updatedAt = data.createdAt;
    
    const docRef = await patientsCol.add(data);
    res.status(201).json({ id: docRef.id, _id: docRef.id, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update a patient by id
router.patch('/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();
    
    await patientsCol.doc(uid).update(updates);
    
    const docRef = await patientsCol.doc(uid).get();
    res.json({ id: docRef.id, _id: docRef.id, ...docRef.data() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE remove a patient by id
router.delete('/:id', async (req, res) => {
  try {
    await patientsCol.doc(req.params.id).delete();
    res.json({ message: 'Patient profile deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
