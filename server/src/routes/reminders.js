import express from 'express';
import * as reminderService from '../services/reminderService.js';
import { protect, restrictToOwner } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createReminderSchema, updateReminderSchema, getRemindersSchema } from '../validations/reminderValidation.js';

const router = express.Router();

// GET all reminders for a user (with optional patientId scope)
router.get('/', protect, validate(getRemindersSchema), restrictToOwner, async (req, res, next) => {
  try {
    const { userId, patientId } = req.query;
    const reminders = await reminderService.getAllReminders(userId, patientId);
    res.json(reminders);
  } catch (err) {
    next(err);
  }
});

// POST create a new reminder
router.post('/', protect, validate(createReminderSchema), restrictToOwner, async (req, res, next) => {
  try {
    const reminder = await reminderService.createReminder(req.body);
    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
});

// PATCH update a reminder — with ownership verification
router.patch('/:id', protect, validate(updateReminderSchema), async (req, res, next) => {
  try {
    const reminder = await reminderService.updateReminder(
      req.params.id,
      req.body,
      req.user.uid  // Pass authenticated user for ownership check
    );
    res.json(reminder);
  } catch (err) {
    next(err);
  }
});

// DELETE a reminder — with ownership verification
router.delete('/:id', protect, async (req, res, next) => {
  try {
    await reminderService.deleteReminder(
      req.params.id,
      req.user.uid  // Pass authenticated user for ownership check
    );
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
