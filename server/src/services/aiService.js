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

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_KEY_2 = process.env.GROQ_API_KEY_2;
const GROQ_API_KEY_3 = process.env.GROQ_API_KEY_3;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_LIGHT_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODEL = 'gpt-oss-120b';
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

/**
 * Determines which API key to use based on the model ID and preferred key.
 * If model is llama-3.1-8b, we prefer GROQ_API_KEY_2 if it exists.
 * Otherwise, we use GROQ_API_KEY.
 */
const getGroqApiKey = (modelId) => {
  if (modelId && modelId.toLowerCase().includes('llama-3.1-8b')) {
    // Independent key for 8B model to avoid 70B limit sharing if possible
    return GROQ_API_KEY_2 || GROQ_API_KEY;
  }
  return GROQ_API_KEY;
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Strip markdown code fences that AI sometimes wraps JSON responses in.
 */
const sanitizeJson = (text) => {
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
const callGeminiChat = async (finalMessages, priority = 'high', maxTokens = 2048) => {
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
        parts: [{ text: "You are Dawa-Lens AI. Respond STRICTLY in JSON format with 'text', 'suggestions', 'source', and 'action' fields. Use Markdown for formatting in the 'text' field. Agentic capabilities are enabled via the 'action' field." }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: maxTokens
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
const callCerebrasChat = async (messages, responseFormat = { type: 'json_object' }, modelId = CEREBRAS_MODEL, priority = 'high', maxTokens = 2048, failFast = false) => {
  if (!CEREBRAS_API_KEY) {
    throw new AppError('Cerebras API key not configured', 503);
  }

  const fn = async () => {
    const payload = {
      model: modelId,
      messages,
      max_tokens: maxTokens
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
const callGroqChat = async (messages, responseFormat = { type: 'json_object' }, modelId = GROQ_MODEL, priority = 'high', maxTokens = 2048, failFast = false) => {
  const apiKey = getGroqApiKey(modelId);
  if (!apiKey) {
    throw new AppError('Groq API key not configured', 401);
  }

  const modelKey = modelId === GROQ_MODEL ? 'groq-70b' : 'groq-8b';

  const fn = async () => {
    const payload = {
      model: modelId,
      messages,
      max_tokens: maxTokens
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
 * Order: Cerebras -> Groq (70B) -> Groq (8B) -> Gemini
 */
export const callAiWithFallback = async (messages, options = {}) => {
  const { 
    isJson = true, 
    priority = 'high', 
    maxTokens = 2048, 
    isComplex = true,
    forceModel = null 
  } = options;

  const responseFormat = isJson ? { type: 'json_object' } : null;

  // 1. Try Cerebras (Primary)
  if (CEREBRAS_API_KEY && forceModel !== 'groq-70b' && forceModel !== 'groq-8b' && forceModel !== 'gemini') {
    try {
      return await callCerebrasChat(messages, responseFormat, CEREBRAS_MODEL, priority, maxTokens, false);
    } catch (err) {
      console.warn("Fallback: Cerebras failed or rate limited, trying Groq 70B...", err.message);
    }
  }

  // 2. Try Groq 70B
  if (GROQ_API_KEY && (isComplex || forceModel === 'groq-70b' || !CEREBRAS_API_KEY)) {
    try {
      const modelId = GROQ_MODEL;
      return await callGroqChat(messages, responseFormat, modelId, priority, maxTokens, false);
    } catch (err) {
      console.warn("Fallback: Groq 70B failed or rate limited, trying Groq 8B...", err.message);
    }
  }

  // 3. Try Groq 8B (Secondary key/model)
  if (GROQ_API_KEY_2 || GROQ_API_KEY) {
    try {
      const modelId = GROQ_LIGHT_MODEL;
      return await callGroqChat(messages, responseFormat, modelId, priority, maxTokens, false);
    } catch (err) {
      console.warn("Fallback: Groq 8B failed or rate limited, trying Gemini...", err.message);
    }
  }

  // 4. Try Gemini (Final fallback)
  try {
    return await callGeminiChat(messages, priority, maxTokens);
  } catch (err) {
    console.error("Fallback: ALL AI providers failed.", err.message);
    throw new AppError('All AI services are currently unavailable. Please try again later.', 503);
  }
};

const callGroq = async (prompt, isJson = true, modelId = GROQ_MODEL, priority = 'high', maxTokens = 2048) => {
  const messages = [{ role: 'user', content: prompt }];
  const isComplex = modelId === GROQ_MODEL;
  return await callAiWithFallback(messages, { isJson, priority, maxTokens, isComplex });
};


export const getWellnessQuote = async (userName, priority = 'medium') => {
  const prompt = `
    Generate a short, powerful, and inspiring wellness quote (max 15 words) for a health app user named ${userName || 'friend'}.
    The quote should emphasize consistency, strength, or the journey to better health.
    Context: East Africa (keep it culturally relevant but universally inspiring).
    Respond in JSON format: { "quote": "..." }
  `;
  // Using GROQ_LIGHT_MODEL ('llama-3.1-8b-instant') which uses GROQ_API_KEY_2 via getGroqApiKey
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
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
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
};

export const checkHolisticSafety = async (medicines, lifestyleFactors, priority = 'high') => {
  const prompt = `
    You are "Dawa-Lens Holistic Safety Engine".
    Medication List: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    Factors: ${JSON.stringify(lifestyleFactors)}

    Task: Identify interactions with food/lifestyle (Alcohol, Caffeine, Grapefruit, Dairy, etc.).
    Categorize risk: High, Medium, Low.
    Use Markdown for formatting the explanation and advice if helpful.

    Respond in JSON format:
    { "interactions": [{ "factor": "...", "risk": "...", "explanation": "text (Markdown)", "advice": "text (Markdown)" }] }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
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
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
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
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
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
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
};

export const getNutritionalGuidance = async (medicines, priority = 'high') => {
  const prompt = `
    You are the "Dawa-Lens Nutritional Guard".
    Active Medications: ${JSON.stringify(medicines.map(m => ({ name: m.name, generic: m.genericName })))}

    Task:
    1. Provide 2-3 specific "Food Recommendations" that aid absorption or mitigate side effects for these medications.
    2. Identify "Critical Safety Warnings" regarding foods/drinks to avoid (e.g., Grapefruit, Alcohol, Dairy, Caffeine).
    3. Include "Timing Advice" (e.g., "Take 2 hours after dairy").
    4. Focus on East African regional foods (Matooke, G-nuts, Avocado, Posho, etc.) where appropriate.
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
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
};

/**
 * Advanced task complexity detection to avoid unnecessary usage of 70B model.
 * Returns true if the query requires system context (logs, reminders) or tool-use capabilities.
 */
export const isComplexTask = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  
  // High threshold for complexity by length (approx 100-120 words)
  if (text.length > 500) return true;
  
  // Specific command-oriented patterns that require tool-use/action capabilities
  const actionPatterns = [
    /(add|create|set|put|new|remind|schedule|register|log|record|track|save|update|change|modify|edit|adjust|delete|remove|stop|cancel|clear)/i,
    /(reminder|alarm|med|medicine|dose|taken|skipped|feeling|wellness|food|meal|profile|patient|family|mother|father|son|daughter|wife|husband|parent|child)/i
  ];
  
  // Data retrieval patterns
  const dataPatterns = [
    /(what|show|list|tell|view|see|check|get|summary|history|status)/i,
    /(my|current|active|recent|all)/i
  ];

  // If it matches an action verb OR a data retrieval verb + a noun from our domain
  const hasActionVerb = /(add|create|set|remind|log|record|track|update|delete|remove|register)/i.test(lower);
  const hasDomainNoun = /(reminder|med|medicine|dose|log|wellness|family|profile|patient|history)/i.test(lower);
  const hasDataVerb = /(what|show|list|tell|view|check|get)/i.test(lower);

  const isActionRequest = hasActionVerb && hasDomainNoun;
  const isDataRequest = hasDataVerb && (hasDomainNoun || /(my|current|active|recent)/i.test(lower));
  
  // Generic informational queries about keywords should NOT trigger 70B
  // e.g. "How do I add a med?" vs "Add a med"
  const isHowToQuery = /^(how\s+do\s+i|can\s+you\s+explain|what\s+is|tell\s+me\s+about)/i.test(lower);

  if (isHowToQuery && !lower.includes('my')) return false;

  // Delete/remove intent + domain noun (Requirement 5.1)
  // Uses (?:\w+\s+)*? to allow any number of words between the intent verb and domain noun
  // e.g. "remove the Metformin alarm" (two words between intent and noun) must match
  const hasDeleteIntent = /(delete|remove|cancel|stop)\s+(?:\w+\s+)*?(reminder|alarm|med|medicine)/i.test(lower);
  if (hasDeleteIntent) return true;

  // Show/list reminders intent (Requirement 5.2)
  const hasShowRemindersIntent = /(show|list|what\s+are|check|view)\s+\w*\s*reminders?/i.test(lower);
  if (hasShowRemindersIntent) return true;

  if (isActionRequest || isDataRequest) return true;

  // Check for medical advice needs (symptoms, dosage questions etc)
  const isMedicalQuery = /(dose|dosage|effect|safe|interact|symptom|pain|sick|hurt|doctor|health)/i.test(lower);
  if (isMedicalQuery && text.split(' ').length > 5) return true;

  return false;
};

/**
 * Helper to detect if the user's message likely requires an action (write operation).
 */
const isLikelyActionRequest = (text) => {
  if (!text) return false;
  return /(add|create|set|put|new|remind|schedule|register|log|record|track|save|update|change|modify|edit|adjust|delete|remove|stop|cancel|clear)\s/i.test(text.toLowerCase());
};

export const chatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, selectedPatientId }, priority = 'high') => {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text;
  if (detectEmergency(lastUserMsg)) {
    return EMERGENCY_RESPONSE;
  }

  const isComplex = isComplexTask(lastUserMsg);
  const { finalMessages } = await prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, isComplex, selectedPatientId });

  // Increase max tokens for conversational chat
  const chatMaxTokens = 4096;

  try {
    // Use the unified fallback logic
    let result = await callAiWithFallback(finalMessages, { 
      isJson: true, 
      priority, 
      maxTokens: chatMaxTokens, 
      isComplex 
    });

    // --- AUTONOMOUS AGENT EXECUTION LOOP ---
    if (result.action && result.action.type && isComplex) {
      console.log(`🤖 Agent executing action: ${result.action.type}`);
      try {
        const userId = userProfile?.id || userProfile?.uid;
        const actionResult = await executeAiAction(result.action, userId, medicines, selectedPatientId);
        result.actionExecuted = true;

        // Inject the executed action into the text response for conversation history awareness
        // This is hidden from the user in the frontend but present in formattedMessages for the next turn
        result.text += `\n\n[ACTION EXECUTED: ${result.action.type} — ID: ${actionResult?.id || 'new'}]`;
      } catch (actionErr) {
        console.error("Agent Action Execution Failed:", actionErr.message);
        result.text += `\n\n(Note: I tried to perform that action but encountered an error: ${actionErr.message})`;
      }
    }

    return result;
  } catch (err) {
    console.error("DawaGPT critical failure:", err.message);
    throw err; // Re-throw to be handled by route/middleware
  }
};

/**
 * Execute an AI-requested action against the Firestore database.
 */
async function executeAiAction(action, userId, userMedicines = [], selectedPatientId = null) {
  const { type, payload } = action;
  
  // Ensure userId is attached to payloads
  const data = { ...payload, userId };

  // Default patientId to selectedPatientId (current profile) if missing
  if (!data.patientId) {
    data.patientId = selectedPatientId;
  }

  switch (type) {
    case 'ADD_MEDICINE':
      return await medicineService.createMedicine(data);
    
    case 'UPDATE_MEDICINE':
      return await medicineService.updateMedicine(payload.id, data);
    
    case 'ADD_REMINDER':
      // If medicineName is provided but no medicineId, try to resolve it from the inventory
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
    
    case 'UPDATE_REMINDER':
      return await reminderService.updateReminder(payload.id, data, userId);
    
    case 'REMOVE_REMINDER':
      return await reminderService.deleteReminder(payload.id, userId);
    
    case 'LOG_DOSE':
      return await doseLogService.createDoseLog(data);
    
    case 'LOG_WELLNESS':
      return await wellnessService.createWellnessLog(data);
    
    case 'ADD_PATIENT':
      return await patientService.createPatient(data);
      
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

/**
 * Streaming version of Dawa-GPT.
 * Returns the raw axios stream from Groq.
 */
export const streamChatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, selectedPatientId }, priority = 'high') => {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text;
  if (detectEmergency(lastUserMsg)) {
    return new Readable({
      read() {
        const metadata = JSON.stringify({
          suggestions: EMERGENCY_RESPONSE.suggestions,
          source: EMERGENCY_RESPONSE.source,
          action: null
        });
        const data = JSON.stringify({
          choices: [{ delta: { content: EMERGENCY_RESPONSE.text + "\n" + metadata } }]
        });
        this.push(`data: ${data}\n`);
        this.push(`data: [DONE]\n`);
        this.push(null);
      }
    });
  }

  const isComplex = isComplexTask(lastUserMsg);

  // --- FORCE NON-STREAMING PATH FOR ACTIONS ---
  if (isComplex && isLikelyActionRequest(lastUserMsg)) {
    const result = await chatWithDawaGPT(
      { messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, selectedPatientId },
      priority
    );
    // Wrap result in a fake stream for the frontend
    return createFakeStream(result);
  }

  const { finalMessages } = await prepareDawaGPTContext({
    messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients,
    isStreaming: true, isComplex, selectedPatientId
  });

  const chatMaxTokens = 4096;

  // Helper for non-streaming fallback
  const createFakeStream = (jsonResp) => {
    return new Readable({
      read() {
        const metadata = JSON.stringify({
          suggestions: jsonResp.suggestions || [],
          source: jsonResp.source || "Dawa-GPT",
          action: jsonResp.action || null
        });
        const data = JSON.stringify({
          choices: [{ delta: { content: (jsonResp.text || "") + "\n###METADATA###\n" + metadata } }]
        });
        this.push(`data: ${data}\n`);
        this.push(`data: [DONE]\n`);
        this.push(null);
      }
    });
  };

  // --- STREAMING FALLBACK CHAIN ---
  
  // 1. Try Cerebras Streaming
  if (CEREBRAS_API_KEY && isComplex) {
    try {
      const fn = async () => {
        const response = await axios.post(CEREBRAS_API_URL, {
          model: CEREBRAS_MODEL,
          messages: finalMessages,
          stream: true,
          max_tokens: chatMaxTokens
        }, {
          headers: {
            'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 20000
        });
        return response.data;
      };
      return await rateLimitManager.enqueue(fn, 'cerebras-120b', finalMessages, priority, 3, true);
    } catch (err) {
      if (err.isRateLimit) await new Promise(r => setTimeout(r, 1000));
      console.warn("DawaGPT Stream Fallback: Cerebras failed, trying Groq 70B...", err.message);
    }
  }

  // 2. Try Groq 70B Streaming
  if (GROQ_API_KEY && isComplex) {
    try {
      const modelId = GROQ_MODEL;
      const apiKey = getGroqApiKey(modelId);
      const fn = async () => {
        const response = await axios.post(GROQ_API_URL, {
          model: modelId,
          messages: finalMessages,
          stream: true,
          max_tokens: chatMaxTokens
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 15000
        });
        return response.data;
      };
      return await rateLimitManager.enqueue(fn, 'groq-70b', finalMessages, priority, 3, true);
    } catch (err) {
      if (err.isRateLimit) await new Promise(r => setTimeout(r, 1000));
      console.warn("DawaGPT Stream Fallback: Groq 70B failed, trying Groq 8B...", err.message);
    }
  }

  // 3. Try Groq 8B Streaming
  if (GROQ_API_KEY_2 || GROQ_API_KEY) {
    try {
      const modelId = GROQ_LIGHT_MODEL;
      const apiKey = getGroqApiKey(modelId);
      const fn = async () => {
        const response = await axios.post(GROQ_API_URL, {
          model: modelId,
          messages: finalMessages,
          stream: true,
          max_tokens: chatMaxTokens
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 15000
        });
        return response.data;
      };
      return await rateLimitManager.enqueue(fn, 'groq-8b', finalMessages, priority, 3, true);
    } catch (err) {
      if (err.isRateLimit) await new Promise(r => setTimeout(r, 1000));
      console.warn("DawaGPT Stream Fallback: Groq 8B failed, trying Gemini...", err.message);
    }
  }

  // 4. Fallback to Gemini (non-streaming, then wrapped in stream)
  try {
    const geminiResp = await callGeminiChat(finalMessages, priority, chatMaxTokens);
    return createFakeStream(geminiResp);
  } catch (err) {
    console.error("DawaGPT Stream Fallback: ALL providers failed.", err.message);
    return createFakeStream({
      text: "Sorry, I'm having trouble connecting to my medical intelligence core right now. This may be due to a temporary service outage.",
      suggestions: ["Try again", "Go home"],
      source: "System",
      action: null
    });
  }
};

// --- Helpers ---

/**
 * Generate a dynamic priming message for the first assistant turn.
 */
function buildPrimingMessage(reminders, medicines, patients, selectedPatientId) {
  const activePatient = patients?.find(p => p.id === selectedPatientId);
  const name = activePatient?.name || 'you';
  const reminderCount = reminders?.length || 0;
  const nextReminder = reminders?.[0];

  let opening = `Hi! I'm Dawa-GPT.`;
  if (reminderCount > 0 && nextReminder) {
    opening += ` ${name === 'you' ? 'You have' : `${name} has`} ${reminderCount} reminder${reminderCount > 1 ? 's' : ''} set up.`;
  }

  // Generate first suggestions based on actual state
  let firstSuggestions = [];
  if (nextReminder) {
    firstSuggestions.push(`Log ${nextReminder.medicineName} as taken`);
  }
  if (medicines?.length > 0) {
    firstSuggestions.push(`Does ${medicines[0].name} interact with anything?`);
  }
  firstSuggestions.push(reminderCount === 0 ? 'Add my first medicine reminder' : 'Add another medicine');

  // Format as JSON with metadata so the frontend parses suggestions correctly
  return JSON.stringify({
    text: opening,
    suggestions: firstSuggestions.slice(0, 3),
    source: 'Dawa-GPT',
    action: null
  });
}

async function prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, isStreaming = false, isComplex = true, selectedPatientId = null }) {
  const recentMessages = messages.slice(-5);
  const lastUserMsg = recentMessages.filter(m => m.role === 'user').pop()?.text || "";
  const lastAction = recentMessages.find(m => m.role === 'assistant' && m.action)?.action;

  const conversationPhase = messages.length === 0 ? 'opening'
    : messages.length < 4 ? 'discovery'
    : lastAction ? 'post-action'
    : 'ongoing';

  const knowledgeSnippets = await retrieveMedicalKnowledge(lastUserMsg);
  const knowledgeContext = knowledgeSnippets.length > 0
    ? `=== VERIFIED MEDICAL KNOWLEDGE (Context) ===\n${knowledgeSnippets.join('\n\n')}\n\n`
    : "";

  const activeMeds = medicines?.length
    ? medicines.map(m => `${m.name}${m.genericName ? ` (${m.genericName})` : ''} — ${m.dosage}`).join('; ')
    : 'None';
  
  // Safe date formatting helper to avoid crashes on non-string inputs (e.g., Firestore Timestamps)
  const safeFormatDate = (val) => {
    if (typeof val !== 'string') return val;
    return val.replace(/:\d{2}\.\d{3}Z$/, '').replace('T', ' ');
  };

  // Provide basic summaries even for non-complex tasks so AI has state awareness
  const recentLogs = doseLogs ? JSON.stringify(doseLogs.slice(0, isComplex ? 5 : 2).map(l => ({
    ...l,
    actionTime: safeFormatDate(l.actionTime),
    scheduledTime: safeFormatDate(l.scheduledTime)
  }))) : 'No logs';
  const remindersSummary = reminders?.length
    ? JSON.stringify(reminders.map(r => ({
      id: r.id,
      medicineName: r.medicineName,
      dose: r.dose,
      time: r.time,
      repeat: r.repeatSchedule,
      enabled: r.enabled
    })).slice(0, isComplex ? 10 : 3))
    : 'No reminders set';
    
  const wellnessSummary = wellnessLogs?.length
    ? JSON.stringify(wellnessLogs.slice(0, isComplex ? 3 : 1).map(l => ({
      ...l,
      timestamp: safeFormatDate(l.timestamp)
    })))
    : 'No wellness logs';
    
  const patientsSummary = patients?.length
    ? JSON.stringify(patients.map(p => ({ id: p.id, name: p.name, relation: p.relation })))
    : 'No family profiles';

  const systemInstruction = `
    You are "Dawa-GPT", a premium medical AI assistant integrated into the Dawa-Lens app.
    Regional Context: Uganda / East Africa.

    === SYSTEM CONTEXT ===
    User: ${userProfile?.name || 'User'} | ID: ${userProfile?.id || 'unknown'}
    Active Profile (Target): ${selectedPatientId || 'Self (Account Owner)'}
    Active Medications: ${activeMeds}
    Reminders: ${remindersSummary}
    Recent Dose Logs: ${recentLogs}
    Wellness Logs: ${wellnessSummary}
    Family: ${patientsSummary}

    ${knowledgeContext}

    === CAPABILITIES & ACTIONS ===
    You have FULL READ and WRITE access to the user's medication system.
    To perform an operation, include an "action" field in your metadata JSON.
    
    Actions:
    - ADD_MEDICINE: { name, genericName?, dosage, unit?, notes?, totalQuantity?, dosagePerDose?, patientId? }
    - UPDATE_MEDICINE: { id, name?, dosage?, notes? }
    - ADD_REMINDER: { medicineName, dose, time (HH:mm or "HH:mm,HH:mm,..."), repeatSchedule ("daily"|"weekly"|"once"|"custom"), repeatDays?, patientId?, medicineId? }
    - UPDATE_REMINDER: { id, enabled?, time? (HH:mm or "HH:mm,HH:mm,..."), repeatSchedule?, repeatDays?, dose? }
    - REMOVE_REMINDER: { id, medicineName? } — IMPORTANT: When the reminder list is available in context, you MUST always include the reminder "id" (Firestore document ID) in the payload. The "id" is shown in the Reminders context above. Including "id" ensures reliable deletion.
    - LOG_DOSE: { reminderId, medicineName, dose, scheduledTime (YYYY-MM-DD HH:mm), action ("taken"|"skipped"), patientId? }
    - LOG_WELLNESS: { type ("food"|"symptom"), data: { symptoms: [], mood?, meal?, notes? }, patientId? }
    - ADD_PATIENT: { name, age?, gender?, relation? }

    === MEDICINE KNOWLEDGE ===
    You have built-in knowledge of thousands of medicines. When a user asks about a medicine NOT in their active medications list, you can still:
    - Explain what it is, its typical uses, dosage ranges, and common side effects.
    - Suggest it as a new medicine to ADD if appropriate.
    - Warn about interactions with their CURRENT active medications.
    - Reference WHO Essential Medicines List and NDA Uganda approved drugs where relevant.
    Do NOT say "this medicine isn't in your list" as if that limits your knowledge. Your active medications list only shows what they're currently tracking — your medical knowledge is far broader.

    === RULES ===
    1. BE AGENTIC & PROACTIVE: If the user asks for a task that requires an action (e.g., adding a reminder, logging a dose), PERFORM THE ACTION IMMEDIATELY. Do not tell the user how to do it; just do it.
    2. MINIMAL TALK, MAXIMUM ACTION: Avoid long explanations of app features. If you have the info, execute.
    3. TONE — Sound like a knowledgeable friend, not a medical brochure:
       - Use contractions naturally ("I've set that up", "You're all good", "Let's check").
       - Keep sentences short. One idea per sentence.
       - After completing an action, confirm it conversationally: "Done! I've added your Paracetamol reminder for 8am daily." NOT "The ADD_REMINDER action has been executed successfully."
       - Use first-person naturally: "I've added...", "I found...", "I can see..."
       - Avoid: "Certainly!", "Absolutely!", "Great question!", "As per your request".
       - When you don't know something, say so plainly: "I'm not sure about that — it's worth checking with your pharmacist."
       - Match the user's energy. If they're brief, be brief. If they're chatty, be warmer.
    4. ACTION CONFIRMATION: When you include an action in your response, your "text" field should already contain the confirmation message as if the action succeeded. Say "I've added your reminder" not "I will add your reminder". The action executes immediately after your response — speak in the past tense of success.
    5. MEDICINE RESOLUTION: Before ADD_REMINDER, check if the medicine already exists in Active Medications.
       - If YES: use the existing medicineId in the ADD_REMINDER payload. Do NOT call ADD_MEDICINE first.
       - If NO and the user wants to track it: call ADD_MEDICINE first, then ADD_REMINDER. Tell the user: "I've added [Medicine] to your medications and set up your reminder."
       - Never silently fail. If you can't resolve a medicine, ask: "I don't see [medicine] in your list — want me to add it first?"
    6. Advise doctor visits for critical misses (Heart, BP, HIV).
    7. Frequency Logic: Calculate evenly-spaced times based on frequency.
       Examples:
       - "Twice a day" -> "08:00,20:00"
       - "Three times a day" or "8 hourly" -> "08:00,16:00,00:00"
       - "Four times a day" or "6 hourly" -> "06:00,12:00,18:00,00:00"
       Always provide times as a comma-separated string in the "time" field.
    8. ALWAYS include "patientId" in action payloads. Use the "Active Profile (Target)" ID above unless another person is mentioned.
    9. Include clickable chips for navigation using these supported routes: [Dashboard / Home](/ or /dashboard or /home), [Medication Reminders](/reminders or /medications), [Add Reminder](/reminders/new or /new-reminder or /add-reminder), [History/Logs](/history or /logs), [Lifestyle/Interactions](/interactions or /safety), [Family Hub](/family or /family-hub), [Travel Companion](/travel or /travel-companion), [Wellness Hub](/wellness or /wellness-hub), [Care Report](/report or /care-report), [Settings/Profile](/settings or /profile), [Scan Medicine](/scan or /scan-medicine). These custom routes are dynamically translated by the frontend to their corresponding pages.
    10. Proactively suggest regional foods (Matooke, Avocado, G-nuts).
    11. Use Markdown for formatting (bold, italics, lists, tables) to make information clear and readable.
    12. For any dates or times generated in text (e.g., in tables or summaries), only include the date and time (YYYY-MM-DD HH:mm). REMOVE seconds and milliseconds. (Example: 2026-06-01 14:30).

    === SUGGESTION RULES ===
    The "suggestions" array contains 3 SHORT chips the user can tap as their next message.
    Each chip must be a complete, natural sentence the user would actually say — not a label or category.

    RULES:
    1. CONTEXTUAL: Every suggestion must follow directly from what just happened.
       - After ADD_REMINDER: ["Set a food reminder for Metformin", "What are all my reminders?", "Add another medicine"]
       - After logging a dose: ["Log my evening Paracetamol", "How many doses have I taken this week?", "I felt nauseous after taking it"]
       - After a medicine question: ["Does \${medicineName} interact with \${otherMedicine}?", "What's the best time to take it?", "Add a reminder for \${medicineName}"]
       - After ADD_PATIENT: ["Set a reminder for \${patientName}", "What medicines is \${patientName} taking?", "Switch to \${patientName}'s profile"]
       - After a wellness check-in: ["What should I eat today?", "Log my blood pressure", "How has my health been this week?"]

    2. PROGRESSIVE: Suggestions should lead somewhere new — not repeat what was just done.
       BAD (after adding a reminder): "Add a reminder" ← already done
       GOOD: "Add a food note to this reminder", "What time is my next dose?", "Log this dose as taken"

    3. SPECIFIC not GENERIC: Use the actual medicine name, patient name, or action from the conversation.
       BAD: "Tell me about my medications"
       GOOD: "Does Metformin 500mg interact with Ibuprofen?"

    4. ONE ACTION SHORTCUT: At least one chip should be a quick action the user can execute immediately.
       Example: "Log Paracetamol as taken now", "Add reminder for tonight at 9pm", "Switch to Mary's profile"

    5. LENGTH: Each chip must be under 8 words. Natural spoken phrasing, not menu labels.
       BAD: "Medication Interaction Check"
       GOOD: "Does this interact with my BP meds?"

    CONVERSATION PHASE: ${conversationPhase}
    - opening: Suggest things that help the user discover what DawaGPT can do
    - discovery: Suggest actions related to what they've been asking about
    - post-action: Suggest the natural next step after the action just completed
    - ongoing: Suggest deeper dives or related features they haven't tried yet

    ${isStreaming ? `=== STREAMING RESPONSE FORMAT ===
    Write your response as plain Markdown text.
    At the very end, on a new line, append exactly:

    ###METADATA###
    {"suggestions":["...","..."],"source":"Dawa-GPT","action":{"type":"...","payload":{...}}}

    Rules:
    - The ###METADATA### line must be the LAST thing you output.
    - The JSON must be on a single line immediately after ###METADATA###.
    - If no action is needed, set "action" to null.
    - Do NOT wrap your response in a JSON object. Only the metadata block is JSON.
    - Do NOT include any text after the metadata JSON line.` : `=== RESPONSE FORMAT ===
    Respond STRICTLY in JSON format, with the "text" field containing Markdown-formatted content.
    NEVER append text outside the JSON block.

    Structure:
    {
      "text": "Your markdown response here",
      "suggestions": ["suggestion 1", "2", "3"],
      "source": "Dawa-GPT",
      "action": { "type": "...", "payload": {...} } | null
    }`}
  `;

  const formattedMessages = recentMessages.map(msg => {
    if (msg.role === 'assistant') {
      // Append the previous suggestions as a silent annotation the AI can read
      const suggestionContext = msg.suggestions?.length
        ? `\n[Previous suggestions offered: ${msg.suggestions.join(' | ')}]`
        : '';
      return {
        role: 'assistant',
        content: (msg.text || "") + suggestionContext
      };
    }
    return { role: 'user', content: msg.text || "" };
  });

  // Clean and validate message history:
  // 1. Conversation SHOULD alternate between 'user' and 'assistant'.
  const cleanedMessages = [];
  let lastRole = null;

  for (const msg of formattedMessages) {
    if (msg.role === lastRole) {
      // Merge consecutive messages with the same role
      if (cleanedMessages.length > 0) {
        cleanedMessages[cleanedMessages.length - 1].content += "\n\n" + msg.content;
      } else {
        cleanedMessages.push(msg);
      }
    } else {
      cleanedMessages.push(msg);
      lastRole = msg.role;
    }
  }

  // Final check: if history is now empty (e.g., only assistant welcome msg), start fresh
  if (cleanedMessages.length === 0 && lastUserMsg) {
    cleanedMessages.push({ role: 'user', content: lastUserMsg });
  }

  // Prime the first turn with contextual suggestions if it's the beginning or no assistant msg present
  const primingMessage = buildPrimingMessage(reminders, medicines, patients, selectedPatientId);

  const finalMessages = [
    { role: 'system', content: systemInstruction },
    // If the history doesn't start with an assistant message, inject the priming message
    ...(cleanedMessages.length === 0 || cleanedMessages[0].role !== 'assistant' ? [{ role: 'assistant', content: primingMessage }] : []),
    ...cleanedMessages
  ];

  return { finalMessages, systemInstruction };
}

/**
 * Generate a personalized emotional reflection from a single Daily Vibe + Body Scan check-in.
 * Called immediately after the user taps "Secure Daily Reflection" in the Wellness Hub.
 */
export const getEmotionReflection = async (mood, energy, symptoms, medicines = [], priority = 'high') => {
  const moodLabels = { 1: 'Very Low', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Great' };
  const moodLabel = moodLabels[mood] || 'Unknown';
  const energyLabel = moodLabels[energy] || 'Unknown';
  const symptomList = symptoms && symptoms.length > 0 ? symptoms.join(', ') : 'None reported';
  const medList = medicines.length > 0
    ? medicines.map(m => m.name).join(', ')
    : 'Not specified';

  const prompt = `
    You are "Dawa-Lens Wellness Companion", a warm and empathetic emotional health assistant.
    Regional Context: Uganda / East Africa.

    The user just completed their daily wellness check-in:
    - Current Mood: ${moodLabel} (${mood}/5)
    - Energy Level: ${energyLabel} (${energy}/5)
    - Reported Symptoms: ${symptomList}
    - Active Medications: ${medList}

    Your task:
    1. Write a warm, personalized 2-3 sentence "reflection" that acknowledges their current state.
       - If mood or energy is low (1-2), be extra compassionate and validating.
       - If symptoms are reported, gently acknowledge them and relate to their treatment context.
       - If mood is high (4-5), celebrate and reinforce positive momentum.
    2. Write a short, punchy "affirmation" (one sentence, max 12 words) that feels authentic — not generic.
    3. Write one concrete "tip" (one sentence) — a specific, actionable wellness suggestion for their state.
       - Prioritize East African context (rest, hydration, walking, regional foods like Matooke or Avocado).
       - If they have active medications, tie the tip to medication adherence or side effect management.

    Tone: Warm, human, culturally grounded. Never clinical or robotic.

    Respond in EXACT JSON format:
    {
      "reflection": "2-3 sentence personalized reflection",
      "affirmation": "Short encouraging affirmation",
      "tip": "One actionable wellness tip"
    }
  `;

  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority);
};

function handleAiError(err) {
  if (err.isOperational) throw err;
  if (err.response) {
    const status = err.response.status;
    const msg = err.response.data?.error?.message || 'AI API request failed';
    throw new AppError(`Groq API error (${status}): ${msg}`, 502);
  }
  if (err instanceof SyntaxError) {
    throw new AppError('AI returned malformed data. Please try again.', 502);
  }
  throw new AppError('Unexpected AI service error. Please try again.', 500);
}