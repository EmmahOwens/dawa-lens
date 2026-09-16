/**
 * test-dawagpt-unit-direct.js
 * Runs inside the server environment (with dotenv loaded) to directly test
 * prepareDawaGPTContext, chatWithDawaGPT, and streamChatWithDawaGPT
 * without any HTTP layer or auth requirements.
 *
 * Run from server/ dir: node test-dawagpt-unit-direct.js
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║          DawaGPT Direct Unit Test (No Auth Required)         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ── Check which API keys are set ────────────────────────────────────────────
console.log('── API Key Status ──────────────────────────────────────────────');
const keyChecks = {
  'GROQ_API_KEY':        process.env.GROQ_API_KEY,
  'GROQ_API_KEY_2':      process.env.GROQ_API_KEY_2,
  'GEMINI_API_KEY':      process.env.GEMINI_API_KEY,
  'CEREBRAS_API_KEY':    process.env.CEREBRAS_API_KEY,
  'SAMBANOVA_API_KEY':   process.env.SAMBACLOUD_API_KEY || process.env.SAMBANOVA_API_KEY,
  'NVIDIA_API_KEY':      process.env.NVIDIA_API || process.env.NVIDIA_NIM_API_KEY,
  'OPENROUTER_API_KEY':  process.env.OPENROUTER_API_KEY,
  'MISTRAL_API_KEY':     process.env.MISTRAL_API_KEY,
  'SILICONFLOW_API_KEY': process.env.SILICONFLOW_API || process.env.SILICONFLOW_API_KEY,
  'Z_AI_API_KEY':        process.env.Z_AI_API_KEY,
  'VOYAGEAI_API':        process.env.VOYAGEAI_API,
};

let configuredCount = 0;
for (const [name, val] of Object.entries(keyChecks)) {
  const isSet = !!val && val.length > 10;
  if (isSet) configuredCount++;
  console.log(`  ${isSet ? '✅' : '❌'} ${name}: ${isSet ? `${val.slice(0, 8)}...` : 'NOT SET'}`);
}
console.log(`\n  ${configuredCount}/${Object.keys(keyChecks).length} keys configured\n`);

if (configuredCount === 0) {
  console.log('⚠️  No API keys found. Create server/.env from server/.env.example and add your keys.');
  console.log('   This test must be run from the server/ directory with a valid .env file.\n');
  process.exit(0);
}

// ── Import services ─────────────────────────────────────────────────────────
console.log('── Importing Services ──────────────────────────────────────────');
let chatWithDawaGPT, streamChatWithDawaGPT, prepareDawaGPTContext, 
    isComplexTask, isLikelyActionRequest, callAiWithFallback, shouldRetrieveMedicalKnowledge;

try {
  const mod = await import('./src/services/aiService.js');
  chatWithDawaGPT = mod.chatWithDawaGPT;
  streamChatWithDawaGPT = mod.streamChatWithDawaGPT;
  prepareDawaGPTContext = mod.prepareDawaGPTContext;
  isComplexTask = mod.isComplexTask;
  isLikelyActionRequest = mod.isLikelyActionRequest;
  callAiWithFallback = mod.callAiWithFallback;
  shouldRetrieveMedicalKnowledge = mod.shouldRetrieveMedicalKnowledge;
  console.log('  ✅ aiService.js loaded\n');
} catch (err) {
  console.error('  ❌ Failed to import aiService.js:', err.message);
  console.error('     This likely means Firebase Admin SDK credentials are missing.');
  console.error('     Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to server/.env\n');
  process.exit(1);
}

const SAMPLE_PARAMS = {
  messages: [{ role: 'user', text: 'What are the side effects of Panadol?' }],
  medicines: [{ id: 'm1', name: 'Panadol', genericName: 'Paracetamol', dosage: '500mg', currentQuantity: 20, dosagePerDose: 1, unit: 'tablets', frequencyPerDay: 3 }],
  userProfile: { id: 'u1', name: 'Test User', gender: 'male' },
  doseLogs: [],
  reminders: [],
  wellnessLogs: [],
  vitalitySummary: [],
  patients: [],
  selectedPatientId: null,
  currentPage: '/medications',
};

// ── Test 1: isComplexTask / isLikelyActionRequest ────────────────────────────
console.log('── Test 1: Classifier Functions ────────────────────────────────');
const testQuery = 'What are the side effects of Panadol?';
console.log(`  Query: "${testQuery}"`);
console.log(`  isComplexTask: ${isComplexTask(testQuery)}`);
console.log(`  isLikelyActionRequest: ${isLikelyActionRequest(testQuery)}`);
console.log(`  shouldRetrieveMedicalKnowledge: ${shouldRetrieveMedicalKnowledge(testQuery)}\n`);

// ── Test 2: prepareDawaGPTContext ────────────────────────────────────────────
console.log('── Test 2: prepareDawaGPTContext ───────────────────────────────');
try {
  const start = Date.now();
  const { finalMessages } = await prepareDawaGPTContext({
    ...SAMPLE_PARAMS,
    isComplex: true,
    isStreaming: true,
  });
  const elapsed = Date.now() - start;
  const totalChars = finalMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estTokens = Math.round(totalChars / 3.7);
  console.log(`  ✅ Context built in ${elapsed}ms`);
  console.log(`  Message count: ${finalMessages.length}`);
  console.log(`  Total chars: ${totalChars.toLocaleString()} (~${estTokens.toLocaleString()} tokens)`);
  finalMessages.forEach((m, i) => {
    console.log(`  [${i}] role=${m.role}, length=${m.content?.length || 0} chars`);
  });
  if (estTokens > 30000) {
    console.log(`  ⚠️  Context is VERY LARGE (${estTokens} tokens). This may cause 413/context-limit errors.`);
  }
} catch (err) {
  console.log(`  ❌ prepareDawaGPTContext failed: ${err.message}`);
}
console.log();

// ── Test 3: callAiWithFallback directly (same as other features) ─────────────
console.log('── Test 3: callAiWithFallback (same path as other AI features) ─');
try {
  const start = Date.now();
  const result = await callAiWithFallback(
    [
      { role: 'system', content: 'You are a helpful assistant. Reply with {"text":"...","suggestions":[]}' },
      { role: 'user', content: 'What is Panadol used for? Reply in JSON.' }
    ],
    { isJson: true, priority: 'high', maxTokens: 512, isComplex: false }
  );
  const elapsed = Date.now() - start;
  console.log(`  ✅ callAiWithFallback succeeded (${elapsed}ms)`);
  const preview = JSON.stringify(result).slice(0, 200);
  console.log(`  Result: ${preview}...`);
} catch (err) {
  console.log(`  ❌ callAiWithFallback FAILED: ${err.message}`);
}
console.log();

// ── Test 4: chatWithDawaGPT (full JSON mode) ──────────────────────────────────
console.log('── Test 4: chatWithDawaGPT (JSON mode — same as /ai/chat) ──────');
try {
  const start = Date.now();
  const result = await chatWithDawaGPT(SAMPLE_PARAMS);
  const elapsed = Date.now() - start;
  const isRealAI = result.source !== 'DawaGPT' && result.source !== 'System' && !result.text?.includes('unavailable');
  const isBackendFallback = result.source === 'DawaGPT' || result.source === 'MoH Safety Protocol' || result.source === 'Clinical Safety';
  console.log(`  ${isRealAI ? '✅' : (isBackendFallback ? '🟡' : '✅')} chatWithDawaGPT completed (${elapsed}ms)`);
  console.log(`  Source: ${result.source}`);
  console.log(`  Text preview: ${(result.text || '').slice(0, 200)}...`);
  if (isBackendFallback) {
    console.log(`  ⚠️  Got backend clinical FALLBACK (hardcoded) response, not a real LLM response!`);
    console.log(`       This means ALL AI providers failed for chatWithDawaGPT specifically.`);
  }
} catch (err) {
  console.log(`  ❌ chatWithDawaGPT FAILED: ${err.message}`);
}
console.log();

// ── Test 5: streamChatWithDawaGPT ────────────────────────────────────────────
console.log('── Test 5: streamChatWithDawaGPT ───────────────────────────────');
try {
  const start = Date.now();
  const stream = await streamChatWithDawaGPT(SAMPLE_PARAMS);
  
  // Read the stream
  let allData = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => { allData += chunk.toString(); });
    stream.on('end', resolve);
    stream.on('error', reject);
    setTimeout(() => resolve(), 30000); // max 30s
  });
  
  const elapsed = Date.now() - start;
  const hasMetadata = allData.includes('###METADATA###');
  const hasDone = allData.includes('[DONE]');
  const isBackendFallback = allData.includes('Oli otya') || allData.includes('I am DawaGPT') || 
                             allData.includes('check your pill stock') || allData.includes('MoH Safety Protocol');
  
  // Extract text content
  const textContent = allData.split('\n')
    .filter(l => l.startsWith('data: ') && !l.includes('[DONE]'))
    .map(l => { try { return JSON.parse(l.slice(6))?.choices?.[0]?.delta?.content || ''; } catch { return l.slice(6, 50); } })
    .join('').slice(0, 300);

  console.log(`  ${isBackendFallback ? '🟡' : '✅'} streamChatWithDawaGPT completed (${elapsed}ms)`);
  console.log(`  Has metadata: ${hasMetadata}, Has [DONE]: ${hasDone}`);
  console.log(`  Stream content: ${textContent}...`);
  if (isBackendFallback) {
    console.log(`  ⚠️  Got backend clinical FALLBACK (hardcoded) response!`);
    console.log(`       All ${11} streaming providers failed. The stream fell through to generateBackendClinicalFallback().`);
  }
} catch (err) {
  console.log(`  ❌ streamChatWithDawaGPT FAILED: ${err.message}`);
}

console.log('\n══ Done ════════════════════════════════════════════════════════');
