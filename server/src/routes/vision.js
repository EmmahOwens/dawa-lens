import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// The Gemini model to use — gemini-2.0-flash is free with AI Studio key (no billing needed)
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const getPillIdPrompt = (patientAge) => {
  let ageContext = "standard adult";
  if (patientAge) {
    ageContext = `specifically for a patient aged ${patientAge}`;
  }

  return `You are a pharmaceutical AI assistant integrated into Dawa Lens, a medication safety app.
Analyze the provided image of a medication (pill, tablet, capsule, blister pack, prescription label, or pharmaceutical packaging).

Your task:
1. Identify the medication name(s) visible or identifiable. This could be from imprints on a pill or text on the package.
2. Extract any text, imprints, or markings on the pill or package.
3. Assign a confidence score (0.0 to 1.0) for each match.
4. List descriptive labels for the image (e.g. "white circular tablet", "blue capsule", "blister pack").
5. Suggest a 'recommendedDosage' ${ageContext} according to standard medical guidelines. If age is unknown, provide a standard adult dosage.

Rules:
- ALWAYS return exactly 5 potential medication matches. 
- If you find fewer than 5 likely matches, fill the remaining slots with the next most visually similar medications and set their confidence to 0.0, naming them "Inconclusive Match".
- Sort matches by confidence in descending order.
- Confidence > 0.8: certain; 0.5-0.8: probable; < 0.5: uncertain.
- Do not fabricate drug names for high-confidence matches.
- Respond ONLY with valid JSON.`;
};

// POST /api/vision/pill-id
router.post('/pill-id', async (req, res) => {
  const { image, patientAge } = req.body; // base64 string (with or without data:image prefix)

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
              text: getPillIdPrompt(patientAge),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,       // Slight increase to allow alternative matches if unsure
        maxOutputTokens: 1024,
        responseMimeType: 'application/json', // Force JSON output
        responseSchema: {
          type: "OBJECT",
          properties: {
            matches: {
              type: "ARRAY",
              description: "Must contain exactly 5 potential medication matches.",
              minItems: 5,
              maxItems: 5,
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", description: "The commercial or generic name of the medication." },
                  genericName: { type: "STRING", description: "The active ingredient(s)." },
                  confidence: { type: "NUMBER", description: "Match confidence from 0.0 to 1.0." },
                  recommendedDosage: { type: "STRING", description: "Suggested dosage based on patient age context." }
                },
                required: ["name", "confidence", "genericName", "recommendedDosage"]
              }
            },
            imprints: { type: "ARRAY", items: { type: "STRING" } },
            labels: { type: "ARRAY", items: { type: "STRING" } },
            summary: { type: "STRING", description: "A brief 1-2 sentence overview of the identification results." }
          },
          required: ["matches", "summary", "imprints", "labels"]
        }
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
      // Robust extraction: find the first { and last }
      const startIdx = rawText.indexOf('{');
      const endIdx = rawText.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1) {
        throw new Error('No JSON object found in response');
      }
      const jsonText = rawText.substring(startIdx, endIdx + 1);
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('[Vision] Failed to parse Gemini JSON:', rawText);
      return res.status(500).json({
        error: 'The AI service returned an unreadable response. Please try scanning again.',
        code: 'PARSE_ERROR',
        raw: process.env.NODE_ENV === 'development' ? rawText : undefined
      });
    }

    // Normalize and validate the response structure
    let matches = Array.isArray(parsed.matches) ? parsed.matches : [];
    
    matches = matches
      .filter(m => m && typeof m === 'object' && m.name)
      .map(m => ({
        name: String(m.name || 'Unknown Medication'),
        genericName: String(m.genericName || ''),
        confidence: typeof m.confidence === 'number' ? Math.min(1, Math.max(0, m.confidence)) : 0.0,
        recommendedDosage: String(m.recommendedDosage || ''),
      }))
      .sort((a, b) => b.confidence - a.confidence);

    // Fallback/Padding: Ensure exactly 5 matches
    while (matches.length < 5) {
      matches.push({
        name: "Inconclusive Match",
        genericName: "",
        confidence: 0.0,
        recommendedDosage: ""
      });
    }
    
    // Final slice to ensure exactly 5 in case Gemini returned more
    matches = matches.slice(0, 5);

    const imprints = Array.isArray(parsed.imprints) ? parsed.imprints.filter(i => typeof i === 'string').slice(0, 10) : [];
    const labels = Array.isArray(parsed.labels) ? parsed.labels.filter(l => typeof l === 'string').slice(0, 10) : [];

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
