import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Strip markdown code fences that AI sometimes wraps JSON responses in.
 */
const sanitizeJson = (text) => {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
};

const callGroq = async (prompt, isJson = true) => {
  if (!GROQ_API_KEY) {
    throw new AppError('AI service is temporarily unavailable. Please try again later.', 503);
  }

  try {
    const payload = {
      model: GROQ_MODEL,
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
    5. Tone: Warm and culturally appropriate for East Africa.
    6. Warning: Do not change dosages. Advise doctor visit if heart/BP meds are skipped.

    Respond in JSON format:
    { "advice": "text", "patterns": ["list"], "adherenceScore": 0-100 }
  `;
  return await callGroq(prompt);
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
  return await callGroq(prompt);
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
    4. Provide local emergency contact numbers (Ambulance, Police) for ${destination}.
    5. List general health risks (e.g. Malaria, yellow fever, water safety) for ${destination}.

    Respond in JSON format:
    { 
      "equivalents": [...], 
      "timezoneAdvice": "...", 
      "customsNotes": "...",
      "emergencyContacts": [{ "service": "...", "number": "..." }],
      "healthRisks": ["..."]
    }
  `;
  return await callGroq(prompt);
};

export const getWellnessInsight = async (doseLogs, wellnessLogs, medicines) => {
  const prompt = `
    You are the "Dawa-Lens Medical Data Analyst".
    Medicines: ${JSON.stringify(medicines.map(m => m.name))}
    Medication Logs: ${JSON.stringify(doseLogs)}
    Wellness/Symptom Logs: ${JSON.stringify(wellnessLogs)}
    
    Task: Correlate adherence with wellness trends (side effects, positive outcomes).
    Generate a full Care Report summary suitable for handing to a doctor.

    Respond in EXACT JSON format:
    { 
      "summary": "2-3 sentences high level clinical overview.", 
      "lifestyleAnalysis": "1-2 sentences on how symptoms/energy align with log times.",
      "insights": ["Specific correlation bullet 1", "Specific correlation bullet 2"], 
      "actionItems": ["Actionable clinical suggestion 1", "Suggestion 2"],
      "correlationScore": 85
    }
  `;
  return await callGroq(prompt);
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
  return await callGroq(prompt);
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
  return await callGroq(prompt);
};

export const chatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients }) => {
  const { finalMessages, systemInstruction } = prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients });

  if (!GROQ_API_KEY) {
    throw new AppError('AI service is temporarily unavailable. Please try again later.', 503);
  }

  try {
    const response = await axios.post(GROQ_API_URL, {
      model: GROQ_MODEL,
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
    return JSON.parse(sanitizeJson(text));
  } catch (err) {
    handleAiError(err);
  }
};

/**
 * Streaming version of Dawa-GPT.
 * Returns the raw axios stream from Groq.
 */
export const streamChatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients }) => {
  const { finalMessages } = prepareDawaGPTContext({ 
    messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, 
    isStreaming: true 
  });

  if (!GROQ_API_KEY) {
    throw new AppError('AI service is temporarily unavailable. Please try again later.', 503);
  }

  try {
    const response = await axios.post(GROQ_API_URL, {
      model: GROQ_MODEL,
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
    handleAiError(err);
  }
};

// --- Helpers ---

function prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, patients, isStreaming = false }) {
  const activeMeds = medicines?.map(m => m.name).join(', ') || 'No active medications';
  const recentLogs = doseLogs ? JSON.stringify(doseLogs.slice(0, 20)) : 'No recent dose history available';
  const remindersSummary = reminders?.length
    ? JSON.stringify(reminders.map(r => ({
        id: r.id,
        medicineName: r.medicineName,
        dose: r.dose,
        time: r.time,
        repeat: r.repeatSchedule,
        enabled: r.enabled
      })))
    : 'No reminders set';
  const wellnessSummary = wellnessLogs?.length
    ? JSON.stringify(wellnessLogs.slice(0, 10))
    : 'No wellness data available';
  const patientsSummary = patients?.length
    ? JSON.stringify(patients.map(p => ({ name: p.name, age: p.age, gender: p.gender, relation: p.relation })))
    : 'No family/patient profiles';

  const systemInstruction = `
    You are "Dawa-GPT", a premium medical AI assistant integrated into the Dawa-Lens app.
    Regional Context: Uganda / East Africa.

    === FULL SYSTEM CONTEXT ===
    User: ${userProfile?.name || 'User'} | Gender: ${userProfile?.gender || 'unknown'} | DOB: ${userProfile?.dateOfBirth || 'unknown'}
    Active Medications: ${activeMeds}
    Reminders: ${remindersSummary}
    Recent Dose Logs: ${recentLogs}
    Wellness/Symptom Logs: ${wellnessSummary}
    Family/Patients: ${patientsSummary}

    === CAPABILITIES ===
    You have FULL READ and WRITE access to the user's medication system.
    You can perform actions by including an "action" field in your metadata JSON.
    
    Supported actions:
    - ADD_MEDICINE: { type: "ADD_MEDICINE", payload: { name, genericName?, dosage, unit?, notes?, totalQuantity?, currentQuantity?, dosagePerDose? } }
    - UPDATE_MEDICINE: { type: "UPDATE_MEDICINE", payload: { id, name?, dosage?, notes? } }
    - ADD_REMINDER: { type: "ADD_REMINDER", payload: { medicineName, dose, time (HH:mm), repeatSchedule ("daily"|"weekly"|"once"|"custom"), notes? } }
    - UPDATE_REMINDER: { type: "UPDATE_REMINDER", payload: { id, enabled?, time?, dose? } }
    - REMOVE_REMINDER: { type: "REMOVE_REMINDER", payload: { id } }
    - LOG_DOSE: { type: "LOG_DOSE", payload: { reminderId, medicineName, dose, scheduledTime, action ("taken"|"skipped") } }
    - LOG_WELLNESS: { type: "LOG_WELLNESS", payload: { type ("food"|"symptom"), data: { symptoms: [], mood?, meal?, notes? } } }
    - ADD_PATIENT: { type: "ADD_PATIENT", payload: { name, age?, gender?, relation? } }
    - null: No system action required.

    === NUTRITIONAL GUIDELINES ===
    1. When asked about food, check for interactions with the user's active medications.
    2. Proactively suggest regional East African foods (Matooke, Avocado, G-nuts, Posho) that help with absorption or reduce side effects.
    3. Always warn about high-risk interactions (e.g. Grapefruit with Statins, Dairy with certain Antibiotics).
    4. If the user asks "Can I eat this with my meds?", provide a detailed clinical reason but in a warm tone.

    === RULES ===
    1. Professional, warm "Dawa-Lens signature" tone — culturally appropriate for Uganda/East Africa.
    2. Never change medication dosages unless explicitly asked to fix an error by the user. 
    3. Advise doctor visits for critical medication misses (heart, BP, HIV).
    4. When asked to "Add a reminder for [Med] at [Time]", you MUST trigger ADD_REMINDER.
    5. When asked to "Stop my [Med] reminder", you MUST trigger REMOVE_REMINDER or UPDATE_REMINDER (enabled: false).
    6. When asked to "Log that I took my [Med]", you MUST trigger LOG_DOSE. Find the corresponding reminderId from the provided context.
    7. When asked to "Log that I have a headache" or "I ate Matooke", you MUST trigger LOG_WELLNESS.
    8. When asked to "Add my mother Mary to the app", you MUST trigger ADD_PATIENT.
    9. Provide exactly 3 next-prompt suggestions.
    10. Keep text responses concise and actionable.

    ${isStreaming ? `
    === STREAMING FORMAT ===
    Respond in plain text message first.
    At the end, append "###METADATA###" followed by a JSON object.
    {
      "suggestions": ["...", "...", "..."],
      "source": "Gemini",
      "action": { "type": "...", "payload": { ... }, "confirmMessage": "I've added that for you." } | null
    }
    ` : `
    Respond STRICTLY in JSON format:
    {
      "text": "...",
      "suggestions": ["...", "...", "..."],
      "source": "Gemini",
      "action": { "type": "...", "payload": { ... }, "confirmMessage": "..." } | null
    }
    `}
  `;

  const formattedMessages = messages.map(msg => ({
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



