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

axios.post = async (url, data, config) => {
  interceptedUrl = url;
  interceptedRequestBody = data;

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
};

process.env.GEMINI_API_KEY = 'TEST_GEMINI_KEY';
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

  // Restore axios
  axios.post = originalPost;
  axios.get = originalGet;

  console.log('\n🎉 ALL MULTIMODAL & HYBRID VISION SCAN TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
