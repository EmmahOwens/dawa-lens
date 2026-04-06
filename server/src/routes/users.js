import express from 'express';
import { db } from '../db.js';

const router = express.Router();
const usersCol = db.collection('users');

// GET user profile
router.get('/:uid', async (req, res) => {
  try {
    const docRef = await usersCol.doc(req.params.uid).get();
    if (!docRef.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    res.json({ id: docRef.id, ...docRef.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST update/create user profile
router.post('/', async (req, res) => {
  try {
    const { uid, name, dateOfBirth, gender, isProfessional } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    const payload = {
      name: name || '',
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      isProfessional: isProfessional ?? false,
      updatedAt: new Date().toISOString()
    };

    await usersCol.doc(uid).set(payload, { merge: true });
    
    // Return the updated doc
    const updatedRef = await usersCol.doc(uid).get();
    res.json({ id: updatedRef.id, ...updatedRef.data() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
