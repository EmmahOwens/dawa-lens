import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * AI Behavioral Adherence Coach
 * Analyzes medication logs for patterns and provides supportive advice.
 */
router.post('/coach', async (req, res) => {
  const { logs, medicines, userName } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI key not set', code: 'API_KEY_MISSING' });
  }

  const prompt = `
    You are the "Dawa-Lens Adherence Coach", a supportive health assistant for users in East Africa.
    User Name: ${userName || 'User'}
    
    Current Medications:
    ${JSON.stringify(medicines)}
    
    Recent Medication Activity (Logs):
    ${JSON.stringify(logs)}
    
    Your task:
    1. Analyze the logs for any patterns in missed or delayed doses.
    2. Provide supportive, non-judgmental advice to help the user stay on track.
    3. If adherence is high, give specific praise and motivation.
    4. Mention if specific medications have more misses than others.
    5. Keep the tone warm, helpful, and culturally appropriate for an African context.
    6. Warning: Do not change dosages. If you see many skipped heart or blood pressure meds, advise seeing a doctor immediately.

    Respond in JSON format:
    {
      "advice": "Main coaching text",
      "patterns": ["List of identified patterns"],
      "adherenceScore": 0-100
    }
  `;

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const reply = JSON.parse(response.data.candidates[0].content.parts[0].text);
    res.json(reply);
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Coaching AI Error:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ 
      error: 'AI coaching failed', 
      details: error.response?.data?.error?.message || error.message,
      code: 'AI_ERROR' 
    });
  }
});

/**
 * Holistic Safety Engine
 * Checks interactions between medications and lifestyle/food.
 */
router.post('/holistic-safety', async (req, res) => {
  const { medicines, lifestyleFactors } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI key not set', code: 'API_KEY_MISSING' });
  }

  const prompt = `
    You are "Dawa-Lens Holistic Safety Engine".
    Medication List: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    Lifestyle/Food Factors to check: ${JSON.stringify(lifestyleFactors)}

    Your task:
    1. Identify any known interactions between the medications and the food/lifestyle factors listed.
    2. Focus on: Alcohol, Caffeine, Grapefruit, Dairy, High-fat meals, and traditional herbal remedies.
    3. Categorize each interaction as "High", "Medium", or "Low" risk.
    4. Provide clear, simple explanations and actionable advice.

    Respond in JSON format:
    {
      "interactions": [
        { "factor": "Alcohol", "risk": "High", "explanation": "Explanation here", "advice": "Avoid entirely while on this med" }
      ]
    }
  `;

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const reply = JSON.parse(response.data.candidates[0].content.parts[0].text);
    res.json(reply);
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Safety AI Error:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ 
      error: 'AI safety check failed', 
      details: error.response?.data?.error?.message || error.message,
      code: 'AI_ERROR' 
    });
  }
});

/**
 * Medication Travel Companion
 * Finds equivalents and handles timezone shifts.
 */
router.post('/travel', async (req, res) => {
  const { medicines, destination, currentCity, homeTimezone, targetTimezone } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI key not set', code: 'API_KEY_MISSING' });
  }

  const prompt = `
    You are the "Dawa-Lens Global Travel Companion".
    User is traveling from ${currentCity || 'Home'} (${homeTimezone || 'Local'}) to ${destination} (${targetTimezone || 'Destination'}).
    
    Current Medications:
    ${JSON.stringify(medicines.map(m => ({ name: m.name, generic: m.genericName, dosage: m.dosage })))}
    
    Your task:
    1. For each medication, find the most common equivalent brand name in ${destination}.
    2. Provide specific advice on how to shift dose timings if there's a significant timezone change.
    3. Advise on any known customs restrictions for these specific types of drugs in ${destination} (if applicable).
    4. Keep the tone professional, reassuring, and clear.

    Respond in JSON format:
    {
      "equivalents": [
        { "original": "Brand X", "equivalent": "Local Brand Y", "country": "Destination" }
      ],
      "timezoneAdvice": "How to shift doses (e.g., 'Take dose 2 hours later each day until aligned')",
      "customsNotes": "General or specific alerts about traveling with these meds"
    }
  `;

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const reply = JSON.parse(response.data.candidates[0].content.parts[0].text);
    res.json(reply);
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Travel AI Error:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ 
      error: 'Travel analysis failed', 
      details: error.response?.data?.error?.message || error.message,
      code: 'AI_ERROR' 
    });
  }
});

/**
 * Wellness Pattern Insight
 * Correlates dose logs + wellness logs (symptoms/mood).
 */
router.post('/wellness-insight', async (req, res) => {
  const { doseLogs, wellnessLogs, medicines } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI key not set', code: 'API_KEY_MISSING' });
  }

  const prompt = `
    You are the "Dawa-Lens Wellness Analyst".
    
    Data:
    Medications: ${JSON.stringify(medicines.map(m => m.name))}
    Medication Logs (last 7-14 days): ${JSON.stringify(doseLogs)}
    Wellness Logs (Mood/Energy/Symptoms): ${JSON.stringify(wellnessLogs)}
    
    Your task:
    1. Identify any correlations between medication adherence (taken/skipped) and wellness trends.
    2. Look for potential side effects (e.g., "Fatigue on days Med X was taken").
    3. Look for positive outcomes (e.g., "Mood improves 2 days after starting Med Y").
    4. Provide 3 actionable wellness insights.
    5. Maintain a professional, data-driven yet encouraging tone.

    Respond in JSON format:
    {
      "summary": "Overall trend summary",
      "insights": ["Insight 1", "Insight 2", "Insight 3"],
      "correlationScore": 0-100
    }
  `;

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const reply = JSON.parse(response.data.candidates[0].content.parts[0].text);
    res.json(reply);
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Wellness AI Error:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ 
      error: 'Wellness analysis failed', 
      details: error.response?.data?.error?.message || error.message,
      code: 'AI_ERROR' 
    });
  }
});

/**
 * Instant Meal Safety Check
 * Checks a specific meal against current medications.
 */
router.post('/meal-check', async (req, res) => {
  const { medicines, mealDescription } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI key not set', code: 'API_KEY_MISSING' });
  }

  const prompt = `
    You are "Dawa-Lens Meal Safety Checker".
    Current Medications: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    User is about to eat: "${mealDescription}"

    Your task:
    1. Check for any dangerous or efficacy-reducing interactions between the food mentioned and the user's meds.
    2. Specifically look for: Dairy (with antibiotics), Grapefruit (with statins), Alcohol, Tyramine-rich foods, etc.
    3. Categorize risk as "High", "Medium", or "Safe".
    4. Provide a very brief, clear explanation.

    Respond in JSON format:
    {
      "risk": "High/Medium/Safe",
      "verdict": "Clear concise verdict",
      "explanation": "Why?"
    }
  `;

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const reply = JSON.parse(response.data.candidates[0].content.parts[0].text);
    res.json(reply);
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Meal AI Error:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ 
      error: 'Meal check failed', 
      details: error.response?.data?.error?.message || error.message,
      code: 'AI_ERROR' 
    });
  }
});

/**
 * Conversational AI Assistant (Dawa-GPT)
 * Maintains history and provides contextual follow-up suggestions.
 */
router.post('/chat', async (req, res) => {
  const { messages, medicines, userProfile, doseLogs } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI key not set', code: 'API_KEY_MISSING' });
  }

  const activeMeds = medicines?.map(m => m.name).join(', ') || 'No active medications';
  const recentLogs = doseLogs ? JSON.stringify(doseLogs.slice(0, 20)) : 'No recent dose history available';
  
  const systemInstruction = `
    You are "Dawa-GPT", a premium medical AI assistant integrated into the Dawa-Lens app.
    Your primary focus is the health and safety of users in Uganda and East Africa.
    
    Transparency Notice:
    - You MUST inform the user that you have access to their medication history (active meds and dose logs) to provide personalized and safe advice.
    - Mention this naturally in your first response or when relevant.
    
    Context:
    - User Name: ${userProfile?.name || 'User'}
    - Active Medications: ${activeMeds}
    - Recent Dose History (last 20 logs): ${recentLogs}
    - Regional Context: Uganda (Ministry of Health / NDA guidelines).
    
    Rules:
    1. Prioritize East African medication names and regional health standards.
    2. Maintain a professional, warm, and helpful tone (the "Dawa-Lens signature").
    3. Never officially alter dosages; always advise consulting a professional for prescription changes.
    4. Use the Dose History to provide context (e.g., if they missed a dose, give advice based on that).
    5. Based on the conversation, yield 3 concise "Next Prompt Suggestions" that the user might want to click.
    
    Response Format (Strict JSON):
    {
      "text": "Your helpful response here (Markdown supported)",
      "suggestions": ["Next prompt 1", "Next prompt 2", "Next prompt 3"],
      "source": "Gemini/MoH"
    }
  `;

  // Convert frontend messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  // Embed system instruction at the start of the conversation
  const finalContents = [
    { role: 'user', parts: [{ text: `System Instruction: ${systemInstruction}` }] },
    { role: 'model', parts: [{ text: "Understood. I am Dawa-GPT, focusing on Uganda and East African health context. How can I help you today?" }] },
    ...contents
  ];

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: finalContents,
      generationConfig: { 
        responseMimeType: 'application/json' 
      }
    });

    const replyText = response.data.candidates[0].content.parts[0].text;
    res.json(JSON.parse(replyText));
  } catch (error) {
    console.error('Chat AI Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'AI chat failed', 
      details: error.response?.data?.error?.message || error.message,
      code: 'AI_ERROR' 
    });
  }
});

export default router;
