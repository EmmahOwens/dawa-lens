/**
 * test-dawagpt-live.js
 * Live diagnostic: Tests DawaGPT stream & non-stream endpoints against Render,
 * plus all other AI endpoints, to isolate where the failure is.
 *
 * Usage: node test-dawagpt-live.js <firebase-id-token>
 *   OR:  node test-dawagpt-live.js  (runs local server tests without auth)
 */

import { createInterface } from 'readline';

const BASE_URL = process.env.API_URL || 'https://dawa-lens.onrender.com/api/v1';
const TOKEN = process.argv[2] || null;

const headers = {
  'Content-Type': 'application/json',
  ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
};

const SAMPLE_PAYLOAD = {
  messages: [{ role: 'user', text: 'What are the side effects of Panadol?' }],
  medicines: [{ id: 'm1', name: 'Panadol', genericName: 'Paracetamol', dosage: '500mg', currentQuantity: 20, dosagePerDose: 1, unit: 'tablets', frequencyPerDay: 3 }],
  userProfile: { id: 'test-user', name: 'Test User', gender: 'male' },
  doseLogs: [],
  reminders: [{ id: 'r1', medicineName: 'Panadol', dose: '500mg', time: '08:00', repeatSchedule: 'daily', enabled: true }],
  wellnessLogs: [],
  vitalitySummary: [],
  patients: [],
  selectedPatientId: null,
  currentPage: '/medications',
};

async function testEndpoint(name, url, body, expectStream = false) {
  const start = Date.now();
  process.stdout.write(`  → ${name} ... `);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const txt = await res.text();
      console.log(`❌ HTTP ${res.status} (${elapsed}ms): ${txt.slice(0, 200)}`);
      return false;
    }

    if (expectStream) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let allText = '';
      let chunks = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        allText += decoder.decode(value, { stream: true });
        chunks++;
        if (allText.includes('[DONE]') || allText.length > 5000) break;
      }
      const elapsed2 = Date.now() - start;
      const hasMetadata = allText.includes('###METADATA###');
      const hasDone = allText.includes('[DONE]');
      const preview = allText.replace(/data: /g, '').slice(0, 150).replace(/\n/g, ' ');
      console.log(`✅ Stream OK (${elapsed2}ms, ${chunks} chunks, metadata=${hasMetadata}, done=${hasDone})`);
      console.log(`     Preview: ${preview}...`);
      return true;
    } else {
      const json = await res.json();
      const elapsed2 = Date.now() - start;
      const hasText = !!(json.text || json.advice || json.healthTip || json.reflection || json.message);
      const textPreview = (json.text || json.advice || json.healthTip || JSON.stringify(json)).slice(0, 120);
      console.log(`✅ OK (${elapsed2}ms) | has_text=${hasText}`);
      console.log(`     Preview: ${textPreview}...`);
      return true;
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ERROR (${elapsed}ms): ${err.message}`);
    return false;
  }
}

async function testGetEndpoint(name, url) {
  const start = Date.now();
  process.stdout.write(`  → ${name} ... `);
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    const elapsed = Date.now() - start;
    const txt = await res.text();
    if (res.ok) {
      console.log(`✅ OK (${elapsed}ms): ${txt.slice(0, 80)}`);
    } else {
      console.log(`❌ HTTP ${res.status} (${elapsed}ms): ${txt.slice(0, 150)}`);
    }
    return res.ok;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ERROR (${elapsed}ms): ${err.message}`);
    return false;
  }
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║          DawaGPT Live API Diagnostic Test Suite              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`\nTarget: ${BASE_URL}`);
console.log(`Auth:   ${TOKEN ? '✅ Token provided' : '⚠️  No token — auth-protected endpoints will return 401'}`);
console.log('');

const results = {};

// ── 1. Server health check ─────────────────────────────────────────────────
console.log('1. Server Reachability');
results.health = await testGetEndpoint('GET /api/v1/health (or root)', BASE_URL.replace('/api/v1', '') + '/');

// ── 2. DawaGPT endpoints ───────────────────────────────────────────────────
console.log('\n2. DawaGPT Chat Endpoints (Primary Test)');
results.chatJson = await testEndpoint(
  'POST /ai/chat (JSON mode)',
  `${BASE_URL}/ai/chat`,
  SAMPLE_PAYLOAD,
  false
);
results.chatStream = await testEndpoint(
  'POST /ai/chat/stream (Streaming mode)',
  `${BASE_URL}/ai/chat/stream`,
  SAMPLE_PAYLOAD,
  true
);

// ── 3. Other AI endpoints (to confirm API keys work) ──────────────────────
console.log('\n3. Other AI Endpoints (control group — should work if keys are valid)');
results.coach = await testEndpoint(
  'POST /ai/coach (adherence coach)',
  `${BASE_URL}/ai/coach`,
  { logs: [{ medicineName: 'Panadol', action: 'taken', actionTime: new Date().toISOString() }], medicines: SAMPLE_PAYLOAD.medicines, userName: 'Test' },
  false
);
results.healthDiscoveries = await testEndpoint(
  'POST /ai/health-discoveries',
  `${BASE_URL}/ai/health-discoveries`,
  {},
  false
);
results.mealCheck = await testEndpoint(
  'POST /ai/meal-check',
  `${BASE_URL}/ai/meal-check`,
  { medicines: SAMPLE_PAYLOAD.medicines, mealDescription: 'Matooke and G-nut sauce' },
  false
);
results.wellnessInsight = await testEndpoint(
  'POST /ai/wellness-insight',
  `${BASE_URL}/ai/wellness-insight`,
  { doseLogs: [], wellnessLogs: [], medicines: SAMPLE_PAYLOAD.medicines },
  false
);

// ── 4. DawaGPT with minimal payload (rule out tokenBudgetGuard) ───────────
console.log('\n4. DawaGPT with Minimal Payload (rules out payload-size issues)');
results.chatMinimal = await testEndpoint(
  'POST /ai/chat (minimal payload)',
  `${BASE_URL}/ai/chat`,
  { messages: [{ role: 'user', text: 'hello' }], medicines: [], userProfile: null, doseLogs: [], reminders: [] },
  false
);
results.streamMinimal = await testEndpoint(
  'POST /ai/chat/stream (minimal payload)',
  `${BASE_URL}/ai/chat/stream`,
  { messages: [{ role: 'user', text: 'hello' }], medicines: [], userProfile: null, doseLogs: [], reminders: [] },
  true
);

// ── 5. Summary ─────────────────────────────────────────────────────────────
console.log('\n══ RESULTS SUMMARY ══════════════════════════════════════════════');
const total = Object.keys(results).length;
const passed = Object.values(results).filter(Boolean).length;
for (const [name, ok] of Object.entries(results)) {
  console.log(`  ${ok ? '✅' : '❌'} ${name}`);
}
console.log(`\n  ${passed}/${total} endpoints passed\n`);

if (!results.chatJson && !results.chatStream) {
  console.log('🔴 DIAGNOSIS: Both DawaGPT chat endpoints are failing.');
  if (results.coach || results.healthDiscoveries) {
    console.log('   Other AI endpoints work → API keys are valid.');
    console.log('   The issue is SPECIFIC to the /ai/chat and /ai/chat/stream routes.');
    console.log('   Likely causes: system prompt too large for context window, JSON schema issue,');
    console.log('   or rateLimitManager.enqueue() blocking the chat queue specifically.');
  } else {
    console.log('   Other AI endpoints also fail → API keys are expired/invalid on Render.');
    console.log('   Action: Update GROQ_API_KEY, GEMINI_API_KEY etc. in Render environment.');
  }
} else if (results.chatJson && !results.chatStream) {
  console.log('🟡 DIAGNOSIS: JSON chat works but STREAMING is broken.');
  console.log('   Likely cause: Nginx/proxy buffering or streaming response format issue on Render.');
  console.log('   The frontend should be switched to use non-streaming /ai/chat for now.');
} else if (!results.chatJson && results.chatStream) {
  console.log('🟡 DIAGNOSIS: Streaming works but JSON chat is broken (unusual).');
} else if (results.chatJson && results.chatStream) {
  console.log('🟢 Both DawaGPT endpoints work from here.');
  console.log('   The issue may be client-side auth token expiry or CORS.');
}
