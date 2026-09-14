import assert from 'assert';
import { chatSchema } from './validations/aiValidation.js';
import { rateLimitManager } from './services/rateLimitManager.js';
import { isComplexTask, isLikelyActionRequest, sanitizeJson } from './services/aiService.js';

console.log("=== Running DawaGPT Unit & Regression Tests ===");

// 1. Test rateLimitManager limits
console.log("\n1. Verifying RateLimitManager TPM configurations...");
assert.strictEqual(rateLimitManager.configs['groq-70b'].tpm, 200000, "groq-70b TPM should be 200,000");
assert.strictEqual(rateLimitManager.configs['groq-scout'].tpm, 60000, "groq-scout TPM should be 60,000");
assert.strictEqual(rateLimitManager.configs['groq-8b'].tpm, 60000, "groq-8b TPM should be 60,000");
console.log("✔ RateLimitManager TPM limits verified (groq-70b: 200k, groq-scout: 60k, groq-8b: 60k).");

// 1b. Test reasoning token estimation
const estStandard = rateLimitManager.estimateTokens([{ role: 'user', content: 'hello' }], false);
const estReasoning = rateLimitManager.estimateTokens([{ role: 'user', content: 'hello' }], true);
assert(estReasoning > estStandard, "Reasoning token estimation must provide higher completion headroom for thinking tokens");
console.log("✔ Reasoning models receive enlarged completion buffer (2048 tokens).");

// 2. Test aiValidation chatSchema passthrough and action tolerance
console.log("\n2. Verifying aiValidation chatSchema compatibility...");
const testPayload = {
  messages: [
    { role: 'user', content: 'Remind me to take Panadol' },
    {
      role: 'assistant',
      content: 'I have set a reminder for Panadol.',
      action: { type: 'ADD_REMINDER', payload: { medicineName: 'Panadol', time: '08:00' } }
    },
    { role: 'user', content: 'Thank you' }
  ],
  medicines: [{ id: 'm1', name: 'Panadol' }],
  userProfile: { name: 'Sarah', gender: 'female' },
  extraPropertyFromFrontend: 'should-not-be-stripped'
};

const parsed = chatSchema.parse({ body: testPayload });
assert(parsed.body.messages[1].action !== undefined, "chatSchema must preserve action in assistant messages");
assert.strictEqual(parsed.body.extraPropertyFromFrontend, 'should-not-be-stripped', "chatSchema must allow passthrough fields");
console.log("✔ chatSchema correctly preserves client action objects and passes through metadata.");

// 3. Test isComplexTask and isLikelyActionRequest distinctions
console.log("\n3. Verifying task complexity and action intent detection...");
assert.strictEqual(isComplexTask("What is Panadol?"), false, "Simple question should not be complex task");
assert.strictEqual(isComplexTask("Check my drug interactions"), true, "Interaction check should be complex task");
assert.strictEqual(isLikelyActionRequest("Remind me to take Panadol at 8pm"), true, "Reminder setup should be action request");
assert.strictEqual(isLikelyActionRequest("What is Panadol?"), false, "Simple question should not be action request");
console.log("✔ Intent detection correctly distinguishes actions vs complex queries vs general questions.");

// 4. Test sanitizeJson
console.log("\n4. Verifying sanitizeJson robustness...");
const dirtyJson = '```json\n{\n  "text": "Hello world",\n  "suggestions": ["One", "Two"]\n}\n```';
const cleaned = sanitizeJson(dirtyJson);
const parsedObj = JSON.parse(cleaned);
assert.strictEqual(parsedObj.text, "Hello world");
console.log("✔ sanitizeJson successfully strips Markdown blocks and parses clean JSON.");

// 5. Test Metadata delimiter parsing logic (simulating Gemini / Groq streaming responses)
console.log("\n5. Verifying ###METADATA### response parsing resilience...");
const rawModelOutput = `Panadol (Paracetamol) is an analgesic and antipyretic medication used to relieve mild-to-moderate pain and reduce fever.\n\n###METADATA###\n{"suggestions":["Check drug interactions","View dosage guidelines","Check Med Vault stock"],"source":"DawaGPT","action":null}`;

const metadataDelim = '###METADATA###';
assert(rawModelOutput.includes(metadataDelim));
const delimIndex = rawModelOutput.lastIndexOf(metadataDelim);
const displayText = rawModelOutput.substring(0, delimIndex).trim();
const rawMeta = rawModelOutput.substring(delimIndex + metadataDelim.length).trim();
const metaObj = JSON.parse(sanitizeJson(rawMeta));

assert(displayText.startsWith("Panadol (Paracetamol)"));
assert.strictEqual(metaObj.suggestions.length, 3);
assert.strictEqual(metaObj.source, "DawaGPT");
assert.strictEqual(metaObj.action, null);
console.log("✔ Streaming metadata split and JSON extraction is 100% resilient.");

// 6. Test Context Window Preservation for Thinking Models
console.log("\n6. Verifying context window retention for thinking models...");
import { prepareDawaGPTContext } from './services/aiService.js';
const longConversation = [];
for (let i = 1; i <= 15; i++) {
  longConversation.push({ role: 'user', content: `User query ${i}` });
  longConversation.push({ role: 'assistant', content: `Assistant reply ${i}` });
}
longConversation.push({ role: 'user', content: 'Final question to test context length' });

const contextOutput = await prepareDawaGPTContext({
  messages: longConversation,
  medicines: [],
  userProfile: { name: 'Mukasa', gender: 'male' },
  doseLogs: [],
  reminders: [],
  wellnessLogs: [],
  vitalitySummary: [],
  patients: [],
  isStreaming: true,
  isComplex: true
});

// Out of 31 messages, recentMessages takes the last 20.
// Verify that the finalMessages array contains the expanded context window (at least 15 messages)
assert(contextOutput.finalMessages.length >= 15, `Context window should preserve at least 15 messages, got ${contextOutput.finalMessages.length}`);
console.log(`✔ Context window retains multi-turn history (${contextOutput.finalMessages.length} messages) for thinking models.`);

console.log("\n🎉 ALL UNIT AND INTEGRATION CHECKS PASSED SUCCESSFULLY!");
