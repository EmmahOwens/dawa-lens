import { chatSchema, wellnessLogInputSchema, wellnessInsightSchema, userProfileInputSchema, vitalitySummaryInputSchema } from './validations/aiValidation.js';
import { logWellnessSchema } from './validations/wellnessValidation.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ ${testName}`);
    failed++;
  }
}

console.log('\n🧪 Testing Zod v4 Schema Validations & Null Safety...\n');

// Test 1: wellnessLogInputSchema with data field (Zod v4 z.record fix)
try {
  const parsed = wellnessLogInputSchema.parse({
    id: 'w1',
    type: 'symptom',
    timestamp: '2026-09-01T12:00:00Z',
    mood: 4,
    energy: 3,
    patientId: null,
    data: { mood: 4, energy: 3, symptoms: ['headache', 'dizziness'], notes: 'Feeling better' }
  });
  assert(parsed.data.mood === 4, 'wellnessLogInputSchema accepts data dictionary without _zod error');
} catch (e) {
  assert(false, `wellnessLogInputSchema failed with: ${e.message}`);
}

// Test 2: logWellnessSchema in wellnessValidation
try {
  const parsed = logWellnessSchema.parse({
    body: {
      userId: 'user-123',
      type: 'symptom',
      patientId: null,
      data: { mood: 5, energy: 4, deep: { a: 1 } }
    }
  });
  assert(parsed.body.data.mood === 5, 'logWellnessSchema accepts data dictionary without _zod error');
} catch (e) {
  assert(false, `logWellnessSchema failed with: ${e.message}`);
}

// Test 3: userProfileInputSchema with null fields
try {
  const parsed = userProfileInputSchema.parse({
    name: 'Ssebo Mbayo',
    email: null,
    gender: null,
    age: 30
  });
  assert(parsed.name === 'Ssebo Mbayo' && parsed.email === null, 'userProfileInputSchema accepts null email and gender');
} catch (e) {
  assert(false, `userProfileInputSchema failed with: ${e.message}`);
}

// Test 4: vitalitySummaryInputSchema with calculateVitalitySummary shape
try {
  const parsed = vitalitySummaryInputSchema.parse({
    name: 'Sep 01',
    adherence: 100,
    energy: null,
    mood: 80
  });
  assert(parsed.name === 'Sep 01' && parsed.energy === null, 'vitalitySummaryInputSchema accepts frontend shape with null energy/mood');
} catch (e) {
  assert(false, `vitalitySummaryInputSchema failed with: ${e.message}`);
}

// Test 5: Full chatSchema with real DawaGPT payload (null userProfile, wellnessLogs with data, vitalitySummary)
try {
  const parsed = chatSchema.parse({
    body: {
      messages: [
        { role: 'assistant', text: "Unclench your shoulders and take a slow breath. Okay, now let's talk health, Ssebo Mbayo! 🩺 I'm DawaGPT, your health companion." },
        { role: 'user', text: 'I want you to describe yourself.' }
      ],
      medicines: [
        { id: 'm1', name: 'Paracetamol', dosage: '500mg', patientId: null }
      ],
      userProfile: {
        name: 'Ssebo Mbayo',
        email: null,
        gender: null
      },
      doseLogs: [
        { id: 'd1', medicineName: 'Paracetamol', action: 'taken', patientId: null }
      ],
      reminders: [
        { id: 'r1', medicineName: 'Paracetamol', dose: '1 tab', time: '08:00', patientId: null }
      ],
      wellnessLogs: [
        {
          id: 'w1',
          type: 'symptom',
          timestamp: '2026-09-01T10:00:00Z',
          patientId: null,
          data: { mood: 4, energy: 3, symptoms: ['fatigue'] }
        }
      ],
      vitalitySummary: [
        { name: 'Aug 30', adherence: 100, energy: null, mood: null },
        { name: 'Aug 31', adherence: 50, energy: 60, mood: 70 },
        { name: 'Sep 01', adherence: 100, energy: 80, mood: 80 }
      ],
      patients: [],
      selectedPatientId: null,
      currentPage: '/'
    },
    query: {},
    params: {}
  });
  assert(parsed.body.messages.length === 2, 'Full DawaGPT chat payload parses cleanly');
} catch (e) {
  assert(false, `Full DawaGPT chat payload failed with: ${e.message}`);
}

// Test 6: chatSchema with null userProfile
try {
  const parsed = chatSchema.parse({
    body: {
      messages: [
        { role: 'user', text: 'Hello' }
      ],
      userProfile: null,
      medicines: [],
      doseLogs: [],
      reminders: [],
      wellnessLogs: [],
      vitalitySummary: [],
      patients: [],
      selectedPatientId: null
    }
  });
  assert(parsed.body.userProfile === null, 'chatSchema accepts null userProfile');
} catch (e) {
  assert(false, `chatSchema null userProfile failed with: ${e.message}`);
}

// Test 7: wellnessInsightSchema with wellnessLogs containing data
try {
  const parsed = wellnessInsightSchema.parse({
    body: {
      wellnessLogs: [
        {
          id: 'w1',
          type: 'symptom',
          timestamp: '2026-09-01T10:00:00Z',
          data: { mood: 3, energy: 2 }
        }
      ]
    }
  });
  assert(parsed.body.wellnessLogs.length === 1, 'wellnessInsightSchema parses wellnessLogs with data');
} catch (e) {
  assert(false, `wellnessInsightSchema failed with: ${e.message}`);
}

console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`────────────────────────────────────────────────────────────`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All schema validation tests passed!\n');
}
