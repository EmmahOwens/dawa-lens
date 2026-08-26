import assert from 'assert';
import { prepareDawaGPTContext } from './services/aiService.js';

console.log('Testing Server-Side Gender-Aware Context & Salutation Intelligence...');

async function runTests() {
  // 1. Female User Profile Context
  const femaleProfile = {
    id: 'user-female-1',
    name: 'Sarah Nalule',
    gender: 'female'
  };

  const femaleContext = await prepareDawaGPTContext({
    messages: [{ role: 'user', content: 'Oli otya' }],
    medicines: [],
    userProfile: femaleProfile,
    doseLogs: [],
    reminders: [],
    wellnessLogs: [],
    vitalitySummary: [],
    patients: [],
    selectedPatientId: null,
    currentPage: '/dashboard'
  });

  const femalePrompt = femaleContext.finalMessages[0].content;
  const femaleSessionContext = femaleContext.finalMessages[1].content;

  // Verify static prompt contains strict Nyabo / Ssebo rules
  assert(femalePrompt.includes('"Nyabo" -> "Madam"'), 'STATIC_SYSTEM_PROMPT missing Nyabo definition');
  assert(femalePrompt.includes('"Ssebo" (or "Sebbo") -> "Sir"'), 'STATIC_SYSTEM_PROMPT missing Ssebo definition');
  assert(femalePrompt.includes('If the user/profile is FEMALE: You MUST address them as "Nyabo"'), 'STATIC_SYSTEM_PROMPT missing female rule');
  assert(femalePrompt.includes('If the user/profile is MALE: You MUST address them as "Ssebo"'), 'STATIC_SYSTEM_PROMPT missing male rule');

  // Verify dynamic context includes female gender
  assert(femaleSessionContext.includes('Gender: female'), `Dynamic context missing female gender: ${femaleSessionContext}`);
  console.log('✔ Female user context and prompt rules verified.');

  // 2. Male User Profile Context
  const maleProfile = {
    id: 'user-male-1',
    name: 'David Mukasa',
    gender: 'male'
  };

  const maleContext = await prepareDawaGPTContext({
    messages: [{ role: 'user', content: 'Oli otya' }],
    medicines: [],
    userProfile: maleProfile,
    doseLogs: [],
    reminders: [],
    wellnessLogs: [],
    vitalitySummary: [],
    patients: [],
    selectedPatientId: null,
    currentPage: '/dashboard'
  });

  const maleSessionContext = maleContext.finalMessages[1].content;
  assert(maleSessionContext.includes('Gender: male'), `Dynamic context missing male gender: ${maleSessionContext}`);
  console.log('✔ Male user context verified.');

  // 3. Unspecified Gender Context
  const unspecifiedProfile = {
    id: 'user-unspecified-1',
    name: 'Alex Kato'
  };

  const unspecContext = await prepareDawaGPTContext({
    messages: [{ role: 'user', content: 'Oli otya' }],
    medicines: [],
    userProfile: unspecifiedProfile,
    doseLogs: [],
    reminders: [],
    wellnessLogs: [],
    vitalitySummary: [],
    patients: [],
    selectedPatientId: null,
    currentPage: '/dashboard'
  });

  const unspecSessionContext = unspecContext.finalMessages[1].content;
  assert(unspecSessionContext.includes('Gender: Not specified'), `Dynamic context missing Not specified: ${unspecSessionContext}`);
  console.log('✔ Unspecified gender context verified.');

  // 4. Family Hub Active Patient Gender Context
  const patientGrace = {
    id: 'patient-grace',
    name: 'Grace Nabirye',
    relation: 'Mother',
    gender: 'female'
  };

  const familyContext = await prepareDawaGPTContext({
    messages: [{ role: 'user', content: 'What are Grace\'s medicines?' }],
    medicines: [],
    userProfile: maleProfile,
    doseLogs: [],
    reminders: [],
    wellnessLogs: [],
    vitalitySummary: [],
    patients: [patientGrace],
    selectedPatientId: 'patient-grace',
    currentPage: '/family'
  });

  const familySessionContext = familyContext.finalMessages[1].content;
  assert(familySessionContext.includes('Grace Nabirye (Mother, Gender: female)'), `Dynamic context missing active patient gender: ${familySessionContext}`);
  console.log('✔ Active patient in Family Hub gender context verified.');

  console.log('\nAll Server-Side Gender-Aware Context & Salutation tests PASSED successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
