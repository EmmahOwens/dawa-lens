import express from 'express';
import * as aiService from '../services/aiService.js';
import { protect } from '../middleware/authMiddleware.js';
import { heavyAiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Personalized Wellness Quote
 */
router.post('/wellness-quote', protect, heavyAiLimiter, async (req, res, next) => {
  try {
    const { userName } = req.body;
    const quote = await aiService.getWellnessQuote(userName);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

/**
 * AI Behavioral Adherence Coach
 */
router.post('/coach', protect, heavyAiLimiter, async (req, res, next) => {
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
router.post('/holistic-safety', protect, heavyAiLimiter, async (req, res, next) => {
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
router.post('/travel', protect, heavyAiLimiter, async (req, res, next) => {
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
router.post('/wellness-insight', protect, heavyAiLimiter, async (req, res, next) => {
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
router.post('/meal-check', protect, heavyAiLimiter, async (req, res, next) => {
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
router.post('/nutritional-guidance', protect, heavyAiLimiter, async (req, res, next) => {
  try {
    const { medicines } = req.body;
    const guidance = await aiService.getNutritionalGuidance(medicines);
    res.json(guidance);
  } catch (error) {
    next(error);
  }
});

/**
 * Personalized Emotion Reflection (Wellness Hub – Daily Vibe + Body Scan)
 */
router.post('/emotion-reflection', protect, heavyAiLimiter, async (req, res, next) => {
  try {
    const { mood, energy, symptoms, medicines } = req.body;
    const reflection = await aiService.getEmotionReflection(mood, energy, symptoms, medicines);
    res.json(reflection);
  } catch (error) {
    next(error);
  }
});

/**
 * Conversational AI Assistant (Dawa-GPT)
 */
router.post('/chat', protect, heavyAiLimiter, async (req, res, next) => {
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
router.post('/chat/stream', protect, heavyAiLimiter, async (req, res, next) => {
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
