import assert from 'assert';
import axios from 'axios';
import * as visionService from './src/services/visionService.js';
import AppError from './src/utils/AppError.js';

console.log('🧪 Starting Multimodal & Hybrid Vision Scan Tests...');

let interceptedRequestBody = null;
let interceptedUrl = null;

const originalPost = axios.post;
const originalGet = axios.get;

axios.get = async () => ({ data: {} });

let failGemini = false;
let geminiCustomResponse = null;

axios.post = async (url, data, config) => {
  interceptedUrl = url;
  interceptedRequestBody = data;

  if (url.includes('generativelanguage.googleapis.com')) {
    if (failGemini) {
      const err = new Error('Service Unavailable: Gemini overloaded');
      err.response = { status: 503, data: { error: { message: 'Overloaded' } } };
      throw err;
    }

    if (geminiCustomResponse !== null) {
      return {
        data: {
          candidates: [
            {
              content: {
                parts: [{ text: geminiCustomResponse }]
              }
            }
          ]
        }
      };
    }

    return {
      data: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    matches: [
                      {
                        name: 'REVIDOL',
                        genericName: 'Paracetamol',
                        confidence: 0.98,
                        safetyFlag: 'Do not exceed 4g/day',
                        unverifiedNotice: 'Visual match unverified. Confirm with packaging.'
                      },
                      { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' },
                      { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' },
                      { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' },
                      { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' }
                    ],
                    imprints: ['500'],
                    labels: ['PARACETAMOL TABLETS BP 500MG', 'REVIDOL'],
                    summary: 'Revidol contains paracetamol 500mg used for relief of mild to moderate pain and fever.'
                  })
                }
              ]
            }
          }
        ]
      }
    };
  }

  // Handle Groq / Cerebras / fallback providers
  return {
    data: {
      choices: [
        {
          message: {
            content: JSON.stringify({
              matches: [
                {
                  name: 'Amoxicillin',
                  genericName: 'Amoxicillin Trihydrate',
                  confidence: 0.96,
                  safetyFlag: 'Contraindicated in penicillin allergy',
                  unverifiedNotice: 'Visual match unverified. Check packaging.'
                },
                { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' },
                { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' },
                { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' },
                { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Inconclusive' }
              ],
              imprints: ['AMOX 500'],
              labels: ['Amoxicillin Capsules 500mg'],
              summary: 'Broad-spectrum penicillin antibiotic.'
            })
          }
        }
      ]
    }
  };
};

process.env.GEMINI_API_KEY = 'TEST_GEMINI_KEY';
process.env.GROQ_API_KEY = 'TEST_GROQ_KEY';
process.env.NODE_ENV = 'production';

// Valid dummy base64 JPEG data (~120 chars)
const dummyBase64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runTests() {
  // Test 1: Image-only scan (Local OCR yielded no text or failed)
  console.log('\n🔹 Test 1: Multimodal Image-Only Scan (no OCR text)');
  const res1 = await visionService.identifyPill(dummyBase64Image, 35, '');
  assert.ok(res1.success, 'Image-only scan should succeed');
  assert.strictEqual(res1.matches[0].name, 'REVIDOL');
  
  // Verify request body contains inline_data image part
  const parts1 = interceptedRequestBody.contents[0].parts;
  const imagePart = parts1.find(p => p.inline_data);
  assert.ok(imagePart, 'Request to Gemini must contain inline_data image part');
  assert.strictEqual(imagePart.inline_data.mime_type, 'image/jpeg');
  assert.ok(parts1[0].text.includes('direct visual recognition'), 'Prompt should instruct direct visual recognition');
  console.log('✅ Test 1 Passed: Image-only scan properly formats multimodal payload.');

  // Test 2: Hybrid Scan (Both image and OCR text available)
  console.log('\n🔹 Test 2: Hybrid Scan (both image and OCR text available)');
  const res2 = await visionService.identifyPill(dummyBase64Image, 35, 'REVIDOL 500MG');
  assert.ok(res2.success, 'Hybrid scan should succeed');
  const parts2 = interceptedRequestBody.contents[0].parts;
  assert.ok(parts2.some(p => p.inline_data), 'Hybrid request must include image part');
  assert.ok(parts2[0].text.includes('REVIDOL 500MG'), 'Prompt must include OCR text hint');
  console.log('✅ Test 2 Passed: Hybrid scan combines image and OCR text hint.');

  // Test 3: Text-only scan (No image provided)
  console.log('\n🔹 Test 3: Text-Only Scan (no image provided)');
  const res3 = await visionService.identifyPill(null, 35, 'Paracetamol BP 500mg');
  assert.ok(res3.success, 'Text-only scan should succeed');
  const parts3 = interceptedRequestBody.contents[0].parts;
  assert.strictEqual(parts3.some(p => p.inline_data), false, 'Text-only scan should not have inline_data');
  console.log('✅ Test 3 Passed: Text-only scan works as expected.');

  // Test 4: Rejection when both image and OCR text are absent
  console.log('\n🔹 Test 4: Rejection when neither image nor OCR text is provided');
  await assert.rejects(
    async () => {
      await visionService.identifyPill('', 35, '   ');
    },
    (err) => {
      return err instanceof AppError && err.statusCode === 400 && err.code === 'NO_INPUT_DETECTED';
    },
    'Should throw AppError 400 NO_INPUT_DETECTED'
  );
  console.log('✅ Test 4 Passed: Empty scan properly rejected with NO_INPUT_DETECTED.');

  // Test 5: Graceful cascade to Unified AI API Fallback when Gemini fails
  console.log('\n🔹 Test 5: Graceful cascade to API Fallback when Gemini is rate-limited/down');
  failGemini = true;
  const res5 = await visionService.identifyPill(dummyBase64Image, 35, 'Amoxicillin Capsules 500mg');
  assert.ok(res5.success, 'Scan should succeed via API fallback');
  assert.strictEqual(res5.matches[0].name, 'Amoxicillin', 'Should identify Amoxicillin via fallback');
  assert.ok(
    res5.engine.includes('Groq') || res5.engine.includes('Fallback') || res5.engine.includes('DawaGPT'),
    `Engine should indicate fallback provider, got: ${res5.engine}`
  );
  console.log(`✅ Test 5 Passed: Scan cascaded seamlessly to API fallback (${res5.engine}).`);

  // Test 6: Direct invocation of identifyWithDawaGPT
  console.log('\n🔹 Test 6: Direct identifyWithDawaGPT invocation');
  const res6 = await visionService.identifyWithDawaGPT('Amoxicillin 500mg', 30);
  assert.ok(res6.success, 'Direct DawaGPT call should succeed');
  assert.strictEqual(res6.matches[0].name, 'Amoxicillin');
  console.log(`✅ Test 6 Passed: Direct DawaGPT fallback confirmed working.`);

  // Test 7: Truncated/Malformed JSON recovery (e.g. cut off output from Revidol blister scan)
  console.log('\n🔹 Test 7: Resilient recovery from truncated AI response (Revidol blister scan)');
  failGemini = false;
  geminiCustomResponse = '```json\n{"matches": [{"name": "REVIDOL", "genericName": "Paracetamol 500mg", "confidence": 0.99, "safetyFlag": "Do not exceed 4g in 24 hours", "unverifiedNotice": "Check package"}], "summary": "Revidol contains paracetamol used for pain';
  const res7 = await visionService.identifyPill(dummyBase64Image, 35, '');
  assert.ok(res7.success, 'Scan should recover and succeed from truncated JSON');
  assert.strictEqual(res7.matches[0].name, 'REVIDOL');
  assert.strictEqual(res7.matches[0].genericName, 'Paracetamol 500mg');
  assert.strictEqual(res7.matches.length, 5, 'Should normalize to 5 matches');
  console.log('✅ Test 7 Passed: Successfully recovered and parsed candidate matches from truncated output.');
  geminiCustomResponse = null;

  // Reset flag and restore axios
  failGemini = false;
  axios.post = originalPost;
  axios.get = originalGet;

  console.log('\n🎉 ALL MULTIMODAL, HYBRID, API FALLBACK & RECOVERY SCAN TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
