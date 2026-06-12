/**
 * Standalone Cerebras API key diagnostic script.
 * Tests: key validity, model availability, and a simple completion.
 * 
 * Usage: node test-cerebras-key.js
 *   - Uses .env if present (local dev)
 *   - Or pass CEREBRAS_API_KEY=... node test-cerebras-key.js
 */
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_MODELS_URL = 'https://api.cerebras.ai/v1/models';

console.log('═══════════════════════════════════════════');
console.log('  Cerebras API Key Diagnostic');
console.log('═══════════════════════════════════════════');
console.log();

// Step 1: Check if key exists
if (!CEREBRAS_API_KEY) {
  console.log('❌ CEREBRAS_API_KEY is NOT SET in environment.');
  console.log('   → Make sure it is set in your Render dashboard env vars');
  console.log('   → Or create a local .env with: CEREBRAS_API_KEY=csk-...');
  process.exit(1);
}

console.log(`✅ Key found: ${CEREBRAS_API_KEY.substring(0, 8)}...${CEREBRAS_API_KEY.slice(-4)} (${CEREBRAS_API_KEY.length} chars)`);
console.log();

// Step 2: List available models
async function listModels() {
  console.log('── Step 2: Listing available models ──');
  try {
    const res = await axios.get(CEREBRAS_MODELS_URL, {
      headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}` },
      timeout: 10000,
    });
    const models = res.data?.data || res.data?.models || res.data;
    if (Array.isArray(models)) {
      console.log(`✅ Found ${models.length} model(s):`);
      models.forEach(m => {
        console.log(`   • ${m.id || m.name || JSON.stringify(m)}`);
      });
      return models;
    } else {
      console.log('⚠️  Unexpected response format:', JSON.stringify(res.data).substring(0, 300));
      return [];
    }
  } catch (err) {
    console.log('❌ Failed to list models:', err.response?.status, err.response?.data || err.message);
    return null;
  }
}

// Step 3: Test chat completion with the current model
async function testChat(modelId) {
  console.log();
  console.log(`── Step 3: Testing chat completion with model "${modelId}" ──`);
  try {
    const start = Date.now();
    const res = await axios.post(CEREBRAS_API_URL, {
      model: modelId,
      messages: [{ role: 'user', content: 'Say "Hello, Cerebras is working!" in exactly those words.' }],
      max_tokens: 30,
      temperature: 0,
    }, {
      headers: {
        'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const elapsed = Date.now() - start;
    const content = res.data?.choices?.[0]?.message?.content;
    const usage = res.data?.usage;

    console.log(`✅ Chat completion SUCCESS (${elapsed}ms)`);
    console.log(`   Response: "${content}"`);
    if (usage) {
      console.log(`   Tokens used — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`);
    }
    console.log(`   Full response ID: ${res.data?.id || 'N/A'}`);
    return true;
  } catch (err) {
    console.log(`❌ Chat completion FAILED for model "${modelId}"`);
    console.log(`   Status: ${err.response?.status || 'N/A'}`);
    console.log(`   Error: ${JSON.stringify(err.response?.data || err.message)}`);
    
    if (err.response?.status === 401) {
      console.log('   → Your API key is INVALID or EXPIRED. Regenerate it at https://cloud.cerebras.ai/');
    } else if (err.response?.status === 404 || err.response?.status === 400) {
      console.log(`   → The model "${modelId}" may not exist or is deprecated.`);
      console.log('   → Check the model list above for valid model IDs.');
    } else if (err.response?.status === 429) {
      console.log('   → Rate limited. Your key works but you hit usage limits.');
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.log('   → Network error. Cannot reach Cerebras API.');
    }
    return false;
  }
}

// Step 4: Test JSON mode (how your app actually uses it)
async function testJsonMode(modelId) {
  console.log();
  console.log(`── Step 4: Testing JSON mode with model "${modelId}" ──`);
  try {
    const res = await axios.post(CEREBRAS_API_URL, {
      model: modelId,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond in JSON format with a "greeting" field.' },
        { role: 'user', content: 'Say hello' }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 50,
      temperature: 0,
    }, {
      headers: {
        'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const content = res.data?.choices?.[0]?.message?.content;
    console.log(`✅ JSON mode SUCCESS`);
    console.log(`   Raw: ${content}`);
    try {
      const parsed = JSON.parse(content);
      console.log(`   Parsed: ${JSON.stringify(parsed)}`);
    } catch {
      console.log(`   ⚠️ Response is not valid JSON — may cause issues in your app`);
    }
    return true;
  } catch (err) {
    console.log(`❌ JSON mode FAILED: ${err.response?.status || ''} ${JSON.stringify(err.response?.data || err.message)}`);
    return false;
  }
}

// Run all tests
async function run() {
  const models = await listModels();
  console.log();

  const currentModel = 'gpt-oss-120b';
  
  // Check if current model exists in the model list
  if (models && Array.isArray(models)) {
    const found = models.find(m => (m.id || m.name) === currentModel);
    if (!found) {
      console.log(`⚠️  WARNING: Your configured model "${currentModel}" was NOT found in the available models list!`);
      console.log(`   This is likely why Cerebras calls fail silently and fall through to Groq/Gemini.`);
      console.log();
    } else {
      console.log(`✅ Model "${currentModel}" is available.`);
      console.log();
    }
  }

  // Test with the model your app uses
  const chatOk = await testChat(currentModel);
  
  // If that fails, try with a known-good model
  if (!chatOk && models && Array.isArray(models) && models.length > 0) {
    const fallbackModel = (models[0].id || models[0].name);
    if (fallbackModel !== currentModel) {
      console.log();
      console.log(`── Retrying with first available model "${fallbackModel}" ──`);
      const retryOk = await testChat(fallbackModel);
      if (retryOk) {
        console.log();
        console.log(`💡 FIX: Update CEREBRAS_MODEL in aiService.js from "${currentModel}" to "${fallbackModel}"`);
      }
    }
  }

  if (chatOk) {
    await testJsonMode(currentModel);
  }

  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('  Diagnostic complete');
  console.log('═══════════════════════════════════════════');
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
