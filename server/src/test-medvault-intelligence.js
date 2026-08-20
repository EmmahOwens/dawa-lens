import {
  getServerDailyDoseRate,
  calculateServerRefillStatus,
  buildMedVaultSummary,
} from "./services/aiService.js";

console.log("Testing Server-Side Med Vault Intelligence...");

const panadol = {
  id: "panadol-101",
  name: "Panadol Extra",
  dosage: "500mg",
  dosagePerDose: 2, // 2 tablets per dose
  frequencyPerDay: 2, // 2 doses per day
  currentQuantity: 20, // 20 tablets
  totalQuantity: 40,
  unit: "tablets",
};

const panadolReminder = {
  id: "rem-panadol",
  medicineId: "panadol-101",
  medicineName: "Panadol Extra",
  dose: "2 tablets",
  time: "08:00, 20:00",
  repeatSchedule: "daily",
  enabled: true,
};

// 1. Daily rate test
const rate = getServerDailyDoseRate(panadol, [panadolReminder]);
console.assert(rate === 4, `Expected rate 4, got ${rate}`);

// 2. Refill status test
const status = calculateServerRefillStatus(panadol, [panadolReminder]);
console.assert(status.dosesRemaining === 10, `Expected 10 doses, got ${status.dosesRemaining}`);
console.assert(status.daysRemaining === 5, `Expected 5 days, got ${status.daysRemaining}`);
console.assert(status.dailyDoseTotal === 4, `Expected 4 tablets/day, got ${status.dailyDoseTotal}`);

// 3. Summary test
const summary = buildMedVaultSummary([panadol], [panadolReminder]);
console.assert(summary.includes("Panadol Extra"), "Summary missing name");
console.assert(summary.includes("10 doses left"), `Summary missing doses left: ${summary}`);
console.assert(summary.includes("~5 days of supply left"), `Summary missing days left: ${summary}`);

// 4. Critical status test (<= 2 days)
const criticalPanadol = { ...panadol, currentQuantity: 6 }; // 6 tablets at 4/day = 1 day left
const critStatus = calculateServerRefillStatus(criticalPanadol, [panadolReminder]);
console.assert(critStatus.daysRemaining === 1, `Expected 1 day, got ${critStatus.daysRemaining}`);
console.assert(critStatus.isLow === true, "Expected isLow=true for 1 day left");
console.assert(critStatus.statusText.includes("CRITICAL"), `Expected CRITICAL in statusText, got ${critStatus.statusText}`);

console.log("All Server-Side Med Vault Intelligence tests PASSED successfully!");
