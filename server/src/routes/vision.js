import express from 'express';
import * as visionService from '../services/visionService.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Identify a pill from an image (base64)
 */
router.post('/pill-id', protect, async (req, res, next) => {
  try {
    const { image, patientAge, ocrText } = req.body || {};
    if ((!ocrText || !ocrText.trim()) && (!image || typeof image !== 'string' || image.trim().length === 0)) {
      return res.status(400).json({ error: 'No medication image or label text provided', code: 'MISSING_INPUT' });
    }

    const result = await visionService.identifyPill(image, patientAge, ocrText);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
