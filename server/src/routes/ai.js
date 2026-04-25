import express from 'express';
import * as aiService from '../services/aiService.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * AI Behavioral Adherence Coach
 */
router.post('/coach', protect, async (req, res, next) => {
  try {
    const { logs, medicines, userName } = req.body;
    const advice = await aiService.getCoachAdvice(logs, medicines, userName);
    res.json(advice);
  } catch (error) {
    next(error);
  }
});

/**
 * Holistic Safety Engine
 */
router.post('/holistic-safety', protect, async (req, res, next) => {
  try {
    const { medicines, lifestyleFactors } = req.body;
    const safety = await aiService.checkHolisticSafety(medicines, lifestyleFactors);
    res.json(safety);
  } catch (error) {
    next(error);
  }
});

/**
 * Medication Travel Companion
 */
router.post('/travel', protect, async (req, res, next) => {
  try {
    const advice = await aiService.getTravelAdvice(req.body);
    res.json(advice);
  } catch (error) {
    next(error);
  }
});

/**
 * Wellness Pattern Insight
 */
router.post('/wellness-insight', protect, async (req, res, next) => {
  try {
    const { doseLogs, wellnessLogs, medicines } = req.body;
    const insight = await aiService.getWellnessInsight(doseLogs, wellnessLogs, medicines);
    res.json(insight);
  } catch (error) {
    next(error);
  }
});

/**
 * Instant Meal Safety Check
 */
router.post('/meal-check', protect, async (req, res, next) => {
  try {
    const { medicines, mealDescription } = req.body;
    const safety = await aiService.checkMealSafety(medicines, mealDescription);
    res.json(safety);
  } catch (error) {
    next(error);
  }
});

/**
 * Proactive Nutritional Guidance
 */
router.post('/nutritional-guidance', protect, async (req, res, next) => {
  try {
    const { medicines } = req.body;
    const guidance = await aiService.getNutritionalGuidance(medicines);
    res.json(guidance);
  } catch (error) {
    next(error);
  }
});

/**
 * Conversational AI Assistant (Dawa-GPT)
 */
router.post('/chat', protect, async (req, res, next) => {
  try {
    const chat = await aiService.chatWithDawaGPT(req.body);
    res.json(chat);
  } catch (error) {
    next(error);
  }
});

/**
 * Streaming Conversational AI Assistant
 */
router.post('/chat/stream', protect, async (req, res, next) => {
  try {
    const stream = await aiService.streamChatWithDawaGPT(req.body);
    
    // Set headers for SSE (Server-Sent Events) or raw stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Pipe the axios stream to the response
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});


export default router;
