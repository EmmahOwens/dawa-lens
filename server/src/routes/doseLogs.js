import express from 'express';
import DoseLog from '../models/DoseLog.js';

const router = express.Router();

// GET all dose logs for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    const logs = await DoseLog.find({ userId }).sort({ actionTime: -1 }).limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST log a dose action
router.post('/', async (req, res) => {
  try {
    const log = new DoseLog(req.body);
    const saved = await log.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
