import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';

dotenv.config();

// ── Primary: Groq Llama 4 Scout (free tier, OpenAI-compatible) ──────────────
const GROQ_API_KEY   = process.env.GROQ_API_KEY;
const GROQ_MODEL     = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_API_URL   = 'https://api.groq.com/openai/v1/chat/completions';

// ── Fallback: Gemini 2.0 Flash ───────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

Respond ONLY with a valid JSON object in this exact schema:
{
  "matches": [
    {
      "name": "string",
      "genericName": "string",
      "confidence": number,
      "recommendedDosage": "string"
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
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  while (matches.length < 5) {
    matches.push({ name: 'Inconclusive Match', genericName: '', confidence: 0.0, recommendedDosage: '' });
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
        Authorization: `Bearer ${GROQ_API_KEY}`,
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
const identifyWithGemini = async (cleanBase64, mimeType, patientAge) => {
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
        throw new AppError('Both AI engines are rate-limited. Please wait a moment and try again.', 429, 'RATE_LIMITED');
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
  if (candidate.finishReason === 'SAFETY') {
    throw new AppError(
      'The image was blocked by safety filters. Please try a clearer photo.',
      400,
      'SAFETY_BLOCKED'
    );
  }

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

  return {
    success:  true,
    matches:  normaliseMatches(parsed.matches),
    imprints: parsed.imprints || [],
    labels:   parsed.labels   || [],
    summary:  parsed.summary  || '',
    engine:   GEMINI_MODEL,
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Identifies a pill/medication from a base64-encoded image.
 *
 * Strategy:
 *   1. Try Groq Llama 4 Scout (free, ultra-low latency).
 *   2. If Groq fails with a retriable error, fall back to Gemini 2.0 Flash.
 *
 * @param {string} image       - Raw base64 image (no data URI prefix).
 * @param {number} [patientAge] - Optional patient age for dosage context.
 * @returns {Promise<object>}
 */
export const identifyPill = async (image, patientAge) => {
  // Strip data URI prefix if it somehow arrives with one
  const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
  const mimeType    = detectMimeType(cleanBase64);

  // ── 1. Try Groq first ──────────────────────────────────────────────────────
  if (GROQ_API_KEY) {
    try {
      const result = await identifyWithGroq(cleanBase64, mimeType, patientAge);
      console.log(`[visionService] ✅ Identified via Groq (${GROQ_MODEL})`);
      return result;
    } catch (err) {
      // Only fall back if Groq signals a retriable/transient failure
      if (err.retriable) {
        console.warn(`[visionService] ⚠️  Groq failed (${err.message}), falling back to Gemini…`);
      } else {
        // Non-retriable Groq error (bad key, safety block, etc.) — surface directly
        throw err;
      }
    }
  } else {
    console.warn('[visionService] GROQ_API_KEY not set, skipping Groq.');
  }

  // ── 2. Fall back to Gemini ─────────────────────────────────────────────────
  if (!GEMINI_API_KEY) {
    throw new AppError(
      'No AI vision engine is configured. Add GROQ_API_KEY or GEMINI_API_KEY to server/.env.',
      503,
      'API_KEY_MISSING'
    );
  }

  console.log(`[visionService] 🔄 Using Gemini fallback (${GEMINI_MODEL})`);
  return identifyWithGemini(cleanBase64, mimeType, patientAge);
};
