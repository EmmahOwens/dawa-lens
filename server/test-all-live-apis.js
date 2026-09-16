/**
 * test-all-live-apis.js
 * Comprehensive diagnostic script testing all AI features and API fallback behavior
 * using the real live authenticated Firebase token.
 */

const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjY2MmQ3YTBkNGVlZmQzNDMyNjFjYWRkZmZhZWM2MjNkYzZjYTlmZjAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbWVkaWNpbmUtZDNiYTIiLCJhdWQiOiJtZWRpY2luZS1kM2JhMiIsImF1dGhfdGltZSI6MTc4OTU1ODk3NywidXNlcl9pZCI6ImhZUm5MbDRKUkRZUW5hak5zS0g5c0ZYb2c0dDEiLCJzdWIiOiJoWVJuTGw0SlJEWVFuYWpOc0tIOXNGWG9nNHQxIiwiaWF0IjoxNzg5NTU4OTc3LCJleHAiOjE3ODk1NjI1NzcsImVtYWlsIjoidGVzdF9kaWFnbm9zdGljc18xMjM0NUBkYXdhbGVucy5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdF9kaWFnbm9zdGljc18xMjM0NUBkYXdhbGVucy5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.myDt_EmH1W2spxGzsBM9opebpmrdlN-JYqanAdhlAIppM8TTWbxH9480mHWssz2JM1MgQYsasgZQrHr3hGnmCXPgMia1Xk2f9Q1v0ggtCKBOf1pzUlQo6Jd9bSy4WoWnyeZA1l6JRxz4r7EGdCCFIlQ0PbCFC14l3_I9alEc78fisuRxOMfBM5wHMs3lTLtwWDPejKAUYVzTgOYgrT4udzbz_jxhyiHWWHsm3OUH-p0NEau2IQ80ngjSQBuHyduz6B1eLeBVzGen37ygkZinyX_TodUz5TqDzh_RMJp4l3TNJ3ZamFxvBoEcfIYL9cjMv754YZoP4_Ggg-aUf1Ad2Q";
const BASE_URL = "https://dawa-lens.onrender.com/api/v1";

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${TOKEN}`,
};

const SAMPLE_MEDS = [
  { id: "m1", name: "Panadol", genericName: "Paracetamol", dosage: "500mg", currentQuantity: 20, dosagePerDose: 1, unit: "tablets", frequencyPerDay: 2 }
];

async function testEndpoint(name, path, payload, isStream = false) {
  const start = Date.now();
  process.stdout.write(`\n🔍 Testing [${name}] (${path})...\n`);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000),
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const errTxt = await res.text();
      console.log(`  ❌ HTTP ${res.status} (${elapsed}ms): ${errTxt.slice(0, 300)}`);
      return { name, path, status: "FAIL", httpStatus: res.status, elapsed, error: errTxt };
    }

    if (isStream) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let allChunks = "";
      let chunkCount = 0;
      let detectedSource = "Unknown";
      let isFallback = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        allChunks += chunk;
        chunkCount++;
      }

      if (allChunks.includes("MoH Safety Protocol") || allChunks.includes("Schedule Guard") || allChunks.includes("Adherence Guard")) {
        isFallback = true;
        detectedSource = "Hardcoded Clinical Fallback";
      } else if (allChunks.includes("openai/gpt-oss") || allChunks.includes("llama-3")) {
        detectedSource = "Groq Live Stream";
      } else if (allChunks.includes("AI Fallback") || allChunks.includes("Gemini")) {
        detectedSource = "Gemini / AI Fallback";
      }

      const preview = allChunks.slice(0, 300).replace(/\n/g, " ");
      console.log(`  ✅ Stream completed (${elapsed}ms, ${chunkCount} chunks)`);
      console.log(`     Detected Source: ${detectedSource} ${isFallback ? "⚠️ (HARDCODED FALLBACK)" : "✨ (REAL LLM)"}`);
      console.log(`     Preview: ${preview.slice(0, 150)}...`);
      return { name, path, status: "OK", elapsed, source: detectedSource, isFallback, preview };
    } else {
      const data = await res.json();
      const source = data.source || data.model || (data.advice ? "Adherence Coach" : "AI API");
      const preview = JSON.stringify(data).slice(0, 200);
      console.log(`  ✅ OK (${elapsed}ms)`);
      console.log(`     Source: ${source}`);
      console.log(`     Preview: ${preview}...`);
      return { name, path, status: "OK", elapsed, source, preview };
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`  ❌ ERROR (${elapsed}ms): ${err.message}`);
    return { name, path, status: "ERROR", elapsed, error: err.message };
  }
}

async function runAll() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   DAWA-LENS LIVE PRODUCTION AI ENDPOINT DIAGNOSTIC SUITE     ");
  console.log("═══════════════════════════════════════════════════════════════");

  const results = [];

  // 1. DawaGPT Non-Streaming
  results.push(await testEndpoint("DawaGPT (JSON / Non-Streaming)", "/ai/chat", {
    messages: [{ role: "user", text: "What is the recommended dosage of Panadol for an adult?" }],
    medicines: SAMPLE_MEDS,
    userProfile: { name: "Sarah", gender: "female" }
  }));

  // 2. DawaGPT Streaming (Simple Query)
  results.push(await testEndpoint("DawaGPT Stream (Simple Query)", "/ai/chat/stream", {
    messages: [{ role: "user", text: "Tell me about Panadol side effects" }],
    medicines: SAMPLE_MEDS,
    userProfile: { name: "Sarah", gender: "female" }
  }, true));

  // 3. Health Discoveries
  results.push(await testEndpoint("Health Discoveries", "/ai/health-discoveries", {}));

  // 4. Meal Safety Check
  results.push(await testEndpoint("Meal Safety Checker", "/ai/meal-check", {
    medicines: SAMPLE_MEDS,
    mealDescription: "A bowl of Matooke with groundnut sauce and a cup of black tea"
  }));

  // 5. Adherence Coach
  results.push(await testEndpoint("Adherence Coach", "/ai/coach", {
    medicines: SAMPLE_MEDS,
    userName: "Sarah",
    logs: [
      { medicineName: "Panadol", action: "taken", actionTime: "2026-09-16 08:00" },
      { medicineName: "Panadol", action: "missed", actionTime: "2026-09-15 20:00" }
    ]
  }));

  // 6. Wellness Pattern Insight
  results.push(await testEndpoint("Wellness Pattern Insight", "/ai/wellness-insight", {
    medicines: SAMPLE_MEDS,
    wellnessLogs: [{ mood: 3, energy: 4, symptoms: ["mild headache"], timestamp: "2026-09-16 09:00" }],
    doseLogs: [{ medicineName: "Panadol", action: "taken", actionTime: "2026-09-16 08:00" }]
  }));

  // 7. Nutritional Guidance
  results.push(await testEndpoint("Nutritional Guidance", "/ai/nutritional-guidance", {
    medicines: SAMPLE_MEDS
  }));

  // 8. Emotion Reflection
  results.push(await testEndpoint("Emotion Reflection", "/ai/emotion-reflection", {
    mood: 2,
    energy: 2,
    symptoms: ["tired", "stress"],
    medicines: SAMPLE_MEDS
  }));

  // 9. Holistic Safety
  results.push(await testEndpoint("Holistic Safety Engine", "/ai/holistic-safety", {
    medicines: SAMPLE_MEDS,
    lifestyleFactors: ["Alcohol", "Late nights"]
  }));

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                    DIAGNOSTIC SUMMARY TABLE                   ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.table(results.map(r => ({
    Feature: r.name,
    Path: r.path,
    Status: r.status,
    Latency: `${r.elapsed}ms`,
    Source: r.source || (r.error ? "Error" : "OK")
  })));
}

runAll();
