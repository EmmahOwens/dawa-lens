import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const callGemini = async (prompt, isJson = true) => {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: isJson ? { responseMimeType: 'application/json' } : {}
  });

  const text = response.data.candidates[0].content.parts[0].text;
  return isJson ? JSON.parse(text) : text;
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
  return await callGemini(prompt);
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
  return await callGemini(prompt);
};

export const getTravelAdvice = async ({ medicines, destination, currentCity, homeTimezone, targetTimezone }) => {
  const prompt = `
    You are the "Dawa-Lens Global Travel Companion".
    Travel: ${currentCity || 'Home'} (${homeTimezone}) to ${destination} (${targetTimezone}).
    Medicines: ${JSON.stringify(medicines.map(m => ({ name: m.name, generic: m.genericName, dosage: m.dosage })))}
    
    Task:
    1. Find equivalent brand names in ${destination}.
    2. Timezone shift advice.
    3. Customs restrictions.

    Respond in JSON format:
    { "equivalents": [...], "timezoneAdvice": "...", "customsNotes": "..." }
  `;
  return await callGemini(prompt);
};

export const getWellnessInsight = async (doseLogs, wellnessLogs, medicines) => {
  const prompt = `
    You are the "Dawa-Lens Wellness Analyst".
    Medicines: ${JSON.stringify(medicines.map(m => m.name))}
    Med logs: ${JSON.stringify(doseLogs)}
    Wellness logs: ${JSON.stringify(wellnessLogs)}
    
    Task: Correlate adherence with wellness trends (side effects, positive outcomes).
    Provide 3 actionable insights.

    Respond in JSON format:
    { "summary": "...", "insights": ["..."], "correlationScore": 0-100 }
  `;
  return await callGemini(prompt);
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
  return await callGemini(prompt);
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

  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const finalContents = [
    { role: 'user', parts: [{ text: `System Instruction: ${systemInstruction}` }] },
    { role: 'model', parts: [{ text: "Understood. I am Dawa-GPT. How can I help you today?" }] },
    ...contents
  ];

  const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    contents: finalContents,
    generationConfig: { responseMimeType: 'application/json' }
  });

  return JSON.parse(response.data.candidates[0].content.parts[0].text);
};
