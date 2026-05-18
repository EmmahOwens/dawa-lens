import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';

dotenv.config();

// ── API Config ───────────────────────────────────────────────────────────────
const GROQ_API_KEY_3 = process.env.GROQ_API_KEY_3;
const GROQ_API_KEY_2 = process.env.GROQ_API_KEY_2;
const GROQ_MODEL     = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_API_URL   = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Determines which API key to use based on the model ID.
 * Features using llama 3.1 8b models MUST use GROQ_API_KEY_2.
 */
const getGroqApiKey = (modelId) => {
  if (modelId && modelId.toLowerCase().includes('llama-3.1-8b')) {
    return GROQ_API_KEY_2;
  }
  return GROQ_API_KEY_3;
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_PRO_MODEL   = 'gemini-1.5-pro';
const GEMINI_FLASH_MODEL = 'gemini-2.0-flash';

// ── Prompt ───────────────────────────────────────────────────────────────────
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
- 'imprints': Any text/numbers found imprinted on the pill surface (empty array if none).
- 'labels': Any brand or label text visible on packaging (empty array if none).
- 'draftSchedule': A suggested daily schedule based on common usage (e.g., ["08:00", "20:00"] for twice daily).
- 'safetyFlag': A short one-sentence critical warning if this med is high-risk (e.g., "Do not take with alcohol").

Respond ONLY with a valid JSON object in this exact schema:
{
  "matches": [
    {
      "name": "string",
      "genericName": "string",
      "confidence": number,
      "recommendedDosage": "string",
      "draftSchedule": ["string"],
      "safetyFlag": "string"
    }
  ],
  "imprints": ["string"],
  "labels": ["string"],
  "summary": "string"
}`;
};

// ── Gemini response schema ────────────────────────────────────────────────────
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
          name:              { type: 'STRING' },
          genericName:       { type: 'STRING' },
          confidence:        { type: 'NUMBER' },
          recommendedDosage: { type: 'STRING' },
          draftSchedule:     { type: 'ARRAY', items: { type: 'STRING' } },
          safetyFlag:        { type: 'STRING' },
        },
        required: ['name', 'confidence', 'genericName', 'recommendedDosage', 'draftSchedule', 'safetyFlag'],
      },
    },
    imprints: { type: 'ARRAY', items: { type: 'STRING' } },
    labels:   { type: 'ARRAY', items: { type: 'STRING' } },
    summary:  { type: 'STRING' },
  },
  required: ['matches', 'summary', 'imprints', 'labels'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detects the MIME type from a base64 string's magic bytes.
 */
const detectMimeType = (base64) => {
  try {
    const header = base64.substring(0, 8);
    if (atob(header).charCodeAt(0) === 0x89) return 'image/png';
    if (atob(header).charCodeAt(0) === 0x52) return 'image/webp';
    if (atob(header).charCodeAt(0) === 0x47) return 'image/gif';
  } catch {
    // fall through
  }
  return 'image/jpeg';
};

/**
 * Normalises and pads the matches array to exactly 5 entries.
 */
const normaliseMatches = (raw) => {
  const matches = (raw || [])
    .map((m) => ({
      name:              String(m.name || 'Unknown'),
      genericName:       String(m.genericName || ''),
      confidence:        Math.min(1, Math.max(0, Number(m.confidence || 0))),
      recommendedDosage: String(m.recommendedDosage || ''),
      draftSchedule:     m.draftSchedule || [],
      safetyFlag:        String(m.safetyFlag || ''),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  while (matches.length < 5) {
    matches.push({ 
      name: 'Inconclusive Match', 
      genericName: '', 
      confidence: 0.0, 
      recommendedDosage: '',
      draftSchedule: [],
      safetyFlag: ''
    });
  }
  return matches;
};

// ── Primary: Groq Llama 4 Scout ───────────────────────────────────────────────

/**
 * Calls the Groq vision API with the given base64 image.
 * Returns parsed result or throws an AppError.
 */
const identifyWithGroq = async (cleanBase64, mimeType, patientAge) => {
  const dataUri = `data:${mimeType};base64,${cleanBase64}`;

  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUri },
          },
          {
            type: 'text',
            text: getPillIdPrompt(patientAge),
          },
        ],
      },
    ],
    temperature: 0.4,
    max_completion_tokens: 1024,
    response_format: { type: 'json_object' },
  };

  let response;
  try {
    response = await axios.post(GROQ_API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${getGroqApiKey(GROQ_MODEL)}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const msg    = err.response.data?.error?.message || '';

      if (status === 401 || status === 403) {
        throw new AppError('The Groq API key is invalid or expired. Check server/.env.', 401, 'INVALID_API_KEY');
      }
      if (status === 429) {
        throw new AppError('Groq rate limit reached. Retrying with fallback engine…', 429, 'RATE_LIMITED');
      }
      // Propagate as a retriable error so the caller can fall back
      const groqErr = new Error(`Groq API error (${status}): ${msg}`);
      groqErr.retriable = true;
      throw groqErr;
    }
    if (err.code === 'ECONNABORTED') {
      const timeoutErr = new Error('Groq timed out');
      timeoutErr.retriable = true;
      throw timeoutErr;
    }
    const netErr = new Error('Groq unreachable');
    netErr.retriable = true;
    throw netErr;
  }

  const rawText = response.data?.choices?.[0]?.message?.content;
  if (!rawText) {
    const emptyErr = new Error('Groq returned an empty response');
    emptyErr.retriable = true;
    throw emptyErr;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const parseErr = new Error('Groq returned malformed JSON');
    parseErr.retriable = true;
    throw parseErr;
  }

  return {
    success:  true,
    matches:  normaliseMatches(parsed.matches),
    imprints: parsed.imprints || [],
    labels:   parsed.labels   || [],
    summary:  parsed.summary  || '',
    engine:   GROQ_MODEL,
  };
};

// ── Fallback: Gemini 2.0 Flash ────────────────────────────────────────────────

/**
 * Calls the Gemini vision API with the given base64 image.
 * Returns parsed result or throws an AppError.
 */
const identifyWithGemini = async (cleanBase64, mimeType, patientAge, modelName = GEMINI_PRO_MODEL) => {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
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
      `${apiUrl}?key=${GEMINI_API_KEY}`,
      requestBody,
      { timeout: 30000 }
    );
  } catch (err) {
    if (err.response) {
      const status    = err.response.status;
      const geminiMsg = err.response.data?.error?.message || '';

      if (status === 400 && geminiMsg.toLowerCase().includes('api key')) {
        throw new AppError('The Gemini API key is invalid or expired. Check server/.env.', 401, 'INVALID_API_KEY');
      }
      if (status === 401 || status === 403) {
        throw new AppError('The Gemini API key is invalid or expired. Check server/.env.', 401, 'INVALID_API_KEY');
      }
      if (status === 429) {
        const rateLimitErr = new Error(`Gemini rate limited: ${geminiMsg}`);
        rateLimitErr.status = 429;
        rateLimitErr.retriable = true;
        throw rateLimitErr;
      }
      if (status === 402) {
        throw new AppError('Google Cloud Vision billing is not enabled on this GCP project.', 402, 'BILLING_DISABLED');
      }
      const genericErr = new Error(`Gemini API error (${status}): ${geminiMsg}`);
      genericErr.retriable = true;
      throw genericErr;
    }
    if (err.code === 'ECONNABORTED') {
      const timeoutErr = new Error('Gemini timed out');
      timeoutErr.retriable = true;
      throw timeoutErr;
    }
    const netErr = new Error('Gemini unreachable');
    netErr.retriable = true;
    throw netErr;
  }

  const candidate = response.data?.candidates?.[0];
  if (!candidate) {
    const emptyErr = new Error('No response received from Gemini');
    emptyErr.retriable = true;
    throw emptyErr;
  }
  if (candidate.finishReason === 'SAFETY') {
    throw new AppError(
      'The image was blocked by safety filters. Please try a clearer photo.',
      400,
      'SAFETY_BLOCKED'
    );
  }

  const rawText = candidate.content?.parts?.[0]?.text;
  if (!rawText) {
    const emptyErr = new Error('Gemini returned an empty response');
    emptyErr.retriable = true;
    throw emptyErr;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const parseErr = new Error('AI returned malformed data');
    parseErr.retriable = true;
    throw parseErr;
  }

  return {
    success:  true,
    matches:  normaliseMatches(parsed.matches),
    imprints: parsed.imprints || [],
    labels:   parsed.labels   || [],
    summary:  parsed.summary  || '',
    engine:   modelName,
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Identifies a pill/medication from a base64-encoded image.
 *
 * Strategy:
 *   1. Try Gemini 1.5 Pro as primary model.
 *   2. If Gemini 1.5 Pro fails, fall back to Llama 4 Scout.
 *   3. If Llama 4 Scout fails, fall back to Gemini 2.0 Flash.
 *
 * @param {string} image       - Raw base64 image (no data URI prefix).
 * @param {number} [patientAge] - Optional patient age for dosage context.
 * @returns {Promise<object>}
 */
export const identifyPill = async (image, patientAge) => {
  // Strip data URI prefix if it somehow arrives with one
  const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
  const mimeType    = detectMimeType(cleanBase64);

  // Ensure at least one key is present
  if (!GEMINI_API_KEY && !GROQ_API_KEY_3) {
    throw new AppError(
      'No AI vision engine is configured. Add GROQ_API_KEY_3 or GEMINI_API_KEY to server/.env.',
      503,
      'API_KEY_MISSING'
    );
  }

  // ── 1. Try Primary: Gemini 1.5 Pro ──────────────────────────────────────────
  if (GEMINI_API_KEY) {
    try {
      console.log(`[visionService] 🔄 Scanning with Gemini 1.5 Pro (${GEMINI_PRO_MODEL})...`);
      const result = await identifyWithGemini(cleanBase64, mimeType, patientAge, GEMINI_PRO_MODEL);
      console.log(`[visionService] ✅ Identified via Gemini 1.5 Pro (${GEMINI_PRO_MODEL})`);
      return result;
    } catch (err) {
      if (err.retriable) {
        console.warn(`[visionService] ⚠️  Gemini 1.5 Pro failed (${err.message}), falling back to Llama 4 Scout…`);
      } else {
        throw err;
      }
    }
  } else {
    console.warn('[visionService] GEMINI_API_KEY not set, skipping Gemini 1.5 Pro.');
  }

  // ── 2. Fallback 1: Groq Llama 4 Scout ───────────────────────────────────────
  if (GROQ_API_KEY_3) {
    try {
      console.log(`[visionService] 🔄 Scanning with Fallback 1: Llama 4 Scout (${GROQ_MODEL})...`);
      const result = await identifyWithGroq(cleanBase64, mimeType, patientAge);
      console.log(`[visionService] ✅ Identified via Groq Llama 4 Scout (${GROQ_MODEL})`);
      return result;
    } catch (err) {
      if (err.retriable) {
        console.warn(`[visionService] ⚠️  Llama 4 Scout failed (${err.message}), falling back to Gemini 2.0 Flash…`);
      } else {
        throw err;
      }
    }
  } else {
    console.warn('[visionService] GROQ_API_KEY_3 not set, skipping Llama 4 Scout.');
  }

  // ── 3. Fallback 2: Gemini 2.0 Flash ─────────────────────────────────────────
  if (GEMINI_API_KEY) {
    try {
      console.log(`[visionService] 🔄 Scanning with Fallback 2: Gemini 2.0 Flash (${GEMINI_FLASH_MODEL})...`);
      const result = await identifyWithGemini(cleanBase64, mimeType, patientAge, GEMINI_FLASH_MODEL);
      console.log(`[visionService] ✅ Identified via Gemini 2.0 Flash (${GEMINI_FLASH_MODEL})`);
      return result;
    } catch (err) {
      // Map transient/retriable errors to a final user-friendly response or throw directly if already mapped
      if (err.isOperational) throw err;
      if (err.status === 429) {
        throw new AppError('Both AI engines are rate-limited. Please wait a moment and try again.', 429, 'RATE_LIMITED');
      }
      throw new AppError(`Scan failed: ${err.message}`, 502);
    }
  } else {
    // If we reach here, it means we don't have GEMINI_API_KEY for fallback 2, and Groq already failed.
    throw new AppError('AI vision services failed to identify the medication.', 502);
  }
};
