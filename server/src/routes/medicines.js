import express from 'express';
import Medicine from '../models/Medicine.js';

const router = express.Router();

// GET all medicines for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    const medicines = await Medicine.find({ userId }).sort({ createdAt: -1 });
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new medicine
router.post('/', async (req, res) => {
  try {
    const medicine = new Medicine(req.body);
    const saved = await medicine.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update a medicine by id
router.patch('/:id', async (req, res) => {
  try {
    const updated = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE remove a medicine by id
router.delete('/:id', async (req, res) => {
  try {
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
