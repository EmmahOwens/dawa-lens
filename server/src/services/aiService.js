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

export const chatWithDawaGPT = async ({ messages, medicines, userProfile, doseLogs }) => {
  const activeMeds = medicines?.map(m => m.name).join(', ') || 'No active medications';
  const recentLogs = doseLogs ? JSON.stringify(doseLogs.slice(0, 20)) : 'No recent dose history available';
  
  const systemInstruction = `
    You are "Dawa-GPT", a premium medical AI assistant integrated into the Dawa-Lens app.
    Regional Context: Uganda / East Africa.
    
    Context:
    - User: ${userProfile?.name || 'User'}
    - Meds: ${activeMeds}
    - Recent Logs: ${recentLogs}
    
    Rules:
    1. Professional, warm "Dawa-Lens signature" tone.
    2. Do not change dosages.
    3. Give 3 Next Prompt Suggestions.
    
    Respond in JSON format:
    { "text": "...", "suggestions": ["..."], "source": "..." }
  `;

  const formattedMessages = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.text
  }));

  const finalMessages = [
    { role: 'system', content: systemInstruction },
    { role: 'assistant', content: 'Understood. I am Dawa-GPT. How can I help you today?' },
    ...formattedMessages
  ];

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

