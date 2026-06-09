import express from 'express';
import * as userService from '../services/userService.js';
import { protect, restrictToOwner } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { getUserSchema, upsertUserSchema } from '../validations/userValidation.js';
import AppError from '../utils/AppError.js';

const router = express.Router();

// GET user profile
router.get('/:uid', protect, validate(getUserSchema), restrictToOwner, async (req, res, next) => {
  try {
    const profile = await userService.getUserProfile(req.params.uid);
    if (!profile) {
      return next(new AppError('User profile not found', 404));
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// POST update/create user profile
router.post('/', protect, validate(upsertUserSchema), restrictToOwner, async (req, res, next) => {
  try {
    const { uid } = req.body;
    const profile = await userService.upsertUserProfile(uid, req.body);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

export default router;
