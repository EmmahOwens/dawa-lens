import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const getPillIdPrompt = (patientAge) => {
  let ageContext = patientAge ? `specifically for a patient aged ${patientAge}` : "standard adult";
  return `You are a pharmaceutical AI assistant integrated into Dawa Lens, a medication safety app.
Analyze the provided image of a medication.
1. Identify names.
2. Extract imprints.
3. Assign confidence.
4. Descriptive labels.
5. Suggested 'recommendedDosage' ${ageContext}.
Rules: Return exactly 5 matches in sorting order. Respond ONLY with valid JSON.`;
};

const PILL_ID_SCHEMA = {
  type: "OBJECT",
  properties: {
    matches: {
      type: "ARRAY",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          genericName: { type: "STRING" },
          confidence: { type: "NUMBER" },
          recommendedDosage: { type: "STRING" }
        },
        required: ["name", "confidence", "genericName", "recommendedDosage"]
      }
    },
    imprints: { type: "ARRAY", items: { type: "STRING" } },
    labels: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" }
  },
  required: ["matches", "summary", "imprints", "labels"]
};

export const identifyPill = async (image, patientAge) => {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY missing');

  const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: getPillIdPrompt(patientAge) + "\n\nFormat your response EXACTLY as JSON matching this schema:\n" + JSON.stringify(PILL_ID_SCHEMA) },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }
        ]
      }
    ],
    temperature: 0.4
  };

  const response = await axios.post(GROQ_API_URL, requestBody, { 
    timeout: 30000,
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const choice = response.data?.choices?.[0];

  if (!choice) throw new Error('No response from Groq');

  let rawText = choice.message?.content || "";
  rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(rawText);

  // Normalization
  let matches = (parsed.matches || [])
    .map(m => ({
      name: String(m.name || 'Unknown'),
      genericName: String(m.genericName || ''),
      confidence: Number(m.confidence || 0),
      recommendedDosage: String(m.recommendedDosage || ''),
    }))
    .slice(0, 5);

  while (matches.length < 5) {
    matches.push({ name: "Inconclusive Match", genericName: "", confidence: 0.0, recommendedDosage: "" });
  }

  return {
    success: true,
    matches,
    imprints: parsed.imprints || [],
    labels: parsed.labels || [],
    summary: parsed.summary || '',
    engine: 'llama-3.2-11b-vision-preview'
  };
};
