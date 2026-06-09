import { chatWithDawaGPT } from './src/services/aiService.js';

(async () => {
  console.log("🚀 Testing long output for DawaGPT...");
  try {
    const res = await chatWithDawaGPT({
      messages: [{ role: 'user', text: 'Please write a very detailed medical guide (at least 500 words) about malaria prevention and treatment in Uganda. Include specific regional context, cultural considerations, and common myths.' }],
      medicines: [],
      userProfile: { name: 'Test User', id: 'test-123' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      patients: [],
      selectedPatientId: 'test-123'
    });

    console.log("✅ SUCCESS!");
    console.log("Source:", res.source);
    console.log("Output Length (chars):", res.text.length);
    console.log("Output Length (approx words):", res.text.split(/\s+/).length);

    if (res.text.length > 2000) {
      console.log("🌟 VERIFIED: Large output received.");
    } else {
      console.warn("⚠️ WARNING: Output might still be short.");
    }

    // Check if it's valid JSON (DawaGPT non-streaming returns JSON)
    if (res.suggestions && res.text) {
        console.log("✅ JSON Structure is valid.");
    }

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    if (err.response) {
      console.error("DATA:", err.response.data);
    }
  }
})();
