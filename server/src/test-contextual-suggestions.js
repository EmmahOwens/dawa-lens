import assert from 'assert';
import { generateContextualSuggestions, isGenericBoilerplate } from './utils/contextualSuggestions.js';

console.log("=== Running Contextual Suggestions Unit Tests ===");

// 1. Test generic boilerplate detection
console.log("\n1. Testing generic boilerplate detection...");
assert.strictEqual(
  isGenericBoilerplate(["Check medications", "View reminders", "Drug safety"]),
  true,
  "Should flag classic generic boilerplate as generic"
);
assert.strictEqual(
  isGenericBoilerplate(["Try again", "Check my medications"]),
  true,
  "Should flag 'Try again' pairs as generic"
);
assert.strictEqual(
  isGenericBoilerplate([]),
  true,
  "Empty array should be flagged as needing contextual generation"
);
assert.strictEqual(
  isGenericBoilerplate(["Can I take Panadol with milk?", "Safe foods for headache", "When to see a doctor"]),
  false,
  "Specific medical questions should NOT be flagged as generic"
);
console.log("✔ Boilerplate detection correctly identifies generic and specific suggestions.");

// 2. Test medication topic extraction and suggestions
console.log("\n2. Testing medication-specific suggestions...");
const amoxSuggestions = generateContextualSuggestions({
  userQuery: "I was prescribed Amoxicillin 500mg. Can I take it with food?",
  assistantText: "Yes, Amoxicillin can be taken with or without food. Taking it with meals may reduce stomach discomfort."
});
assert.strictEqual(amoxSuggestions.length, 3);
assert(amoxSuggestions.some(s => s.toLowerCase().includes("amoxicillin") || s.toLowerCase().includes("food") || s.toLowerCase().includes("milk")), "Suggestions should reference Amoxicillin or food context");
console.log("✔ Amoxicillin food query generated contextual prompts:", amoxSuggestions);

// 3. Test symptom context (Headache)
console.log("\n3. Testing symptom-specific suggestions...");
const headacheSuggestions = generateContextualSuggestions({
  userQuery: "I have a pounding headache and feel fatigued.",
  assistantText: "Headaches can stem from dehydration, tension, or lack of rest. Ensure you drink plenty of fluids."
});
assert.strictEqual(headacheSuggestions.length, 3);
assert(headacheSuggestions.some(s => s.toLowerCase().includes("headache") || s.toLowerCase().includes("painkiller") || s.toLowerCase().includes("doctor")), "Suggestions should address headache relief and doctor advice");
console.log("✔ Headache symptom query generated contextual prompts:", headacheSuggestions);

// 4. Test Action context (ADD_REMINDER)
console.log("\n4. Testing action-based suggestions...");
const reminderSuggestions = generateContextualSuggestions({
  userQuery: "Remind me to take Metformin at 8am",
  action: { type: "ADD_REMINDER", payload: { medicineName: "Metformin", time: "08:00" } }
});
assert.strictEqual(reminderSuggestions.length, 3);
assert(reminderSuggestions.some(s => s.toLowerCase().includes("metformin") || s.toLowerCase().includes("reminder")), "Suggestions should directly follow up on Metformin reminder");
console.log("✔ ADD_REMINDER action generated contextual prompts:", reminderSuggestions);

// 5. Test Therapeutic Duplication context
console.log("\n5. Testing duplication context...");
const dupSuggestions = generateContextualSuggestions({
  userQuery: "Can I take Panadol and Ibuprofen together?",
  assistantText: "Taking both together involves therapeutic duplication risks if taking duplicate NSAIDs or exceeding safe doses."
});
assert.strictEqual(dupSuggestions.length, 3);
assert(dupSuggestions.some(s => s.toLowerCase().includes("panadol") || s.toLowerCase().includes("ibuprofen") || s.toLowerCase().includes("safer")), "Suggestions should address drug comparison and dose spacing");
console.log("✔ Duplication query generated contextual prompts:", dupSuggestions);

// 6. Test Route / Page Context (when opening on /interactions)
console.log("\n6. Testing route context on initial open...");
const routeSuggestions = generateContextualSuggestions({
  currentPage: "/interactions"
});
assert.strictEqual(routeSuggestions.length, 3);
assert(routeSuggestions.some(s => s.toLowerCase().includes("interact") || s.toLowerCase().includes("safe")), "Suggestions should relate to drug and food interactions");
console.log("✔ /interactions page generated contextual prompts:", routeSuggestions);

console.log("\nAll contextual suggestions unit tests passed successfully! 🎉");
