// test-fix-verification.js
import dotenv from 'dotenv';
dotenv.config();

const sanitizeJson = (text) => {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
};

async function runTest() {
  console.log("🚀 Starting DawaGPT Fix Verification Test (Direct API Calls)...");

  const systemInstruction = `
    You are "Dawa-GPT", a premium medical AI assistant integrated into the Dawa-Lens app.
    Regional Context: Uganda / East Africa.

    === RESPONSE FORMAT ===
    Respond STRICTLY in JSON format, with the "text" field containing Markdown-formatted content.
    NEVER append text outside the JSON block.

    Structure:
    {
      "text": "Your markdown response here",
      "suggestions": ["suggestion 1", "2", "3"],
      "source": "Dawa-GPT",
      "action": { "type": "...", "payload": {...} } | null
    }
  `;

  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: "Add a reminder for Paracetamol 500mg at 8am daily" }
  ];

  try {
    // 1. Test Groq (Llama 3.3 70B)
    console.log("\n--- Testing Groq (llama-3.3-70b-versatile) ---");
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        response_format: { type: 'json_object' }
      })
    });
    const groqData = await groqResponse.json();
    if (groqData.error) {
      console.error("Groq Error:", groqData.error);
    } else {
      const groqParsed = JSON.parse(sanitizeJson(groqData.choices[0].message.content));
      console.log("Action Found:", groqParsed.action ? "YES ✅" : "NO ❌");
      console.log("Action Type:", groqParsed.action?.type);
      console.log("Action Payload:", JSON.stringify(groqParsed.action?.payload, null, 2));
    }

    // 2. Test Gemini (2.0 Flash)
    console.log("\n--- Testing Gemini (gemini-2.0-flash) ---");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: "Add a reminder for Paracetamol 500mg at 8am daily" }] }],
        systemInstruction: {
          parts: [{ text: "You are Dawa-Lens AI. Respond STRICTLY in JSON format with 'text', 'suggestions', 'source', and 'action' fields. Use Markdown for formatting in the 'text' field. Agentic capabilities are enabled via the 'action' field." }]
        },
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const geminiData = await geminiResponse.json();
    if (geminiData.error) {
      console.error("Gemini Error:", geminiData.error);
    } else {
      const geminiText = geminiData.candidates[0].content.parts[0].text;
      const geminiParsed = JSON.parse(sanitizeJson(geminiText));
      console.log("Action Found:", geminiParsed.action ? "YES ✅" : "NO ❌");
      console.log("Action Type:", geminiParsed.action?.type);
      console.log("Action Payload:", JSON.stringify(geminiParsed.action?.payload, null, 2));
    }

  } catch (err) {
    console.error("Test Failed with Error:", err);
  }
}

runTest();
