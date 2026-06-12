import axios from 'axios';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import AppError from '../utils/AppError.js';
import { retrieveMedicalKnowledge } from './vectorService.js';
import * as medicineService from './medicineService.js';
import * as reminderService from './reminderService.js';
import * as doseLogService from './doseLogService.js';
import * as patientService from './patientService.js';
import * as wellnessService from './wellnessService.js';
import { rateLimitManager } from './rateLimitManager.js';
import { getFoodKnowledgePrompt, LOCAL_FOODS } from './localFoodService.js';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_KEY_2 = process.env.GROQ_API_KEY_2;
const GROQ_API_KEY_3 = process.env.GROQ_API_KEY_3;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_SCOUT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_LIGHT_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODEL = 'gpt-oss-120b';
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

/**
 * Global AI error handler to ensure all errors returned are "operational" AppErrors.
 */
export function handleAiError(err) {
  if (err.isOperational) throw err;

  console.error("AI Service Error:", err);

  if (err.response) {
    const status = err.response.status;
    const msg = err.response.data?.error?.message || 'AI API request failed';
    throw new AppError(`AI API error (${status}): ${msg}`, 502);
  }

  if (err instanceof SyntaxError) {
    throw new AppError('AI returned malformed data. Please try again.', 502);
  }

  if (err instanceof TypeError) {
    throw new AppError('Internal processing error in AI service.', 500);
  }

  throw new AppError(err.message || 'Unexpected AI service error. Please try again.', 500);
}

/**
 * Determines which API key to use based on the model ID.
 * Implements round-robin rotation across available keys for 70B.
 * For 8B, prefer KEY_2 if available.
 */
const GROQ_KEYS = [GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3].filter(Boolean);
let groqKeyIndex = 0;

const getGroqApiKey = (modelId) => {
  if (modelId && modelId.toLowerCase().includes('llama-3.1-8b')) {
    // Independent key for 8B model to avoid 70B limit sharing if possible
    return GROQ_API_KEY_2 || GROQ_API_KEY;
  }

  // Round-robin across all available keys (each key has its own RPD budget if from different accounts)
  if (GROQ_KEYS.length === 0) return null;
  const key = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length];
  groqKeyIndex++;
  return key;
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Strip markdown code fences that AI sometimes wraps JSON responses in.
 */
const sanitizeJson = (text) => {
  if (typeof text !== 'string') return text;
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
};

const EMERGENCY_KEYWORDS = [
  'poison', 'suicide', 'kill myself', 'allergic reaction', 'chest pain',
  'difficulty breathing', 'can\'t breathe', 'stroke', 'seizure', 'unconscious',
  'overdose', 'bleeding heavily', 'anaphylaxis'
];

const detectEmergency = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some(kw => lowerText.includes(kw));
};

const EMERGENCY_RESPONSE = {
  text: "🚨 **EMERGENCY ALERT**: I've detected a potentially life-threatening situation in your message. \n\n**PLEASE STOP AND SEEK IMMEDIATE HELP:**\n- **Call Emergency Services (911/999/112)** immediately.\n- Contact your nearest hospital or clinic.\n- If this is an overdose or allergic reaction, inform the medical team exactly what was taken.\n\nI am an AI, not a doctor. Please do not wait for my response.",
  suggestions: ["Call Emergency", "Nearest Hospital", "I'm okay now"],
  source: "System Safety",
  action: null
};

/**
 * Fallback chat with Gemini (Standard JSON response)
 */
const callGeminiChat = async (finalMessages, priority = 'high', maxTokens = 2048, temperature = 0.7) => {
  if (!GEMINI_API_KEY) {
    throw new AppError('AI service is temporarily unavailable. Please try again later.', 503);
  }

  // Transform OpenAI/Groq messages format to Gemini format
  const contents = finalMessages
    .filter(m => m.role !== 'system') // System instruction is already in our context
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  const fn = async () => {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents,
      systemInstruction: {
        parts: [{ text: "You are Dawa-Lens AI, a warm and caring health companion. Respond STRICTLY in JSON format with 'text', 'suggestions', 'source', and 'action' fields. Use Markdown for formatting in the 'text' field. The 'suggestions' field MUST contain EXACTLY 3 short follow-up prompts (under 6 words each) that are NATURAL CONTINUATIONS of the conversation — what the user would logically ask or do next based on your response. Suggestions must be from the user's perspective. Agentic capabilities are enabled via the 'action' field." }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: maxTokens,
        temperature: temperature
      }
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AppError('Gemini returned an empty response.', 502);

    const parsed = JSON.parse(sanitizeJson(text));
    parsed.source = "Gemini (Fallback)";
    return parsed;
  };

  try {
    return await rateLimitManager.enqueue(fn, 'gemini', finalMessages, priority, 3, false); // Allow retries for the final fallback
  } catch (err) {
    console.error("Gemini Fallback Error:", err.message);
    throw new AppError('All AI services are currently unavailable. Please try again later.', 503);
  }
};

/**
 * Standard chat completion call to Cerebras (GPT-OSS-120B)
 */
const callCerebrasChat = async (messages, responseFormat = { type: 'json_object' }, modelId = CEREBRAS_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  if (!CEREBRAS_API_KEY) {
    throw new AppError('Cerebras API key not configured', 503);
  }

  const fn = async () => {
    const payload = {
      model: modelId,
      messages,
      max_tokens: maxTokens,
      temperature: temperature
    };
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    const response = await axios.post(CEREBRAS_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // Increased timeout to give Cerebras more time before fallback
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new AppError('Cerebras returned an empty response.', 502);
    }

    const result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object') result.source = "Cerebras (Llama-3-120B)";
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'cerebras-120b', messages, priority, 3, failFast);
};

/**
 * Standard chat completion call to Groq routed via rate limit queue
 */
const callGroqChat = async (messages, responseFormat = { type: 'json_object' }, modelId = GROQ_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  const apiKey = getGroqApiKey(modelId);
  if (!apiKey) {
    throw new AppError('Groq API key not configured', 401);
  }

  const modelKey = modelId === GROQ_MODEL ? 'groq-70b'
    : modelId === GROQ_SCOUT_MODEL ? 'groq-scout'
    : 'groq-8b';

  const fn = async () => {
    const payload = {
      model: modelId,
      messages,
      max_tokens: maxTokens,
      temperature: temperature
    };
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    const response = await axios.post(GROQ_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new AppError('AI returned an empty response.', 502);
    }

    const result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object') result.source = `Groq (${modelId})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, modelKey, messages, priority, 3, failFast);
};

/**
 * Unified AI call with multi-provider fallback.
 * Order: Cerebras -> Groq (70B) -> Groq (Scout) -> Groq (8B) -> Gemini
 */
export const callAiWithFallback = async (messages, options = {}) => {
  const { 
    isJson = true, 
    priority = 'high', 
    maxTokens = 2048, 
    isComplex = true,
    forceModel = null,
    temperature = 0.7
  } = options;

  const responseFormat = isJson ? { type: 'json_object' } : null;

  // 1. Try Cerebras (Primary)
  if (CEREBRAS_API_KEY && forceModel !== 'groq-70b' && forceModel !== 'groq-scout' && forceModel !== 'groq-8b' && forceModel !== 'gemini') {
    try {
      return await callCerebrasChat(messages, responseFormat, CEREBRAS_MODEL, priority, maxTokens, false, temperature);
    } catch (err) {
      console.warn("Fallback: Cerebras failed, trying Groq 70B...", err.message);
    }
  }

  // 2. Try Groq 70B
  if (GROQ_API_KEY && (isComplex || forceModel === 'groq-70b' || !CEREBRAS_API_KEY)) {
    try {
      const modelId = GROQ_MODEL;
      return await callGroqChat(messages, responseFormat, modelId, priority, maxTokens, false, temperature);
    } catch (err) {
      console.warn("Fallback: Groq 70B failed, trying Groq Scout...", err.message);
    }
  }

  // 2.5 Try Groq Scout
  if (GROQ_API_KEY) {
    try {
      return await callGroqChat(messages, responseFormat, GROQ_SCOUT_MODEL, priority, maxTokens, false, temperature);
    } catch (err) {
      console.warn("Fallback: Groq Scout failed, trying Groq 8B...", err.message);
    }
  }

  // 3. Try Groq 8B (Secondary key/model)
  if (GROQ_API_KEY_2 || GROQ_API_KEY) {
    try {
      const modelId = GROQ_LIGHT_MODEL;
      return await callGroqChat(messages, responseFormat, modelId, priority, maxTokens, false, temperature);
    } catch (err) {
      console.warn("Fallback: Groq 8B failed, trying Gemini...", err.message);
    }
  }

  // 4. Try Gemini (Final fallback)
  try {
    return await callGeminiChat(messages, priority, maxTokens, temperature);
  } catch (err) {
    console.error("Fallback: ALL AI providers failed.", err.message);
    throw new AppError('All AI services are currently unavailable. Please try again later.', 503);
  }
};

const callGroq = async (prompt, isJson = true, modelId = GROQ_MODEL, priority = 'high', maxTokens = 2048, temperature = 0.7) => {
  const messages = [{ role: 'user', content: prompt }];
  const isComplex = modelId === GROQ_MODEL || modelId === GROQ_SCOUT_MODEL;
  try {
    return await callAiWithFallback(messages, { isJson, priority, maxTokens, isComplex, temperature });
  } catch (err) {
    handleAiError(err);
  }
};

// --- Helpers ---

const responseCache = new Map();

/**
 * Helper to wrap AI calls with a simple in-memory TTL cache.
 */
const withCache = async (key, ttlMs, fn) => {
  const hit = responseCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;

  const value = await fn();
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });

  // Evict stale entries to prevent memory leak
  if (responseCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now > v.expiresAt) responseCache.delete(k);
    }
  }
  return value;
};

export const getWellnessQuote = async (userName, priority = 'medium') => {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `quote:${userName || 'friend'}:${today}`;

  return withCache(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const prompt = `
      Generate a short, powerful, and inspiring wellness quote (max 15 words) for a health app user named ${userName || 'friend'}.
      The quote should emphasize consistency, strength, or the journey to better health.
      Context: East Africa (keep it culturally relevant but universally inspiring).
      Respond in JSON format: { "quote": "..." }
    `;
    return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 200, 0.6);
  });
};

export const getCoachAdvice = async (logs, medicines, userName, priority = 'high') => {
  const prompt = `
    You are the "Dawa-Lens Adherence Coach", a supportive health assistant for users in East Africa.
    User Name: ${userName || 'User'}
    Current Medications: ${JSON.stringify(medicines)}
    Recent Medication Activity (Logs): ${JSON.stringify(logs)}
    
    Your task:
    1. Analyze the logs for any patterns in missed or delayed doses.
    2. Provide supportive, non-judgmental advice.
    3. If adherence is high, give praise.
    4. Mention specific medications with more misses.
    5. Proactive suggestions: If a user consistently misses a dose at a certain time, suggest moving it by 30-60 minutes if safe, or suggest a specific ritual (e.g., "take with your morning tea").
    6. Tone: Warm and culturally appropriate for East Africa.
    7. Warning: Do not change dosages. Advise doctor visit if heart/BP meds are skipped.
    8. Use Markdown for formatting the advice (bolding, lists) to make it readable.
    9. DATE FORMATTING: For any dates or times generated in the response, only include the date and time (YYYY-MM-DD HH:mm). REMOVE seconds and milliseconds.

    Respond in JSON format:
    { "advice": "text (Markdown formatted)", "patterns": ["list"], "adherenceScore": 0-100 }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 800);
};

export const checkHolisticSafety = async (medicines, lifestyleFactors, priority = 'high') => {
  const prompt = `
    You are "Dawa-Lens Holistic Safety Engine".
    Medication List: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    Factors: ${JSON.stringify(lifestyleFactors)}

    Task: Identify interactions with food/lifestyle (Alcohol, Caffeine, Grapefruit, Dairy, etc.).
    Include East African context: also check for interactions with local staples (e.g., Mukene, Kalo, Nakati) if mentioned or relevant.
    Categorize risk: High, Medium, Low.
    Use Markdown for formatting the explanation and advice if helpful.

    Respond in JSON format:
    { "interactions": [{ "factor": "...", "risk": "...", "explanation": "text (Markdown)", "advice": "text (Markdown)" }] }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 600);
};

export const getTravelAdvice = async ({ medicines, destination, currentCity, homeTimezone, targetTimezone }, priority = 'high') => {
  const prompt = `
    You are the "Dawa-Lens Global Travel Companion".
    Travel: ${currentCity || 'Home'} (${homeTimezone}) to ${destination} (${targetTimezone || 'Unknown'}).
    Medicines: ${JSON.stringify(medicines.map(m => ({ name: m.name, generic: m.genericName, dosage: m.dosage })))}
    
    Task:
    1. Find equivalent brand names in ${destination}.
    2. Timezone shift advice for dosing.
    3. Customs restrictions for these specific meds.
    4. Provide ONLY TWO emergency contact numbers for ${destination}:
       a) Ambulance / Emergency Medical Services number (e.g. 999, 911, 112, or country-specific)
       b) The NATIONAL DRUG REGULATORY AUTHORITY (e.g. National Drug Authority in Uganda, FDA in USA, MHRA in UK, CDSCO in India) — include their name and public helpline number.
       Do NOT include Police. Do NOT include generic numbers like 112 for the drug authority.
    5. Provide a detailed summary of general health risks (e.g. Malaria, yellow fever, water safety) for ${destination} in a clear markdown format.
    6. Use Markdown for formatting the advice, notes, and risks.

    Respond in EXACT JSON format:
    { 
      "equivalents": [
        { "original": "Original medicine name", "equivalent": "Local equivalent brand name in ${destination}" }
      ],
      "timezoneAdvice": "text (Markdown formatted)",
      "customsNotes": "text (Markdown formatted)",
      "emergencyContacts": [
        { "service": "Ambulance", "number": "...", "type": "ambulance" },
        { "service": "[Full Authority Name]", "number": "...", "type": "drug_authority" }
      ],
      "healthRisks": "text (Markdown formatted)"
    }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 1200);
};

export const getWellnessInsight = async (doseLogs, wellnessLogs, medicines, priority = 'high') => {
  const prompt = `
    You are the "Dawa-Lens Medical Data Analyst".
    
    === DATA FOR ANALYSIS ===
    Medicines: ${JSON.stringify(medicines.map(m => m.name))}
    Medication Logs (last 30 days): ${JSON.stringify(doseLogs.slice(0, 30).map(l => ({ 
      med: l.medicineName, 
      time: l.actionTime ? l.actionTime.replace(/:\d{2}\.\d{3}Z$/, '').replace('T', ' ') : undefined, 
      status: l.action 
    })))}
    Wellness/Symptom Logs: ${JSON.stringify(wellnessLogs.slice(0, 20).map(l => ({ 
      time: l.timestamp ? l.timestamp.replace(/:\d{2}\.\d{3}Z$/, '').replace('T', ' ') : undefined, 
      type: l.type, 
      data: l.data 
    })))}
    
    === TASK ===
    1. Correlate medication adherence with wellness trends (side effects, energy, mood).
    2. Identify specific dosage patterns (e.g., missed morning doses, timing delays).
    3. Generate a high-level clinical summary suitable for a doctor.
    4. DATE FORMATTING: For any dates or times generated in the response, only include the date and time (YYYY-MM-DD HH:mm). REMOVE seconds and milliseconds.

    === RESPONSE FORMAT (STRICT JSON) ===
    { 
      "summary": "2-3 sentences high level clinical overview (Markdown formatted).",
      "dosagePatterns": "Analysis of adherence, skipped doses, and timing (Markdown formatted).",
      "lifestyleAnalysis": "Correlation between symptoms/energy and logs (Markdown formatted).",
      "insights": ["Specific correlation bullet 1", "Specific correlation bullet 2"],
      "actionItems": ["Actionable clinical suggestion 1", "Suggestion 2"],
      "correlationScore": 85
    }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 800);
};

export const checkMealSafety = async (medicines, mealDescription, priority = 'high') => {
  const prompt = `
    You are "Dawa-Lens Meal Safety Checker".
    Medicines: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    Meal: "${mealDescription}"

    Task: Check for interactions (Dairy, Grapefruit, Alcohol, etc.).
    Risk: High, Medium, Safe.
    Use Markdown for formatting the verdict and explanation.

    Respond in JSON format:
    { "risk": "...", "verdict": "text (Markdown)", "explanation": "text (Markdown)" }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 400, 0.1);
};

export const getNutritionalGuidance = async (medicines, priority = 'high') => {
  const medKey = medicines.map(m => m.name + (m.genericName || '')).sort().join(',');
  const cacheKey = `nutrition:${medKey}`;

  return withCache(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const prompt = `
      You are the "Dawa-Lens Nutritional Guard".
      Active Medications: ${JSON.stringify(medicines.map(m => ({ name: m.name, generic: m.genericName })))}

      Task:
      1. Provide 2-3 specific "Food Recommendations" that aid absorption or mitigate side effects for these medications.
      2. Identify "Critical Safety Warnings" regarding foods/drinks to avoid (e.g., Grapefruit, Alcohol, Dairy, Caffeine).
      3. Include "Timing Advice" (e.g., "Take 2 hours after dairy").
      4. Focus on East African regional foods (Matooke, G-nuts, Mukene, Kalo, Nakati, etc.) where appropriate, explaining their specific local benefits.
      5. Use Markdown for formatting reasons, explanations, and advice.

      Respond in EXACT JSON format:
      {
        "recommendations": [
          { "food": "string", "reason": "text (Markdown)", "benefit": "string" }
        ],
        "warnings": [
          { "factor": "string", "severity": "High" | "Medium", "explanation": "text (Markdown)" }
        ],
        "timingAdvice": "text (Markdown)"
      }
    `;
    return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 800, 0.4);
  });
};

export const getHealthDiscoveries = async (priority = 'low') => {
  return withCache('health-discoveries', 12 * 60 * 60 * 1000, async () => {
    const prompt = `
      Generate TWO distinct health discovery items for an East African health app:
      1. A "Health Tip": A short, actionable health or medication advice (max 15 words).
      2. A "Did You Know": A surprising, evidence-based health fact (max 15 words).

      Context: East Africa (e.g., Uganda, Kenya, Tanzania). Use regional context where appropriate (e.g., local foods like Matooke, G-nuts, Mukene, Kalo, or local climate/lifestyle).

      Respond in EXACT JSON format:
      {
        "healthTip": "...",
        "didYouKnow": "..."
      }
    `;
    return await callAiWithFallback([{ role: 'user', content: prompt }], {
      isJson: true,
      priority,
      maxTokens: 500,
      forceModel: 'gemini'
    });
  });
};

export const isComplexTask = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  if (text.length > 500) return true;
  const actionPatterns = [
    /(add|create|set|put|new|remind|schedule|register|log|record|track|save|update|change|modify|edit|adjust|delete|remove|stop|cancel|clear)/i,
    /(reminder|alarm|med|medicine|dose|taken|skipped|feeling|wellness|food|meal|profile|patient|family|mother|father|son|daughter|wife|husband|parent|child)/i
  ];
  const dataPatterns = [
    /(what|show|list|tell|view|see|check|get|summary|history|status)/i,
    /(my|current|active|recent|all)/i
  ];
  const hasActionVerb = /(add|create|set|remind|log|record|track|update|delete|remove|register)/i.test(lower);
  const hasDomainNoun = /(reminder|med|medicine|dose|log|wellness|family|profile|patient|history)/i.test(lower);
  const hasDataVerb = /(what|show|list|tell|view|check|get)/i.test(lower);
  const isActionRequest = hasActionVerb && hasDomainNoun;
  const isDataRequest = hasDataVerb && (hasDomainNoun || /(my|current|active|recent)/i.test(lower));
  const isHowToQuery = /^(how\s+do\s+i|can\s+you\s+explain|what\s+is|tell\s+me\s+about)/i.test(lower);
  if (isHowToQuery && !lower.includes('my')) return false;
  const hasDeleteIntent = /(delete|remove|cancel|stop)\s+(?:\w+\s+)*?(reminder|alarm|med|medicine)/i.test(lower);
  if (hasDeleteIntent) return true;
  const hasShowRemindersIntent = /(show|list|what\s+are|check|view)\s+\w*\s*reminders?/i.test(lower);
  if (hasShowRemindersIntent) return true;
  if (isActionRequest || isDataRequest) return true;
  const isMedicalQuery = /(dose|dosage|effect|safe|interact|symptom|pain|sick|hurt|doctor|health)/i.test(lower);
  if (isMedicalQuery && text.split(' ').length > 5) return true;
  return false;
};

const isLikelyActionRequest = (text) => {
  if (!text) return false;
  return /(add|create|set|put|new|remind|schedule|register|log|record|track|save|update|change|modify|edit|adjust|delete|remove|stop|cancel|clear)\s/i.test(text.toLowerCase());
};

export const chatWithDawaGPT = async (params, priority = 'high') => {
  try {
    const { messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, selectedPatientId } = params;

    if (!Array.isArray(messages)) {
      throw new AppError('Invalid messages format: expected an array.', 400);
    }

    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text || messages.filter(m => m.role === 'user').pop()?.content;

    if (detectEmergency(lastUserMsg)) {
      return EMERGENCY_RESPONSE;
    }

    const isComplex = isComplexTask(lastUserMsg);

    const { finalMessages } = await prepareDawaGPTContext({
      messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, isComplex, selectedPatientId
    });

    const chatMaxTokens = 2048;

    let result = await callAiWithFallback(finalMessages, {
      isJson: true, 
      priority, 
      maxTokens: chatMaxTokens, 
      isComplex 
    });

    if (result.action && result.action.type && isComplex) {
      console.log(`🤖 Agent executing action: ${result.action.type}`);
      try {
        const userId = userProfile?.id || userProfile?.uid;
        const actionResult = await executeAiAction(result.action, userId, medicines, selectedPatientId);
        result.actionExecuted = true;
        result.text += `\n\n[ACTION EXECUTED: ${result.action.type} — ID: ${actionResult?.id || 'new'}]`;
      } catch (actionErr) {
        console.error("Agent Action Execution Failed:", actionErr.message);
        result.text += `\n\n(Note: I tried to perform that action but encountered an error: ${actionErr.message})`;
      }
    }

    return result;
  } catch (err) {
    handleAiError(err);
  }
};

async function executeAiAction(action, userId, userMedicines = [], selectedPatientId = null) {
  const { type, payload } = action;
  if (!type || !payload) throw new Error('Action type and payload are required');
  const data = { ...payload, userId };
  if (!data.patientId) data.patientId = selectedPatientId;

  switch (type) {
    case 'ADD_MEDICINE': return await medicineService.createMedicine(data);
    case 'UPDATE_MEDICINE': return await medicineService.updateMedicine(payload.id, data);
    case 'ADD_REMINDER':
      if (!data.medicineId && data.medicineName && userMedicines.length > 0) {
        const match = userMedicines.find(m => 
          m.name.toLowerCase() === data.medicineName.toLowerCase() ||
          (m.genericName && m.genericName.toLowerCase() === data.medicineName.toLowerCase())
        );
        if (match) {
          data.medicineId = match.id;
          data.color = data.color || match.color;
          data.icon = data.icon || match.icon;
        }
      }
      return await reminderService.createReminder(data);
    case 'UPDATE_REMINDER': return await reminderService.updateReminder(payload.id, data, userId);
    case 'REMOVE_REMINDER': return await reminderService.deleteReminder(payload.id, userId);
    case 'LOG_DOSE': return await doseLogService.createDoseLog(data);
    case 'LOG_WELLNESS': return await wellnessService.createWellnessLog(data);
    case 'ADD_PATIENT': return await patientService.createPatient(data);
    default: throw new Error(`Unknown action type: ${type}`);
  }
}

export const streamChatWithDawaGPT = async (params, priority = 'high') => {
  try {
    const { messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, selectedPatientId } = params;

    if (!Array.isArray(messages)) throw new AppError('Invalid messages format.', 400);

    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text || messages.filter(m => m.role === 'user').pop()?.content;

    if (detectEmergency(lastUserMsg)) {
      return new Readable({
        read() {
          const metadata = JSON.stringify({ suggestions: EMERGENCY_RESPONSE.suggestions, source: EMERGENCY_RESPONSE.source, action: null });
          const data = JSON.stringify({ choices: [{ delta: { content: EMERGENCY_RESPONSE.text + "\n" + metadata } }] });
          this.push(`data: ${data}\n`);
          this.push(`data: [DONE]\n`);
          this.push(null);
        }
      });
    }

    const isComplex = isComplexTask(lastUserMsg);

    if (isComplex && isLikelyActionRequest(lastUserMsg)) {
      try {
        const result = await chatWithDawaGPT(params, priority);
        return createFakeStream(result);
      } catch (err) {
        return createFakeStream({ text: err.message || "I encountered an error.", suggestions: ["Try again"], source: "System", action: null });
      }
    }

    const { finalMessages } = await prepareDawaGPTContext({
      messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients,
      isStreaming: true, isComplex, selectedPatientId
    });

    const chatMaxTokens = 2048;

    function createFakeStream(jsonResp) {
      return new Readable({
        read() {
          const metadata = JSON.stringify({ suggestions: jsonResp.suggestions || [], source: jsonResp.source || "Dawa-GPT", action: jsonResp.action || null });
          const data = JSON.stringify({ choices: [{ delta: { content: (jsonResp.text || "") + "\n###METADATA###\n" + metadata } }] });
          this.push(`data: ${data}\n`);
          this.push(`data: [DONE]\n`);
          this.push(null);
        }
      });
    }

    if (CEREBRAS_API_KEY && isComplex) {
      try {
        const fn = async () => {
          const response = await axios.post(CEREBRAS_API_URL, { model: CEREBRAS_MODEL, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 20000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'cerebras-120b', finalMessages, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: Cerebras failed.", err.message);
      }
    }

    if (GROQ_API_KEY && isComplex) {
      try {
        const modelId = GROQ_MODEL;
        const apiKey = getGroqApiKey(modelId);
        const fn = async () => {
          const response = await axios.post(GROQ_API_URL, { model: modelId, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 15000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'groq-70b', finalMessages, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: Groq 70B failed.", err.message);
      }
    }

    if (GROQ_API_KEY_2 || GROQ_API_KEY) {
      try {
        const modelId = GROQ_LIGHT_MODEL;
        const apiKey = getGroqApiKey(modelId);
        const fn = async () => {
          const response = await axios.post(GROQ_API_URL, { model: modelId, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 15000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'groq-8b', finalMessages, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: Groq 8B failed.", err.message);
      }
    }

    try {
      const geminiResp = await callGeminiChat(finalMessages, priority, chatMaxTokens);
      return createFakeStream(geminiResp);
    } catch (err) {
      return createFakeStream({ text: "Sorry, I'm having trouble connecting.", suggestions: ["Try again"], source: "System", action: null });
    }
  } catch (err) {
    return new Readable({
      read() {
        const data = JSON.stringify({ choices: [{ delta: { content: "Error starting chat stream." } }] });
        this.push(`data: ${data}\n`);
        this.push(`data: [DONE]\n`);
        this.push(null);
      }
    });
  }
};

function buildPrimingMessage(reminders, medicines, patients, selectedPatientId) {
  const activePatient = patients?.find(p => p.id === selectedPatientId);
  const name = activePatient?.name || 'you';
  const reminderCount = reminders?.length || 0;
  const nextReminder = reminders?.[0];
  let opening = `Hi! I'm Dawa-GPT.`;
  if (reminderCount > 0 && nextReminder) opening += ` ${name === 'you' ? 'You have' : `${name} has`} ${reminderCount} reminder${reminderCount > 1 ? 's' : ''} set up.`;
  let firstSuggestions = [];
  if (nextReminder) firstSuggestions.push(`Log ${nextReminder.medicineName} as taken`);
  if (medicines?.length > 0) firstSuggestions.push(`Does ${medicines[0].name} interact with anything?`);
  firstSuggestions.push(reminderCount === 0 ? 'Add my first medicine reminder' : 'Add another medicine');
  return JSON.stringify({ text: opening, suggestions: firstSuggestions.slice(0, 3), source: 'Dawa-GPT', action: null });
}

async function prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, isStreaming = false, isComplex = true, selectedPatientId = null }) {
  const recentMessages = messages.slice(-5);
  const lastUserMsg = recentMessages.filter(m => m.role === 'user').pop()?.text || recentMessages.filter(m => m.role === 'user').pop()?.content || "";
  const lastAction = recentMessages.find(m => m.role === 'assistant' && (m.action || m.content?.includes('action')) )?.action;
  const conversationPhase = messages.length === 0 ? 'opening' : messages.length < 4 ? 'discovery' : lastAction ? 'post-action' : 'ongoing';
  const knowledgePromise = retrieveMedicalKnowledge(lastUserMsg);
  const activeMeds = medicines?.length ? medicines.map(m => `${m.name}${m.genericName ? ` (${m.genericName})` : ''} — ${m.dosage}`).join('; ') : 'None';
  const safeFormatDate = (val) => typeof val !== 'string' ? val : val.replace(/:\d{2}\.\d{3}Z$/, '').replace('T', ' ');
  const recentLogs = doseLogs ? JSON.stringify(doseLogs.slice(0, isComplex ? 5 : 2).map(l => ({ ...l, actionTime: safeFormatDate(l.actionTime), scheduledTime: safeFormatDate(l.scheduledTime) }))) : 'No logs';
  const remindersSummary = reminders?.length ? JSON.stringify(reminders.map(r => ({ id: r.id, medicineName: r.medicineName, dose: r.dose, time: r.time, repeat: r.repeatSchedule, enabled: r.enabled })).slice(0, isComplex ? 10 : 3)) : 'No reminders set';
  const wellnessSummary = wellnessLogs?.length ? JSON.stringify(wellnessLogs.slice(0, isComplex ? 3 : 1).map(l => ({ ...l, timestamp: safeFormatDate(l.timestamp) }))) : 'No wellness logs';
  const vitalityContext = vitalitySummary?.length ? `Vitality Trends (Last 7 Days): ${JSON.stringify(vitalitySummary.map(d => ({ day: d.name, adherence: `${d.adherence}%`, energy: d.energy ? `${(d.energy/20).toFixed(1)}/5` : 'N/A', mood: d.mood ? `${(d.mood/20).toFixed(1)}/5` : 'N/A' })))}` : 'No vitality trends available';
  const patientsSummary = patients?.length ? JSON.stringify(patients.map(p => ({ id: p.id, name: p.name, relation: p.relation }))) : 'No family profiles';
  const knowledgeSnippets = await knowledgePromise;
  const knowledgeContext = knowledgeSnippets.length > 0 ? `=== VERIFIED MEDICAL KNOWLEDGE (Context) ===\n${knowledgeSnippets.join('\n\n')}\n\n` : "";

  const STATIC_SYSTEM_PROMPT = `
    You are "Dawa-GPT", a warm and caring medical AI assistant integrated into the Dawa-Lens app.
    Regional Context: Uganda / East Africa.

    ${getFoodKnowledgePrompt()}

    === PERSONALITY & TONE ===
    - VOICE: You are an empathetic health companion. Think of a knowledgeable, caring pharmacist or a friend in the medical field.
    - DIALECT: Use standard English, but feel free to use subtle local flavor (e.g., "Kare", "Webale", "Well done", "How are you feeling today?") to build rapport.
    - EMPATHY: If a user mentions pain, fatigue, symptoms, or difficulty with their meds, acknowledge it with warmth before providing assistance.
    - NATURAL FLOW: Use natural contractions (I've, you're, we'll). Avoid sounding like a robot.
    - NO DISCLAIMER OVERLOAD: You already have a UI disclaimer. Focus on being helpful.

    === CAPABILITIES & ACTIONS ===
    You have FULL READ and WRITE access to the user's medication system.
    Actions:
    - ADD_MEDICINE: { name, genericName?, dosage, unit?, notes?, totalQuantity?, dosagePerDose?, patientId? }
    - UPDATE_MEDICINE: { id, name?, dosage?, notes? }
    - ADD_REMINDER: { medicineName, dose, time (HH:mm), repeatSchedule, patientId?, medicineId? }
    - UPDATE_REMINDER: { id, enabled?, time?, dose? }
    - REMOVE_REMINDER: { id }
    - LOG_DOSE: { reminderId, medicineName, dose, scheduledTime, action, patientId? }
    - LOG_WELLNESS: { type, data, patientId? }
    - ADD_PATIENT: { name, age, gender, relation }

    === RULES ===
    1. BE AGENTIC: PERFORM ACTIONS IMMEDIATELY.
    2. CONFIRMATION: Confirm actions in past tense ("I've added that for you.").
    3. MEDICINE NAME FORMAT: Whenever you mention any medicine, ALWAYS write the brand name first, followed by the chemical (generic/active ingredient) name in brackets. Example: "Panadol (Paracetamol)", "Augmentin (Amoxicillin/Clavulanate)", "Flagyl (Metronidazole)". Never mention only a generic name without its brand name, and never omit the chemical name in brackets.
    4. SUGGESTIONS (CRITICAL — READ CAREFULLY):
       - You MUST provide EXACTLY 3 short, context-aware follow-up suggestions in the 'suggestions' field.
       - Suggestions must be NATURAL CONTINUATIONS of the current conversation — what the user would logically ask or do NEXT based on YOUR response.
       - Suggestions must be from the USER's perspective (e.g., "Log my dose", NOT "You should log your dose").
       - If you asked the user a question, provide likely answers as suggestions.
       - If you discussed a medicine, suggest related actions (interactions, side effects, logging).
       - If you performed an action, suggest the next logical step.
       - NEVER repeat suggestions from earlier turns. Keep them fresh and relevant.
       - Keep them under 6 words each.
       ${(() => {
         const lastAssistantMsg = messages.slice().reverse().find(m => m.role === 'assistant');
         const prevSuggestions = lastAssistantMsg?.suggestions || lastAssistantMsg?.text?.match?.(/suggestions.*?\[(.*?)\]/s);
         if (lastAssistantMsg?.suggestions?.length) {
           return `- Previous turn suggestions were: ${JSON.stringify(lastAssistantMsg.suggestions)}. Generate NEW ones that follow the conversation forward.`;
         }
         return '';
       })()}

    CONVERSATION PHASE: ${conversationPhase}
    ${isStreaming ? `=== STREAMING RESPONSE FORMAT ===
    Write your response as normal Markdown text first, then on a new line append EXACTLY:
    ###METADATA###
    {"suggestions":["suggestion 1","suggestion 2","suggestion 3"],"source":"Gemini","action":null}
    
    The metadata JSON MUST contain:
    - "suggestions": array of EXACTLY 3 short follow-up prompts relevant to your response
    - "source": always "Gemini"
    - "action": null or an action object if you performed a system action
    DO NOT omit the suggestions field. DO NOT leave it empty.` : `=== RESPONSE FORMAT ===
    Respond in JSON: {"text":"...","suggestions":["s1","s2","s3"],"source":"Gemini","action":null}`}
  `;

  const dynamicContextBlock = `
    === CURRENT SESSION CONTEXT ===
    User: ${userProfile?.name || 'User'} | ID: ${userProfile?.id || 'unknown'}
    Active Profile: ${selectedPatientId || 'Self'}
    Active Medications: ${activeMeds}
    Reminders: ${remindersSummary}
    Recent Dose Logs: ${recentLogs}
    Wellness Logs: ${wellnessSummary}
    ${vitalityContext}
    Family: ${patientsSummary}
    ${knowledgeContext}
  `;

  const formattedMessages = recentMessages.map(msg => {
    const content = msg.text || msg.content || "";
    // Include suggestions in assistant message content so the LLM knows what follow-ups were previously offered
    if (msg.role === 'assistant' && msg.suggestions?.length) {
      return { role: 'assistant', content: content + `\n[Previous suggestions offered: ${msg.suggestions.join(', ')}]` };
    }
    return { role: msg.role === 'assistant' ? 'assistant' : 'user', content };
  });
  const cleanedMessages = [];
  let lastRole = null;
  for (const msg of formattedMessages) {
    if (msg.role === lastRole) cleanedMessages[cleanedMessages.length - 1].content += "\n\n" + msg.content;
    else { cleanedMessages.push(msg); lastRole = msg.role; }
  }
  if (cleanedMessages.length === 0 && lastUserMsg) cleanedMessages.push({ role: 'user', content: lastUserMsg });
  const primingMessage = buildPrimingMessage(reminders, medicines, patients, selectedPatientId);

  const finalMessages = [
    { role: 'system', content: STATIC_SYSTEM_PROMPT },
    { role: 'user', content: dynamicContextBlock },
    ...(cleanedMessages.length === 0 || cleanedMessages[0].role !== 'assistant' ? [{ role: 'assistant', content: primingMessage }] : []),
    ...cleanedMessages
  ];
  return { finalMessages, systemInstruction: STATIC_SYSTEM_PROMPT };
}

export const getEmotionReflection = async (mood, energy, symptoms, medicines = [], priority = 'high') => {
  const moodLabels = { 1: 'Very Low', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Great' };
  const moodLabel = moodLabels[mood] || 'Unknown';
  const energyLabel = moodLabels[energy] || 'Unknown';
  const symptomList = symptoms && symptoms.length > 0 ? symptoms.join(', ') : 'None reported';
  const medList = medicines.length > 0 ? medicines.map(m => m.name).join(', ') : 'Not specified';
  const prompt = `
    You are "Dawa-Lens Wellness Companion".
    Check-in: Mood ${moodLabel}, Energy ${energyLabel}, Symptoms ${symptomList}, Meds ${medList}.
    Task: Warm 2-3 sentence reflection, short affirmation, concrete tip.
    Respond in JSON: { "reflection": "...", "affirmation": "...", "tip": "..." }
  `;
  try { return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 500, 0.6); }
  catch (err) { handleAiError(err); }
};
