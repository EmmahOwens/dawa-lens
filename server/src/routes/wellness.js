import express from 'express';
import * as wellnessService from '../services/wellnessService.js';
import { protect, restrictToOwner } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { logWellnessSchema, getWellnessSchema } from '../validations/wellnessValidation.js';

const router = express.Router();

// GET all wellness logs (food/symptom) for a user
router.get('/', protect, validate(getWellnessSchema), restrictToOwner, async (req, res, next) => {
  try {
    const { userId, patientId } = req.query;
    const logs = await wellnessService.getWellnessLogs(userId, patientId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// POST log a food or symptom entry
router.post('/', protect, validate(logWellnessSchema), restrictToOwner, async (req, res, next) => {
  try {
    const log = await wellnessService.createWellnessLog(req.body);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE a wellness log
router.delete('/:id', protect, async (req, res, next) => {
  try {
    await wellnessService.deleteWellnessLog(req.params.id);
    res.json({ message: 'Log deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
