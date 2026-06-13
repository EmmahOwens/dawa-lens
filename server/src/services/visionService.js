import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';
import { rateLimitManager } from './rateLimitManager.js';
import { callAiWithFallback } from './aiService.js';

dotenv.config();

// ── API Config ───────────────────────────────────────────────────────────────
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_FLASH_MODEL = 'gemini-2.0-flash';   // cheap & fast

// ── Prompt ───────────────────────────────────────────────────────────────────
const getTextPillIdPrompt = (ocrText, patientAge) => {
  const ageCtx = patientAge ? `for a patient aged ${patientAge}` : 'for a standard adult';

  return `You are a pharmaceutical identification AI. Identify the medication from the following OCR text extracted from the medication packaging or pill.

OCR Text:
"${ocrText}"

Analyze the OCR text to extract:
1. The brand name(s) or generic name(s) of the medication.
2. Any imprints or labels mentioned in the text.
3. Formulate exactly 5 matching candidates (ranked by confidence, with the most likely match first). If there are fewer than 5 candidates, fill the rest with inconclusive entries.

Return ONLY valid JSON matching this schema exactly:
{
  "matches": [ // exactly 5 entries ranked by confidence desc
    {
      "name": "brand name",
      "genericName": "active ingredient(s)",
      "confidence": 0.0, // confidence between 0.0 and 1.0
      "recommendedDosage": "safe standard dose ${ageCtx}",
      "draftSchedule": ["HH:MM"],
      "safetyFlag": "one critical warning or empty string"
    }
  ],
  "imprints": ["text on pill surface extracted from OCR"],
  "labels": ["text on packaging extracted from OCR"],
  "summary": "2-3 sentence summary: primary use and one safety warning"
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

// ── Primary: DawaGPT text-only model pipeline ─────────────────────────────────

const identifyWithDawaGPT = async (ocrText, patientAge) => {
  const prompt = getTextPillIdPrompt(ocrText, patientAge);
  const messages = [{ role: 'user', content: prompt }];
  
  // Call DawaGPT's fallback chain
  const result = await callAiWithFallback(messages, {
    isJson: true,
    priority: 'high',
    maxTokens: 1000,
    isComplex: true
  });
  
  return {
    success: true,
    matches: normaliseMatches(result.matches),
    imprints: result.imprints || [],
    labels: result.labels || [],
    summary: result.summary || '',
    engine: result.source || 'DawaGPT (Text)',
  };
};

// ── Fallback: Cloudflare Text model ──────────────────────────────────────────

const identifyWithCloudflareText = async (ocrText, patientAge) => {
  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('Cloudflare API key or Account ID not configured');
  }
  
  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_TEXT_MODEL}`;
  const requestBody = {
    messages: [
      {
        role: 'user',
        content: getTextPillIdPrompt(ocrText, patientAge)
      }
    ]
  };
  
  const fn = async () => {
    return await axios.post(apiUrl, requestBody, {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  };
  
  let response;
  try {
    response = await rateLimitManager.enqueue(fn, 'cloudflare-llama-3.1-text', requestBody.messages, 'high', 1, true);
  } catch (err) {
    const cfErr = new Error(`Cloudflare Text API error: ${err.message}`);
    cfErr.retriable = true;
    throw cfErr;
  }
  
  const rawText = response.data?.result?.response;
  if (!rawText) {
    const emptyErr = new Error('Cloudflare returned an empty response');
    emptyErr.retriable = true;
    throw emptyErr;
  }
  
  let parsed;
  try {
    const sanitized = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    parsed = JSON.parse(sanitized);
  } catch {
    const parseErr = new Error('Cloudflare returned malformed JSON');
    parseErr.retriable = true;
    throw parseErr;
  }
  
  return {
    success: true,
    matches: normaliseMatches(parsed.matches),
    imprints: parsed.imprints || [],
    labels: parsed.labels || [],
    summary: parsed.summary || '',
    engine: CLOUDFLARE_TEXT_MODEL,
  };
};

// ── Final Fallback: Gemini Text model ────────────────────────────────────────

const identifyWithGeminiText = async (ocrText, patientAge) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FLASH_MODEL}:generateContent`;
  const requestBody = {
    contents: [
      {
        parts: [
          { text: getTextPillIdPrompt(ocrText, patientAge) },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 700,
      responseMimeType: 'application/json',
      responseSchema: PILL_ID_SCHEMA,
    },
  };
  
  const fn = async () => {
    return await axios.post(
      `${apiUrl}?key=${GEMINI_API_KEY}`,
      requestBody,
      { timeout: 20000 }
    );
  };
  
  let response;
  try {
    response = await rateLimitManager.enqueue(fn, 'gemini-text', requestBody.contents, 'high', 1, true);
  } catch (err) {
    const genericErr = new Error(`Gemini Text API error: ${err.message}`);
    genericErr.status = err.response?.status;
    throw genericErr;
  }
  
  const candidate = response.data?.candidates?.[0];
  if (!candidate) {
    throw new Error('No response received from Gemini');
  }
  
  const rawText = candidate.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini returned an empty response');
  }
  
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('AI returned malformed data');
  }
  
  return {
    success: true,
    matches: normaliseMatches(parsed.matches),
    imprints: parsed.imprints || [],
    labels: parsed.labels || [],
    summary: parsed.summary || '',
    engine: `${GEMINI_FLASH_MODEL} (Text)`,
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Identifies a pill/medication using extracted OCR text.
 *
 * Fallback chain:
 *   1. DawaGPT Text Models
 *   2. Cloudflare Llama 3.1 8B Text
 *   3. Gemini 2.0 Flash Text
 *
 * @param {string} [image]     - Ignored/Optional base64 image.
 * @param {number} [patientAge] - Optional patient age for dosage context.
 * @param {string} ocrText     - Extracted OCR text from the medication.
 * @returns {Promise<object>}
 */
export const identifyPill = async (image, patientAge, ocrText) => {
  if (!ocrText || !ocrText.trim()) {
    throw new AppError(
      'No text was detected from the scan. Please try again with a clearer photo of the label.',
      400,
      'NO_TEXT_DETECTED'
    );
  }

  // ── 1. Primary: DawaGPT text models ──
  try {
    console.log(`[visionService] 🔄 Processing scan with Primary: DawaGPT text models...`);
    const result = await identifyWithDawaGPT(ocrText, patientAge);
    console.log(`[visionService] ✅ Identified via DawaGPT text models`);
    return result;
  } catch (err) {
    console.warn(`[visionService] ⚠️  DawaGPT text models failed (${err.message}), falling back to Cloudflare text model…`);
  }

  // ── 2. Fallback: Cloudflare text model ──
  if (CLOUDFLARE_API_KEY && CLOUDFLARE_ACCOUNT_ID) {
    try {
      console.log(`[visionService] 🔄 Processing scan with Fallback: Cloudflare text model (${CLOUDFLARE_TEXT_MODEL})...`);
      const result = await identifyWithCloudflareText(ocrText, patientAge);
      console.log(`[visionService] ✅ Identified via Cloudflare text model`);
      return result;
    } catch (err) {
      console.warn(`[visionService] ⚠️  Cloudflare text model failed (${err.message}), falling back to Gemini text model…`);
    }
  } else {
    console.warn('[visionService] CLOUDFLARE_API_KEY or CLOUDFLARE_ACCOUNT_ID not set, skipping Cloudflare text fallback.');
  }

  // ── 3. Final Fallback: Gemini text model ──
  if (GEMINI_API_KEY) {
    try {
      console.log(`[visionService] 🔄 Processing scan with Final Fallback: Gemini text model (${GEMINI_FLASH_MODEL})...`);
      const result = await identifyWithGeminiText(ocrText, patientAge);
      console.log(`[visionService] ✅ Identified via Gemini text model`);
      return result;
    } catch (err) {
      console.error(`[visionService] ❌ Gemini text fallback failed:`, err.message);
      if (err.isOperational) throw err;
      throw new AppError(`Scan failed: ${err.message}`, 502);
    }
  } else {
    throw new AppError('AI text services failed to identify the medication.', 502);
  }
};
