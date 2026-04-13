import express from 'express';
import * as patientService from '../services/patientService.js';
import { protect, restrictToOwner } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createPatientSchema, updatePatientSchema, getPatientsSchema } from '../validations/patientValidation.js';

const router = express.Router();

// GET all patients managed by a user
router.get('/', protect, validate(getPatientsSchema), restrictToOwner, async (req, res, next) => {
  try {
    const { managedBy } = req.query;
    const patients = await patientService.getAllPatients(managedBy);
    res.json(patients);
  } catch (err) {
    next(err);
  }
});

// POST create a new patient profile
router.post('/', protect, validate(createPatientSchema), restrictToOwner, async (req, res, next) => {
  try {
    const patient = await patientService.createPatient(req.body);
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

// PATCH update a patient by id
router.patch('/:id', protect, validate(updatePatientSchema), async (req, res, next) => {
  try {
    const patient = await patientService.updatePatient(req.params.id, req.body);
    res.json(patient);
  } catch (err) {
    next(err);
  }
});

// DELETE remove a patient by id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    await patientService.deletePatient(req.params.id);
    res.json({ message: 'Patient profile deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
