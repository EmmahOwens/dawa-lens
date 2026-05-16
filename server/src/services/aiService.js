import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';
import { retrieveMedicalKnowledge } from './vectorService.js';
import * as medicineService from './medicineService.js';
import * as reminderService from './reminderService.js';
import * as doseLogService from './doseLogService.js';
import * as patientService from './patientService.js';
import * as wellnessService from './wellnessService.js';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_LIGHT_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
const callGeminiChat = async (finalMessages) => {
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

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents,
      systemInstruction: {
        parts: [{ text: "You are Dawa-Lens AI. Respond STRICTLY in JSON format as requested by the user." }]
      },
      generationConfig: { responseMimeType: 'application/json' }
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AppError('Gemini returned an empty response.', 502);

    const parsed = JSON.parse(sanitizeJson(text));
    parsed.source = "Gemini (Fallback)";
    return parsed;
  } catch (err) {
    console.error("Gemini Fallback Error:", err.message);
    throw new AppError('Both AI engines are currently unavailable. Please try again.', 503);
  }
};

const callGroq = async (prompt, isJson = true, modelId = GROQ_MODEL) => {
  if (!GROQ_API_KEY) {
    return await callGeminiChat([{ role: 'user', content: prompt }]);
  }

  try {
    const payload = {
      model: modelId,
      messages: [{ role: 'user', content: prompt }]
    };
    if (isJson) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(GROQ_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new AppError('AI returned an empty response.', 502);
    }

    return isJson ? JSON.parse(sanitizeJson(text)) : text;
  } catch (err) {
    console.warn("Groq failed, trying Gemini fallback...", err.message);
    return await callGeminiChat([{ role: 'user', content: prompt }]);
  }
};


export const getCoachAdvice = async (logs, medicines, userName) => {
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
 
    Respond in JSON format:
    { "advice": "text", "patterns": ["list"], "adherenceScore": 0-100 }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL);
};

export const checkHolisticSafety = async (medicines, lifestyleFactors) => {
  const prompt = `
    You are "Dawa-Lens Holistic Safety Engine".
    Medication List: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    Factors: ${JSON.stringify(lifestyleFactors)}

    Task: Identify interactions with food/lifestyle (Alcohol, Caffeine, Grapefruit, Dairy, etc.).
    Categorize risk: High, Medium, Low.

    Respond in JSON format:
    { "interactions": [{ "factor": "...", "risk": "...", "explanation": "...", "advice": "..." }] }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL);
};

export const getTravelAdvice = async ({ medicines, destination, currentCity, homeTimezone, targetTimezone }) => {
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
    5. List general health risks (e.g. Malaria, yellow fever, water safety) for ${destination}.

    Respond in EXACT JSON format:
    { 
      "equivalents": [
        { "original": "Original medicine name", "equivalent": "Local equivalent brand name in ${destination}" }
      ],
      "timezoneAdvice": "...", 
      "customsNotes": "...",
      "emergencyContacts": [
        { "service": "Ambulance", "number": "...", "type": "ambulance" },
        { "service": "[Full Authority Name]", "number": "...", "type": "drug_authority" }
      ],
      "healthRisks": ["..."]
    }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL);
};

export const getWellnessInsight = async (doseLogs, wellnessLogs, medicines) => {
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
      "summary": "2-3 sentences high level clinical overview.", 
      "dosagePatterns": "Analysis of adherence, skipped doses, and timing.",
      "lifestyleAnalysis": "Correlation between symptoms/energy and logs.",
      "insights": ["Specific correlation bullet 1", "Specific correlation bullet 2"], 
      "actionItems": ["Actionable clinical suggestion 1", "Suggestion 2"],
      "correlationScore": 85
    }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL);
};

export const checkMealSafety = async (medicines, mealDescription) => {
  const prompt = `
    You are "Dawa-Lens Meal Safety Checker".
    Medicines: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    Meal: "${mealDescription}"

    Task: Check for interactions (Dairy, Grapefruit, Alcohol, etc.).
    Risk: High, Medium, Safe.

    Respond in JSON format:
    { "risk": "...", "verdict": "...", "explanation": "..." }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL);
};

export const getNutritionalGuidance = async (medicines) => {
  const prompt = `
    You are the "Dawa-Lens Nutritional Guard".
    Active Medications: ${JSON.stringify(medicines.map(m => ({ name: m.name, generic: m.genericName })))}

    Task:
    1. Provide 2-3 specific "Food Recommendations" that aid absorption or mitigate side effects for these medications.
    2. Identify "Critical Safety Warnings" regarding foods/drinks to avoid (e.g., Grapefruit, Alcohol, Dairy, Caffeine).
    3. Include "Timing Advice" (e.g., "Take 2 hours after dairy").
    4. Focus on East African regional foods (Matooke, G-nuts, Avocado, Posho, etc.) where appropriate.

    Respond in EXACT JSON format:
    {
      "recommendations": [
        { "food": "string", "reason": "string", "benefit": "string" }
      ],
      "warnings": [
        { "factor": "string", "severity": "High" | "Medium", "explanation": "string" }
      ],
      "timingAdvice": "string"
    }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL);
};

/**
 * Advanced task complexity detection to avoid unnecessary usage of 70B model.
 */
const isComplexTask = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  
  // High threshold for complexity by length (approx 100-120 words)
  if (text.length > 600) return true;
  
  // Specific command-oriented patterns that require tool-use/action capabilities
  // Removed strict '^' to allow for natural language like "Please remind me" or "Can you log"
  const actionPatterns = [
    /(add|create|set|put|new|remind|schedule)\s+(reminder|alarm|med|medicine|dose)/i,
    /(log|record|track|save)\s+(that|my|dose|taken|skipped|feeling|wellness|food|meal)/i,
    /(update|change|modify|edit|adjust)\s+(reminder|med|dose|schedule|time)/i,
    /(delete|remove|stop|cancel|clear)\s+(reminder|med|dose)/i,
    /(who\s+is|add\s+my|register|new)\s+(mother|father|son|daughter|wife|husband|parent|child|patient|profile)/i
  ];
  
  const hasActionPattern = actionPatterns.some(pattern => pattern.test(lower));
  
  // Generic informational queries about keywords should NOT trigger 70B
  // e.g. "How do I add a med?" vs "Add a med"
  const isHowToQuery = /^(how\s+do\s+i|can\s+you\s+explain|what\s+is|tell\s+me\s+about)/i.test(lower);
  
  return hasActionPattern && !isHowToQuery;
};

export const chatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, selectedPatientId }) => {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text;
  if (detectEmergency(lastUserMsg)) {
    return EMERGENCY_RESPONSE;
  }

  const isComplex = isComplexTask(lastUserMsg);
  const { finalMessages } = await prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, isComplex, selectedPatientId });

  if (!GROQ_API_KEY) {
    return await callGeminiChat(finalMessages);
  }

  try {
    const selectedModel = isComplexTask(lastUserMsg) ? GROQ_MODEL : GROQ_LIGHT_MODEL;
    const response = await axios.post(GROQ_API_URL, {
      model: selectedModel,
      messages: finalMessages,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new AppError('AI returned an empty response.', 502);
    
    let result = JSON.parse(sanitizeJson(text));

    // --- AUTONOMOUS AGENT EXECUTION LOOP ---
    if (result.action && result.action.type && isComplex) {
      console.log(`🤖 Agent executing action: ${result.action.type}`);
      try {
        const actionResult = await executeAiAction(result.action, userProfile.id, medicines, selectedPatientId);
        
        // Feed the result back to AI for a final human-like confirmation
        const feedbackMessages = [
          ...finalMessages,
          { role: 'assistant', content: text },
          { role: 'system', content: `ACTION_RESULT: ${JSON.stringify(actionResult)}. Now confirm this to the user in a warm, human way.` }
        ];

        const finalResponse = await axios.post(GROQ_API_URL, {
          model: GROQ_LIGHT_MODEL, // Light model is fine for confirmation
          messages: feedbackMessages,
          response_format: { type: 'json_object' }
        }, {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        const finalText = finalResponse.data?.choices?.[0]?.message?.content;
        if (finalText) {
          result = JSON.parse(sanitizeJson(finalText));
          result.actionExecuted = true;
        }
      } catch (actionErr) {
        console.error("Agent Action Execution Failed:", actionErr.message);
        result.text += `\n\n(Note: I tried to perform that action but encountered an error: ${actionErr.message})`;
      }
    }

    return result;
  } catch (err) {
    console.warn("Groq Chat failed, falling back to Gemini...", err.message);
    return await callGeminiChat(finalMessages);
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
export const streamChatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, selectedPatientId }) => {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text;
  if (detectEmergency(lastUserMsg)) {
    return new ReadableStream({
      start(controller) {
        const data = JSON.stringify({
          choices: [{ delta: { content: EMERGENCY_RESPONSE.text } }]
        });
        const metadata = JSON.stringify({
          suggestions: EMERGENCY_RESPONSE.suggestions,
          source: EMERGENCY_RESPONSE.source,
          action: null
        });
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n`));
        controller.enqueue(new TextEncoder().encode(`data: ###METADATA###${metadata}###METADATA###\n`));
        controller.enqueue(new TextEncoder().encode(`data: [DONE]\n`));
        controller.close();
      }
    });
  }

  const isComplex = isComplexTask(lastUserMsg);
  const { finalMessages } = await prepareDawaGPTContext({
    messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients,
    isStreaming: true, isComplex, selectedPatientId
  });

  if (!GROQ_API_KEY) {
    // Fallback to non-streaming Gemini chat if Groq is missing
    const geminiResp = await callGeminiChat(finalMessages);
    return new ReadableStream({
      start(controller) {
        const data = JSON.stringify({ choices: [{ delta: { content: geminiResp.text } }] });
        const metadata = JSON.stringify({ suggestions: geminiResp.suggestions, source: geminiResp.source, action: geminiResp.action });
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n`));
        controller.enqueue(new TextEncoder().encode(`data: ###METADATA###${metadata}###METADATA###\n`));
        controller.enqueue(new TextEncoder().encode(`data: [DONE]\n`));
        controller.close();
      }
    });
  }

  try {
    const selectedModel = isComplexTask(lastUserMsg) ? GROQ_MODEL : GROQ_LIGHT_MODEL;
    const response = await axios.post(GROQ_API_URL, {
      model: selectedModel,
      messages: finalMessages,
      stream: true
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream'
    });

    return response.data;
  } catch (err) {
    console.warn("Groq Stream failed, falling back to Gemini...", err.message);
    const geminiResp = await callGeminiChat(finalMessages);
    return new ReadableStream({
      start(controller) {
        const data = JSON.stringify({ choices: [{ delta: { content: geminiResp.text } }] });
        const metadata = JSON.stringify({ suggestions: geminiResp.suggestions, source: geminiResp.source, action: geminiResp.action });
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n`));
        controller.enqueue(new TextEncoder().encode(`data: ###METADATA###${metadata}###METADATA###\n`));
        controller.enqueue(new TextEncoder().encode(`data: [DONE]\n`));
        controller.close();
      }
    });
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
  // Conditionally load detailed summaries based on complexity to save tokens
  const recentLogs = (isComplex && doseLogs) ? JSON.stringify(doseLogs.slice(0, 3)) : 'History omitted for brevity';
  const remindersSummary = (isComplex && reminders?.length)
    ? JSON.stringify(reminders.map(r => ({
      id: r.id,
      medicineName: r.medicineName,
      dose: r.dose,
      time: r.time,
      repeat: r.repeatSchedule,
      enabled: r.enabled
    })))
    : (reminders?.length ? `${reminders.length} reminders active` : 'No reminders set');
    
  const wellnessSummary = (isComplex && wellnessLogs?.length)
    ? JSON.stringify(wellnessLogs.slice(0, 2))
    : 'Wellness logs omitted';
    
  const patientsSummary = (isComplex && patients?.length)
    ? JSON.stringify(patients.map(p => ({ id: p.id, name: p.name, relation: p.relation })))
    : (patients?.length ? `${patients.length} family profiles` : 'No family profiles');

  const systemInstruction = `
    You are "Dawa-GPT", a premium medical AI assistant integrated into the Dawa-Lens app.
    Regional Context: Uganda / East Africa.

    === SYSTEM CONTEXT ===
    User: ${userProfile?.name || 'User'} | ID: ${userProfile?.id || 'unknown'} | Gender: ${userProfile?.gender || 'unknown'}
    Active Profile (Target): ${selectedPatientId || 'Self (Account Owner)'}
    Active Medications: ${activeMeds}
    Reminders: ${remindersSummary}
    Recent Dose Logs: ${recentLogs}
    Wellness Logs: ${wellnessSummary}
    Family: ${patientsSummary}

    ${knowledgeContext}

    ${isComplex ? `
    === CAPABILITIES & ACTIONS ===
    You have FULL READ and WRITE access to the user's medication system.
    Include an "action" field in your metadata JSON to perform operations:
    
    Actions:
    - ADD_MEDICINE: { name, genericName?, dosage, unit?, notes?, totalQuantity?, dosagePerDose?, patientId? }
    - UPDATE_MEDICINE: { id, name?, dosage?, notes? }
    - ADD_REMINDER: { medicineName, dose, time (HH:mm string), repeatSchedule ("daily"|"weekly"|"once"|"custom"), repeatDays?, patientId?, medicineId? }
    - UPDATE_REMINDER: { id, enabled?, time?, repeatSchedule?, repeatDays?, dose? }
    - REMOVE_REMINDER: { id }
    - LOG_DOSE: { reminderId, medicineName, dose, scheduledTime, action ("taken"|"skipped"), patientId? }
    - LOG_WELLNESS: { type ("food"|"symptom"), data: { symptoms: [], mood?, meal?, notes? }, patientId? }
    - ADD_PATIENT: { name, age?, gender?, relation? }

    === ACTION RULES ===
    1. Professional, warm "Dawa-Lens signature" tone.
    2. Advise doctor visits for critical misses (Heart, BP, HIV).
    3. Frequency Logic: Calculate evenly-spaced times (e.g. 3x/day -> "08:00,14:00,20:00").
    4. For ADD_REMINDER, if medicine exists, use UPDATE_REMINDER instead.
    5. IMPORTANT: Always include the "patientId" in the action payload. Use the "Active Profile (Target)" ID provided above unless the user explicitly mentions another person from the Family list.
    6. If you find a matching medicine in the "Active Medications" list, include its "medicineId" if applicable.
    ` : `
    === CONVERSATIONAL MODE ===
    - Answer clearly and warmly. You cannot perform system actions.
    - Focus on regional wellness tips and medical education.
    - Keep text responses concise and actionable.
    `}

    === IN-APP NAVIGATION ===
    ALWAYS embed clickable chips for relevant pages using: [Label](/route)
    Routes: [/dashboard, /reminders, /history, /interactions, /family, /wellness, /report, /travel, /scan]

    === NUTRITIONAL GUIDELINES ===
    1. Proactively suggest regional foods (Matooke, Avocado, G-nuts).
    2. Warn about high-risk interactions (e.g. Grapefruit, Dairy, Alcohol).


    === RESPONSE FORMAT ===
    ${isStreaming ? `
    Respond in plain text first. Append "###METADATA###" followed by:
    { "suggestions": ["...", "...", "..."], "source": "Dawa-GPT", "action": null }
    ` : `
    Respond STRICTLY in JSON format:
    { "text": "...", "suggestions": ["...", "...", "..."], "source": "Dawa-GPT", "action": null }
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
export const getEmotionReflection = async (mood, energy, symptoms, medicines = []) => {
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

  return await callGroq(prompt, true, GROQ_LIGHT_MODEL);
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