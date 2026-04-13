import express from 'express';
import * as doseLogService from '../services/doseLogService.js';
import { protect, restrictToOwner } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createDoseLogSchema, getDoseLogsSchema } from '../validations/doseLogValidation.js';

const router = express.Router();

// GET all dose logs for a user
router.get('/', protect, validate(getDoseLogsSchema), restrictToOwner, async (req, res, next) => {
  try {
    const { userId } = req.query;
    const logs = await doseLogService.getDoseLogs(userId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// POST log a dose action
router.post('/', protect, validate(createDoseLogSchema), restrictToOwner, async (req, res, next) => {
  try {
    const log = await doseLogService.createDoseLog(req.body);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

export default router;
