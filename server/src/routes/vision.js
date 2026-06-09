import express from 'express';
import * as visionService from '../services/visionService.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Identify a pill from an image (base64)
 */
router.post('/pill-id', protect, async (req, res, next) => {
  try {
    const { image, patientAge } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided', code: 'NO_IMAGE' });
    }

    const result = await visionService.identifyPill(image, patientAge);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
