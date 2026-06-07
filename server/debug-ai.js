import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_KEY_2 = process.env.GROQ_API_KEY_2;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function testGroq(key, model) {
  console.log(`Testing Groq with model ${model}...`);
  if (!key) {
    console.log(`❌ No key for ${model}`);
    return;
  }
  try {
    const res = await axios.post(GROQ_API_URL, {
      model: model,
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10
    }, {
      headers: { 'Authorization': `Bearer ${key}` },
      timeout: 10000
    });
    console.log(`✅ Groq ${model} success:`, res.data.choices[0].message.content);
  } catch (err) {
    console.log(`❌ Groq ${model} failed:`, err.response?.data || err.message);
  }
}

async function testCerebras() {
  console.log('Testing Cerebras...');
  if (!CEREBRAS_API_KEY) {
    console.log('❌ No Cerebras key');
    return;
  }
  try {
    const res = await axios.post(CEREBRAS_API_URL, {
      model: 'gpt-oss-120b',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10
    }, {
      headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}` },
      timeout: 10000
    });
    console.log('✅ Cerebras success:', res.data.choices[0].message.content);
  } catch (err) {
    console.log('❌ Cerebras failed:', err.response?.data || err.message);
  }
}

async function testGemini() {
  console.log('Testing Gemini...');
  if (!GEMINI_API_KEY) {
    console.log('❌ No Gemini key');
    return;
  }
  try {
    const res = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: 'Say hello' }] }]
    }, { timeout: 10000 });
    console.log('✅ Gemini success:', res.data.candidates[0].content.parts[0].text);
  } catch (err) {
    console.log('❌ Gemini failed:', err.response?.data || err.message);
  }
}

async function runTests() {
  console.log('Starting AI provider tests...');
  await testGroq(GROQ_API_KEY, 'llama-3.3-70b-versatile');
  await testGroq(GROQ_API_KEY_2 || GROQ_API_KEY, 'llama-3.1-8b-instant');
  await testCerebras();
  await testGemini();
  console.log('Tests finished.');
}

runTests();
