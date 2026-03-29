import express from 'express';
import Reminder from '../models/Reminder.js';

const router = express.Router();

// GET all reminders for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    const reminders = await Reminder.find({ userId }).sort({ createdAt: -1 });
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new reminder
router.post('/', async (req, res) => {
  try {
    const reminder = new Reminder(req.body);
    const saved = await reminder.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update a reminder
router.patch('/:id', async (req, res) => {
  try {
    const updated = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a reminder
router.delete('/:id', async (req, res) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
