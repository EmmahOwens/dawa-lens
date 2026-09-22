// server/test-dawagpt-responses-comprehensive.js
import assert from 'assert';
import {
  chatWithDawaGPT,
  streamChatWithDawaGPT,
  prepareDawaGPTContext,
  sanitizeJson
} from './src/services/aiService.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Comprehensive DawaGPT End-to-End Prompt Response Verification');
console.log('═══════════════════════════════════════════════════════════════\n');

async function runComprehensiveTests() {
  let passed = 0;
  let total = 0;

  async function testCase(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASSED] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAILED] ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // 1. Emergency prompt (Overdose / Acute Poisoning)
  await testCase('1. Emergency Prompt: Overdose triggers instant Uganda safety protocol with emergency hotlines', async () => {
    const res = await chatWithDawaGPT({
      messages: [{ role: 'user', content: 'I swallowed too many sleeping pills and I am feeling dizzy and faint' }],
      medicines: [],
      userProfile: { name: 'Amina', gender: 'female' }
    });

    assert.strictEqual(res.source, 'System Safety');
    assert(res.text.includes('EMERGENCY ALERT (Uganda)'), 'Must display Uganda emergency alert');
    assert(res.text.includes('112'), 'Must include 112 emergency hotline');
    assert(res.text.includes('0800 100 066'), 'Must include Ministry of Health toll-free hotline');
    assert(res.suggestions.length >= 2, 'Must include quick emergency suggestions');
  });

  // 2. Cultural Greeting & Gender Salutation (Female Profile)
  await testCase('2. Cultural Greeting: Female profile receives "Nyabo" honorific and strict non-misgendering', async () => {
    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'Wasuze otya DawaGPT' }],
      medicines: [{ name: 'Panadol', dosage: '500mg' }],
      userProfile: { name: 'Sarah Babirye', gender: 'female' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const systemPrompt = context.systemInstruction || context.finalMessages[0].content;

    assert(systemPrompt.includes('If the user/profile is FEMALE: You MUST address them as "Nyabo"'));
    assert(systemPrompt.includes('NEVER call a female/woman "Ssebo"'));
    assert(systemPrompt.includes('Gender: female'));
  });

  // 3. Cultural Greeting & Gender Salutation (Male Profile)
  await testCase('3. Cultural Greeting: Male profile receives "Ssebo" honorific and strict non-misgendering', async () => {
    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'Oli otya DawaGPT' }],
      medicines: [{ name: 'Metformin', dosage: '500mg' }],
      userProfile: { name: 'David Kato', gender: 'male' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const systemPrompt = context.systemInstruction || context.finalMessages[0].content;

    assert(systemPrompt.includes('If the user/profile is MALE: You MUST address them as "Ssebo"'));
    assert(systemPrompt.includes('NEVER call a male/man "Nyabo"'));
    assert(systemPrompt.includes('Gender: male'));
  });

  // 4. Med Vault Calculation Accuracy (Doses vs Days of Supply)
  await testCase('4. Med Vault Math: Distinguishes between 15 doses remaining and 7 days of supply for 2x/day medicine', async () => {
    const medicines = [{
      id: 'med-1',
      name: 'Metformin',
      dosage: '500mg',
      currentQuantity: 30, // 30 tablets
      dosagePerDose: 2 // 2 tablets per dose -> 15 doses
    }];
    const reminders = [{
      id: 'rem-1',
      medicineId: 'med-1',
      medicineName: 'Metformin',
      dose: '2 tablets',
      time: '08:00,20:00', // 2 times a day -> 4 tablets/day -> 7.5 -> ~7 days of supply
      repeatSchedule: 'custom',
      enabled: true
    }];

    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'How long will my Metformin last?' }],
      medicines,
      reminders,
      userProfile: { name: 'Grace' },
      doseLogs: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const systemPrompt = context.systemInstruction || context.finalMessages[0].content;
    assert(systemPrompt.includes('Doses left: 15'));
    assert(systemPrompt.includes('~7 days left'));
  });

  // 5. Food Interaction Knowledge (Ugandan Food Context)
  await testCase('5. Food Interaction Context: Contains Ugandan local food interactions (Coartem with G-nut sauce, Mukene calcium)', async () => {
    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'Can I take Coartem with G-nut sauce and Matooke?' }],
      medicines: [{ name: 'Coartem', dosage: '20/120mg' }],
      userProfile: { name: 'Ivan' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const staticPrompt = context.finalMessages[0].content;
    assert(staticPrompt.includes('Matooke'), 'Must contain Matooke context');
    assert(staticPrompt.includes('G-nut Sauce'), 'Must contain G-nut Sauce context');
    assert(staticPrompt.includes('Mukene'), 'Must contain Mukene context');
    assert(staticPrompt.includes('Coartem'), 'Must contain Coartem absorption advice with fat-containing meals');
  });

  // 6. Action Intent Generation Rules
  await testCase('6. Action Generation Rules: Mandatory action payload format and strict prohibition of hallucinated promises', async () => {
    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'Remind me to take Panadol 500mg at 08:00 and 20:00' }],
      medicines: [],
      userProfile: { name: 'Amina' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const staticPrompt = context.finalMessages[0].content;
    assert(staticPrompt.includes('PERFORM ACTIONS IMMEDIATELY'));
    assert(staticPrompt.includes('NEVER LIE / CRITICAL ACTION RULE') || staticPrompt.includes('NEVER LIE ABOUT ACTIONS'));
    assert(staticPrompt.includes('ADD_REMINDER'));
    assert(staticPrompt.includes('LOG_DOSE'));
    assert(staticPrompt.includes('LOG_WELLNESS'));
  });

  // 7. Streaming Protocol & SSE Chunk Delimitation
  await testCase('7. Streaming SSE Output: Delivers valid double-newline SSE chunks with [DONE] termination', async () => {
    const stream = await streamChatWithDawaGPT({
      messages: [{ role: 'user', content: 'I accidentally overdosed on medication' }],
      medicines: [],
      userProfile: { name: 'Amina' }
    });

    let rawStream = '';
    for await (const chunk of stream) {
      rawStream += chunk.toString();
    }

    assert(rawStream.includes('data: '), 'Must include SSE prefix "data: "');
    assert(rawStream.includes('data: [DONE]\n\n'), 'Must conclude with SSE double newline "data: [DONE]\\n\\n"');
    assert(rawStream.includes('###METADATA###'), 'Must embed structured metadata separator');
  });

  // 8. In-App Navigation Map
  await testCase('8. In-App Navigation Map: Correctly embeds contextual internal app routes', async () => {
    const context = await prepareDawaGPTContext({
      messages: [{ role: 'user', content: 'Where do I check drug interactions and pill stock?' }],
      medicines: [],
      userProfile: { name: 'Kato' },
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: []
    });

    const staticPrompt = context.finalMessages[0].content;
    assert(staticPrompt.includes('/interactions'));
    assert(staticPrompt.includes('/medvault'));
    assert(staticPrompt.includes('/family'));
    assert(staticPrompt.includes('/reminders'));
    assert(staticPrompt.includes('/wellness'));
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} / ${total} tests passed.`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (passed === total) {
    console.log('✅ ALL COMPREHENSIVE DAWAGPT PROMPT RESPONSE TESTS PASSED!');
  } else {
    throw new Error(`${total - passed} test(s) failed.`);
  }
}

runComprehensiveTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
