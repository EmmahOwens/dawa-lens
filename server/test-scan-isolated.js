import axios from 'axios';
import assert from 'assert';
import * as visionService from './src/services/visionService.js';
import { rateLimitManager } from './src/services/rateLimitManager.js';
import AppError from './src/utils/AppError.js';

// Mock axios.post to intercept the requests
let lastRequestUrl = null;
let lastRequestBody = null;

const originalPost = axios.post;
const originalGet = axios.get;

// Mock axios.get to avoid real external openFDA / rxNorm network calls in isolated unit test
axios.get = async () => ({
  data: {}
});

axios.post = async (url, data, config) => {
  lastRequestUrl = url;
  lastRequestBody = data;
  
  // Return mock successful scan analysis response matching PILL_ID_SCHEMA
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
                      name: 'Paracetamol',
                      genericName: 'Acetaminophen',
                      confidence: 0.95,
                      safetyFlag: 'Do not exceed 4g/day',
                      unverifiedNotice: 'Visual match unverified. Confirm dosage from medication packaging or pharmacist.'
                    },
                    { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Visual match unverified.' },
                    { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Visual match unverified.' },
                    { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Visual match unverified.' },
                    { name: 'Inconclusive Match', genericName: '', confidence: 0.0, safetyFlag: '', unverifiedNotice: 'Visual match unverified.' }
                  ],
                  imprints: ['500'],
                  labels: ['Paracetamol 500mg Tablets'],
                  summary: 'Analgesic and antipyretic for pain and fever relief.'
                })
              }
            ]
          },
          usageMetadata: {
            totalTokenCount: 150
          }
        }
      ]
    }
  };
};

async function testScanIsolation() {
  console.log('🧪 Running Scan Isolation & Key Verification Tests...');

  const expectedModel = process.env.GEMINI_SCAN_MODEL || 'gemini-2.5-flash';

  // Reset rate limit manager stats for clean test runs
  rateLimitManager.counters[expectedModel] = { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 };
  rateLimitManager.cooldownUntil[expectedModel] = 0;

  // --- Test Case 1: Primary usage of GEMINI_API_KEY_2 ---
  console.log(`\n🔹 Test Case 1: Scanning uses GEMINI_API_KEY_2 and ${expectedModel} model`);
  process.env.GEMINI_API_KEY_2 = 'TEST_KEY_2_VAL';
  process.env.GEMINI_API_KEY = 'TEST_KEY_1_VAL';
  process.env.NODE_ENV = 'production';

  const result1 = await visionService.identifyPill(null, 30, 'Paracetamol 500mg');
  
  assert.ok(result1.success, 'Scan should return success');
  assert.strictEqual(result1.engine, expectedModel, `Engine should be ${expectedModel}`);
  assert.ok(lastRequestUrl.includes(expectedModel), `API URL should target ${expectedModel}`);
  assert.ok(lastRequestUrl.includes('key=TEST_KEY_2_VAL'), 'API URL should authenticate with GEMINI_API_KEY_2');
  console.log('✅ Test Case 1 Passed! Correct model and key used.');

  // --- Test Case 2: Fallback to GEMINI_API_KEY in non-production environments ---
  console.log('\n🔹 Test Case 2: Fallback to GEMINI_API_KEY in development when GEMINI_API_KEY_2 is missing');
  delete process.env.GEMINI_API_KEY_2;
  process.env.GEMINI_API_KEY = 'TEST_KEY_1_VAL';
  process.env.NODE_ENV = 'development';

  const result2 = await visionService.identifyPill(null, 30, 'Paracetamol 500mg');
  
  assert.ok(result2.success, 'Scan should succeed using fallback key');
  assert.ok(lastRequestUrl.includes('key=TEST_KEY_1_VAL'), 'API URL should use GEMINI_API_KEY in development');
  console.log('✅ Test Case 2 Passed! Development fallback verified.');

  // --- Test Case 3: Strictly block scan if key is missing in production ---
  console.log('\n🔹 Test Case 3: Throws error in production if GEMINI_API_KEY_2 is missing');
  delete process.env.GEMINI_API_KEY_2;
  process.env.GEMINI_API_KEY = 'TEST_KEY_1_VAL';
  process.env.NODE_ENV = 'production';

  await assert.rejects(
    async () => {
      await visionService.identifyPill(null, 30, 'Paracetamol 500mg');
    },
    (err) => {
      return err instanceof AppError && err.statusCode === 500 && err.code === 'GEMINI_KEY_2_MISSING';
    },
    'Should throw AppError when scan key is missing in production'
  );
  console.log('✅ Test Case 3 Passed! Production key requirements enforced.');

  // --- Test Case 4: Rate limit manager integration ---
  console.log('\n🔹 Test Case 4: Rate Limit Manager Integration and Config verification');
  const config = rateLimitManager.configs[expectedModel];
  assert.ok(config, `Rate Limit configs should contain ${expectedModel}`);
  assert.strictEqual(config.rpm, 10, 'RPM limit should be 10');
  assert.strictEqual(config.rpd, 1500, 'RPD limit should be 1500');
  
  const stats = rateLimitManager.getStats();
  assert.ok(stats.counters[expectedModel], `Counters should track ${expectedModel} requests`);
  console.log('✅ Test Case 4 Passed! Rate limit configuration and counter tracking validated.');

  // Restore original axios methods
  axios.post = originalPost;
  axios.get = originalGet;
  
  console.log('\n🎉 All scan isolation tests passed successfully!');
}

testScanIsolation().catch(err => {
  console.error('❌ Tests failed:', err);
  process.exit(1);
});
