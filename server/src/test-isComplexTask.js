/**
 * Regression Tests for `isComplexTask`
 *
 * Tests ≥ 10 representative inputs to prevent regressions in the routing logic
 * that determines whether a user query is sent to the capable 70B model.
 *
 * Validates: Requirement 5.4
 *
 * Run with: node src/test-isComplexTask.js
 *
 * NOTE: isComplexTask is inlined here to avoid pulling in Firebase/Firestore
 * dependencies from aiService.js during isolated unit testing. The logic is
 * identical to the exported version in server/src/services/aiService.js.
 * Keep this copy in sync with the source of truth in aiService.js.
 */

import assert from 'node:assert/strict';

/**
 * Inlined copy of isComplexTask from server/src/services/aiService.js.
 * Source of truth: server/src/services/aiService.js → export const isComplexTask
 */
const isComplexTask = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // High threshold for complexity by length (approx 100-120 words)
  if (text.length > 500) return true;

  // Guard: informational queries are NOT complex
  const isHowToQuery = /^(how\s+do\s+i|can\s+you\s+explain|what\s+is|tell\s+me\s+about)/i.test(lower);
  if (isHowToQuery) return false;

  // Delete/remove intent + domain noun (Requirement 5.1)
  // Uses (?:\w+\s+)*? to allow any number of words between the intent verb and domain noun
  // e.g. "remove the Metformin alarm" (two words between intent and noun) must match
  const hasDeleteIntent = /(delete|remove|cancel|stop)\s+(?:\w+\s+)*?(reminder|alarm|med|medicine)/i.test(lower);
  if (hasDeleteIntent) return true;

  // Show/list reminders intent (Requirement 5.2)
  const hasShowRemindersIntent = /(show|list|what\s+are|check|view)\s+\w*\s*reminders?/i.test(lower);
  if (hasShowRemindersIntent) return true;

  const hasActionVerb = /(add|create|set|remind|log|record|track|update|delete|remove|register)/i.test(lower);
  const hasDomainNoun = /(reminder|med|medicine|dose|log|wellness|family|profile|patient|history)/i.test(lower);
  const hasDataVerb = /(what|show|list|tell|view|check|get)/i.test(lower);

  const isActionRequest = hasActionVerb && hasDomainNoun;
  const isDataRequest = hasDataVerb && (hasDomainNoun || /(my|current|active|recent)/i.test(lower));

  if (isActionRequest || isDataRequest) return true;

  const isMedicalQuery = /(dose|dosage|effect|safe|interact|symptom|pain|sick|hurt|doctor|health)/i.test(lower);
  if (isMedicalQuery && text.split(' ').length > 5) return true;

  return false;
};

// ─── Test Harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${description}`);
    console.error(`     ${err.message}`);
    failed++;
    failures.push({ description, error: err.message });
  }
}

// ─── Regression Test Cases ────────────────────────────────────────────────────

console.log('\n📋 isComplexTask — Regression Tests (Requirement 5.4)\n');

// 1. Delete intent → true (Requirement 5.1)
test('"delete my Paracetamol reminder" → true', () =>
  assert.equal(isComplexTask('delete my Paracetamol reminder'), true));

// 2. Remove intent → true (Requirement 5.1)
test('"remove the Metformin alarm" → true', () =>
  assert.equal(isComplexTask('remove the Metformin alarm'), true));

// 3. Show reminders intent → true (Requirement 5.2)
test('"show my reminders" → true', () =>
  assert.equal(isComplexTask('show my reminders'), true));

// 4. List reminders intent → true (Requirement 5.2)
test('"list all reminders" → true', () =>
  assert.equal(isComplexTask('list all reminders'), true));

// 5. Add reminder action → true (action verb + domain noun)
test('"add a reminder for Coartem at 8am" → true', () =>
  assert.equal(isComplexTask('add a reminder for Coartem at 8am'), true));

// 6. What are reminders query → true (Requirement 5.2)
test('"what are my current reminders?" → true', () =>
  assert.equal(isComplexTask('what are my current reminders?'), true));

// 7. How-to guard → false (Requirement 5.3)
test('"how do I add a reminder?" → false', () =>
  assert.equal(isComplexTask('how do I add a reminder?'), false));

// 8. Explain guard → false (Requirement 5.3)
test('"can you explain what Metformin does?" → false', () =>
  assert.equal(isComplexTask('can you explain what Metformin does?'), false));

// 9. Log dose action → true (action verb + domain noun)
test('"log my Paracetamol dose" → true', () =>
  assert.equal(isComplexTask('log my Paracetamol dose'), true));

// 10. Unrelated / no domain context → false
test('"I have a headache" → false', () =>
  assert.equal(isComplexTask('I have a headache'), false));

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(({ description, error }) => {
    console.error(`  • ${description}: ${error}`);
  });
}

console.log('─'.repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All regression tests passed!');
  process.exit(0);
}
