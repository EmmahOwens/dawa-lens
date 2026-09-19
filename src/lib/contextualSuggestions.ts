/**
 * Contextual Suggestion Engine for DawaGPT (Frontend)
 *
 * Ensures all suggested prompts dynamically and accurately match the immediate
 * conversation topic, medications, symptoms, and user actions. Replaces generic
 * boilerplate with natural, clinically relevant follow-up prompts.
 */

import { Medicine, Reminder, UserProfile, Patient } from "@/contexts/AppContext";
import { ResolvedPatient } from "@/hooks/usePatientScope";
import { ChatMessage, AIAction } from "@/services/aiAssistantService";

// Common generic boilerplate prompts that lack specific conversation grounding
const GENERIC_BOILERPLATE_PATTERNS = [
  /^check medications$/i,
  /^view reminders$/i,
  /^drug safety$/i,
  /^try (again|asking again)$/i,
  /^how is my pill stock\??$/i,
  /^open (my )?med vault$/i,
  /^contact (support|nda)( for uganda)?$/i,
  /^open settings$/i,
  /^check drug interactions$/i,
  /^check my medications$/i,
];

/**
 * Determines whether a suggestions array consists of generic boilerplate
 * that lacks specific grounding in the immediate conversation.
 */
export function isGenericBoilerplate(suggestions?: string[] | null): boolean {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return true;
  
  const genericCount = suggestions.filter(s => {
    if (typeof s !== "string") return true;
    const trimmed = s.trim();
    return GENERIC_BOILERPLATE_PATTERNS.some(pat => pat.test(trimmed));
  }).length;

  return genericCount >= 2;
}

interface SuggestionPattern {
  regex: RegExp;
  suggestions: string[];
}

const SYMPTOM_PATTERNS: SuggestionPattern[] = [
  {
    regex: /\b(headache|migraine|omutwe)\b/i,
    suggestions: [
      "Safe home remedies for headache",
      "Which painkiller is safest for me?",
      "When should I see a doctor?"
    ]
  },
  {
    regex: /\b(fever|temperature|musujja|chills)\b/i,
    suggestions: [
      "Safe ways to reduce fever",
      "Could this be malaria or infection?",
      "Warning signs that need urgent care"
    ]
  },
  {
    regex: /\b(malaria|coartem|artemether|lumefantrine)\b/i,
    suggestions: [
      "What food to take with Coartem?",
      "What if I vomit my malaria dose?",
      "How long until I feel better?"
    ]
  },
  {
    regex: /\b(stomach\s*ache|stomachache|nausea|vomit(ing)?|gastritis|ulcer|olubuto)\b/i,
    suggestions: [
      "Gentle foods that soothe nausea",
      "Which medicines irritate the stomach?",
      "When to consult a doctor"
    ]
  },
  {
    regex: /\b(dizzy|dizziness|lightheaded|vertigo)\b/i,
    suggestions: [
      "Could my medicine cause dizziness?",
      "What should I do right now?",
      "Check my blood pressure"
    ]
  },
  {
    regex: /\b(cough|flu|cold|sore throat|congestion|catarrh)\b/i,
    suggestions: [
      "Soothing drinks for cough and throat",
      "Do cold meds interact with my pills?",
      "How long does this usually last?"
    ]
  },
  {
    regex: /\b(diarrhea|loose stool|dehydration|ors)\b/i,
    suggestions: [
      "How to prepare ORS at home",
      "Safe foods to eat with diarrhea",
      "When is dehydration an emergency?"
    ]
  },
  {
    regex: /\b(hypertension|high blood pressure|bp|amlodipine|lisinopril|losartan)\b/i,
    suggestions: [
      "Foods that help manage blood pressure",
      "What if I forget my BP dose?",
      "Common side effects of BP meds"
    ]
  },
  {
    regex: /\b(diabetes|blood sugar|metformin|glibenclamide|insulin)\b/i,
    suggestions: [
      "Signs of low blood sugar (hypo)",
      "Best meal timing for Metformin",
      "Foods to moderate with diabetes"
    ]
  },
  {
    regex: /\b(pregnant|pregnancy|expecting|breastfeeding|nursing)\b/i,
    suggestions: [
      "Which medicines are safe in pregnancy?",
      "Safe remedies for morning sickness",
      "Consulting NDA pregnancy guidelines"
    ]
  },
  {
    regex: /\b(allergy|allergic|rash|itching|hives)\b/i,
    suggestions: [
      "Is this an allergic drug reaction?",
      "Signs of severe anaphylaxis",
      "Safe antihistamine options"
    ]
  }
];

const DIET_PATTERNS: SuggestionPattern[] = [
  {
    regex: /\b(alcohol|waragi|beer|wine|spirits|kasese|malwa)\b/i,
    suggestions: [
      "How long after alcohol can I take meds?",
      "Why is alcohol dangerous with Flagyl?",
      "Check liver safety with Panadol"
    ]
  },
  {
    regex: /\b(milk|dairy|yogurt|mukene|calcium)\b/i,
    suggestions: [
      "How many hours to space dairy?",
      "Does milk weaken antibiotics?",
      "Best non-dairy drinks with medicine"
    ]
  },
  {
    regex: /\b(grapefruit|grapefruit juice)\b/i,
    suggestions: [
      "Why does grapefruit block drug breakdown?",
      "Which medications does it affect?",
      "Safe alternative fruit juices"
    ]
  },
  {
    regex: /\b(matooke|posho|kalo|g-nut|bushera|food|meal|eat|swallow)\b/i,
    suggestions: [
      "Should I take my pills before or after meals?",
      "Does G-nut sauce boost absorption?",
      "Best soft foods for swallowing pills"
    ]
  }
];

function extractContextEntities(text: string, medicines: Medicine[] = []): { matchedMeds: string[]; norm: string } {
  const norm = (text || "").toLowerCase();
  const matchedMeds: string[] = [];

  if (Array.isArray(medicines)) {
    for (const m of medicines) {
      if (m?.name && norm.includes(m.name.toLowerCase())) {
        matchedMeds.push(m.name);
      } else if (m?.genericName && norm.includes(m.genericName.toLowerCase())) {
        matchedMeds.push(m.genericName);
      }
    }
  }

  const commonDrugs = [
    "Panadol", "Paracetamol", "Ibuprofen", "Amoxicillin", "Coartem", "Metronidazole",
    "Flagyl", "Metformin", "Ciprofloxacin", "Amlodipine", "Omeprazole", "Diclofenac",
    "Cetirizine", "Azithromycin", "Artemether", "Lumefantrine", "Warfarin", "Aspirin"
  ];
  for (const d of commonDrugs) {
    if (norm.includes(d.toLowerCase()) && !matchedMeds.some(m => m.toLowerCase() === d.toLowerCase())) {
      matchedMeds.push(d);
    }
  }

  return { matchedMeds, norm };
}

export interface GetContextualSuggestionsParams {
  messages?: ChatMessage[];
  userQuery?: string;
  assistantText?: string;
  medicines?: Medicine[];
  reminders?: Reminder[];
  userProfile?: UserProfile | null;
  activePatient?: Patient | ResolvedPatient | null;
  currentPage?: string | null;
  action?: AIAction | null;
  existingSuggestions?: string[];
}

/**
 * Dynamically computes 3 suggestions that strictly match the conversation context.
 */
export function getContextualSuggestions({
  messages = [],
  userQuery = "",
  assistantText = "",
  medicines = [],
  reminders = [],
  userProfile = null,
  activePatient = null,
  currentPage = null,
  action = null,
  existingSuggestions = []
}: GetContextualSuggestionsParams = {}): string[] {
  // If specific, non-boilerplate suggestions are provided, keep them
  if (
    Array.isArray(existingSuggestions) &&
    existingSuggestions.length >= 2 &&
    !isGenericBoilerplate(existingSuggestions)
  ) {
    return existingSuggestions.slice(0, 3);
  }

  const lastUserMsg = userQuery || (
    Array.isArray(messages)
      ? messages.filter(m => m.role === "user").pop()?.text || ""
      : ""
  );
  const lastAssistantMsg = assistantText || (
    Array.isArray(messages)
      ? messages.filter(m => m.role === "assistant").pop()?.text || ""
      : ""
  );

  const combinedText = `${lastUserMsg} ${lastAssistantMsg}`;
  const { matchedMeds, norm } = extractContextEntities(combinedText, medicines);
  const suggestions: string[] = [];

  // 1. Action-Based Suggestions (if an action was executed)
  if (action && action.type) {
    const medName = (action.payload as any)?.medicineName || (action.payload as any)?.name || matchedMeds[0] || "my medicine";
    switch (action.type) {
      case "ADD_REMINDER":
        suggestions.push("Set an evening reminder");
        suggestions.push(`What food to take with ${medName}?`);
        suggestions.push(`Does ${medName} have side effects?`);
        return suggestions.slice(0, 3);
      case "LOG_DOSE":
        suggestions.push(`When is my next dose of ${medName}?`);
        suggestions.push("Log another dose");
        suggestions.push("How many doses left in vault?");
        return suggestions.slice(0, 3);
      case "UPDATE_MEDICINE":
        suggestions.push(`How many days supply is ${medName}?`);
        suggestions.push(`Set a reminder for ${medName}`);
        suggestions.push("When will I need a refill?");
        return suggestions.slice(0, 3);
      case "LOG_WELLNESS":
        suggestions.push("Safe remedies to soothe symptoms");
        suggestions.push("When should I see a doctor?");
        suggestions.push("Can I take medication for this?");
        return suggestions.slice(0, 3);
    }
  }

  // 2. Direct Action Intent in Query (e.g. reminder, refill, dose log)
  if (/\b(remind|alarm|schedule)\b/i.test(lastUserMsg)) {
    const med = matchedMeds[0] || "this medicine";
    suggestions.push(`What food to take with ${med}?`);
    suggestions.push(`What if I miss a dose of ${med}?`);
    suggestions.push("How many days of supply do I have?");
    return suggestions.slice(0, 3);
  }

  if (/\b(refill|stock|vault|pill count|supply|doses left|days left)\b/i.test(lastUserMsg)) {
    const med = matchedMeds[0] || "my meds";
    suggestions.push(`How many days of ${med} are left?`);
    suggestions.push("Which medicines need restocking?");
    suggestions.push("Set reminder before stock runs out");
    return suggestions.slice(0, 3);
  }

  // 3. Therapeutic Duplication / Interaction Context
  if (
    /\b(duplicat|same class|same task|taking both|together|interact|conflict)\b/i.test(norm) &&
    matchedMeds.length >= 2
  ) {
    suggestions.push(`Which is safer: ${matchedMeds[0]} or ${matchedMeds[1]}?`);
    suggestions.push("Can I alternate them safely?");
    suggestions.push("How many hours between doses?");
    return suggestions.slice(0, 3);
  }

  // 4. Specific Medication Context
  if (matchedMeds.length > 0) {
    const primaryMed = matchedMeds[0];

    if (/\b(food|eat|drink|milk|alcohol|matooke|meal)\b/i.test(norm)) {
      suggestions.push(`Can I take ${primaryMed} with milk?`);
      suggestions.push(`What foods should I avoid with ${primaryMed}?`);
      suggestions.push(`Should I take ${primaryMed} with meals?`);
      return suggestions.slice(0, 3);
    }

    if (/\b(side effect|reaction|danger|safe|harm|bad)\b/i.test(norm)) {
      suggestions.push(`Common side effects of ${primaryMed}`);
      suggestions.push(`What if I feel dizzy after ${primaryMed}?`);
      suggestions.push(`When to call a doctor for ${primaryMed}`);
      return suggestions.slice(0, 3);
    }

    suggestions.push(`What foods go well with ${primaryMed}?`);
    suggestions.push(`What if I miss a dose of ${primaryMed}?`);
    suggestions.push(`Does ${primaryMed} interact with anything?`);
    return suggestions.slice(0, 3);
  }

  // 5. Symptom / Health Condition Context
  for (const item of SYMPTOM_PATTERNS) {
    if (item.regex.test(norm)) {
      return item.suggestions.slice(0, 3);
    }
  }

  // 6. Dietary Context
  for (const item of DIET_PATTERNS) {
    if (item.regex.test(norm)) {
      return item.suggestions.slice(0, 3);
    }
  }

  // 7. Demographic / Patient-Specific Context
  const userAge = userProfile?.dateOfBirth
    ? new Date().getFullYear() - new Date(userProfile.dateOfBirth).getFullYear()
    : undefined;
  const patientAge = activePatient?.age ?? (
    activePatient && 'dateOfBirth' in activePatient && activePatient.dateOfBirth
      ? new Date().getFullYear() - new Date(activePatient.dateOfBirth).getFullYear()
      : userAge
  );
  if (patientAge !== undefined && patientAge !== null) {
    if (patientAge < 12 || /\b(child|baby|infant|toddler|pediatric)\b/i.test(norm)) {
      return [
        "Chewable medication options",
        "Can I crush tablets in porridge?",
        "Safe drinks for children"
      ];
    }
    if (patientAge >= 65 || /\b(senior|elderly|grandma|grandpa)\b/i.test(norm)) {
      return [
        "Swallowing tips for seniors",
        "Soothing foods to take with pills",
        "Checking drug interactions"
      ];
    }
  }

  // 8. Route / Feature Context (when conversation is starting or empty)
  if (currentPage) {
    if (currentPage.includes("/interactions")) {
      return [
        "Does Panadol interact with Ibuprofen?",
        "Is Matooke safe with my meds?",
        "Can I drink alcohol with antibiotics?"
      ];
    }
    if (currentPage.includes("/medvault")) {
      return [
        "How many days of meds do I have left?",
        "Which medications are low on stock?",
        "How is days of supply calculated?"
      ];
    }
    if (currentPage.includes("/reminders")) {
      return [
        "Add a medicine reminder for 8:00 AM",
        "What are my scheduled doses today?",
        "How to pause or snooze a reminder"
      ];
    }
    if (currentPage.includes("/wellness")) {
      return [
        "Log how I am feeling today",
        "Safe home remedies for headache",
        "How to improve my vitality score"
      ];
    }
    if (currentPage.includes("/family-hub")) {
      return [
        "Check family medication schedules",
        "Add a family member or dependent",
        "Check interactions for family"
      ];
    }
    if (currentPage.includes("/travel")) {
      return [
        "Calculate travel medication supply",
        "Adjusting doses across time zones",
        "Carrying prescriptions through customs"
      ];
    }
  }

  // 9. Prescriptions in cabinet
  if (Array.isArray(medicines) && medicines.length > 0) {
    const med = medicines[0].name;
    return [
      `When should I take ${med}?`,
      `Does ${med} have side effects?`,
      `Is ${med} safe with local foods?`
    ];
  }

  // 10. Intelligent Default Health Companion Prompts
  return [
    "Check drug & food safety",
    "What foods pair well with medicines?",
    "How to manage side effects"
  ];
}
