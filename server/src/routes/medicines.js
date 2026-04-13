import express from 'express';
import * as medicineService from '../services/medicineService.js';
import { protect, restrictToOwner } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createMedicineSchema, updateMedicineSchema, getMedicinesSchema } from '../validations/medicineValidation.js';

const router = express.Router();

// GET all medicines for a user
router.get('/', protect, validate(getMedicinesSchema), restrictToOwner, async (req, res, next) => {
  try {
    const { userId, patientId } = req.query;
    const medicines = await medicineService.getAllMedicines(userId, patientId);
    res.json(medicines);
  } catch (err) {
    next(err);
  }
});

// POST create a new medicine
router.post('/', protect, validate(createMedicineSchema), restrictToOwner, async (req, res, next) => {
  try {
    const medicine = await medicineService.createMedicine(req.body);
    res.status(201).json(medicine);
  } catch (err) {
    next(err);
  }
});

// PATCH update a medicine by id
router.patch('/:id', protect, validate(updateMedicineSchema), async (req, res, next) => {
  try {
    const medicine = await medicineService.updateMedicine(req.params.id, req.body);
    res.json(medicine);
  } catch (err) {
    next(err);
  }
});

// DELETE remove a medicine by id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    await medicineService.deleteMedicine(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
