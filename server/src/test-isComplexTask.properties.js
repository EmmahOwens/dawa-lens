/**
 * Property-Based Tests for `isComplexTask`
 *
 * Tests Properties 6, 7, and 8 from the design document using representative
 * sample inputs that cover the full input space for each property.
 *
 * Validates: Requirements 5.1, 5.2, 5.3
 *
 * Run with: node src/test-isComplexTask.properties.js
 *
 * NOTE: isComplexTask is inlined here to avoid pulling in Firebase/Firestore
 * dependencies from aiService.js during isolated unit testing. The logic is
 * identical to the exported version in aiService.js.
 */

import assert from 'node:assert/strict';

/**
 * Inlined copy of isComplexTask from server/src/services/aiService.js.
 * Keep in sync with the source of truth in aiService.js.
 */
const isComplexTask = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

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

// ─── Test Harness ────────────────────────────────────────────────────────────

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

// ─── Property 6: isComplexTask classifies delete+domain as complex ────────────
// For any string containing a delete/remove intent word (delete, remove, cancel, stop)
// adjacent to a domain noun (reminder, alarm, med, medicine), isComplexTask must return true.
// Validates: Requirement 5.1

console.log('\n📋 Property 6: delete/remove intent + domain noun → true');

// Intent: "delete" + domain nouns
test('delete + reminder', () =>
  assert.equal(isComplexTask('delete my Paracetamol reminder'), true));

test('delete + alarm', () =>
  assert.equal(isComplexTask('delete the alarm'), true));

test('delete + med', () =>
  assert.equal(isComplexTask('delete that med'), true));

test('delete + medicine', () =>
  assert.equal(isComplexTask('delete my Metformin medicine'), true));

// Intent: "remove" + domain nouns
test('remove + reminder', () =>
  assert.equal(isComplexTask('remove the Metformin alarm'), true));

test('remove + reminder (explicit)', () =>
  assert.equal(isComplexTask('remove my evening reminder'), true));

test('remove + med', () =>
  assert.equal(isComplexTask('remove that med please'), true));

test('remove + medicine', () =>
  assert.equal(isComplexTask('remove Coartem medicine'), true));

// Intent: "cancel" + domain nouns
test('cancel + reminder', () =>
  assert.equal(isComplexTask('cancel my reminder for Aspirin'), true));

test('cancel + alarm', () =>
  assert.equal(isComplexTask('cancel the alarm'), true));

// Intent: "stop" + domain nouns
test('stop + reminder', () =>
  assert.equal(isComplexTask('stop my reminder'), true));

test('stop + med', () =>
  assert.equal(isComplexTask('stop that med'), true));

// Case-insensitivity
test('DELETE (uppercase) + REMINDER', () =>
  assert.equal(isComplexTask('DELETE MY REMINDER'), true));

test('Remove (mixed case) + Medicine', () =>
  assert.equal(isComplexTask('Remove the Medicine'), true));

// Extra words between intent and domain noun
test('delete [extra words] reminder', () =>
  assert.equal(isComplexTask('delete all my old reminders'), true));

// ─── Property 7: isComplexTask classifies show-reminders as complex ───────────
// For any string containing a read/list intent word (show, list, what are, check, view)
// adjacent to "reminder" or "reminders", isComplexTask must return true.
// Validates: Requirement 5.2

console.log('\n📋 Property 7: show/list intent + reminder(s) → true');

// Intent: "show" + reminder(s)
test('show + reminders', () =>
  assert.equal(isComplexTask('show my reminders'), true));

test('show + reminder (singular)', () =>
  assert.equal(isComplexTask('show my reminder'), true));

test('show + all reminders', () =>
  assert.equal(isComplexTask('show all my reminders'), true));

// Intent: "list" + reminder(s)
test('list + reminders', () =>
  assert.equal(isComplexTask('list all reminders'), true));

test('list + reminder', () =>
  assert.equal(isComplexTask('list my reminder'), true));

// Intent: "what are" + reminder(s)
test('what are + reminders', () =>
  assert.equal(isComplexTask('what are my current reminders?'), true));

test('what are + reminder', () =>
  assert.equal(isComplexTask('what are my reminder settings?'), true));

// Intent: "check" + reminder(s)
test('check + reminders', () =>
  assert.equal(isComplexTask('check my reminders'), true));

test('check + reminder', () =>
  assert.equal(isComplexTask('check my reminder'), true));

// Intent: "view" + reminder(s)
test('view + reminders', () =>
  assert.equal(isComplexTask('view reminders'), true));

test('view + reminder', () =>
  assert.equal(isComplexTask('view my reminder'), true));

// Case-insensitivity
test('SHOW (uppercase) + REMINDERS', () =>
  assert.equal(isComplexTask('SHOW MY REMINDERS'), true));

test('List (mixed case) + Reminders', () =>
  assert.equal(isComplexTask('List all my Reminders'), true));

// ─── Property 8: isComplexTask preserves how-to guard ────────────────────────
// For any string beginning with "how do i", "can you explain", "what is", or
// "tell me about", isComplexTask must return false.
// Validates: Requirement 5.3

console.log('\n📋 Property 8: how-to guard prefixes → false');

// Prefix: "how do i"
test('"how do i" + add reminder → false', () =>
  assert.equal(isComplexTask('how do I add a reminder?'), false));

test('"how do i" + delete reminder → false', () =>
  assert.equal(isComplexTask('how do I delete a reminder?'), false));

test('"how do i" + show reminders → false', () =>
  assert.equal(isComplexTask('how do I show my reminders?'), false));

test('"how do i" + log dose → false', () =>
  assert.equal(isComplexTask('how do I log a dose?'), false));

// Prefix: "can you explain"
test('"can you explain" + Metformin → false', () =>
  assert.equal(isComplexTask('can you explain what Metformin does?'), false));

test('"can you explain" + reminders → false', () =>
  assert.equal(isComplexTask('can you explain how reminders work?'), false));

test('"can you explain" + delete → false', () =>
  assert.equal(isComplexTask('can you explain how to delete a reminder?'), false));

// Prefix: "what is"
test('"what is" + Paracetamol → false', () =>
  assert.equal(isComplexTask('what is Paracetamol used for?'), false));

test('"what is" + reminder → false', () =>
  assert.equal(isComplexTask('what is a reminder?'), false));

test('"what is" + medicine → false', () =>
  assert.equal(isComplexTask('what is this medicine for?'), false));

// Prefix: "tell me about"
test('"tell me about" + Metformin → false', () =>
  assert.equal(isComplexTask('tell me about Metformin side effects'), false));

test('"tell me about" + reminders → false', () =>
  assert.equal(isComplexTask('tell me about my reminders'), false));

// Case-insensitivity of the guard
test('"HOW DO I" (uppercase) → false', () =>
  assert.equal(isComplexTask('HOW DO I add a reminder?'), false));

test('"Can You Explain" (mixed case) → false', () =>
  assert.equal(isComplexTask('Can You Explain what Metformin does?'), false));

// ─── Summary ─────────────────────────────────────────────────────────────────

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
  console.log('🎉 All property tests passed!');
  process.exit(0);
}
