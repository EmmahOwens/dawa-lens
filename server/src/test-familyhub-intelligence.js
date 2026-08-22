import { buildFamilyHubSummary } from "./services/aiService.js";

console.log("Testing Server-Side Family Hub Intelligence...");

const hostProfile = {
  id: "user-host-1",
  name: "Dr. Mukasa",
  dateOfBirth: "1985-04-12",
  gender: "male",
  isProfessional: true,
};

const hostMed = {
  id: "med-host-panadol",
  name: "Panadol Extra",
  genericName: "Paracetamol",
  dosage: "500mg",
  currentQuantity: 20,
  unit: "tablets",
  patientId: null,
};

const hostReminder = {
  id: "rem-host-1",
  medicineName: "Panadol Extra",
  dose: "2 tablets",
  time: "08:00, 20:00",
  repeatSchedule: "daily",
  enabled: true,
  patientId: null,
};

const mamaPatient = {
  id: "patient-mama-101",
  name: "Sarah Nalule",
  relation: "Mother",
  type: "family",
  age: 62,
  gender: "female",
  conditions: ["Hypertension", "Type 2 Diabetes"],
  allergies: ["Penicillin", "Sulfa drugs"],
  bloodType: "O+",
  notes: "Requires morning blood pressure check before taking medication.",
};

const mamaMed = {
  id: "med-mama-amlo",
  name: "Amlodipine",
  genericName: "Amlodipine Besylate",
  dosage: "5mg",
  currentQuantity: 30,
  unit: "tablets",
  patientId: "patient-mama-101",
};

const mamaReminder = {
  id: "rem-mama-1",
  medicineName: "Amlodipine",
  dose: "1 tablet",
  time: "08:00",
  repeatSchedule: "daily",
  enabled: true,
  patientId: "patient-mama-101",
};

const clientDavid = {
  id: "patient-david-202",
  name: "David Ochieng",
  relation: "Client",
  type: "client",
  age: 45,
  gender: "male",
  conditions: ["Asthma"],
  allergies: ["Aspirin"],
  bloodType: "A+",
  notes: "Carry inhaler at all times during travel.",
};

const davidMed = {
  id: "med-david-ventolin",
  name: "Ventolin",
  genericName: "Salbutamol Inhaler",
  dosage: "100mcg",
  currentQuantity: 200,
  unit: "puffs",
  patientId: "patient-david-202",
};

const medicines = [hostMed, mamaMed, davidMed];
const reminders = [hostReminder, mamaReminder];
const patients = [mamaPatient, clientDavid];

// 1. Test buildFamilyHubSummary formatting with multiple profiles
const summary = buildFamilyHubSummary(patients, medicines, reminders, [], hostProfile, "patient-mama-101");

console.assert(summary.includes("PRIMARY ACCOUNT OWNER"), "Summary missing Primary Account Owner");
console.assert(summary.includes("Dr. Mukasa"), "Summary missing host name");
console.assert(summary.includes("Panadol Extra"), "Summary missing host medicine");

// Check Sarah Nalule (Mama)
console.assert(summary.includes("Sarah Nalule (Mother)"), "Summary missing Sarah Nalule profile header");
console.assert(summary.includes("CURRENTLY SELECTED ACTIVE CONTEXT"), "Summary should flag selected patient as active context");
console.assert(summary.includes("Family Member"), "Summary missing family member type");
console.assert(summary.includes("Hypertension, Type 2 Diabetes"), "Summary missing chronic conditions");
console.assert(summary.includes("Penicillin, Sulfa drugs"), "Summary missing allergies");
console.assert(summary.includes("Blood Type: O+"), "Summary missing blood type");
console.assert(summary.includes("Requires morning blood pressure check"), "Summary missing clinical notes");
console.assert(summary.includes("Amlodipine (Amlodipine Besylate)"), "Summary missing assigned medicine");
console.assert(summary.includes("Amlodipine (1 tablet) at 08:00"), "Summary missing assigned reminder");

// Check David Ochieng (Client)
console.assert(summary.includes("David Ochieng (Client)"), "Summary missing David Ochieng profile header");
console.assert(summary.includes("Professional Client"), "Summary missing client type");
console.assert(summary.includes("Asthma"), "Summary missing asthma condition");
console.assert(summary.includes("Aspirin"), "Summary missing aspirin allergy");
console.assert(summary.includes("Ventolin (Salbutamol Inhaler)"), "Summary missing client medicine");

// 2. Test empty Family Hub
const emptySummary = buildFamilyHubSummary([], [hostMed], [hostReminder], [], hostProfile, null);
console.assert(emptySummary.includes("No additional family member or client profiles added yet"), "Empty summary failed");
console.assert(emptySummary.includes("CURRENTLY SELECTED ACTIVE CONTEXT"), "Owner should be active context when selectedPatientId is null");

console.log("All Server-Side Family Hub Intelligence tests PASSED successfully!");
