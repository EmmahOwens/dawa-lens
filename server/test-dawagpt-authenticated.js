/**
 * test-dawagpt-authenticated.js
 * Authenticates with Firebase using email/password via the REST API,
 * then runs the full DawaGPT diagnostic with a real auth token.
 *
 * Usage:
 *   FIREBASE_API_KEY=xxx TEST_EMAIL=user@example.com TEST_PASSWORD=pass node test-dawagpt-authenticated.js
 *
 * The Firebase API key is the client-side VITE_FIREBASE_API_KEY (not the admin key).
 */

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const BASE_URL = process.env.API_URL || 'https://dawa-lens.onrender.com/api/v1';

if (!FIREBASE_API_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
  console.log('\n⚠️  Missing required env vars. Usage:');
  console.log('   FIREBASE_API_KEY=<your-web-api-key> TEST_EMAIL=<email> TEST_PASSWORD=<password> node test-dawagpt-authenticated.js\n');
  console.log('   FIREBASE_API_KEY is found in .env.local as VITE_FIREBASE_API_KEY');
  process.exit(1);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║       DawaGPT Authenticated Live API Diagnostic              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`\nTarget: ${BASE_URL}`);
console.log(`Email:  ${TEST_EMAIL}`);

// Step 1: Get Firebase ID token
console.log('\n→ Authenticating with Firebase...');
let idToken;
try {
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, returnSecureToken: true }),
    }
  );
  const authData = await authRes.json();
  if (!authRes.ok || !authData.idToken) {
    console.error('❌ Authentication failed:', authData.error?.message || JSON.stringify(authData));
    process.exit(1);
  }
  idToken = authData.idToken;
  console.log('✅ Firebase auth token obtained.\n');
} catch (err) {
  console.error('❌ Firebase auth error:', err.message);
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${idToken}`,
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
      signal: AbortSignal.timeout(35000),
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const txt = await res.text();
      console.log(`❌ HTTP ${res.status} (${elapsed}ms): ${txt.slice(0, 300)}`);
      return { ok: false, status: res.status, body: txt };
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
        if (allText.includes('[DONE]') || allText.length > 8000) break;
      }
      const elapsed2 = Date.now() - start;
      const hasMetadata = allText.includes('###METADATA###');
      const hasDone = allText.includes('[DONE]');
      const hasTroubleMsg = allText.includes('trouble') || allText.includes('unavailable');
      // Extract the text content from SSE events
      const textContent = allText.split('\n')
        .filter(l => l.startsWith('data: ') && !l.includes('[DONE]'))
        .map(l => { try { return JSON.parse(l.slice(6))?.choices?.[0]?.delta?.content || ''; } catch { return ''; } })
        .join('').slice(0, 200);

      if (hasTroubleMsg) {
        console.log(`🟡 Stream returned error message (${elapsed2}ms): ${allText.slice(0, 200)}`);
      } else {
        console.log(`✅ Stream OK (${elapsed2}ms, ${chunks} chunks, metadata=${hasMetadata}, done=${hasDone})`);
      }
      console.log(`     Content: ${textContent}...`);
      return { ok: !hasTroubleMsg, status: 200, stream: allText };
    } else {
      const json = await res.json();
      const elapsed2 = Date.now() - start;
      const hasText = !!(json.text || json.advice || json.healthTip || json.reflection);
      const isErrorText = (json.text || '').includes('unavailable') || (json.text || '').includes('trouble');
      const textPreview = (json.text || json.advice || json.healthTip || JSON.stringify(json)).slice(0, 150);
      if (isErrorText) {
        console.log(`🟡 Got error text (${elapsed2}ms): ${textPreview}`);
      } else {
        console.log(`✅ OK (${elapsed2}ms) | has_text=${hasText}`);
      }
      console.log(`     Preview: ${textPreview}...`);
      return { ok: hasText && !isErrorText, status: 200, json };
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ERROR (${elapsed}ms): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

const results = {};

// ── 2. DawaGPT chat (primary test) ────────────────────────────────────────
console.log('1. DawaGPT Chat Endpoints (Primary):');
results.chatJson = await testEndpoint('POST /ai/chat (JSON)', `${BASE_URL}/ai/chat`, SAMPLE_PAYLOAD, false);
results.chatStream = await testEndpoint('POST /ai/chat/stream (Stream)', `${BASE_URL}/ai/chat/stream`, SAMPLE_PAYLOAD, true);

// ── 3. Other AI endpoints (control group) ─────────────────────────────────
console.log('\n2. Other AI Endpoints (Control Group):');
results.coach = await testEndpoint(
  'POST /ai/coach',
  `${BASE_URL}/ai/coach`,
  { logs: [{ medicineName: 'Panadol', action: 'taken', actionTime: new Date().toISOString() }], medicines: SAMPLE_PAYLOAD.medicines, userName: 'Test' },
  false
);
results.healthDiscoveries = await testEndpoint('POST /ai/health-discoveries', `${BASE_URL}/ai/health-discoveries`, {}, false);
results.mealCheck = await testEndpoint(
  'POST /ai/meal-check',
  `${BASE_URL}/ai/meal-check`,
  { medicines: SAMPLE_PAYLOAD.medicines, mealDescription: 'Matooke and G-nut sauce' },
  false
);

// ── 4. DawaGPT minimal payload ─────────────────────────────────────────────
console.log('\n3. DawaGPT Minimal Payload (rule out large context issues):');
results.chatMinimal = await testEndpoint(
  'POST /ai/chat (minimal)',
  `${BASE_URL}/ai/chat`,
  { messages: [{ role: 'user', text: 'Hello' }], medicines: [], userProfile: null, doseLogs: [], reminders: [] },
  false
);
results.streamMinimal = await testEndpoint(
  'POST /ai/chat/stream (minimal)',
  `${BASE_URL}/ai/chat/stream`,
  { messages: [{ role: 'user', text: 'Hello' }], medicines: [], userProfile: null, doseLogs: [], reminders: [] },
  true
);

// ── 5. Wellness insight (complex AI feature) ───────────────────────────────
console.log('\n4. Wellness Insight (same AI fallback path):');
results.wellnessInsight = await testEndpoint(
  'POST /ai/wellness-insight',
  `${BASE_URL}/ai/wellness-insight`,
  { doseLogs: [], wellnessLogs: [], medicines: SAMPLE_PAYLOAD.medicines },
  false
);

// ── 6. Summary ─────────────────────────────────────────────────────────────
console.log('\n══ RESULTS ══════════════════════════════════════════════════════');
const chatOk = results.chatJson?.ok && results.chatStream?.ok;
const otherOk = results.coach?.ok || results.healthDiscoveries?.ok || results.mealCheck?.ok;

for (const [name, r] of Object.entries(results)) {
  const icon = r?.ok ? '✅' : (r?.status === 200 ? '🟡' : '❌');
  console.log(`  ${icon} ${name}`);
}

console.log('\n══ DIAGNOSIS ════════════════════════════════════════════════════');
if (chatOk && otherOk) {
  console.log('🟢 Everything works. The issue may be client-side (token expiry, CORS, stale cache).');
} else if (!chatOk && otherOk) {
  console.log('🔴 DawaGPT chat fails, but OTHER AI endpoints work.');
  console.log('   → The /ai/chat route has a specific bug. Likely causes:');
  console.log('     1. The DawaGPT system prompt exceeds the model context window');
  console.log('     2. JSON schema validation fails (chatSchema in aiValidation.js)');
  console.log('     3. rateLimitManager queue is saturated only for chat');
  console.log('     4. prepareDawaGPTContext() throws an error');
  console.log('     5. The model used for chat cannot produce JSON (format issue)');
} else if (chatOk && !otherOk) {
  console.log('🟡 DawaGPT works but other AI endpoints fail (unusual).');
} else {
  console.log('🔴 ALL AI endpoints fail with valid auth.');
  console.log('   → API keys on Render are expired/invalid.');
  console.log('   → Update GROQ_API_KEY, GEMINI_API_KEY on render.com');
}
