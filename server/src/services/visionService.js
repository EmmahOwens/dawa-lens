import axios from 'axios';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';
import { rateLimitManager } from './rateLimitManager.js';
import { fetchDrugLabel, fetchNdcData } from './openFdaService.js';
import { callAiWithFallback, sanitizeJson } from './aiService.js';

dotenv.config();

// ── API Config ───────────────────────────────────────────────────────────────
const GEMINI_FLASH_MODEL = process.env.GEMINI_SCAN_MODEL || 'gemini-2.5-flash';

const getGeminiApiKeyForScan = () => {
  const key = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AppError('Gemini API key for scanning (GEMINI_API_KEY_2 or GEMINI_API_KEY) is not configured.', 500, 'GEMINI_KEY_MISSING');
  }
  return key;
};

// ── Prompt ───────────────────────────────────────────────────────────────────
const getTextPillIdPrompt = (ocrText) => {
  const hasOcr = Boolean(ocrText && ocrText.trim().length > 0);
  return `You are a pharmaceutical visual identification assistant. Identify candidate medications ${
    hasOcr
      ? 'using BOTH of the following sources in priority order: 1) The attached photo of the medication packaging / blister foil / pill (authoritative: read all visible text directly from it). 2) The on-device OCR text hint (may contain recognition errors or omissions).'
      : 'directly by reading and analyzing all visible brand names, active ingredients, dosage strengths, and imprints from the attached photo of the medication packaging, blister foil, or pill.'
  }

CRITICAL CLINICAL SAFETY RULE: NEVER generate dosage instructions, standard doses, or medication schedules. Dosing advice must be determined exclusively by a licensed prescriber, pharmacist, or from verified physical packaging.

${hasOcr ? `OCR Text (hint only, may be incomplete or garbled):\n"${ocrText}"` : 'Note: On-device OCR was unable to read text on this label; perform direct visual recognition from the attached image.'}

Analyze the photo and OCR text to extract:
1. The candidate brand name(s) or generic active ingredient(s).
2. Any imprints or packaging text extracted.
3. Formulate exactly 5 candidate matches ranked by confidence. If fewer than 5 matches exist, fill the rest with inconclusive entries.
4. For each match, provide an explicit unverifiedNotice reminding the user to verify against the packaging label or with a pharmacist.

Return ONLY valid JSON matching this schema exactly:
{
  "matches": [ // exactly 5 entries ranked by confidence desc
    {
      "name": "brand name",
      "genericName": "active ingredient(s)",
      "confidence": 0.0, // confidence between 0.0 and 1.0
      "safetyFlag": "critical boxed warning or precautionary alert, or empty string",
      "unverifiedNotice": "Visual match unverified. Confirm dosage and instructions from medication packaging or pharmacist."
    }
  ],
  "imprints": ["text on pill surface extracted from OCR or image"],
  "labels": ["text on packaging extracted from OCR or image"],
  "summary": "2-3 sentence visual identification summary: primary clinical indication and regulatory safety warning. Do NOT include dosage instructions."
}`;
};

const getTextFallbackPillIdPrompt = (ocrText, patientAge) => {
  const ageCtx = patientAge ? ` for a patient aged ${patientAge}` : '';
  return `You are a pharmaceutical visual and text identification assistant${ageCtx}. Identify candidate medications strictly from the following OCR text extracted from packaging or pill markings.

CRITICAL CLINICAL SAFETY RULE: NEVER generate dosage instructions, standard doses, or medication schedules. Dosing advice must be determined exclusively by a licensed prescriber, pharmacist, or from verified physical packaging.

OCR Text:
"${ocrText}"

Analyze the OCR text to extract:
1. The candidate brand name(s) or generic active ingredient(s).
2. Any imprints or packaging text extracted.
3. Formulate exactly 5 candidate matches ranked by confidence. If fewer than 5 matches exist, fill the rest with inconclusive entries.
4. For each match, provide an explicit unverifiedNotice reminding the user to verify against the packaging label or with a pharmacist.

Return ONLY valid JSON matching this schema exactly:
{
  "matches": [
    {
      "name": "brand name",
      "genericName": "active ingredient(s)",
      "confidence": 0.0,
      "safetyFlag": "critical boxed warning or precautionary alert, or empty string",
      "unverifiedNotice": "Visual match unverified. Confirm dosage and instructions from medication packaging or pharmacist."
    }
  ],
  "imprints": ["text on pill surface extracted from OCR"],
  "labels": ["text on packaging extracted from OCR"],
  "summary": "2-3 sentence visual identification summary: primary clinical indication and regulatory safety warning. Do NOT include dosage instructions."
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
          safetyFlag:        { type: 'STRING' },
          unverifiedNotice:  { type: 'STRING' },
        },
        required: ['name', 'confidence', 'genericName', 'safetyFlag', 'unverifiedNotice'],
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
 * Validates and normalises the client-provided base64 image for inline
 * multimodal input. Returns null when absent or malformed so the scan can
 * still proceed OCR-text-only.
 */
const toInlineImagePart = (imageBase64) => {
  if (!imageBase64 || typeof imageBase64 !== 'string') return null;
  const data = imageBase64.replace(/^data:image\/\w+;base64,/, '').replace(/\s+/g, '').trim();
  // ~8MB of base64 ≈ 6MB binary — well above the client's 800px/75% JPEG output
  if (data.length < 100 || data.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
    return null;
  }
  return { inline_data: { mime_type: 'image/jpeg', data } };
};

/**
 * Safely parses and repairs JSON returned by AI models.
 * Handles markdown fences, outer commentary, trailing commas, and truncated arrays.
 */
export const safeParsePillIdJson = (raw) => {
  if (!raw || typeof raw !== 'string') return null;

  // 1. Strip markdown fences and whitespace
  const cleaned = sanitizeJson(raw).trim();

  // 2. Direct JSON.parse
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object') {
      if (Array.isArray(direct.matches)) return direct;
      if (direct.name) {
        return {
          matches: [direct],
          imprints: direct.imprints || [],
          labels: direct.labels || [],
          summary: direct.summary || '',
        };
      }
    }
  } catch (_) {
    // Continue to advanced recovery
  }

  // 3. Extract outermost JSON object if model included commentary/prologue/epilogue
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsedExtracted = JSON.parse(extracted);
      if (parsedExtracted && typeof parsedExtracted === 'object') {
        if (Array.isArray(parsedExtracted.matches)) return parsedExtracted;
      }
    } catch (_) {
      // Continue to trailing comma fix
    }
  }

  // 4. Fix trailing commas (e.g. `[ { ... }, ]` or `{ "a": 1, }`)
  const withoutTrailingCommas = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    const parsed = JSON.parse(withoutTrailingCommas);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.matches)) return parsed;
    }
  } catch (_) {
    // Continue to regex recovery
  }

  // 5. Truncated output recovery: extract candidate objects from partial response
  try {
    const matches = [];
    const objectRegex = /\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*\}/g;
    let objMatch;
    while ((objMatch = objectRegex.exec(cleaned)) !== null) {
      const block = objMatch[0];
      const nameMatch = block.match(/"name"\s*:\s*"([^"]+)"/);
      const genericMatch = block.match(/"genericName"\s*:\s*"([^"]*)"/);
      const confMatch = block.match(/"confidence"\s*:\s*([0-9.]+)/);
      const safetyMatch = block.match(/"safetyFlag"\s*:\s*"([^"]*)"/);
      const noticeMatch = block.match(/"unverifiedNotice"\s*:\s*"([^"]*)"/);

      if (nameMatch && nameMatch[1] && nameMatch[1] !== 'Inconclusive Match') {
        matches.push({
          name: nameMatch[1].trim(),
          genericName: genericMatch ? genericMatch[1].trim() : '',
          confidence: confMatch ? (parseFloat(confMatch[1]) || 0.85) : 0.85,
          safetyFlag: safetyMatch ? safetyMatch[1].trim() : '',
          unverifiedNotice: noticeMatch ? noticeMatch[1].trim() : 'Visual match unverified. Confirm dosage and instructions from medication packaging or pharmacist.'
        });
      }
    }

    if (matches.length === 0) {
      const nameRegex = /"name"\s*:\s*"([^"]+)"/g;
      let nm;
      while ((nm = nameRegex.exec(cleaned)) !== null) {
        if (nm[1] && nm[1] !== 'Inconclusive Match') {
          matches.push({
            name: nm[1].trim(),
            genericName: '',
            confidence: 0.9,
            safetyFlag: '',
            unverifiedNotice: 'Visual match unverified. Confirm dosage and instructions from medication packaging or pharmacist.'
          });
        }
      }
    }

    const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]*)/);
    const summary = summaryMatch ? summaryMatch[1] : 'Visual identification completed.';

    if (matches.length > 0) {
      console.warn(`[visionService] ⚠️ Recovered ${matches.length} candidate match(es) from partial AI output.`);
      return {
        matches,
        imprints: [],
        labels: [],
        summary,
      };
    }
  } catch (err) {
    console.warn('[visionService] Regex recovery failed:', err.message);
  }

  return null;
};

/**
 * Normalises and pads the matches array to exactly 5 entries.
 */
const normaliseMatches = (raw) => {
  const matches = (raw || [])
    .map((m) => ({
      name:             String(m.name || 'Unknown'),
      genericName:      String(m.genericName || ''),
      confidence:       Math.min(1, Math.max(0, Number(m.confidence || 0))),
      safetyFlag:       String(m.safetyFlag || ''),
      unverifiedNotice: String(m.unverifiedNotice || 'Visual match unverified. Confirm dosage from medication packaging or pharmacist.'),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  while (matches.length < 5) {
    matches.push({ 
      name: 'Inconclusive Match', 
      genericName: '', 
      confidence: 0.0, 
      safetyFlag: '',
      unverifiedNotice: 'Inconclusive match. Check packaging or consult a pharmacist.'
    });
  }
  return matches;
};

// ── Gemini Text model ────────────────────────────────────────

export const identifyWithGemini = async (ocrText, patientAge, imageBase64) => {
  const apiKey = getGeminiApiKeyForScan();

  // Multimodal request: the photo is the primary identification source, the
  // on-device OCR text is a hint. Falls back to text-only when no valid
  // image arrives (older clients / offline flows).
  const parts = [{ text: getTextPillIdPrompt(ocrText) }];
  const imagePart = toInlineImagePart(imageBase64);
  if (imagePart) {
    parts.push(imagePart);
  }

  const candidateModels = Array.from(new Set([
    GEMINI_FLASH_MODEL,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
  ].filter(Boolean)));

  let response;
  let usedModel = GEMINI_FLASH_MODEL;
  let lastError = null;

  for (const model of candidateModels) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const modelGenConfig = {
      temperature: 0.4,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: PILL_ID_SCHEMA,
    };
    if (model.includes('2.') || model.includes('2.5') || model.includes('flash')) {
      modelGenConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: modelGenConfig,
    };

    const fn = async () => {
      return await axios.post(
        `${apiUrl}?key=${apiKey}`,
        requestBody,
        { timeout: 20000 }
      );
    };

    try {
      // Best rate limiting techniques:
      // - Enqueue under the matching model rate limit config (or 'gemini' fallback)
      const rateLimitKey = rateLimitManager.configs[model] ? model : 'gemini';
      response = await rateLimitManager.enqueue(fn, rateLimitKey, requestBody.contents, 'high', 3, false);
      usedModel = model;
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // If model not found (404) or bad request due to unsupported model name, try next candidate model
      if (status === 404 || (status === 400 && err.response?.data?.error?.message?.toLowerCase().includes('model'))) {
        console.warn(`[visionService] ⚠️ Model ${model} returned HTTP ${status}. Falling back to next candidate model...`);
        continue;
      }
      break;
    }
  }

  if (!response) {
    const genericErr = new Error(`Gemini Text API error: ${lastError?.message || 'Unknown error'}`);
    genericErr.status = lastError?.response?.status;
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

  const parsed = safeParsePillIdJson(rawText);
  if (!parsed || !parsed.matches || !Array.isArray(parsed.matches) || parsed.matches.length === 0) {
    console.error('[visionService] ❌ Failed to parse Gemini response as JSON. Raw preview:', String(rawText).slice(0, 300));
    throw new Error('AI returned malformed data');
  }

  const rawMatches = normaliseMatches(parsed.matches);
  const enrichedMatches = await enrichMatchesWithFda(rawMatches);

  return {
    success: true,
    matches: enrichedMatches,
    imprints: Array.isArray(parsed.imprints) ? parsed.imprints : [],
    labels: Array.isArray(parsed.labels) ? parsed.labels : [],
    summary: parsed.summary || '',
    engine: `${usedModel}`,
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

// ── Fallback: DawaGPT text-based multi-provider cascade ──────

/**
 * Identifies candidate medications using OCR text via DawaGPT's unified
 * multi-provider fallback cascade (Cerebras, Groq, SambaNova, Nvidia NIM, OpenRouter, Mistral, Z.ai).
 *
 * @param {string} ocrText - Extracted OCR text from the medication.
 * @param {number} [patientAge] - Optional patient age for clinical context.
 * @returns {Promise<object>}
 */
export const identifyWithDawaGPT = async (ocrText, patientAge) => {
  const prompt = getTextFallbackPillIdPrompt(ocrText, patientAge);
  const messages = [{ role: 'user', content: prompt }];

  const result = await callAiWithFallback(messages, {
    isJson: true,
    priority: 'high',
    maxTokens: 2048,
    isComplex: true,
  });

  let parsedData = result;
  if (typeof result === 'string') {
    parsedData = safeParsePillIdJson(result) || {};
  } else if (result && !result.matches && typeof result.text === 'string') {
    parsedData = safeParsePillIdJson(result.text) || result;
  }

  const rawMatches = normaliseMatches(parsedData?.matches);
  const enrichedMatches = await enrichMatchesWithFda(rawMatches);

  return {
    success: true,
    matches: enrichedMatches,
    imprints: Array.isArray(parsedData?.imprints) ? parsedData.imprints : [],
    labels: Array.isArray(parsedData?.labels) ? parsedData.labels : [],
    summary: parsedData?.summary || parsedData?.text || '',
    engine: result?.source || 'DawaGPT (API Fallback)',
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Identifies a pill/medication using the captured photo plus extracted OCR text.
 *
 * Primary: Gemini Flash (isolated or shared key) with multimodal support.
 * Fallback: Unified AI API Fallback cascade (DawaGPT multi-provider chain)
 *           when Gemini encounters quota limits, rate limits, or outages
 *           and OCR text is available.
 *
 * @param {string} [image]     - Optional base64 image of the packaging/pill.
 * @param {number} [patientAge] - Optional patient age for dosage context.
 * @param {string} [ocrText]   - Extracted OCR text from the medication.
 * @returns {Promise<object>}
 */
export const identifyPill = async (image, patientAge, ocrText) => {
  const hasText = Boolean(ocrText && ocrText.trim().length > 0);
  const hasImage = Boolean(image && typeof image === 'string' && image.length > 50);

  if (!hasText && !hasImage) {
    throw new AppError(
      'No text or image was detected from the scan. Please try again with a clearer photo of the label.',
      400,
      'NO_INPUT_DETECTED'
    );
  }

  let geminiError = null;

  // ── 1. Primary Engine: Gemini Multimodal / Text ──────────
  try {
    console.log(`[visionService] 🔄 Processing scan with Gemini (${GEMINI_FLASH_MODEL})${hasImage ? ' [multimodal]' : ' [text-only]'}...`);
    const result = await identifyWithGemini(ocrText, patientAge, image);
    console.log(`[visionService] ✅ Identified via Gemini (${result.engine})`);
    return result;
  } catch (err) {
    geminiError = err;
    console.warn(`[visionService] ⚠️ Primary Gemini scan failed: ${err.message}`);
  }

  // ── 2. Resilient API Fallback: DawaGPT Multi-Provider Cascade ──────────
  // When OCR text is available, gracefully cascade to the unified AI API fallback
  if (hasText) {
    try {
      console.log(`[visionService] 🔄 Cascading to unified AI API fallback (DawaGPT multi-provider chain)...`);
      const fallbackResult = await identifyWithDawaGPT(ocrText, patientAge);
      console.log(`[visionService] ✅ Identified via API Fallback (${fallbackResult.engine})`);
      return fallbackResult;
    } catch (fallbackErr) {
      console.error(`[visionService] ❌ Unified AI API fallback cascade also failed:`, fallbackErr.message);
    }
  } else {
    console.warn(`[visionService] ℹ️ Cannot cascade to text-based API fallback because no OCR text was extracted from this image.`);
  }

  // If both primary and fallback failed (or image-only failed with no OCR text)
  if (geminiError?.isOperational) {
    throw geminiError;
  }
  throw new AppError(
    `Scan identification failed: ${geminiError?.message || 'AI services unavailable'}`,
    geminiError?.status || 502
  );
};
