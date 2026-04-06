import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// The Gemini model to use — gemini-2.0-flash is free with AI Studio key (no billing needed)
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Strict prompt that instructs Gemini to act as a pharmaceutical vision model
 * and return results in the exact JSON shape our frontend expects.
 */
const PILL_ID_PROMPT = `You are a pharmaceutical AI assistant integrated into Dawa Lens, a medication safety app.
Analyze the provided image of a medication (pill, tablet, capsule, blister pack, or packaging).

Your task:
1. Identify the medication name(s) visible or identifiable in the image.
2. Extract any text, imprints, or markings on the pill or package.
3. Assign a confidence score (0.0 to 1.0) for each match based on how clear and identifiable the medication is.
4. List general descriptive labels for the image (e.g. "tablet", "capsule", "blister pack", "white pill").

IMPORTANT: Respond ONLY with a valid JSON object matching this exact structure (no markdown, no explanation):
{
  "matches": [
    { "name": "Full Drug Name (e.g. Paracetamol 500mg)", "genericName": "generic name if known", "confidence": 0.95 }
  ],
  "imprints": ["any text/numbers found on the pill, e.g. M30, TYLENOL"],
  "labels": ["tablet", "white", "round"],
  "summary": "Brief one-sentence description of what you see"
}

Rules:
- If you cannot identify any medication clearly, return an empty matches array but still return imprints and labels.
- Confidence above 0.8 means very clear identification; 0.5-0.8 means probable; below 0.5 means uncertain.
- Return at most 5 matches, ordered by confidence descending.
- Do not fabricate drug names. If uncertain, lower the confidence score.
- Always return valid JSON only.`;

// POST /api/vision/pill-id
router.post('/pill-id', async (req, res) => {
  const { image } = req.body; // base64 string (with or without data:image prefix)

  if (!image) {
    return res.status(400).json({ error: 'No image data provided', code: 'NO_IMAGE' });
  }

  if (!GEMINI_API_KEY) {
    console.error('[Vision] GEMINI_API_KEY not set in server/.env');
    return res.status(500).json({
      error: 'Gemini API key not configured. Add GEMINI_API_KEY to server/.env (get one free at https://aistudio.google.com).',
      code: 'API_KEY_MISSING',
    });
  }

  // Strip the data URI prefix if present — Gemini needs raw base64
  const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');

  // Detect MIME type from the prefix (default to jpeg)
  const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  try {
    const requestBody = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: cleanBase64,
              },
            },
            {
              text: PILL_ID_PROMPT,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,       // Low temperature for consistent, factual responses
        maxOutputTokens: 1024,
        responseMimeType: 'application/json', // Force JSON output
      },
    };

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody,
      { timeout: 30000 } // 30s timeout
    );

    // Extract the generated text from Gemini's response
    const candidate = response.data?.candidates?.[0];
    if (!candidate) {
      return res.status(500).json({ error: 'No response from Gemini API', code: 'EMPTY_RESPONSE' });
    }

    // Check for safety blocks
    if (candidate.finishReason === 'SAFETY') {
      return res.status(422).json({
        error: 'Image was blocked by Gemini safety filters. Please try a clearer photo.',
        code: 'SAFETY_BLOCKED',
      });
    }

    const rawText = candidate.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ error: 'Empty content from Gemini', code: 'EMPTY_CONTENT' });
    }

    // Parse the JSON response from Gemini
    let parsed;
    try {
      // Strip any accidental markdown code fences if present
      const jsonText = rawText.replace(/```(?:json)?\n?/g, '').trim();
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('[Vision] Failed to parse Gemini JSON:', rawText);
      return res.status(500).json({
        error: 'Gemini returned non-JSON response. Please try again.',
        code: 'PARSE_ERROR',
      });
    }

    // Normalize and validate the response structure
    const matches = (parsed.matches || [])
      .filter(m => m && m.name)
      .map(m => ({
        name: m.name,
        genericName: m.genericName || '',
        confidence: typeof m.confidence === 'number' ? Math.min(1, Math.max(0, m.confidence)) : 0.5,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    const imprints = (parsed.imprints || []).filter(Boolean).slice(0, 10);
    const labels = (parsed.labels || []).filter(Boolean).slice(0, 10);

    console.log(`[Vision] Gemini identified ${matches.length} match(es) for uploaded image.`);

    res.json({
      success: true,
      matches,
      imprints,
      labels,
      summary: parsed.summary || '',
      engine: 'gemini-2.0-flash', // lets the frontend know which engine was used
    });

  } catch (error) {
    const status = error.response?.status;
    const apiError = error.response?.data?.error;
    console.error('[Vision] Gemini API Error:', apiError || error.message);

    if (status === 400) {
      return res.status(400).json({
        error: 'Invalid request to Gemini API. The image may be corrupt or too large.',
        code: 'INVALID_REQUEST',
      });
    }

    if (status === 401 || status === 403) {
      return res.status(403).json({
        error: 'Invalid or expired Gemini API key. Check GEMINI_API_KEY in server/.env.',
        code: 'INVALID_API_KEY',
        fixUrl: 'https://aistudio.google.com/app/apikey',
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: 'Gemini API rate limit reached. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
      });
    }

    res.status(500).json({
      error: 'Failed to process image with Gemini Vision AI.',
      code: 'VISION_ERROR',
    });
  }
});

export default router;
