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
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_LIGHT_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODEL = 'gpt-oss-120b';
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

/**
 * Determines which API key to use based on the model ID.
 * Features using llama 3.1 8b models MUST use GROQ_API_KEY_2.
 */
const getGroqApiKey = (modelId) => {
  if (modelId && modelId.toLowerCase().includes('llama-3.1-8b')) {
    return GROQ_API_KEY_2;
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
        parts: [{ text: "You are Dawa-Lens AI. Respond STRICTLY in JSON format as requested by the user. Use Markdown for formatting in text fields." }]
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
    return await rateLimitManager.enqueue(fn, 'gemini', finalMessages, priority);
  } catch (err) {
    console.error("Gemini Fallback Error:", err.message);
    throw new AppError('Both AI engines are currently unavailable. Please try again.', 503);
  }
};

/**
 * Standard chat completion call to Cerebras (GPT-OSS-120B)
 */
const callCerebrasChat = async (messages, responseFormat = { type: 'json_object' }, modelId = CEREBRAS_MODEL, priority = 'high', maxTokens = 2048) => {
  if (!CEREBRAS_API_KEY) {
    console.warn("CEREBRAS_API_KEY not set, falling back to Groq/Gemini...");
    return await callGroqChat(messages, responseFormat, GROQ_MODEL, priority, maxTokens);
  }

  const fn = async () => {
    const payload = {
      model: modelId,
      messages,
      max_completion_tokens: maxTokens // Cerebras uses max_completion_tokens for better rate limit estimation
    };
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    const response = await axios.post(CEREBRAS_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new AppError('Cerebras returned an empty response.', 502);
    }

    return responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
  };

  try {
    return await rateLimitManager.enqueue(fn, 'cerebras-120b', messages, priority);
  } catch (err) {
    console.warn("Cerebras failed, trying Groq/Gemini fallback...", err.message);
    return await callGroqChat(messages, responseFormat, GROQ_MODEL, priority, maxTokens);
  }
};

/**
 * Standard chat completion call to Groq routed via rate limit queue
 */
const callGroqChat = async (messages, responseFormat = { type: 'json_object' }, modelId = GROQ_MODEL, priority = 'high', maxTokens = 2048) => {
  // If this is the heavy model and we haven't come from callCerebrasChat yet, try Cerebras first
  if (modelId === GROQ_MODEL && CEREBRAS_API_KEY) {
     // This prevents infinite loops as callCerebrasChat falls back to callGroqChat
     // but we only want to entry point to Cerebras here if it's the intended primary path.
     // However, to keep it simple, we'll let callGroq be the entry and it delegates.
  }

  const apiKey = getGroqApiKey(modelId);
  if (!apiKey) {
    return await callGeminiChat(messages, priority, maxTokens);
  }

  const modelKey = modelId === GROQ_MODEL ? 'groq-70b' : 'groq-8b'; // Note: groq-70b still used as key if we actually use Groq

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
      }
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new AppError('AI returned an empty response.', 502);
    }

    return responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
  };

  try {
    return await rateLimitManager.enqueue(fn, modelKey, messages, priority);
  } catch (err) {
    console.warn("Groq failed, trying Gemini fallback...", err.message);
    return await callGeminiChat(messages, priority, maxTokens);
  }
};

const callGroq = async (prompt, isJson = true, modelId = GROQ_MODEL, priority = 'high', maxTokens = 2048) => {
  const messages = [{ role: 'user', content: prompt }];
  const responseFormat = isJson ? { type: 'json_object' } : null;

  if (modelId === GROQ_MODEL && CEREBRAS_API_KEY) {
    return await callCerebrasChat(messages, responseFormat, CEREBRAS_MODEL, priority, maxTokens);
  }

  return await callGroqChat(
    messages,
    responseFormat,
    modelId,
    priority,
    maxTokens
  );
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
    Medication Logs (last 30 days): ${JSON.stringify(doseLogs.slice(0, 30).map(l => ({ med: l.medicineName, time: l.actionTime, status: l.action })))}
    Wellness/Symptom Logs: ${JSON.stringify(wellnessLogs.slice(0, 20).map(l => ({ time: l.timestamp, type: l.type, data: l.data })))}
    
    === TASK ===
    1. Correlate medication adherence with wellness trends (side effects, energy, mood).
    2. Identify specific dosage patterns (e.g., missed morning doses, timing delays).
    3. Generate a high-level clinical summary suitable for a doctor.

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
const isComplexTask = (text) => {
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
  
  return (isActionRequest || isDataRequest || text.length > 300) && !isHowToQuery;
};

export const chatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, selectedPatientId }, priority = 'high') => {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text;
  if (detectEmergency(lastUserMsg)) {
    return EMERGENCY_RESPONSE;
  }

  const isComplex = isComplexTask(lastUserMsg);
  const { finalMessages } = await prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, isComplex, selectedPatientId });

  const selectedModel = isComplexTask(lastUserMsg) ? GROQ_MODEL : GROQ_LIGHT_MODEL;
  const apiKey = getGroqApiKey(selectedModel);

  // Increase max tokens for conversational chat
  const chatMaxTokens = 4096;

  if (!apiKey) {
    return await callGeminiChat(finalMessages, priority, chatMaxTokens);
  }

  try {
    let result = await callGroqChat(finalMessages, { type: 'json_object' }, selectedModel, priority, chatMaxTokens);

    // --- AUTONOMOUS AGENT EXECUTION LOOP ---
    if (result.action && result.action.type && isComplex) {
      console.log(`🤖 Agent executing action: ${result.action.type}`);
      try {
        const actionResult = await executeAiAction(result.action, userProfile.id, medicines, selectedPatientId);
        
        // Feed the result back to AI for a final human-like confirmation
        const feedbackMessages = [
          ...finalMessages,
          { role: 'assistant', content: JSON.stringify(result) },
          { role: 'system', content: `ACTION_RESULT: ${JSON.stringify(actionResult)}. Now confirm this to the user in a warm, human way.` }
        ];

        const feedbackResponse = await callGroqChat(feedbackMessages, { type: 'json_object' }, GROQ_LIGHT_MODEL, priority, chatMaxTokens);
        result = feedbackResponse;
        result.actionExecuted = true;
      } catch (actionErr) {
        console.error("Agent Action Execution Failed:", actionErr.message);
        result.text += `\n\n(Note: I tried to perform that action but encountered an error: ${actionErr.message})`;
      }
    }

    return result;
  } catch (err) {
    console.warn("Groq Chat failed, falling back to Gemini...", err.message);
    return await callGeminiChat(finalMessages, priority, chatMaxTokens);
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
  const { finalMessages } = await prepareDawaGPTContext({
    messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients,
    isStreaming: true, isComplex, selectedPatientId
  });

  const selectedModel = isComplexTask(lastUserMsg) ? GROQ_MODEL : GROQ_LIGHT_MODEL;
  const apiKey = getGroqApiKey(selectedModel);

  // Increase max tokens for conversational chat
  const chatMaxTokens = 4096;

  if (!apiKey) {
    // Fallback to non-streaming Gemini chat if Groq is missing
    const geminiResp = await callGeminiChat(finalMessages, priority, chatMaxTokens);
    const metadata = JSON.stringify({ suggestions: geminiResp.suggestions, source: geminiResp.source, action: geminiResp.action });
    const data = JSON.stringify({ choices: [{ delta: { content: geminiResp.text + "\n" + metadata } }] });
    return Readable.from([`data: ${data}\n`, `data: [DONE]\n`]);
  }

  try {
    const fn = async () => {
      const isCerebras = isComplex && CEREBRAS_API_KEY && selectedModel === GROQ_MODEL;
      const apiUrl = isCerebras ? CEREBRAS_API_URL : GROQ_API_URL;
      const key = isCerebras ? CEREBRAS_API_KEY : apiKey;
      const model = isCerebras ? CEREBRAS_MODEL : selectedModel;

      const response = await axios.post(apiUrl, {
        model: model,
        messages: finalMessages,
        stream: true,
        ...(isCerebras ? { max_completion_tokens: chatMaxTokens } : { max_tokens: chatMaxTokens })
      }, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      });
      return response.data;
    };

    const modelKey = selectedModel === GROQ_MODEL ? (CEREBRAS_API_KEY ? 'cerebras-120b' : 'groq-70b') : 'groq-8b';
    return await rateLimitManager.enqueue(fn, modelKey, finalMessages, priority);
  } catch (err) {
    console.warn("DawaGPT Stream failed, falling back to Gemini...", err.message);
    const geminiResp = await callGeminiChat(finalMessages, priority, chatMaxTokens);
    const metadata = JSON.stringify({ suggestions: geminiResp.suggestions, source: geminiResp.source, action: geminiResp.action });
    const data = JSON.stringify({ choices: [{ delta: { content: geminiResp.text + "\n" + metadata } }] });
    return Readable.from([`data: ${data}\n`, `data: [DONE]\n`]);
  }
};

// --- Helpers ---

async function prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, isStreaming = false, isComplex = true, selectedPatientId = null }) {
  const recentMessages = messages.slice(-5);
  const lastUserMsg = recentMessages.filter(m => m.role === 'user').pop()?.text || "";
  const knowledgeSnippets = await retrieveMedicalKnowledge(lastUserMsg);
  const knowledgeContext = knowledgeSnippets.length > 0
    ? `=== VERIFIED MEDICAL KNOWLEDGE (Context) ===\n${knowledgeSnippets.join('\n\n')}\n\n`
    : "";

  const activeMeds = medicines?.map(m => m.name).join(', ') || 'No active medications';
  
  // Provide basic summaries even for non-complex tasks so AI has state awareness
  const recentLogs = doseLogs ? JSON.stringify(doseLogs.slice(0, isComplex ? 5 : 2)) : 'No logs';
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
    ? JSON.stringify(wellnessLogs.slice(0, isComplex ? 3 : 1))
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
    - REMOVE_REMINDER: { id }
    - LOG_DOSE: { reminderId, medicineName, dose, scheduledTime, action ("taken"|"skipped"), patientId? }
    - LOG_WELLNESS: { type ("food"|"symptom"), data: { symptoms: [], mood?, meal?, notes? }, patientId? }
    - ADD_PATIENT: { name, age?, gender?, relation? }

    === RULES ===
    1. Professional, warm "Dawa-Lens signature" tone.
    2. Advise doctor visits for critical misses (Heart, BP, HIV).
    3. Frequency Logic: Calculate evenly-spaced times based on frequency. 
       Examples:
       - "Twice a day" -> "08:00,20:00"
       - "Three times a day" or "8 hourly" -> "08:00,16:00,00:00"
       - "Four times a day" or "6 hourly" -> "06:00,12:00,18:00,00:00"
       Always provide times as a comma-separated string in the "time" field.
    4. For ADD_REMINDER, if medicine exists, use UPDATE_REMINDER instead.
    5. ALWAYS include "patientId" in action payloads. Use the "Active Profile (Target)" ID above unless another person is mentioned.
    6. Include clickable chips for navigation using these supported routes: [Dashboard / Home](/ or /dashboard or /home), [Medication Reminders](/reminders or /medications), [Add Reminder](/reminders/new or /new-reminder or /add-reminder), [History/Logs](/history or /logs), [Lifestyle/Interactions](/interactions or /safety), [Family Hub](/family or /family-hub), [Travel Companion](/travel or /travel-companion), [Wellness Hub](/wellness or /wellness-hub), [Care Report](/report or /care-report), [Settings/Profile](/settings or /profile), [Scan Medicine](/scan or /scan-medicine). These custom routes are dynamically translated by the frontend to their corresponding pages.
    7. Proactively suggest regional foods (Matooke, Avocado, G-nuts).
    8. Use Markdown for formatting (bold, italics, lists, tables) to make information clear and readable.

    === RESPONSE FORMAT ===
    ${isStreaming ? `
    Respond in Markdown-formatted text first. Append a JSON block at the very end of your response (no labels or headers) containing:
    { "suggestions": ["...", "...", "..."], "source": "Dawa-GPT", "action": { "type": "...", "payload": {...} } | null }
    ` : `
    Respond STRICTLY in JSON format, with the "text" field containing Markdown-formatted content:
    { "text": "...", "suggestions": ["...", "...", "..."], "source": "Dawa-GPT", "action": { "type": "...", "payload": {...} } | null }
    `}
  `;

  const formattedMessages = recentMessages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.text
  }));

  const finalMessages = [
    { role: 'system', content: systemInstruction },
    { role: 'assistant', content: 'Understood. I am Dawa-GPT with full access to your medication system. How can I help you today?' },
    ...formattedMessages
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