import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const getPillIdPrompt = (patientAge) => {
  let ageContext = patientAge ? `specifically for a patient aged ${patientAge}` : "standard adult";
  return `You are a Senior Pharmaceutical Consultant AI for Dawa Lens. 
Your task is to identify medications from images with extreme precision.

ANALYSIS GUIDELINES:
1. Examine the pill's COLOR, SHAPE (e.g., round, oval, capsule-shaped), and SIZE.
2. Read and extract any IMPRINTS (letters or numbers) on the surface of the medication.
3. If the image is a medication package or label, extract the brand name and active ingredients.
4. Compare these physical characteristics against your knowledge of pharmaceutical products.

OUTPUT REQUIREMENTS:
- Provide 5 potential matches, ranked by confidence.
- 'name': The most common brand name or a clear descriptive name.
- 'genericName': The active ingredient(s).
- 'recommendedDosage': A safe, standard dosage context ${ageContext}.
- 'summary': A concise, professional summary of the identified medication, its primary use, and one critical safety warning.

Respond ONLY with a valid JSON object matching the requested schema.`;
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
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing');

  const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

  const requestBody = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: cleanBase64 } },
          { text: getPillIdPrompt(patientAge) }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: PILL_ID_SCHEMA
    }
  };

  const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, requestBody, { timeout: 30000 });
  const candidate = response.data?.candidates?.[0];

  if (!candidate) throw new Error('No response from Gemini');
  if (candidate.finishReason === 'SAFETY') throw new Error('Image blocked by safety filters');

  const rawText = candidate.content?.parts?.[0]?.text;
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
    engine: 'gemini-2.0-flash'
  };
};
