import { rateLimitManager } from './services/rateLimitManager.js';

async function runVisionTests() {
  console.log("🧪 Starting Vision Rate Limit & Token Estimation Tests...");

  // 1. Test image token estimation
  console.log("\n--- Test 1: Image Token Estimation ---");
  
  const textPromptOnly = "Identify this pill";
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // dummy 1x1 png base64
  
  const messagesOpenAI = [
    {
      role: 'user',
      content: [
        { type: 'text', text: textPromptOnly },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } }
      ]
    }
  ];

  const messagesGemini = [
    {
      parts: [
        { inline_data: { mime_type: 'image/png', data: base64Image } },
        { text: textPromptOnly }
      ]
    }
  ];

  const textTokens = rateLimitManager.estimateTokens(textPromptOnly);
  const openAiTokens = rateLimitManager.estimateTokens(messagesOpenAI);
  const geminiTokens = rateLimitManager.estimateTokens(messagesGemini);

  console.log(`Text-only tokens estimated: ${textTokens}`);
  console.log(`OpenAI format (text + base64 image) tokens estimated: ${openAiTokens}`);
  console.log(`Gemini format (text + base64 image) tokens estimated: ${geminiTokens}`);

  // Checks
  if (openAiTokens < 10000 && geminiTokens < 10000) {
    console.log("✅ Token estimator successfully ignored raw base64 string length and applied image weight!");
  } else {
    console.error("❌ Token estimator failed. It counted the base64 string directly as characters.");
  }

  // 2. Test queuing with vision limits
  console.log("\n--- Test 2: Vision Model Queuing & Head-of-Line Blocking Resolution ---");
  
  // Set extremely small limits to trigger queue throttling
  rateLimitManager.configs['groq-scout'] = { rpm: 1, tpm: 1500, rpd: 10, tpd: 50000 };
  rateLimitManager.configs['gemini-pro'] = { rpm: 5, tpm: 10000, rpd: 50, tpd: 100000 };
  rateLimitManager.counters['groq-scout'] = { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 };
  rateLimitManager.counters['gemini-pro'] = { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 };
  rateLimitManager.cooldownUntil['groq-scout'] = 0;
  rateLimitManager.cooldownUntil['gemini-pro'] = 0;

  const orderOfCompletion = [];

  const runTask = async (name, modelKey, priority) => {
    await rateLimitManager.enqueue(async () => {
      // Simulate API latency
      await new Promise(r => setTimeout(r, 100));
      return { usage: { total_tokens: 100 } };
    }, modelKey, "hello image prompt", priority);
    orderOfCompletion.push(name);
  };

  // Enqueue Task 1 for Groq Scout (High Priority) - will execute immediately
  const p1 = runTask('Task1-GroqScout', 'groq-scout', 'high');
  
  // Wait slightly to ensure Task 1 started and reserved budget
  await new Promise(r => setTimeout(r, 30));

  // Enqueue Task 2 for Groq Scout (High Priority) - will be throttled since groq-scout RPM is 1
  const p2 = runTask('Task2-GroqScout', 'groq-scout', 'high');
  
  // Enqueue Task 3 for Gemini Pro (High Priority) - should execute immediately even though Task 2 is queued!
  const p3 = runTask('Task3-GeminiPro', 'gemini-pro', 'high');

  // Wait for p1 and p3 to complete (Task 3 should finish before Task 2 because of Head-of-Line blocking resolution!)
  await Promise.all([p1, p3]);

  console.log("Tasks completed so far (expecting Task1 first, then Task3):", orderOfCompletion);
  
  if (orderOfCompletion.includes('Task3-GeminiPro') && !orderOfCompletion.includes('Task2-GroqScout')) {
    console.log("✅ Queue processed Gemini Pro task while Groq Scout was throttled. Head-of-Line Blocking Resolved!");
  } else {
    console.error("❌ Head-of-Line blocking occurred. Gemini Pro task was delayed by the throttled Groq task.");
  }

  // Simulate time passing to let Task 2 finish
  console.log("Simulating reset for Groq Scout...");
  rateLimitManager.lastMinuteReset['groq-scout'] = Date.now() - 61000;
  
  await p2;
  console.log("Final completion list:", orderOfCompletion);

  console.log("\n🎉 All vision queue tests completed!");
}

runVisionTests().catch(console.error);
