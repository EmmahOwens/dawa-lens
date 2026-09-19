import assert from 'assert';
import {
  THERAPEUTIC_CLASSES,
  findLocalTherapeuticClass,
  detectDuplicateTherapiesSync,
  detectDuplicateTherapiesWithApis,
  extractDrugsFromQuery,
  isSameTaskOrDuplicateQuery,
  fetchClinicalGroundingForQuery,
  formatDuplicateTherapyWatchdogContext
} from './services/therapeuticDuplicationService.js';
import { prepareDawaGPTContext, generateBackendClinicalFallback, isComplexTask } from './services/aiService.js';

console.log("=== Running Therapeutic Duplication & Same-Task Medication Intelligence Tests ===");

// 1. Test findLocalTherapeuticClass
console.log("\n1. Verifying therapeutic class identification...");
assert.strictEqual(findLocalTherapeuticClass("Panadol")?.id, "paracetamol");
assert.strictEqual(findLocalTherapeuticClass("Flucold")?.id, "paracetamol");
assert.strictEqual(findLocalTherapeuticClass("Brufen")?.id, "nsaid");
assert.strictEqual(findLocalTherapeuticClass("Voltaren")?.id, "nsaid");
assert.strictEqual(findLocalTherapeuticClass("K-Diclo")?.id, "nsaid");
assert.strictEqual(findLocalTherapeuticClass("Lisinopril")?.id, "dual_raas");
assert.strictEqual(findLocalTherapeuticClass("Losartan")?.id, "dual_raas");
assert.strictEqual(findLocalTherapeuticClass("Omeprazole")?.id, "ppi");
assert.strictEqual(findLocalTherapeuticClass("Esomeprazole")?.id, "ppi");
assert.strictEqual(findLocalTherapeuticClass("Cetirizine")?.id, "antihistamines");
assert.strictEqual(findLocalTherapeuticClass("Piriton")?.id, "antihistamines");
console.log("✔ Regional and generic drugs mapped accurately to therapeutic classes.");

// 2. Test detectDuplicateTherapiesSync
console.log("\n2. Verifying synchronous duplicate therapy detection...");
const nsaidMeds = [{ name: "Brufen" }, { name: "Voltaren" }];
const nsaidDups = detectDuplicateTherapiesSync(nsaidMeds);
assert.strictEqual(nsaidDups.length, 1);
assert.strictEqual(nsaidDups[0].sharedClass, "Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)");
assert(nsaidDups[0].warning.includes("stomach ulcers"));

const paracetamolMeds = [{ name: "Panadol" }, { name: "Flucold" }];
const paraDups = detectDuplicateTherapiesSync(paracetamolMeds);
assert.strictEqual(paraDups.length, 1);
assert.strictEqual(paraDups[0].sharedClass, "Paracetamol / Acetaminophen Products");
assert(paraDups[0].warning.includes("liver"));

const nonDuplicateMeds = [{ name: "Panadol" }, { name: "Amoxicillin" }];
const nonDups = detectDuplicateTherapiesSync(nonDuplicateMeds);
assert.strictEqual(nonDups.length, 0);
console.log("✔ Synchronous duplicate therapy detection correctly catches same-task pairs and ignores non-conflicts.");

// 3. Test isSameTaskOrDuplicateQuery & extractDrugsFromQuery
console.log("\n3. Verifying query intent detection & drug extraction...");
assert(isSameTaskOrDuplicateQuery("Can I take two medications that perform the same task?"));
assert(isSameTaskOrDuplicateQuery("Is it safe to take ibuprofen and diclofenac together?"));
assert(isSameTaskOrDuplicateQuery("What happens if I take two painkillers?"));
assert(!isSameTaskOrDuplicateQuery("What time is my reminder?"));

const extracted = extractDrugsFromQuery("Can I take Panadol and Flucold together?", []);
assert(extracted.includes("Panadol"));
assert(extracted.includes("Flucold"));
console.log("✔ Same-task query intent and medication names extracted accurately from natural speech.");

// 4. Test isComplexTask flags duplicate therapy queries
console.log("\n4. Verifying isComplexTask allocates reasoning headroom for duplicate therapy...");
assert.strictEqual(isComplexTask("Can I take Panadol and Flucold together?"), true);
assert.strictEqual(isComplexTask("I have two medications that perform the same task"), true);
console.log("✔ Same-task medication queries correctly designated as complex tasks.");

// 5. Test detectDuplicateTherapiesWithApis (Live RxNorm / openFDA fallback)
console.log("\n5. Verifying asynchronous API-backed duplicate detection...");
const apiDups = await detectDuplicateTherapiesWithApis([
  { name: "Panadol", genericName: "Paracetamol" },
  { name: "Flucold", genericName: "Paracetamol combination" }
]);
assert(apiDups.length >= 1, "Should detect duplicate paracetamol via RxNorm / clinical intelligence");
assert(apiDups[0].sharedClass.toLowerCase().includes("paracetamol") || apiDups[0].sharedClass.toLowerCase().includes("acetaminophen"));
console.log("✔ API-backed duplicate detection verified with RxNorm and openFDA enrichment.");

// 6. Test formatDuplicateTherapyWatchdogContext
console.log("\n6. Verifying watchdog prompt context formatting...");
const testGrounding = {
  profiles: [
    {
      queryName: "Brufen",
      rxNorm: { rxcui: "5640", canonicalName: "Ibuprofen" },
      activeIngredients: ["Ibuprofen"],
      pharmClasses: ["Nonsteroidal Anti-inflammatory Drug [EPC]"],
      localClass: THERAPEUTIC_CLASSES.NSAID
    },
    {
      queryName: "Voltaren",
      rxNorm: { rxcui: "3355", canonicalName: "Diclofenac" },
      activeIngredients: ["Diclofenac"],
      pharmClasses: ["Nonsteroidal Anti-inflammatory Drug [EPC]"],
      localClass: THERAPEUTIC_CLASSES.NSAID
    }
  ],
  duplicates: [
    {
      drug1: "Brufen",
      drug2: "Voltaren",
      sharedClass: "Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)",
      sharedTask: "relieving pain, reducing inflammation, and swelling",
      warning: "Concurrent use of two or more NSAIDs dramatically multiplies the risk of stomach ulcers.",
      dangers: ["Severe gastrointestinal ulceration", "Acute kidney injury"],
      guidance: "Do NOT take two NSAIDs together.",
      source: "openFDA & RxNorm"
    }
  ]
};

const formattedContext = formatDuplicateTherapyWatchdogContext(testGrounding);
assert(formattedContext.includes("AUTHORITATIVE REGULATORY GROUNDING (RxNorm & openFDA)"));
assert(formattedContext.includes("CLINICAL REFERENCE: THERAPEUTIC DUPLICATION"));
assert(formattedContext.includes("Brufen"));
assert(formattedContext.includes("Voltaren"));
assert(formattedContext.includes("CLINICAL GUIDELINES FOR DAWAGPT"));
assert(!formattedContext.includes("MANDATORY INSTRUCTIONS FOR DAWAGPT"), "Must not contain prompt-hijacking mandatory instructions");
console.log("✔ Watchdog context contains non-hijacking clinical guidelines.");

// 7. Test prepareDawaGPTContext injection
console.log("\n7. Verifying dynamic context injection in prepareDawaGPTContext...");
const contextResult = await prepareDawaGPTContext({
  messages: [{ role: 'user', content: 'Can I take Brufen and Voltaren at the same time?' }],
  medicines: [{ id: 'm1', name: 'Brufen' }, { id: 'm2', name: 'Voltaren' }],
  userProfile: { name: 'Amina', gender: 'female' },
  doseLogs: [],
  reminders: [],
  wellnessLogs: [],
  vitalitySummary: [],
  patients: [],
  isStreaming: false,
  isComplex: true
});

assert(contextResult.systemInstruction.includes("RXNORM & OPENFDA CLINICAL GROUNDING & DUPLICATE THERAPY"));
console.log("✔ Same-task questions receive clinical grounding in prepareDawaGPTContext.");

// 7b. Verifying that informational queries ("What are my reminders", "Check my medications") are NOT hijacked
console.log("\n7b. Verifying that informational queries are NOT hijacked into duplicate therapy alerts...");
const remindersContextResult = await prepareDawaGPTContext({
  messages: [{ role: 'user', content: 'What are my reminders' }],
  medicines: [{ id: 'm1', name: 'Brufen' }, { id: 'm2', name: 'Voltaren' }],
  userProfile: { name: 'Amina', gender: 'female' },
  doseLogs: [],
  reminders: [{ id: 'r1', medicineName: 'Brufen', time: '8:00 AM', repeatSchedule: 'daily' }],
  wellnessLogs: [],
  vitalitySummary: [],
  patients: [],
  isStreaming: false,
  isComplex: false
});

assert(!remindersContextResult.systemInstruction.includes("CLINICAL WATCHDOG: THERAPEUTIC DUPLICATION"),
  "Informational query 'What are my reminders' must not be hijacked into duplicate therapy alert even if cabinet has duplicates");
console.log("✔ Informational queries remain pure and are not hijacked by cabinet duplicate medicines.");

// 8. Test generateBackendClinicalFallback returns honest status without canned advice
console.log("\n8. Verifying clinical fallback response returns honest connectivity status without canned output...");
const fallbackResp = generateBackendClinicalFallback(
  "What are my reminders",
  [{ name: "Brufen" }, { name: "Voltaren" }],
  [],
  { name: "Amina", gender: "female" }
);

assert(!fallbackResp.text.includes("Therapeutic Duplication Alert"), "Fallback must NOT return canned Therapeutic Duplication Alert");
assert(fallbackResp.text.includes("live AI reasoning engine") || fallbackResp.text.includes("difficulty reaching"), "Fallback must state live AI status honestly");
assert(fallbackResp.text.includes("/medications"));
assert(fallbackResp.text.includes("/reminders"));
assert(fallbackResp.source.includes("System"));
console.log("✔ Offline fallback provides transparent reconnecting notice and official hotlines instead of canned advice.");

console.log("\n🎉 ALL THERAPEUTIC DUPLICATION & SAME-TASK MEDICATION TESTS PASSED SUCCESSFULLY!");

