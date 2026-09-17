import assert from 'node:assert/strict';
import {
  calculateAge,
  extractAgeFromQuery,
  prepareDawaGPTContext,
  generateBackendClinicalFallback
} from './services/aiService.js';

console.log("=== Running DawaGPT Age-Aware Food, Chewables & Drinks Tests ===");

// 1. Test calculateAge
console.log("\n1. Verifying calculateAge helper...");
assert.equal(calculateAge(25), 25, "Numeric age should return directly");
assert.equal(calculateAge("30"), 30, "String number age should return parsed number");
assert.equal(calculateAge(null), null, "Null should return null");
assert.equal(calculateAge(undefined), null, "Undefined should return null");
const dob2000 = "2000-01-01";
const expectedAge = new Date().getFullYear() - 2000;
const actualAge = calculateAge(dob2000);
assert(actualAge === expectedAge || actualAge === expectedAge - 1, "DOB should calculate accurate age in years");
console.log("✔ calculateAge accurately parses numbers, strings, and ISO DOBs.");

// 2. Test extractAgeFromQuery
console.log("\n2. Verifying extractAgeFromQuery...");
assert.equal(extractAgeFromQuery("What food can a 4 year old take with Panadol?"), 4);
assert.equal(extractAgeFromQuery("What can a 5yo child eat with Coartem?"), 5);
assert.equal(extractAgeFromQuery("Food for my 8-year-old child"), 8);
assert.equal(extractAgeFromQuery("What chewables can an infant take?"), 0);
assert.equal(extractAgeFromQuery("Food for a toddler taking antibiotics"), 2);
assert.equal(extractAgeFromQuery("What food is safe for an elderly person taking Ibuprofen?"), 72);
assert.equal(extractAgeFromQuery("Food for my jajja taking blood pressure meds"), 72);
assert.equal(extractAgeFromQuery("What food goes with Panadol?"), null);
console.log("✔ extractAgeFromQuery accurately detects numeric ages and life-stage keywords.");

// 3. Test prepareDawaGPTContext age awareness & prompt guidance
console.log("\n3. Verifying prepareDawaGPTContext age enrichment and food guidelines...");

// 3a. Pediatric profile context
const pediatricContext = await prepareDawaGPTContext({
  messages: [{ role: 'user', content: 'What food should I give with medication?' }],
  medicines: [{ id: 'm1', name: 'Amoxicillin', dosage: '250mg' }],
  userProfile: { name: 'Dr. Mukasa', gender: 'male' },
  patients: [{ id: 'p-child', name: 'Junior Mukasa', age: 4, gender: 'male', relation: 'Son' }],
  selectedPatientId: 'p-child',
  isStreaming: false
});

const pediatricPrompt = pediatricContext.systemInstruction;
const pediatricUserMsg = pediatricContext.finalMessages.find(m => m.role === 'user')?.content || "";

assert(pediatricPrompt.includes("AGE-AWARE FOOD, CHEWABLES & DRINK GUIDANCE"), "System prompt must include Age-Aware Food & Drink Guidance");
assert(pediatricPrompt.includes("PEDIATRICS (0 - 12 years"), "System prompt must detail pediatric guidance");
assert(pediatricPrompt.includes("chewable tablets"), "System prompt must recommend chewable tablets for children");
assert(pediatricPrompt.includes("applesauce"), "System prompt must recommend applesauce as food vehicle");
assert(pediatricPrompt.includes("NEVER recommend honey for infants under 1 year"), "System prompt must forbid honey under 1 year");
assert(pediatricPrompt.includes("Bushera"), "System prompt must include Bushera porridge");
assert(pediatricPrompt.includes("OUTSIDE the local database"), "System prompt must instruct AI on foods outside knowledge base");
assert(pediatricUserMsg.includes("Active Target Age: 4 yrs (Pediatric: Child 4-12 yrs)"), "User context must specify active target age");
assert(pediatricUserMsg.includes("CLINICAL AGE NOTICE: Patient is a pediatric child"), "User context must include pediatric clinical notice");

// 3b. Geriatric profile context
const geriatricContext = await prepareDawaGPTContext({
  messages: [{ role: 'user', content: 'What food goes with my meds?' }],
  medicines: [{ id: 'm2', name: 'Lisinopril', dosage: '10mg' }],
  userProfile: { name: 'Kato', gender: 'male' },
  patients: [{ id: 'p-senior', name: 'Jajja Nalule', age: 74, gender: 'female', relation: 'Mother' }],
  selectedPatientId: 'p-senior',
  isStreaming: false
});
const geriatricUserMsg = geriatricContext.finalMessages.find(m => m.role === 'user')?.content || "";
assert(geriatricUserMsg.includes("Active Target Age: 74 yrs (Geriatric: Older Adult 65+ yrs)"), "User context must specify geriatric target age");
assert(geriatricUserMsg.includes("CLINICAL AGE NOTICE: Patient is an older adult"), "User context must include geriatric clinical notice");
assert(geriatricUserMsg.includes("presbyphagia/swallowing difficulties"), "User context must flag presbyphagia");

console.log("✔ prepareDawaGPTContext correctly ground sessions in active patient age and dynamic clinical alerts.");

// 4. Test generateBackendClinicalFallback for Age-Aware Food, Chewables & Drinks
console.log("\n4. Verifying generateBackendClinicalFallback food & chewables recommendations...");

// 4a. Pediatric query with child age in message
const pediatricFallback = generateBackendClinicalFallback(
  "What chewables or food can a 5-year-old child take with Amoxicillin?",
  [{ name: 'Amoxicillin' }]
);
assert(pediatricFallback.text.includes("Chewable & Liquid Alternatives"), "Must include chewable alternatives for children");
assert(pediatricFallback.text.includes("applesauce"), "Must include applesauce as a soft vehicle outside local foods");
assert(pediatricFallback.text.includes("Bushera"), "Must include Bushera as a local Ugandan soft vehicle");
assert(pediatricFallback.text.includes("NEVER give honey"), "Must include infant botulism honey warning");
assert(pediatricFallback.suggestions.includes("Chewable medication options"), "Must suggest chewable options");
console.log("✔ Pediatric fallback recommends chewables, applesauce, Bushera, and botulism honey safety.");

// 4b. Geriatric query with senior profile
const seniorFallback = generateBackendClinicalFallback(
  "What food or drinks go well with my medicine?",
  [{ name: 'Lisinopril' }],
  [],
  { name: 'Kato', gender: 'male', age: 72 }
);
assert(seniorFallback.text.includes("presbyphagia"), "Must address swallowing difficulties (presbyphagia)");
assert(seniorFallback.text.includes("Matooke"), "Must suggest soft steamed Matooke");
assert(seniorFallback.text.includes("Greek yogurt") || seniorFallback.text.includes("applesauce") || seniorFallback.text.includes("oatmeal"), "Must suggest global staples outside local knowledge base");
assert(seniorFallback.text.includes("upright for at least 30 minutes"), "Must advise upright posture for pill swallowing");
console.log("✔ Geriatric fallback recommends soft foods, presbyphagia care, and upright posture.");

// 4c. Coartem / Artemether fat-soluble medication pairing for adult
const coartemFallback = generateBackendClinicalFallback(
  "What food should I eat when taking Coartem?",
  [{ name: 'Coartem' }],
  [],
  { name: 'Sarah', gender: 'female', age: 28 }
);
assert(coartemFallback.text.includes("G-nut sauce"), "Must recommend local Ugandan G-nut sauce for fat-soluble Coartem");
assert(coartemFallback.text.includes("avocado") || coartemFallback.text.includes("peanut butter"), "Must recommend foods outside stored knowledge base (avocado, peanut butter)");
assert(coartemFallback.text.includes("Healthy Fats for Absorption"), "Must explain healthy fat requirement for absorption");
console.log("✔ Adult Coartem fallback explains lipid absorption using both G-nut sauce and avocado/peanut butter.");

// 4d. Broad foods outside stored knowledge base
const generalFoodFallback = generateBackendClinicalFallback(
  "What foods outside local foods can I take with my medicine?",
  [{ name: 'Ibuprofen' }],
  [],
  { name: 'Alex', age: 35 }
);
assert(generalFoodFallback.text.includes("oatmeal") || generalFoodFallback.text.includes("toast") || generalFoodFallback.text.includes("crackers"), "Must suggest foods outside local database like oatmeal/toast/crackers");
assert(generalFoodFallback.text.includes("full glass of plain water"), "Must advise ample water for hydration");
console.log("✔ General fallback provides gastric buffers and hydration with global staples.");

console.log("\n🎉 ALL AGE-AWARE FOOD & CHEWABLES TESTS PASSED SUCCESSFULLY!");
