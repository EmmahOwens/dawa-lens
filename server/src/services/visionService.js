import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';
import { rateLimitManager } from './rateLimitManager.js';
import { fetchDrugLabel, fetchNdcData } from './openFdaService.js';

dotenv.config();

// ── API Config ───────────────────────────────────────────────────────────────
const GEMINI_FLASH_MODEL = 'gemini-2.5-flash';

const getGeminiApiKeyForScan = () => {
  const key = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AppError('Gemini API key for scanning (GEMINI_API_KEY_2 or GEMINI_API_KEY) is not configured in environment.', 500, 'GEMINI_KEY_MISSING');
  }
  return key;
};

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

// ── Gemini Text model ────────────────────────────────────────

const identifyWithGeminiText = async (ocrText, patientAge) => {
  const apiKey = getGeminiApiKeyForScan();
  
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
      `${apiUrl}?key=${apiKey}`,
      requestBody,
      { timeout: 20000 }
    );
  };
  
  let response;
  try {
    // Best rate limiting techniques:
    // - Enqueue under 'gemini-2.5-flash' rate limit config
    // - priority: high
    // - maxRetries: 3
    // - failFast: false (queues request on rate limit instead of immediate failure)
    response = await rateLimitManager.enqueue(fn, 'gemini-2.5-flash', requestBody.contents, 'high', 3, false);
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

  const rawMatches = normaliseMatches(parsed.matches);
  const enrichedMatches = await enrichMatchesWithFda(rawMatches);

  return {
    success: true,
    matches: enrichedMatches,
    imprints: parsed.imprints || [],
    labels: parsed.labels || [],
    summary: parsed.summary || '',
    engine: `${GEMINI_FLASH_MODEL}`,
  };
};

// ── Helper to enrich top matches with openFDA data ──────────
const enrichMatchesWithFda = async (matches) => {
  if (!matches || matches.length === 0) return matches;

  const enriched = await Promise.all(
    matches.map(async (m) => {
      // Only enrich valid matches (skip inconclusive entries)
      if (!m.name || m.name === 'Inconclusive Match' || m.confidence < 0.1) {
        return m;
      }

      try {
        const [label, ndc] = await Promise.all([
          fetchDrugLabel(m.name || m.genericName),
          fetchNdcData(m.name || m.genericName),
        ]);

        return {
          ...m,
          boxedWarning: label?.boxedWarning || null,
          indications: label?.indicationsAndUsage ? label.indicationsAndUsage.slice(0, 180) + '...' : null,
          ndcValidated: !!(ndc?.records && ndc.records.length > 0),
          deaSchedule: ndc?.deaSchedule || null,
          storageWarning: label?.storageAndHandling ? label.storageAndHandling.slice(0, 120) + '...' : null,
        };
      } catch {
        return m;
      }
    })
  );

  return enriched;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Identifies a pill/medication using extracted OCR text.
 *
 * Exclusively uses Gemini 2.5 Flash with GEMINI_API_KEY_2 (isolated from DawaGPT).
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

  try {
    console.log(`[visionService] 🔄 Processing scan with Gemini (${GEMINI_FLASH_MODEL})...`);
    const result = await identifyWithGeminiText(ocrText, patientAge);
    console.log(`[visionService] ✅ Identified via Gemini`);
    return result;
  } catch (err) {
    console.error(`[visionService] ❌ Gemini scan failed:`, err.message);
    if (err.isOperational) throw err;
    throw new AppError(`Scan failed: ${err.message}`, err.status || 502);
  }
};
