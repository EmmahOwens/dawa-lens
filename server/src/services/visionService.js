import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const getPillIdPrompt = (patientAge) => {
  const ageContext = patientAge
    ? `specifically for a patient aged ${patientAge}`
    : 'standard adult';

  return `You are a Senior Pharmaceutical Consultant AI for Dawa Lens.
Your task is to identify medications from images with extreme precision.

ANALYSIS GUIDELINES:
1. Examine the pill's COLOR, SHAPE (e.g., round, oval, capsule-shaped), and SIZE.
2. Read and extract any IMPRINTS (letters or numbers) on the surface of the medication.
3. If the image is a medication package or label, extract the brand name and active ingredients.
4. Compare these physical characteristics against your knowledge of pharmaceutical products.

OUTPUT REQUIREMENTS:
- Provide 5 potential matches, ranked by confidence (1.0 = certain, 0.0 = no match).
- 'name': The most common brand name or a clear descriptive name.
- 'genericName': The active ingredient(s).
- 'recommendedDosage': A safe, standard dosage context ${ageContext}.
- 'summary': A concise, professional summary of the identified medication, its primary use, and one critical safety warning.

Respond ONLY with a valid JSON object matching the requested schema.`;
};

const PILL_ID_SCHEMA = {
  type: 'OBJECT',
  properties: {
    matches: {
      type: 'ARRAY',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          genericName: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
          recommendedDosage: { type: 'STRING' },
        },
        required: ['name', 'confidence', 'genericName', 'recommendedDosage'],
      },
    },
    imprints: { type: 'ARRAY', items: { type: 'STRING' } },
    labels:   { type: 'ARRAY', items: { type: 'STRING' } },
    summary:  { type: 'STRING' },
  },
  required: ['matches', 'summary', 'imprints', 'labels'],
};

/**
 * Detects the MIME type from a base64 string magic bytes prefix.
 * The frontend strips the data URI prefix before sending, so we sniff from raw bytes.
 */
const detectMimeType = (base64) => {
  try {
    const header = base64.substring(0, 8);
    // PNG: 89 50 4E 47
    if (atob(header).charCodeAt(0) === 0x89) return 'image/png';
    // WEBP: 52 49 46 46
    if (atob(header).charCodeAt(0) === 0x52) return 'image/webp';
    // GIF: 47 49 46 38
    if (atob(header).charCodeAt(0) === 0x47) return 'image/gif';
  } catch {
    // fall through to default
  }
  return 'image/jpeg'; // JPEG is the most common scan output
};

export const identifyPill = async (image, patientAge) => {
  // --- Guard: API key ---
  if (!GEMINI_API_KEY) {
    throw new AppError('Gemini API key is not configured. Add GEMINI_API_KEY to server/.env.', 503, 'API_KEY_MISSING');
  }

  // Strip data URI prefix if it somehow arrives with one
  const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = detectMimeType(cleanBase64);

  const requestBody = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: cleanBase64 } },
          { text: getPillIdPrompt(patientAge) },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: PILL_ID_SCHEMA,
    },
  };

  let response;
  try {
    response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody,
      { timeout: 30000 }
    );
  } catch (err) {
    // Map Gemini HTTP errors to client-friendly error codes
    if (err.response) {
      const status = err.response.status;
      const geminiMsg = err.response.data?.error?.message || '';

      if (status === 400 && geminiMsg.toLowerCase().includes('api key')) {
        throw new AppError('The Gemini API key is invalid or expired. Check server/.env.', 401, 'INVALID_API_KEY');
      }
      if (status === 401 || status === 403) {
        throw new AppError('The Gemini API key is invalid or expired. Check server/.env.', 401, 'INVALID_API_KEY');
      }
      if (status === 429) {
        throw new AppError('AI rate limit reached. Please wait a moment and try again.', 429, 'RATE_LIMITED');
      }
      if (status === 402) {
        throw new AppError('Google Cloud Vision billing is not enabled on this GCP project.', 402, 'BILLING_DISABLED');
      }
      throw new AppError(`Gemini API error (${status}): ${geminiMsg}`, 502);
    }
    if (err.code === 'ECONNABORTED') {
      throw new AppError('Scan timed out. Please try again with a clearer image.', 504, 'TIMEOUT');
    }
    throw new AppError('Could not reach the AI service. Check your internet connection.', 503);
  }

  const candidate = response.data?.candidates?.[0];

  if (!candidate) {
    throw new AppError('No response received from Gemini. Please try again.', 502);
  }

  // Safety block
  if (candidate.finishReason === 'SAFETY') {
    throw new AppError(
      'The image was blocked by safety filters. Please try a clearer photo.',
      400,
      'SAFETY_BLOCKED'
    );
  }

  // With responseMimeType: 'application/json', Gemini returns a JSON string in parts[0].text
  const rawText = candidate.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new AppError('Gemini returned an empty response. Please try again.', 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new AppError('AI returned malformed data. Please try again.', 502);
  }

  // Normalize and pad to exactly 5 matches
  let matches = (parsed.matches || [])
    .map((m) => ({
      name: String(m.name || 'Unknown'),
      genericName: String(m.genericName || ''),
      confidence: Math.min(1, Math.max(0, Number(m.confidence || 0))),
      recommendedDosage: String(m.recommendedDosage || ''),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  while (matches.length < 5) {
    matches.push({ name: 'Inconclusive Match', genericName: '', confidence: 0.0, recommendedDosage: '' });
  }

  return {
    success: true,
    matches,
    imprints: parsed.imprints || [],
    labels: parsed.labels || [],
    summary: parsed.summary || '',
    engine: GEMINI_MODEL,
  };
};
