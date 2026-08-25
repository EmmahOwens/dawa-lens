import express from 'express';
import axios from 'axios';
import * as aiService from '../services/aiService.js';
import { protect } from '../middleware/authMiddleware.js';
import { heavyAiLimiter, aiLimiter, tokenBudgetGuard } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validateMiddleware.js';
import * as aiValidation from '../validations/aiValidation.js';

const router = express.Router();

/**
 * Diagnostic Endpoint: Check Z.ai API Key Status & Test Generation
 */
router.get('/test-zai', protect, aiLimiter, async (req, res, next) => {
  try {
    let availableModels = [];
    if (process.env.Z_AI_API_KEY) {
      try {
        const mResp = await axios.get('https://api.z.ai/api/paas/v4/models', {
          headers: { 'Authorization': `Bearer ${process.env.Z_AI_API_KEY}` },
          timeout: 5000
        });
        availableModels = mResp.data?.data?.map(m => m.id) || mResp.data;
      } catch (mErr) {
        try {
          const mResp2 = await axios.get('https://open.bigmodel.cn/api/paas/v4/models', {
            headers: { 'Authorization': `Bearer ${process.env.Z_AI_API_KEY}` },
            timeout: 5000
          });
          availableModels = mResp2.data?.data?.map(m => m.id) || mResp2.data;
        } catch (e2) {
          availableModels = mErr.response?.data || mErr.message;
        }
      }
    }

    const testResult = await aiService.testZaiProvider();
    res.json({ ...testResult, availableModels });
  } catch (error) {
    next(error);
  }
});

/**
 * Diagnostic Endpoint: Overall AI Providers Status Check
 */
router.get('/providers-status', protect, aiLimiter, async (req, res, next) => {
  try {
    const status = await aiService.testAllAiProviders();
    res.json(status);
  } catch (error) {
    next(error);
  }
});


/**
 * Personalized Wellness Quote
 */
router.post('/wellness-quote', protect, validate(aiValidation.wellnessQuoteSchema), aiLimiter, async (req, res, next) => {
  try {
    const { userName } = req.body;
    const quote = await aiService.getWellnessQuote(userName);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

/**
 * Health Discoveries (Health Tip & Did You Know)
 */
router.post('/health-discoveries', protect, validate(aiValidation.healthDiscoveriesSchema), aiLimiter, async (req, res, next) => {
  try {
    const discoveries = await aiService.getHealthDiscoveries();
    res.json(discoveries);
  } catch (error) {
    next(error);
  }
});

/**
 * AI Behavioral Adherence Coach
 */
router.post('/coach', protect, validate(aiValidation.coachAdviceSchema), aiLimiter, async (req, res, next) => {
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
router.post('/holistic-safety', protect, validate(aiValidation.holisticSafetySchema), aiLimiter, async (req, res, next) => {
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
router.post('/travel', protect, validate(aiValidation.travelAdviceSchema), aiLimiter, async (req, res, next) => {
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
router.post('/wellness-insight', protect, validate(aiValidation.wellnessInsightSchema), aiLimiter, async (req, res, next) => {
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
router.post('/meal-check', protect, validate(aiValidation.mealCheckSchema), aiLimiter, async (req, res, next) => {
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
router.post('/nutritional-guidance', protect, validate(aiValidation.nutritionalGuidanceSchema), aiLimiter, async (req, res, next) => {
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
router.post('/emotion-reflection', protect, validate(aiValidation.emotionReflectionSchema), aiLimiter, async (req, res, next) => {
  try {
    const { mood, energy, symptoms, medicines } = req.body;
    const reflection = await aiService.getEmotionReflection(mood, energy, symptoms, medicines);
    res.json(reflection);
  } catch (error) {
    next(error);
  }
});

/**
 * Conversational AI Assistant (DawaGPT)
 */
router.post('/chat', protect, validate(aiValidation.chatSchema), heavyAiLimiter, tokenBudgetGuard, async (req, res, next) => {
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
router.post('/chat/stream', protect, validate(aiValidation.chatSchema), heavyAiLimiter, tokenBudgetGuard, async (req, res, next) => {
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
