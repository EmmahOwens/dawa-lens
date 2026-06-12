import express from 'express';
import axios from 'axios';
import * as aiService from '../services/aiService.js';
import { protect } from '../middleware/authMiddleware.js';
import { heavyAiLimiter, tokenBudgetGuard } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validateMiddleware.js';
import * as aiValidation from '../validations/aiValidation.js';

const router = express.Router();

/**
 * TEMPORARY: Cerebras API diagnostic endpoint.
 * Tests key validity, available models, chat completion, and JSON mode.
 * No auth required — remove after debugging!
 * 
 * GET /api/v1/ai/diagnostic
 */
router.get('/diagnostic', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    steps: {},
  };

  const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
  const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
  const CEREBRAS_MODELS_URL = 'https://api.cerebras.ai/v1/models';
  const CONFIGURED_MODEL = 'gpt-oss-120b';

  // Step 1: Check key presence
  if (!CEREBRAS_API_KEY) {
    results.steps.keyCheck = { status: 'FAIL', message: 'CEREBRAS_API_KEY not set in environment' };
    return res.json(results);
  }
  results.steps.keyCheck = {
    status: 'OK',
    keyPrefix: CEREBRAS_API_KEY.substring(0, 8) + '...',
    keyLength: CEREBRAS_API_KEY.length,
  };

  // Step 2: List models
  try {
    const modelsRes = await axios.get(CEREBRAS_MODELS_URL, {
      headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}` },
      timeout: 10000,
    });
    const models = modelsRes.data?.data || modelsRes.data?.models || modelsRes.data;
    const modelIds = Array.isArray(models) ? models.map(m => m.id || m.name) : [];
    const configuredModelFound = modelIds.includes(CONFIGURED_MODEL);
    results.steps.listModels = {
      status: 'OK',
      availableModels: modelIds,
      configuredModel: CONFIGURED_MODEL,
      configuredModelFound,
      warning: configuredModelFound ? null : `Model "${CONFIGURED_MODEL}" NOT found — this is likely why Cerebras fails!`,
    };
  } catch (err) {
    results.steps.listModels = {
      status: 'FAIL',
      httpStatus: err.response?.status,
      error: err.response?.data || err.message,
    };
  }

  // Step 3: Test chat completion
  try {
    const start = Date.now();
    const chatRes = await axios.post(CEREBRAS_API_URL, {
      model: CONFIGURED_MODEL,
      messages: [{ role: 'user', content: 'Say hello in 5 words or fewer.' }],
      max_tokens: 20,
      temperature: 0,
    }, {
      headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    const elapsed = Date.now() - start;
    results.steps.chatCompletion = {
      status: 'OK',
      responseTimeMs: elapsed,
      content: chatRes.data?.choices?.[0]?.message?.content,
      usage: chatRes.data?.usage,
      responseId: chatRes.data?.id,
    };
  } catch (err) {
    results.steps.chatCompletion = {
      status: 'FAIL',
      httpStatus: err.response?.status,
      error: err.response?.data || err.message,
      diagnosis: err.response?.status === 401 ? 'API key is INVALID or EXPIRED'
        : err.response?.status === 404 ? `Model "${CONFIGURED_MODEL}" does not exist`
        : err.response?.status === 400 ? `Bad request — model "${CONFIGURED_MODEL}" may be deprecated`
        : err.response?.status === 429 ? 'Rate limited — key works but hit usage limits'
        : 'Unknown error',
    };
  }

  // Step 4: Test JSON mode
  try {
    const jsonRes = await axios.post(CEREBRAS_API_URL, {
      model: CONFIGURED_MODEL,
      messages: [
        { role: 'system', content: 'Respond in JSON with a "greeting" field.' },
        { role: 'user', content: 'Hello' },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 50,
      temperature: 0,
    }, {
      headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    const content = jsonRes.data?.choices?.[0]?.message?.content;
    let parsed = null;
    try { parsed = JSON.parse(content); } catch { /* not valid JSON */ }
    results.steps.jsonMode = {
      status: parsed ? 'OK' : 'PARTIAL',
      rawContent: content,
      parsed,
      warning: parsed ? null : 'Response is not valid JSON — will cause app parse errors',
    };
  } catch (err) {
    results.steps.jsonMode = {
      status: 'FAIL',
      httpStatus: err.response?.status,
      error: err.response?.data || err.message,
    };
  }

  // Summary
  const allOk = Object.values(results.steps).every(s => s.status === 'OK');
  results.summary = allOk
    ? '✅ Cerebras is fully operational'
    : '❌ Cerebras has issues — check step details above';

  res.json(results);
});

/**
 * Personalized Wellness Quote
 */
router.post('/wellness-quote', protect, validate(aiValidation.wellnessQuoteSchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/health-discoveries', protect, validate(aiValidation.healthDiscoveriesSchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/coach', protect, validate(aiValidation.coachAdviceSchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/holistic-safety', protect, validate(aiValidation.holisticSafetySchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/travel', protect, validate(aiValidation.travelAdviceSchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/wellness-insight', protect, validate(aiValidation.wellnessInsightSchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/meal-check', protect, validate(aiValidation.mealCheckSchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/nutritional-guidance', protect, validate(aiValidation.nutritionalGuidanceSchema), heavyAiLimiter, async (req, res, next) => {
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
router.post('/emotion-reflection', protect, validate(aiValidation.emotionReflectionSchema), heavyAiLimiter, async (req, res, next) => {
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
