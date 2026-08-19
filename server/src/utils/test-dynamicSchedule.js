import {
  timeStrToMinutes,
  minutesToTimeStr,
  parseReminderTimes,
  getInterSlotInterval,
  findSlotIndexForTime,
  calculateDynamicSchedule,
} from './dynamicSchedule.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('🧪 Running Backend Dynamic Schedule Tests...\n');

// Test 1: Time parsing & conversions
assert(timeStrToMinutes('08:00') === 480, 'timeStrToMinutes(08:00) === 480');
assert(timeStrToMinutes('20:30') === 1230, 'timeStrToMinutes(20:30) === 1230');
assert(minutesToTimeStr(480) === '08:00', 'minutesToTimeStr(480) === 08:00');
assert(minutesToTimeStr(1230) === '20:30', 'minutesToTimeStr(1230) === 20:30');

// Test 2: Parse reminder times
const parsed = parseReminderTimes('08:00, 20:00');
assert(parsed.length === 2 && parsed[0] === '08:00' && parsed[1] === '20:00', 'parseReminderTimes parses comma list');

// Test 3: Inter-slot intervals
assert(getInterSlotInterval(['08:00', '20:00'], 0, 1) === 720, '12-hour gap between 08:00 and 20:00');
assert(getInterSlotInterval(['22:00', '06:00'], 0, 1) === 480, '8-hour gap across midnight between 22:00 and 06:00');

// Test 4: Early Dose Shift (08:00 taken at 06:30 -> 20:00 shifts to 18:30)
const earlyTake = new Date('2026-08-19T06:30:00');
const earlyResult = calculateDynamicSchedule(['08:00', '20:00'], 0, earlyTake);
assert(earlyResult.hasChanges === true, 'Early dose reports hasChanges');
assert(earlyResult.newTimes[0] === '06:30', 'First slot updated to 06:30');
assert(earlyResult.newTimes[1] === '18:30', 'Second slot shifted earlier to 18:30');
assert(earlyResult.newTimeStr === '06:30,18:30', 'New time string is 06:30,18:30');

// Test 5: Late Dose Shift (08:00 taken at 09:30 -> 20:00 shifts to 21:30)
const lateTake = new Date('2026-08-19T09:30:00');
const lateResult = calculateDynamicSchedule(['08:00', '20:00'], 0, lateTake);
assert(lateResult.hasChanges === true, 'Late dose reports hasChanges');
assert(lateResult.newTimes[0] === '09:30', 'First slot updated to 09:30');
assert(lateResult.newTimes[1] === '21:30', 'Second slot shifted later to 21:30');
assert(lateResult.newTimeStr === '09:30,21:30', 'New time string is 09:30,21:30');

// Test 6: 3-Dose schedule (08:00, 14:00, 20:00) taken late at 09:00
const threeDoseTake = new Date('2026-08-19T09:00:00');
const threeDoseResult = calculateDynamicSchedule(['08:00', '14:00', '20:00'], 0, threeDoseTake);
assert(threeDoseResult.newTimes.join(',') === '09:00,15:00,21:00', '3-dose schedule preserves 6h intervals (09:00, 15:00, 21:00)');

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
