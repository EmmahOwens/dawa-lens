// server/test-dawagpt-prompts.js
import assert from 'assert';
import {
  chatWithDawaGPT,
  streamChatWithDawaGPT,
  isLikelyActionRequest,
  isComplexTask,
  shouldRetrieveMedicalKnowledge,
  prepareDawaGPTContext,
  sanitizeJson
} from './src/services/aiService.js';

console.log('=== Running DawaGPT User Prompt Response Test Suite ===\n');

async function runPromptTests() {
  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  async function runAsyncTest(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // ─── 1. EMERGENCY PROMPT HANDLING ──────────────────────────────────────────
  console.log('1. Testing Emergency Prompt Responses:');

  await runAsyncTest('Emergency prompt triggers immediate Uganda emergency protocol (JSON mode)', async () => {
    const emergencyPrompts = [
      'I think I took an overdose of paracetamol',
      'My throat is closing up and I can\'t breathe after taking penicillin',
      'Someone swallowed poison and is having a seizure'
    ];

    for (const prompt of emergencyPrompts) {
      const res = await chatWithDawaGPT({
        messages: [{ role: 'user', content: prompt }],
        medicines: [],
        userProfile: { name: 'Amina', gender: 'female' }
      });

      assert.strictEqual(res.source, 'System Safety');
      assert(res.text.includes('EMERGENCY ALERT (Uganda)'), 'Must include Uganda emergency alert header');
      assert(res.text.includes('112'), 'Must list 112 emergency number');
      assert(res.text.includes('0800 100 066'), 'Must list Ministry of Health toll-free hotline');
      assert(Array.isArray(res.suggestions), 'Must provide emergency suggestions');
      assert(res.suggestions.some(s => s.toLowerCase().includes('emergency') || s.toLowerCase().includes('help')));
    }
  });

  await runAsyncTest('Emergency prompt streams valid SSE chunks with double-newline frames', async () => {
    const stream = await streamChatWithDawaGPT({
      messages: [{ role: 'user', content: 'Help, I took an overdose and I feel unconscious' }],
      medicines: [],
      userProfile: { name: 'Kato' }
    });

    let streamOutput = '';
    for await (const chunk of stream) {
      streamOutput += chunk.toString();
    }

    assert(streamOutput.includes('data: '), 'Stream output must be formatted as SSE');
    assert(streamOutput.includes('data: [DONE]\n\n'), 'Stream must terminate with standard SSE double-newline data: [DONE]\n\n');
    assert(streamOutput.includes('EMERGENCY ALERT (Uganda)'), 'Stream text must deliver emergency alert content');
  });

  // ─── 2. ACTION INTENT DETECTION ────────────────────────────────────────────
  console.log('\n2. Testing User Prompt Action Intent Classification:');

  runTest('Identifies reminder creation prompts as action requests', () => {
    const reminderPrompts = [
      'Remind me to take Metformin 500mg daily at 8am',
      'Please add a reminder for Amoxicillin at 08:00 and 20:00',
      'Can you set up an alarm for my blood pressure pill at 9pm?',
      'Schedule a new medication reminder for Paracetamol'
    ];
    for (const p of reminderPrompts) {
      assert.strictEqual(isLikelyActionRequest(p), true, `Should detect action in: "${p}"`);
    }
  });

  runTest('Identifies dose logging prompts as action requests', () => {
    const doseLogPrompts = [
      'I took my morning dose of Panadol',
      'I already took my Metformin tablets',
      'I missed my evening insulin injection',
      'I forgot to take my pills at lunchtime'
    ];
    for (const p of doseLogPrompts) {
      assert.strictEqual(isLikelyActionRequest(p), true, `Should detect dose logging in: "${p}"`);
    }
  });

  runTest('Identifies wellness/symptom check-in prompts as action requests', () => {
    const wellnessPrompts = [
      'I have a terrible headache and feel dizzy',
      'Feeling very tired and exhausted today',
      'Omutwe gunnuma (head hurts)',
      'Olubuto lunnuma (stomach hurts)',
      'Log my mood as feeling great today'
    ];
    for (const p of wellnessPrompts) {
      assert.strictEqual(isLikelyActionRequest(p), true, `Should detect wellness log in: "${p}"`);
    }
  });

  runTest('Identifies inventory refill prompts as action requests', () => {
    const refillPrompts = [
      'I refilled my Coartem to 30 tablets',
      'Restocked Panadol to 60 pills',
      'I just purchased 20 more Metformin capsules'
    ];
    for (const p of refillPrompts) {
      assert.strictEqual(isLikelyActionRequest(p), true, `Should detect refill action in: "${p}"`);
    }
  });

  runTest('Differentiates informational queries from action requests', () => {
    const infoQueries = [
      'What are the side effects of Metformin?',
      'Can I take Paracetamol on an empty stomach?',
      'How does Ibuprofen work?',
      'Tell me about diabetes management in Uganda'
    ];
    for (const p of infoQueries) {
      assert.strictEqual(isLikelyActionRequest(p), false, `Should NOT classify info query as action: "${p}"`);
    }
  });

  // ─── 3. MEDICAL KNOWLEDGE RETRIEVAL INTENT ─────────────────────────────────
  console.log('\n3. Testing Medical Knowledge Retrieval Intent for User Prompts:');

  runTest('Triggers medical retrieval for drug interactions, side effects, and safety queries', () => {
    const medicalPrompts = [
      'Does Metformin interact with Alcohol?',
      'What is the safe dosage of Paracetamol for adults?',
      'Can Ibuprofen cause stomach bleeding?',
      'What should I do if I am allergic to Penicillin?'
    ];
    for (const p of medicalPrompts) {
      assert.strictEqual(shouldRetrieveMedicalKnowledge(p), true, `Should retrieve medical knowledge for: "${p}"`);
    }
  });

  runTest('Skips medical retrieval for greetings and simple app navigation to avoid latency', () => {
    const nonMedicalPrompts = [
      'Hi DawaGPT',
      'Good morning',
      'Oli otya',
      'Show my reminders',
      'Where is the settings page?'
    ];
    for (const p of nonMedicalPrompts) {
      assert.strictEqual(shouldRetrieveMedicalKnowledge(p), false, `Should skip medical retrieval for: "${p}"`);
    }
  });

  // ─── 4. GENDER & CULTURAL CONTEXT RULES IN SYSTEM PROMPT ───────────────────
  console.log('\n4. Testing Cultural Honorifics & Gender Rules in Context Generation:');

  await runAsyncTest('Injects female honorific ("Nyabo") rules when user is female', async () => {
    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'Wasuze otya DawaGPT' }],
      medicines: [],
      userProfile: { name: 'Amina Namubiru', gender: 'female' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const staticPrompt = context.finalMessages[0].content;
    const dynamicContext = context.finalMessages[1].content;

    assert(staticPrompt.includes('"Nyabo" -> "Madam"'), 'System prompt must define Nyabo');
    assert(staticPrompt.includes('If the user/profile is FEMALE: You MUST address them as "Nyabo"'), 'Must enforce Nyabo rule');
    assert(staticPrompt.includes('NEVER call a female/woman "Ssebo"'), 'Must strictly prohibit calling females Ssebo');
    assert(dynamicContext.includes('Gender: female'), 'Dynamic context must specify female gender');
  });

  await runAsyncTest('Injects male honorific ("Ssebo") rules when user is male', async () => {
    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'Oli otya' }],
      medicines: [],
      userProfile: { name: 'John Mukasa', gender: 'male' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const staticPrompt = context.finalMessages[0].content;
    const dynamicContext = context.finalMessages[1].content;

    assert(staticPrompt.includes('"Ssebo" (or "Sebbo") -> "Sir"'), 'System prompt must define Ssebo');
    assert(staticPrompt.includes('If the user/profile is MALE: You MUST address them as "Ssebo"'), 'Must enforce Ssebo rule');
    assert(staticPrompt.includes('NEVER call a male/man "Nyabo"'), 'Must strictly prohibit calling males Nyabo');
    assert(dynamicContext.includes('Gender: male'), 'Dynamic context must specify male gender');
  });

  // ─── 5. MED VAULT CALCULATION ACCURACY IN CONTEXT ──────────────────────────
  console.log('\n5. Testing Med Vault Supply Calculations in Context:');

  await runAsyncTest('Accurately computes Doses Remaining vs Days of Supply for 2x/day medicine', async () => {
    const sampleMedicines = [{
      id: 'med-1',
      name: 'Metformin',
      dosage: '500mg',
      currentQuantity: 30, // 30 tablets
      dosagePerDose: 2 // 2 tablets per dose -> 15 doses
    }];
    const sampleReminders = [{
      id: 'rem-1',
      medicineId: 'med-1',
      medicineName: 'Metformin',
      dose: '2 tablets',
      time: '08:00,20:00', // 2 times a day -> 4 tablets/day -> 7 days of supply
      repeatSchedule: 'custom',
      enabled: true
    }];

    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'How many days of Metformin do I have left?' }],
      medicines: sampleMedicines,
      reminders: sampleReminders,
      userProfile: { name: 'Grace' },
      doseLogs: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const dynamicContext = context.finalMessages[1].content;
    assert(dynamicContext.includes('Metformin'), 'Context must include Metformin');
    assert(dynamicContext.includes('Doses Remaining: 15 doses left'), 'Context must calculate 15 doses remaining (30 / 2)');
    assert(dynamicContext.includes('~7 days of supply left'), 'Context must calculate ~7 days of supply left (30 / 4)');
  });

  // ─── 6. STREAMING SSE DECODER RESILIENCE ────────────────────────────────────
  console.log('\n6. Testing Streaming SSE Delimiter & Metadata Decoder Resilience:');

  runTest('Client decoder correctly parses double-newline SSE frames and extracts metadata', () => {
    const simulatedSSEOutput =
      `data: {"choices":[{"delta":{"content":"You have 7 days of Metformin remaining."}}]}\n\n` +
      `data: {"choices":[{"delta":{"content":"\\n###METADATA###\\n{\\"suggestions\\":[\\"Check stock\\",\\"Log dose\\",\\"View schedule\\"],\\"source\\":\\"DawaGPT\\",\\"action\\":null}"}}]}\n\n` +
      `data: [DONE]\n\n`;

    // Mirroring client decoder in aiAssistantService.ts
    const lines = simulatedSSEOutput.split('\n');
    let accumulatedText = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        const data = JSON.parse(jsonStr);
        accumulatedText += data.choices[0]?.delta?.content || '';
      }
    }

    const delimIdx = accumulatedText.lastIndexOf('###METADATA###');
    assert(delimIdx !== -1, 'Must find METADATA delimiter');
    const visibleText = accumulatedText.substring(0, delimIdx).trim();
    const rawMetadata = accumulatedText.substring(delimIdx + '###METADATA###'.length).trim();
    const metaObj = JSON.parse(sanitizeJson(rawMetadata));

    assert.strictEqual(visibleText, 'You have 7 days of Metformin remaining.');
    assert.strictEqual(metaObj.suggestions.length, 3);
    assert.strictEqual(metaObj.source, 'DawaGPT');
    assert.strictEqual(metaObj.action, null);
  });

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  console.log(`\n============================================================`);
  console.log(`Total Tests Run: ${totalTests} | Passed: ${passedTests} | Failed: ${totalTests - passedTests}`);
  console.log(`============================================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL USER PROMPT AND INTENT TESTS PASSED ACCORDINGLY!\n');
  } else {
    throw new Error(`${totalTests - passedTests} tests failed.`);
  }
}

runPromptTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
