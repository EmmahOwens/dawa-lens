import { prepareDawaGPTContext } from './src/services/aiService.js';

const SIX_MEDS = [
  { id: "7H0ikVQYwRpcJpeoBeMm", name: "Ibuprofen", genericName: "Nurofen", dosage: "400mg", currentQuantity: 48, totalQuantity: 50, dosagePerDose: 2, unit: "tablets", frequencyPerDay: 3 },
  { id: "OOSOFKRfHa7DDLJaxcJ8", name: "Panadol", genericName: "Paracetamol", dosage: "500mg", currentQuantity: 35, totalQuantity: 60, dosagePerDose: 2, unit: "tablets", frequencyPerDay: 3 },
  { id: "RYylmJSDbgqADgpVuNgz", name: "Prilosec OTC", genericName: "Omeprazole", dosage: "20mg", currentQuantity: 18, totalQuantity: 20, dosagePerDose: 1, unit: "capsules", frequencyPerDay: 1 },
  { id: "RbC0XGGId0EI9Rf8eZyN", name: "Paracetamol 500mg", genericName: "Paracetamol", dosage: "500mg", currentQuantity: 24, totalQuantity: 30, dosagePerDose: 2, unit: "tablets", frequencyPerDay: 3 },
  { id: "XL4qQBmFvatEVm4LVoxN", name: "Omeprazole", genericName: "Omeprazole", dosage: "20mg", currentQuantity: 48, totalQuantity: 60, dosagePerDose: 1, unit: "capsules", frequencyPerDay: 1 },
  { id: "qdgFHJWrQ8lNkVcGQNKz", name: "Metronidazole", genericName: "Flagyl", dosage: "200mg", currentQuantity: 34, totalQuantity: 45, dosagePerDose: 2, unit: "tablet", frequencyPerDay: 3 },
];

const REMINDERS = [
  { id: "r1", medicineName: "Ibuprofen", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
  { id: "r2", medicineName: "Panadol", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
  { id: "r3", medicineName: "Prilosec OTC", dose: "1 capsule", time: "08:00", repeatSchedule: "daily", enabled: true },
  { id: "r4", medicineName: "Paracetamol 500mg", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
  { id: "r5", medicineName: "Omeprazole", dose: "1 capsule", time: "08:00", repeatSchedule: "daily", enabled: true },
  { id: "r6", medicineName: "Metronidazole", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
];

const params = {
  messages: [{ role: "user", text: "Which medications should I be most worried about their stock levels" }],
  medicines: SIX_MEDS,
  reminders: REMINDERS,
  userProfile: { id: "u1", name: "User", gender: "female" },
  doseLogs: [],
  wellnessLogs: [],
  vitalitySummary: [],
  patients: [],
  selectedPatientId: null,
  currentPage: "/medvault",
  isStreaming: true,
  isComplex: true
};

const { finalMessages } = await prepareDawaGPTContext(params);
console.log(`Number of messages:`, finalMessages.length);
let totalChars = 0;
finalMessages.forEach((m, idx) => {
  console.log(`Msg ${idx} (${m.role}): ${m.content.length} chars (~${Math.round(m.content.length / 3.7)} tokens)`);
  totalChars += m.content.length;
});
console.log(`Total chars: ${totalChars} (~${Math.round(totalChars / 3.7)} tokens)`);
