/**
 * DawaGPT Service
 * Conversational medical assistant with full system read/write access.
 * Focused on Ugandan healthcare context and user safety.
 */

import type { Medicine, Reminder, UserProfile, DoseLog, WellnessLog, Patient } from "../contexts/AppContext";
import { checkConditionSafety } from "./conditionInteractionService";
import { calculateRefillStatus, getDailyDoseRate } from "./refillService";
import { aiApi } from "./api";
import {
  isSameTaskOrDuplicateQuery,
  detectDuplicateTherapies,
  extractDrugsFromQuery,
  findLocalTherapeuticClass
} from "./therapeuticDuplicationService";
import { getContextualSuggestions } from "@/lib/contextualSuggestions";
import { resolveToInternalRoute } from "@/components/MessageRenderer";
import {
  normalizeAIAction,
  resolveHonorific,
  enforceGenderHonorifics,
  distributeTimes,
  userRequestedReminder,
  extractDeterministicAction,
  extractWellnessData,
  formatActionExecutionMessage as formatSharedActionMessage,
  buildReminderClarificationResponse,
  buildAgeTailoredFoodGuidance,
} from "../../server/src/utils/aiDeterministicUtils.js";

export {
  normalizeAIAction,
  resolveHonorific,
  enforceGenderHonorifics,
  distributeTimes,
  userRequestedReminder,
  extractDeterministicAction,
  extractWellnessData,
};

export type AIActionType =
  | "ADD_REMINDER"
  | "LOG_DOSE"
  | "ADD_MEDICINE"
  | "UPDATE_MEDICINE"
  | "REMOVE_MEDICINE"
  | "DISCONTINUE_MEDICINE"
  | "UPDATE_REMINDER"
  | "REMOVE_REMINDER"
  | "TOGGLE_REMINDER"
  | "SNOOZE_REMINDER"
  | "BATCH_ADD_REGIMEN"
  | "UNDO_DOSE_LOG"
  | "LOG_WELLNESS"
  | "ADD_PATIENT"
  | "UPDATE_PATIENT"
  | "REMOVE_PATIENT"
  | "SWITCH_PATIENT_SCOPE"
  | "OPEN_PHARMACY_MODAL"
  | "NAVIGATE_PAGE"
  | null;

export interface AIAction {
  type: AIActionType;
  payload: Record<string, unknown> | null;
  confirmMessage?: string;
  requiresConfirmation?: boolean;
}

export type ChatMessageSource =
  | "NDA"
  | "ANDA"
  | "WHO"
  | "openFDA"
  | "System"
  | "Gemini"
  | "MoH"
  | "Cabinet Guard"
  | "Schedule Guard"
  | "Adherence Guard"
  | "Med Vault"
  | "Family Hub Guard"
  | "Navigator Guard"
  | "NDA Locator Guard"
  | "Wellness Guard"
  | "NDA / Mental Health Support";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sender?: "user" | "dawagpt" | "assistant" | string;
  content?: string;
  source?: ChatMessageSource;
  patterns?: string[];
  score?: number;
  suggestions?: string[];
  action?: AIAction;
}

export type ChatHistoryItem = ChatMessage | {
  id?: string;
  role?: "user" | "assistant" | string;
  sender?: "user" | "dawagpt" | "assistant" | string;
  text?: string;
  content?: string;
  [key: string]: any;
};

interface ExtractedWellnessData {
  mood: number;
  energy: number;
  symptoms: string[];
  notes: string;
}

function sanitizeMarkdownLinks(text: string): string {
  if (typeof text !== "string") return "";

  let cleaned = text.replace(/support@dawalens\.ug/gi, "[Settings](/settings)");
  cleaned = cleaned.replace(/https?:\/\/(?:www\.)?dawalens\.ug[^\s)\]]*/gi, "/settings");

  return cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, rawHref) => {
    const resolved = resolveToInternalRoute(rawHref, label);
    return resolved ? `[${label}](${resolved})` : `[${label}](/)`;
  });
}

const FAQ_RESPONSE_MAP: Record<string, string> = {
  "oli otya": "Oli otya! I am doing well{{salutation}}. How can DawaGPT help you with your health or medicines today?",
  "wasuze otya": "Wasuze otya! I hope you slept well and are ready for a healthy day. How can I help you today?",
  "osiibye otya": "Osiibye otya! How has your day been? Let's check your evening medication adherence.",
  "gyebaleko": "Gyebaleko! Thank you. I am here to help you manage your health. How are you feeling today?",
  "webale": "Kale! You're welcome. Let me know if you need help with reminders or safety checks.",
  "eddagala": "Eddagala (medicine) is key to your health. You can [view your active medications](/medications) or [set up a dose reminder](/reminders/new).",
  "contact support": "Official Uganda Support Contacts:\n• National Drug Authority (NDA) Uganda: Toll-Free 0800 101 999 | WhatsApp +256 791 415 555 (for drug safety, side effects & fake medicines)\n• Mental Health Support in Uganda: Toll-Free 0800 200 600 (StrongMinds psychosocial support) | Butabika National Referral Mental Hospital: Toll-Free 0800 211 306 / +256 414 504 375",
  "support uganda": "Uganda Support:\n• National Drug Authority (NDA) Uganda: Toll-Free 0800 101 999 | WhatsApp +256 791 415 555\n• Mental Health Support in Uganda: Toll-Free 0800 200 600 | Butabika Hospital: Toll-Free 0800 211 306",
  "uganda support": "Uganda Support:\n• National Drug Authority (NDA) Uganda: Toll-Free 0800 101 999 | WhatsApp +256 791 415 555\n• Mental Health Support in Uganda: Toll-Free 0800 200 600 | Butabika Hospital: Toll-Free 0800 211 306",
  "emergency contact": "Official Uganda Support Contacts:\n• National Drug Authority (NDA) Uganda: Toll-Free 0800 101 999 | WhatsApp +256 791 415 555\n• Mental Health Support in Uganda: Toll-Free 0800 200 600 (StrongMinds) | Butabika Hospital: Toll-Free 0800 211 306",
  "customer care": "For support in Uganda:\n• National Drug Authority (NDA) Uganda: Toll-Free 0800 101 999 | WhatsApp +256 791 415 555\n• Mental Health Support in Uganda: Toll-Free 0800 200 600 | Butabika Hospital: Toll-Free 0800 211 306",
};

function resolveActiveGender(
  selectedPatientId: string | null,
  patients: Patient[],
  userProfile: UserProfile | null
): string | undefined {
  return (
    (selectedPatientId && patients.length > 0
      ? patients.find((p) => p.id === selectedPatientId)?.gender
      : undefined) || userProfile?.gender
  );
}

// ── Domain Handlers for generateDawaGPTResponseImpl ─────────────────────────────

function formatActionExecutionMessage(
  query: string,
  action: AIAction,
  allMedicines: Medicine[],
  reminders: Reminder[],
  patients: Patient[],
  selectedPatientId: string | null,
  userProfile: UserProfile | null
): ChatMessage | null {
  const honorific = resolveHonorific(resolveActiveGender(selectedPatientId, patients, userProfile));
  const greeting = honorific ? ` ${honorific}` : "";
  const formatted = formatSharedActionMessage(action, greeting);
  if (!formatted) return null;

  const suggestions =
    formatted.suggestions || getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders });

  return {
    id: Date.now().toString(),
    role: "assistant",
    text: formatted.text,
    suggestions,
    source: formatted.source as ChatMessageSource,
    action
  };
}

function handleReminderClarification(normalizedQuery: string, allMedicines: Medicine[]): ChatMessage {
  const clarified = buildReminderClarificationResponse(normalizedQuery, allMedicines);
  return {
    id: Date.now().toString(),
    role: "assistant",
    text: clarified.text,
    suggestions: clarified.suggestions,
    source: clarified.source as ChatMessageSource
  };
}

const SUPPORT_KEYWORDS = [
  "support", "contact support", "customer care", "customer service", "help desk",
  "helpdesk", "helpline", "hotline", "emergency contact", "emergency number",
  "who can i call", "who do i contact", "who to contact", "moh contact",
  "nda hotline", "nda contact"
];

const PERSONA_KEYWORDS = [
  "about yourself", "who are you", "what are you", "what can you do",
  "tell me about you", "introduce yourself"
];

function handleSupportOrPersonaQuery(normalizedQuery: string, honorific: string): ChatMessage | null {
  const isAskingForSupport =
    SUPPORT_KEYWORDS.some((k) => normalizedQuery.includes(k)) ||
    (normalizedQuery.includes("help") &&
      ["call", "number", "contact", "phone", "uganda"].some((k) => normalizedQuery.includes(k)));

  if (isAskingForSupport) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text:
        "Here is the official **Support Directory for Uganda**:\n\n" +
        "• **National Drug Authority (NDA) Uganda** *(for medicine safety, adverse drug reactions & reporting counterfeit drugs)*:\n" +
        "  - **Toll-Free Line**: **0800 101 999**\n" +
        "  - **WhatsApp**: **+256 791 415 555**\n" +
        "  - **Head Office**: **+256 417 788 100**\n" +
        "  - **Email**: **ndaug@nda.or.ug** | Pharmacovigilance: **druginfo@nda.or.ug**\n\n" +
        "• **Mental Health Support in Uganda** *(for psychosocial support, depression, anxiety & psychiatric care)*:\n" +
        "  - **Mental Health & Psychosocial Support (StrongMinds)**: Toll-Free **0800 200 600**\n" +
        "  - **Butabika National Referral Mental Hospital**: Toll-Free **0800 211 306** | General Line: **+256 414 504 375**\n" +
        "  - **Mental Health Uganda (MHU)**: Toll-Free **0800 21 21 21**",
      source: "NDA / Mental Health Support",
      suggestions: ["National Drug Authority Helpline", "Mental Health Support Uganda"]
    };
  }

  if (PERSONA_KEYWORDS.some((k) => normalizedQuery.includes(k))) {
    const greeting = honorific ? ` ${honorific}` : "";
    return {
      id: Date.now().toString(),
      role: "assistant",
      text:
        `Oli otya${greeting}! I'm **DawaGPT**, your dedicated Ugandan AI health and medication companion built for DawaLens.\n\n` +
        `Here is how I can support you:\n` +
        `• 💊 **Medication Safety & Dosage**: Provide clear dosage explanations, side effect alerts, and National Drug Authority (NDA) Uganda standards.\n` +
        `• ⚠️ **Drug & Food Interactions**: Screen your prescriptions against local foods (like *Matooke*, *Posho*, *G-nut sauce*) and alcohol (*Waragi*).\n` +
        `• ⏰ **Smart Reminders**: Keep your schedule on track with alarms and dose alerts in [Medication Reminders](/reminders).\n` +
        `• 📦 **Med Vault & Refill Tracking**: Monitor your exact pill count and calculate remaining days of supply in [Med Vault](/medvault).\n` +
        `• 🩺 **Verified Support**: Instantly surface Uganda support contacts for the National Drug Authority (NDA 0800 101 999) and Mental Health Support (0800 200 600).\n\n` +
        `What medication or health question can I help you with today?`,
      source: "System",
      suggestions: ["Check my medications", "How is my pill stock?", "Check drug interactions"]
    };
  }

  return null;
}

function buildDupAlertMessage(
  drug1: string,
  drug2: string,
  sharedTask: string,
  sharedClass: string,
  dangers: string[],
  guidance: string,
  salutation: string,
  firstSuggestion: string
): ChatMessage {
  const dangersList = dangers.map((d: string) => `• ⚠️ **${d}**`).join("\n");
  return {
    id: Date.now().toString(),
    role: "assistant",
    text:
      `⚠️ **Therapeutic Duplication Alert**:\n\n` +
      `Bambi${salutation}, taking **${drug1}** and **${drug2}** together is dangerous because **both medications perform the exact same clinical task** (${sharedTask}).\n\n` +
      `**Why this is harmful (Additive Toxicity & Ceiling Effect)**:\n` +
      `Doubling up on medicines from the same class (${sharedClass}) **does not give you double the relief**. Instead, it severely multiplies the risk of toxic side effects and organ injury:\n` +
      `${dangersList}\n\n` +
      `**Recommended Next Steps**:\n` +
      `1. **Do not take both medicines at the same time**.\n` +
      `2. ${guidance}\n` +
      `3. You can [check your full cabinet in Drug & Food Interactions](/interactions) or [review your active prescriptions in My Medications](/medications).\n\n` +
      `*Source: National Drug Authority (NDA) Uganda & U.S. FDA Drug Safety.*`,
    source: "NDA",
    suggestions: [firstSuggestion, "Check drug interactions", "View active medications"]
  };
}

function handleDuplicateTherapyQuery(
  normalizedQuery: string,
  allMedicines: Medicine[],
  honorific: string
): ChatMessage | null {
  const isDupQuery = isSameTaskOrDuplicateQuery(normalizedQuery, allMedicines);
  const hasSafetyDupOverlap =
    allMedicines.length >= 2 &&
    detectDuplicateTherapies(allMedicines).length > 0 &&
    ["interact", "safe", "conflict"].some((k) => normalizedQuery.includes(k));

  if (!isDupQuery && !hasSafetyDupOverlap) return null;

  const cabinetDuplicates = detectDuplicateTherapies(allMedicines);
  const queryDrugs = extractDrugsFromQuery(normalizedQuery, allMedicines);
  const queryDuplicates =
    queryDrugs.length >= 2 ? detectDuplicateTherapies(queryDrugs.map((name) => ({ name }))) : [];
  const activeDup = queryDuplicates[0] || cabinetDuplicates[0];
  const salutation = honorific ? ` ${honorific}` : "";

  if (activeDup) {
    return buildDupAlertMessage(
      activeDup.drug1,
      activeDup.drug2,
      activeDup.sharedTask,
      activeDup.sharedClass,
      activeDup.dangers,
      activeDup.guidance,
      salutation,
      "Which one should I stop?"
    );
  }

  if (queryDrugs.length >= 2) {
    const class1 = findLocalTherapeuticClass(queryDrugs[0]);
    const class2 = findLocalTherapeuticClass(queryDrugs[1]);
    if (class1 && class2 && class1.id === class2.id) {
      return buildDupAlertMessage(
        queryDrugs[0],
        queryDrugs[1],
        class1.task,
        class1.name,
        class1.dangers,
        class1.guidance,
        salutation,
        "Which one is safer for me?"
      );
    }
  }

  return {
    id: Date.now().toString(),
    role: "assistant",
    text:
      `⚠️ **Clinical Interaction Warning: Medications Performing the Same Task**\n\n` +
      `Bambi${salutation}, taking more than one medication that performs the same clinical task is known as **Therapeutic Duplication**.\n\n` +
      `**Key Clinical Facts**:\n` +
      `• ⚠️ **The "Ceiling Effect"**: Doubling up on medicines that do the same thing does **not** give you double the pain relief or healing. Receptor targets in the body become saturated.\n` +
      `• ⚠️ **Additive Toxicity**: While the therapeutic benefit hits a ceiling, the risk of toxic side effects and organ injury multiplies drastically. For example, taking two NSAIDs (like Ibuprofen and Diclofenac) severely damages the stomach lining and kidneys; taking two Paracetamol products causes acute toxic liver failure; combining multiple blood pressure medications causes dangerous hypotension and kidney shutdown.\n` +
      `• ⚠️ **Hidden Ingredients**: Many over-the-counter cold and flu preparations already contain painkillers or antihistamines.\n\n` +
      `**Recommended Next Steps**:\n` +
      `1. **Never take both medications simultaneously** unless specifically instructed and monitored by your physician.\n` +
      `2. Consult your doctor or pharmacist to determine the single most appropriate medicine for your condition.\n` +
      `3. You can [check drug & food interactions in Interactions Guard](/interactions) or [review your active prescriptions in My Medications](/medications).\n\n` +
      `*Sources: National Drug Authority (NDA) Uganda, NLM RxNorm & U.S. FDA Drug Safety.*`,
    source: "NDA",
    suggestions: ["Check drug interactions", "View active medications", "Ask about my prescriptions"]
  };
}

function resolveFoodQueryAge(
  normalizedQuery: string,
  selectedPatientId: string | null,
  patients: Patient[],
  userProfile: UserProfile | null
): number | null {
  if (/\b(infant|baby|newborn)\b/i.test(normalizedQuery)) return 0;
  if (/\b(toddler)\b/i.test(normalizedQuery)) return 2;

  const match =
    normalizedQuery.match(/\b(?:age|aged)\s*(\d{1,2})\b/) ||
    normalizedQuery.match(/\b(\d{1,2})\s*(?:years?\s*old|yrs?\s*old|yo|-year-old|-yr-old)\b/) ||
    normalizedQuery.match(/\b(?:child|kid|boy|girl)\s*(?:of|aged)?\s*(\d{1,2})\b/);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 120) return parsed;
  }

  if (/\b(child|kid)\b/i.test(normalizedQuery)) return 7;
  if (/\b(elderly|senior|geriatric|old person|older adult|grandma|grandpa|granny|jajja)\b/i.test(normalizedQuery)) {
    return 72;
  }

  const activePatient = selectedPatientId && patients.length > 0 ? patients.find((p) => p.id === selectedPatientId) : null;
  const targetEntity = activePatient || userProfile;
  if (!targetEntity) return null;

  if (typeof (targetEntity as any).age === "number") return (targetEntity as any).age;
  if (targetEntity.dateOfBirth) {
    const dob = new Date(targetEntity.dateOfBirth);
    if (!isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      if (age >= 0 && age <= 150) return age;
    }
  }
  return null;
}

const FOOD_KNOWN_DRUG_ALIASES: Array<{ keys: string[]; name: string }> = [
  { keys: ["panadol", "paracetamol"], name: "Panadol (Paracetamol)" },
  { keys: ["coartem", "artemether", "lumefantrine"], name: "Coartem (Artemether/Lumefantrine)" },
  { keys: ["ibuprofen", "nurofen"], name: "Nurofen (Ibuprofen)" },
  { keys: ["flagyl", "metronidazole"], name: "Flagyl (Metronidazole)" },
  { keys: ["amoxicillin", "augmentin"], name: "Amoxicillin" },
  { keys: ["ciprofloxacin", "cipro"], name: "Ciprofloxacin" },
  { keys: ["metformin"], name: "Metformin" }
];

const FOOD_QUERY_KEYWORDS = [
  "food", "eat", "drink", "chew", "chewable", "swallow", "meal", "take with",
  "beverage", "applesauce", "yogurt", "oatmeal", "bushera", "matooke", "g-nut", "posho"
];

function handleFoodAndDrinkQuery(
  normalizedQuery: string,
  isAskingForPageLink: boolean,
  activeMedicine: Medicine | null,
  allMedicines: Medicine[],
  userProfile: UserProfile | null,
  patients: Patient[],
  selectedPatientId: string | null,
  honorific: string
): ChatMessage | null {
  if (isAskingForPageLink || !FOOD_QUERY_KEYWORDS.some((k) => normalizedQuery.includes(k))) {
    return null;
  }

  const resolvedAge = resolveFoodQueryAge(normalizedQuery, selectedPatientId, patients, userProfile);
  const greeting = honorific ? ` ${honorific}` : "";

  const cabinetMatch = (allMedicines || []).find((m) => m.name && normalizedQuery.includes(m.name.toLowerCase()));
  const aliasMatch = FOOD_KNOWN_DRUG_ALIASES.find((a) => a.keys.some((k) => normalizedQuery.includes(k)));
  const medName =
    cabinetMatch?.name || aliasMatch?.name || activeMedicine?.name || allMedicines?.[0]?.name || "your medication";

  const guidance = buildAgeTailoredFoodGuidance(medName, resolvedAge, greeting);
  return {
    id: Date.now().toString(),
    role: "assistant",
    text: guidance.text,
    suggestions: guidance.suggestions,
    source: "MoH"
  };
}

const PAGE_LINK_RESPONSES: Array<{ keys: string[]; text: string; suggestions: string[] }> = [
  {
    keys: ["vault", "stock", "inventory", "pill count"],
    text: "You can [check your pill stock in Med Vault](/medvault) to see your remaining doses, days of supply, and restock supplies.",
    suggestions: ["Open Med Vault", "How many days of meds left?", "Check reminders"]
  },
  {
    keys: ["reminder", "alarm", "schedule", "timing"],
    text: "You can [manage your active alarms in Medication Reminders](/reminders) or [set up a new reminder](/reminders/new) for your daily dose schedule.",
    suggestions: ["View reminders", "Add a reminder", "Check history"]
  },
  {
    keys: ["search", "lookup", "monograph", "drug info", "information"],
    text: "You can [look up clinical drug facts in Search Medications](/search) for verified monographs and NDA dosage guidelines.",
    suggestions: ["Search medicine", "Check interactions", "View medications"]
  },
  {
    keys: ["medication", "medicine list", "cabinet", "my drug", "prescriptions"],
    text: "You can [view your active prescriptions in My Medications](/medications) whenever you need to check your doses.",
    suggestions: ["View my medications", "Check Med Vault", "Add a reminder"]
  },
  {
    keys: ["history", "log", "past dose", "adherence"],
    text: "You can [review your past logs in Dose History](/history) to track your adherence and streak over time.",
    suggestions: ["View dose history", "What are my reminders?", "Export report"]
  },
  {
    keys: ["wellness", "mood", "symptom", "vibe", "meal journal"],
    text: "Let's [log your symptoms and daily vibe in Wellness Hub](/wellness) to keep a holistic picture of how you feel.",
    suggestions: ["Log my symptoms", "Check daily vibe", "View dose history"]
  },
  {
    keys: ["travel", "flight", "trip", "timezone"],
    text: "You can [calculate your travel medicine supply in Travel Companion](/travel) and adjust your dose timing across time zones.",
    suggestions: ["Open Travel Companion", "Check pill stock", "View reminders"]
  },
  {
    keys: ["report", "pdf", "doctor", "export"],
    text: "You can [export an adherence report for your doctor](/report) to share verified logs ahead of your next appointment.",
    suggestions: ["Generate report", "View dose history", "Check adherence"]
  },
  {
    keys: ["scan", "camera", "picture", "ocr"],
    text: "You can [take a photo to scan your medicine in Visual Scanner](/scan) to identify pills or parse prescription labels.",
    suggestions: ["Open Scanner", "Search medicine", "Check interactions"]
  },
  {
    keys: ["setting", "profile", "account", "preference"],
    text: "You can [manage your profile and preferences in Settings](/settings) to update emergency contacts and notifications.",
    suggestions: ["Open Settings", "View profile", "Check reminders"]
  }
];

function handleInteractionAndPageLinkQueries(
  normalizedQuery: string,
  isAskingForPageLink: boolean
): ChatMessage | null {
  const isInteractionQuery =
    normalizedQuery.includes("interact") ||
    normalizedQuery.includes("safety guard") ||
    (isAskingForPageLink &&
      ["safety", "food check", "compatibility"].some((k) => normalizedQuery.includes(k)));

  if (isInteractionQuery) {
    if (normalizedQuery.includes("metronidazole") || normalizedQuery.includes("flagyl")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text:
          "Yes, **Flagyl (Metronidazole)** has critical interactions you must watch out for:\n\n" +
          "1. ⚠️ **Alcohol & Local Brews (Waragi, Beer, Kasese, Wine)** — **CRITICAL**: Metronidazole blocks alcohol breakdown, causing a severe **disulfiram-like reaction** with violent vomiting, rapid heartbeat (tachycardia), facial flushing, headache, and severe stomach cramps. **NEVER drink alcohol** while taking Metronidazole and for at least **48 hours** after finishing your course.\n" +
          "2. ⚠️ **Blood Thinners (Warfarin)**: Metronidazole significantly increases Warfarin's anticoagulant effect, raising your risk of heavy bleeding.\n" +
          "3. ⚠️ **Lithium**: Can cause toxic buildup of lithium in the body.\n" +
          "4. ℹ️ **Food**: Taking Metronidazole with food or milk (such as *Matooke* or *Posho*) helps reduce stomach upset and metallic taste.\n\n" +
          "You can [check your drug & food interactions](/interactions) anytime to verify how Metronidazole pairs with your active cabinet.",
        source: "MoH",
        suggestions: ["Metronidazole with alcohol", "Check my interactions", "View medicine cabinet"]
      };
    }

    if (["coartem", "artemether", "lumefantrine"].some((k) => normalizedQuery.includes(k))) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text:
          "Here is crucial safety and interaction guidance for **Coartem (Artemether / Lumefantrine)**:\n\n" +
          "1. 🍲 **Fatty Food Requirement**: Coartem **must** be taken with or immediately after food containing fat (e.g. *G-nut sauce*, milk, eggs, or avocado) to ensure proper absorption against malaria parasites.\n" +
          "2. ⚠️ **Grapefruit Juice**: Avoid large amounts as it can increase drug blood levels.\n" +
          "3. ⚠️ **Heart Medications / QT-prolonging drugs**: Avoid combining with medications that affect heart rhythm.\n\n" +
          "You can [check your drug & food interactions](/interactions) to ensure your full malaria treatment is safe.",
        source: "MoH",
        suggestions: ["Best foods for Coartem", "Check drug interactions", "View reminders"]
      };
    }

    if (normalizedQuery.includes("paracetamol") || normalizedQuery.includes("panadol")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text:
          "Here are important safety and interaction facts for **Panadol (Paracetamol)**:\n\n" +
          "1. ⚠️ **Alcohol (Waragi, Beer)**: Regular or heavy alcohol use with Paracetamol increases the risk of acute liver toxicity.\n" +
          "2. ⚠️ **Duplicate Paracetamol Products**: Many cold & flu remedies (e.g. Flucold, ColdCap) contain paracetamol. Avoid double-dosing. Never exceed **4,000mg (4g)** in 24 hours.\n" +
          "3. ⚠️ **Blood Thinners (Warfarin)**: High daily paracetamol doses over several days can increase bleeding risks.\n\n" +
          "You can [check your drug & food interactions](/interactions) to check all your medicines.",
        source: "MoH",
        suggestions: ["Safe daily Paracetamol dose", "Check drug interactions", "View medications"]
      };
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [check your drug & food interactions](/interactions) to verify if your medicines are safe with meals like Matooke, G-nuts, or Waragi, and guard against duplicate therapies.",
      source: "System",
      suggestions: ["Check drug interactions", "Is Matooke safe with my meds?", "Open Interactions"]
    };
  }

  if (isAskingForPageLink) {
    const matched = PAGE_LINK_RESPONSES.find((r) => r.keys.some((k) => normalizedQuery.includes(k)));
    if (matched) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: matched.text,
        source: "System",
        suggestions: matched.suggestions
      };
    }
  }

  return null;
}

function handleFamilyHubQuery(
  normalizedQuery: string,
  patients: Patient[],
  allMedicines: Medicine[],
  reminders: Reminder[]
): ChatMessage | null {
  const familyKeywords = ["family", "client", "dependents", "members", "profiles", "hub", "relatives", "patient"];
  const isFamilyOverviewQuery =
    familyKeywords.some((k) => normalizedQuery.includes(k)) &&
    ["who", "list", "show", "what", "all", "my"].some((k) => normalizedQuery.includes(k));

  const matchedPatient = patients.find((p) => {
    if (!p.name) return false;
    const pNameLower = p.name.toLowerCase();
    if (normalizedQuery.includes(pNameLower)) return true;

    const nameParts = pNameLower.split(/\s+/).filter((part) => part.length >= 3);
    if (nameParts.some((part) => new RegExp(`\\b${part}\\b`, "i").test(normalizedQuery))) {
      return true;
    }

    if (p.relation) {
      const relLower = p.relation.toLowerCase();
      if (new RegExp(`\\b${relLower}\\b`, "i").test(normalizedQuery)) return true;
      if (relLower === "mother" && /\b(mom|mama|mum)\b/i.test(normalizedQuery)) return true;
      if (relLower === "father" && /\b(dad|papa|baba)\b/i.test(normalizedQuery)) return true;
    }
    return false;
  });

  if (matchedPatient) {
    const pMeds = allMedicines.filter((m) => m.patientId === matchedPatient.id);
    const pReminders = reminders.filter((r) => r.patientId === matchedPatient.id);
    const ageStr = matchedPatient.dateOfBirth
      ? `${new Date().getFullYear() - new Date(matchedPatient.dateOfBirth).getFullYear()} years`
      : matchedPatient.age !== undefined
      ? `${matchedPatient.age} years`
      : "Not specified";
    const relStr = matchedPatient.relation ? ` (${matchedPatient.relation})` : "";
    const typeStr = matchedPatient.type === "client" ? "Professional Client" : "Family Member";
    const condStr = matchedPatient.conditions?.length ? matchedPatient.conditions.join(", ") : "None recorded";
    const allergyStr = matchedPatient.allergies?.length ? matchedPatient.allergies.join(", ") : "None recorded";

    let text =
      `Here is the profile for **${matchedPatient.name}**${relStr}:\n\n` +
      `• **Type**: ${typeStr}\n` +
      `• **Age**: ${ageStr} | **Gender**: ${matchedPatient.gender || "Not specified"}\n` +
      `• **Chronic Conditions**: ${condStr}\n` +
      `• **Known Allergies**: ${allergyStr}\n`;

    if (matchedPatient.notes) {
      text += `• **Notes**: ${matchedPatient.notes}\n`;
    }

    text += `\n**Assigned Medications (${pMeds.length})**:\n`;
    if (pMeds.length === 0) {
      text += `No medications currently assigned to ${matchedPatient.name}.\n`;
    } else {
      text +=
        pMeds
          .map(
            (m) =>
              `• **${m.name}**${m.genericName ? ` (${m.genericName})` : ""} — ${m.dosage || "Standard"}${
                m.currentQuantity !== undefined ? ` [${m.currentQuantity} ${m.unit || "units"} in vault]` : ""
              }`
          )
          .join("\n") + "\n";
    }

    if (pReminders.length > 0) {
      text += `\n**Active Reminders (${pReminders.length})**:\n`;
      text +=
        pReminders.map((r) => `• ${r.medicineName} (${r.dose}) at ${r.time} [${r.repeatSchedule}]`).join("\n") + "\n";
    }

    text += `\nYou can [manage ${matchedPatient.name}'s profile in Family Hub](/family-hub) to update health notes and reminder schedules.`;

    return {
      id: Date.now().toString(),
      role: "assistant",
      text,
      source: "System",
      suggestions: [
        `Add medicine for ${matchedPatient.name}`,
        `Check ${matchedPatient.name}'s reminders`,
        "Open Family Hub"
      ]
    };
  }

  if (isFamilyOverviewQuery) {
    if (patients.length === 0) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: "You haven't added any family members or client profiles yet. Would you like to [add a family member in Family Hub](/family-hub) to track their medications, reminders, and health profiles together?",
        source: "System",
        suggestions: ["Add a family member", "Add a client", "Open Family Hub"]
      };
    }

    const lines = patients.map((p, idx) => {
      const pMeds = allMedicines.filter((m) => m.patientId === p.id);
      const rel = p.relation ? ` (${p.relation})` : "";
      const type = p.type === "client" ? "Client" : "Family";
      const medCount = `${pMeds.length} medicine${pMeds.length !== 1 ? "s" : ""}`;
      const cond = p.conditions?.length ? ` | Conditions: ${p.conditions.join(", ")}` : "";
      return `${idx + 1}. **${p.name}**${rel} [${type}] — ${medCount}${cond}`;
    });

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: `You currently manage **${patients.length}** profile${patients.length !== 1 ? "s" : ""} in your Family Hub:\n\n${lines.join("\n")}\n\nYou can [view full profiles in Family Hub](/family-hub) to update clinical notes and schedules.`,
      source: "System",
      suggestions: ["Open Family Hub", "Add another profile", "Check reminders"]
    };
  }

  return null;
}

function handleMedVaultQuery(
  normalizedQuery: string,
  allMedicines: Medicine[],
  reminders: Reminder[]
): ChatMessage | null {
  const medVaultKeywords = [
    "days left", "doses left", "how many days", "how many doses",
    "med vault", "stock", "vault", "refill", "supply left", "pills left"
  ];
  if (!medVaultKeywords.some((k) => normalizedQuery.includes(k)) || allMedicines.length === 0) {
    return null;
  }

  const trackedMeds = allMedicines.filter((m) => m.currentQuantity !== undefined || m.totalQuantity !== undefined);
  if (trackedMeds.length === 0) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You don't have any medication stocks tracked in your Med Vault yet. You can [set your initial pill quantities in Med Vault](/medvault) to track your remaining doses and days of supply.",
      source: "System",
      suggestions: ["Open my Med Vault", "Add a reminder", "Check interactions"]
    };
  }

  const lines = trackedMeds.map((m) => {
    const status = calculateRefillStatus(m, reminders);
    const qty = m.currentQuantity ?? m.totalQuantity ?? 0;
    const unit = m.unit || "tablets";
    const doses = status?.dosesRemaining ?? Math.floor(qty / (m.dosagePerDose || 1));
    const days = status?.daysRemaining;
    const freq = status?.frequencyPerDay || m.frequencyPerDay || 1;
    const perDose = status?.dosagePerDose || m.dosagePerDose || 1;
    const dailyRate = status?.dailyDoseTotal || perDose * freq;

    let statusMsg = `• **${m.name}**: ${qty} ${unit} left → **${doses} dose${doses !== 1 ? "s" : ""}**`;
    if (days !== null && days !== undefined) {
      statusMsg += ` (~**${days} day${days !== 1 ? "s" : ""}** of supply at ${dailyRate} ${unit}/day, taken ${freq}x/day)`;
    } else {
      statusMsg += ` (${perDose} ${unit}/dose)`;
    }

    if (status?.isOutOfStock) statusMsg += " ⚠️ **OUT OF STOCK**";
    else if (status?.isLow) statusMsg += " ⚠️ **CRITICAL LOW STOCK** — please refill now!";
    else if (status?.isWarning) statusMsg += " ⚠️ **LOW STOCK** — refill soon";

    return statusMsg;
  });

  return {
    id: Date.now().toString(),
    role: "assistant",
    text: `Here is your current **Med Vault** stock breakdown:\n\n${lines.join("\n")}\n\nYou can [manage or restock your medications in Med Vault](/medvault) anytime.`,
    source: "System",
    suggestions: ["Open my Med Vault", "Refill my stock", "What are my reminders?"]
  };
}

const generateDawaGPTResponseImpl = async (
  query: string,
  activeMedicine: Medicine | null,
  userProfile: UserProfile | null,
  allMedicines: Medicine[] = [],
  doseLogs: DoseLog[] = [],
  reminders: Reminder[] = [],
  patients: Patient[] = [],
  selectedPatientId: string | null = null,
  currentPage: string | null = null,
  history: ChatHistoryItem[] = [],
  preResolvedAction: AIAction | null = null
): Promise<ChatMessage> => {
  const normalizedQuery = query.toLowerCase().trim();
  const activeGender = resolveActiveGender(selectedPatientId, patients, userProfile);
  const honorific = resolveHonorific(activeGender);

  // 1. Action Dispatching
  const action = preResolvedAction || extractDeterministicAction(query, allMedicines, reminders, patients, history);
  if (action) {
    const actionMsg = formatActionExecutionMessage(
      query,
      action,
      allMedicines,
      reminders,
      patients,
      selectedPatientId,
      userProfile
    );
    if (actionMsg) return actionMsg;
  }

  // 1.5 Reminder Clarification
  if (userRequestedReminder(normalizedQuery, history)) {
    return handleReminderClarification(normalizedQuery, allMedicines);
  }

  // 2. Support Directory & Persona
  const supportOrPersona = handleSupportOrPersonaQuery(normalizedQuery, honorific);
  if (supportOrPersona) return supportOrPersona;

  // 3. Therapeutic Duplication & Same-Task Medication Intelligence
  const dupResponse = handleDuplicateTherapyQuery(normalizedQuery, allMedicines, honorific);
  if (dupResponse) return dupResponse;

  const isAskingForPageLink = [
    "page", "link", "where", "how do i get to", "how to open",
    "go to", "open ", "show me", "take me to"
  ].some((k) => normalizedQuery.includes(k));

  // 4. Age-Aware Food, Chewables & Drinks Guidance
  const foodResponse = handleFoodAndDrinkQuery(
    normalizedQuery,
    isAskingForPageLink,
    activeMedicine,
    allMedicines,
    userProfile,
    patients,
    selectedPatientId,
    honorific
  );
  if (foodResponse) return foodResponse;

  // 5. Interactions & Direct Page Links
  const interactionOrPage = handleInteractionAndPageLinkQueries(normalizedQuery, isAskingForPageLink);
  if (interactionOrPage) return interactionOrPage;

  // 6. Condition Safety Check
  if (activeMedicine && userProfile) {
    const safetyChecks = checkConditionSafety(
      activeMedicine.name,
      activeMedicine.genericName,
      userProfile.gender === "female" ? ["Pregnancy"] : []
    );
    if (safetyChecks.length > 0) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Based on your health profile and National Drug Authority (NDA) guidelines: ${safetyChecks[0].warning}`,
        source: "NDA"
      };
    }
  }

  // 7. Family Hub & Client Profiles Query
  const familyResp = handleFamilyHubQuery(normalizedQuery, patients, allMedicines, reminders);
  if (familyResp) return familyResp;

  // 8. Med Vault Stock Intelligence
  const medVaultResp = handleMedVaultQuery(normalizedQuery, allMedicines, reminders);
  if (medVaultResp) return medVaultResp;

  // 9. Behavioral Coaching Analysis
  const coachingKeywords = ["log", "miss", "pattern", "adherence", "track", "help", "coach", "why"];
  if (coachingKeywords.some((k) => normalizedQuery.includes(k)) && doseLogs.length > 0) {
    try {
      const res = await aiApi.getCoachAdvice({
        logs: doseLogs.slice(0, 50),
        medicines: allMedicines,
        userName: userProfile?.name
      });
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: res.advice,
        source: "Gemini",
        patterns: res.patterns,
        score: res.adherenceScore
      };
    } catch (err) {
      console.warn("AI coaching failed, falling back to basic response.", err);
    }
  }

  // 10. Common Questions Map (Offline/Fast)
  const knownResp = Object.entries(FAQ_RESPONSE_MAP).find(([key]) => normalizedQuery.includes(key));
  if (knownResp) {
    const salutationStr = honorific ? `, ${honorific}` : "";
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: knownResp[1].replace("{{salutation}}", salutationStr),
      source: "WHO"
    };
  }

  // 11. Default generic response
  return {
    id: Date.now().toString(),
    role: "assistant",
    text: "I'm DawaGPT, your Ugandan health companion. Ask me about your medications, reminders, drug interactions, or pill stock. For urgent medical issues, please call a professional.",
    source: "System",
    suggestions: getContextualSuggestions({
      userQuery: query,
      medicines: allMedicines,
      reminders,
      userProfile,
      activePatient: patients.find((p) => p.id === selectedPatientId) || null,
      currentPage
    })
  };
};

export const generateDawaGPTResponse = async (
  query: string,
  activeMedicine: Medicine | null,
  userProfile: UserProfile | null,
  allMedicines: Medicine[] = [],
  doseLogs: DoseLog[] = [],
  reminders: Reminder[] = [],
  patients: Patient[] = [],
  selectedPatientId: string | null = null,
  currentPage: string | null = null,
  history: ChatHistoryItem[] = [],
  preResolvedAction: AIAction | null = null
): Promise<ChatMessage> => {
  const resp = await generateDawaGPTResponseImpl(
    query,
    activeMedicine,
    userProfile,
    allMedicines,
    doseLogs,
    reminders,
    patients,
    selectedPatientId,
    currentPage,
    history,
    preResolvedAction
  );

  const activePatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : null;
  const targetGender = activePatient ? activePatient.gender : userProfile?.gender;
  const targetName = activePatient ? activePatient.name : userProfile?.name;

  return {
    ...resp,
    text: enforceGenderHonorifics(resp.text, targetGender, targetName)
  };
};

export const getMedVaultSystemContext = (medicines: Medicine[], reminders: Reminder[] = []): string => {
  const trackedMeds = medicines.filter((m) => m.currentQuantity !== undefined || m.totalQuantity !== undefined);
  if (trackedMeds.length === 0) {
    return "Med Vault (Pill Stock Tracker) Status: No medicine stocks are currently tracked. Explain that they can track pill counts by setting a quantity on any medicine. Recommend they open [Med Vault](/medvault).";
  }

  const stockLines = trackedMeds.map((m) => {
    const qty = m.currentQuantity ?? m.totalQuantity ?? 0;
    const unit = m.unit || "tablets";
    const status = calculateRefillStatus(m, reminders);
    const dailyDose = getDailyDoseRate(m, reminders);
    const perDose = status?.dosagePerDose || m.dosagePerDose || 1;
    const dosesRemaining = status?.dosesRemaining ?? Math.floor(qty / perDose);
    const daysStr =
      status?.daysRemaining !== null && status?.daysRemaining !== undefined
        ? `~${status?.daysRemaining} day${status?.daysRemaining !== 1 ? "s" : ""} of supply left (${dailyDose} ${unit}/day)`
        : "no active reminders";
    const alertTag = status?.isOutOfStock
      ? " [OUT OF STOCK]"
      : status?.isLow
      ? " [CRITICAL LOW STOCK (<= 2 days)]"
      : status?.isWarning
      ? " [LOW STOCK (<= 3 days)]"
      : " [IN STOCK]";
    return `- ${m.name} (ID: ${m.id}):
  * Stock: ${qty} ${unit} remaining
  * Dosage: ${perDose} ${unit}/dose
  * Daily Frequency: ${status?.frequencyPerDay || 1} dose(s)/day
  * Daily Rate: ${dailyDose} ${unit}/day
  * Doses Remaining: ${dosesRemaining} doses left (${qty} ÷ ${perDose})
  * Days Remaining: ${daysStr}
  * Status:${alertTag}`;
  });

  return `Med Vault (Pill Stock Tracker) Status:\n${stockLines.join("\n")}\n\nInstructions for DawaGPT:\n1. NEVER confuse doses remaining with days remaining. Doses = Stock ÷ Dose per intake. Days = Stock ÷ Daily consumption rate (Dose × Daily frequency).\n2. If a medicine has <= 2 days of supply left (marked as CRITICAL LOW STOCK or OUT OF STOCK), proactively alert the user about the low stock and recommend refilling immediately.\n3. If a medicine has <= 3 days of supply left (marked as LOW STOCK), remind the user that they should consider refilling soon.\n4. Recommend the user to open [Med Vault](/medvault) (using exactly that markdown link format) to manage their stock.\n5. If the user asks to refill a medicine (e.g. "I refilled my Coartem to 30 pills"), reply to confirm and append an action block. The action type is UPDATE_MEDICINE and payload is { id: "medicine_id", currentQuantity: new_quantity }.`;
};

const META_DELIM_REGEX = /(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###METADATA###|---METADATA---)/i;

function extractVisibleStreamingText(allText: string): string {
  const delimMatch = allText.match(META_DELIM_REGEX);
  let rawVisibleText = allText;
  if (delimMatch && delimMatch.index !== undefined) {
    rawVisibleText = allText.substring(0, delimMatch.index);
  } else {
    rawVisibleText = allText.replace(/(?:###|---|###\s*META?D?A?T?A?)\s*$/i, "");
    const trailingJsonIdx = rawVisibleText.search(/\n\s*\{\s*"(?:text|message|response|suggestions|source|action)"/i);
    if (trailingJsonIdx !== -1) {
      rawVisibleText = rawVisibleText.substring(0, trailingJsonIdx);
    }
  }
  return rawVisibleText
    .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, "")
    .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, "");
}

async function consumeSseStream(
  stream: ReadableStream<Uint8Array>,
  activeGender: string | undefined,
  activeName: string,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let allText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]" || !trimmed.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(trimmed.slice(6));
        allText += data.choices?.[0]?.delta?.content || "";
        const visibleText = extractVisibleStreamingText(allText);
        onChunk(enforceGenderHonorifics(visibleText, activeGender, activeName));
      } catch {
        // Ignore parse errors during partial chunks
      }
    }
  }
  return allText;
}

interface StreamMetadata {
  suggestions: string[];
  source: ChatMessage["source"];
  action?: AIAction;
}

function splitStreamTextAndMetadata(allText: string): { displayText: string; metadata: StreamMetadata } {
  const delimMatch = allText.match(META_DELIM_REGEX);
  let displayText = "";
  let rawMetadata = "";

  if (delimMatch && delimMatch.index !== undefined) {
    displayText = sanitizeMarkdownLinks(
      allText
        .substring(0, delimMatch.index)
        .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, "")
        .replace(/\n\s*\{\s*"(?:text|message|response|suggestions|source|action)"[\s\S]*\}\s*$/i, "")
        .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, "")
        .trim()
    );
    rawMetadata = allText.substring(delimMatch.index + delimMatch[0].length).trim();
  } else {
    const trailingJsonMatch = allText.match(/(\{[\s\S]*\})\s*$/);
    if (trailingJsonMatch && trailingJsonMatch.index !== undefined) {
      try {
        const candidate = JSON.parse(trailingJsonMatch[1]);
        if (candidate && (candidate.suggestions || candidate.action || candidate.source || candidate.text)) {
          rawMetadata = trailingJsonMatch[1];
          displayText = allText
            .substring(0, trailingJsonMatch.index)
            .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, "")
            .replace(/\n\s*\{\s*"(?:text|message|response|suggestions|source|action)"[\s\S]*\}\s*$/i, "")
            .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, "")
            .trim();
          if (!displayText && candidate.text) displayText = candidate.text;
        } else {
          displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, "").trim();
        }
      } catch {
        displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, "").trim();
      }
    } else {
      displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, "").trim();
    }
  }

  let metadata: StreamMetadata = { suggestions: [], source: "Gemini", action: undefined };
  if (rawMetadata) {
    try {
      const sanitizedRaw = rawMetadata.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      metadata = JSON.parse(sanitizedRaw);
      if (metadata.action) {
        metadata.action = normalizeAIAction(metadata.action) || undefined;
      }
    } catch (e) {
      console.warn("Failed to parse stream metadata JSON", e);
    }
  }

  return { displayText, metadata };
}

function resolveCandidateStreamAction(
  rawAction: AIAction | undefined,
  lastUserQuery: string,
  fullText: string,
  medicines: Medicine[],
  reminders: Reminder[],
  patients: Patient[],
  messages: ChatMessage[]
): AIAction | undefined {
  const filterUnsolicitedReminder = (act: AIAction | null): AIAction | null =>
    act?.type === "ADD_REMINDER" && !userRequestedReminder(lastUserQuery, messages) ? null : act;

  let candidate = filterUnsolicitedReminder(normalizeAIAction(rawAction));
  if (!candidate) {
    const fromQuery = filterUnsolicitedReminder(
      extractDeterministicAction(lastUserQuery, medicines, reminders, patients, messages)
    );
    const fromText =
      !fromQuery && fullText
        ? filterUnsolicitedReminder(extractDeterministicAction(fullText, medicines, reminders, patients, messages))
        : null;
    const fallback = fromQuery || fromText;
    if (fallback) candidate = normalizeAIAction(fallback);
  }
  return candidate || undefined;
}

/**
 * Streaming version of chatWithDawaGPT.
 * Consumes SSE stream from the backend and calls `onChunk` with accumulated text as it arrives.
 * Returns the final ChatMessage with parsed metadata (suggestions, source, action).
 */
export const chatWithDawaGPTStream = async (
  messages: ChatMessage[],
  medicines: Medicine[],
  userProfile: UserProfile | null,
  doseLogs: DoseLog[] = [],
  reminders: Reminder[] = [],
  wellnessLogs: WellnessLog[] = [],
  vitalitySummary: unknown[] = [],
  patients: Patient[] = [],
  selectedPatientId: string | null = null,
  onChunk: (text: string) => void = () => {},
  currentPage: string | null = null
): Promise<ChatMessage> => {
  const activePatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : undefined;
  const lastUserQuery = messages.filter((m) => m.role === "user").pop()?.text || "";

  try {
    const stream = await aiApi.chatStream({
      messages: messages.slice(-20),
      medicines,
      userProfile,
      doseLogs: doseLogs.slice(0, 20),
      reminders,
      wellnessLogs: wellnessLogs.slice(0, 10),
      vitalitySummary,
      patients,
      selectedPatientId,
      currentPage,
    });

    const activeGender = activePatient?.gender || userProfile?.gender;
    const activeName = activePatient?.name || userProfile?.name || "";
    const allText = await consumeSseStream(stream, activeGender, activeName, onChunk);
    const { displayText, metadata } = splitStreamTextAndMetadata(allText);
    const fullText = enforceGenderHonorifics(displayText, activeGender, activeName);
    const resolvedAction = resolveCandidateStreamAction(
      metadata.action,
      lastUserQuery,
      fullText,
      medicines,
      reminders,
      patients,
      messages
    );

    const hasStreamFailure =
      !fullText ||
      fullText.includes("trouble connecting") ||
      fullText.includes("trouble processing that request") ||
      fullText.includes("Error starting chat stream");

    if (hasStreamFailure) {
      if (resolvedAction) {
        try {
          const offlineResp = await generateDawaGPTResponse(
            lastUserQuery,
            null,
            userProfile,
            medicines,
            doseLogs,
            reminders,
            patients,
            selectedPatientId,
            currentPage,
            messages,
            resolvedAction
          );
          onChunk(offlineResp.text);
          return { ...offlineResp, action: resolvedAction };
        } catch (localErr) {
          console.warn("[DawaGPT] Offline action generation failed:", localErr);
        }
      }

      const serviceDownMsg =
        "⚠️ DawaGPT's AI service is temporarily unavailable. Our backend AI providers are being restored. Please try again in a few minutes.\n\nFor urgent health questions, call the **Uganda National Drug Authority (NDA)** toll-free: **0800 101 999** (WhatsApp: **+256 791 415 555**) or **Mental Health Support**: **0800 200 600**.";
      onChunk(serviceDownMsg);
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: serviceDownMsg,
        source: "System",
        suggestions: getContextualSuggestions({
          messages,
          userQuery: lastUserQuery,
          assistantText: serviceDownMsg,
          medicines,
          reminders,
          userProfile,
          activePatient,
          currentPage,
          existingSuggestions: ["Try again", "Contact NDA Uganda"]
        })
      };
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: fullText,
      source: metadata.source,
      suggestions: getContextualSuggestions({
        messages,
        userQuery: lastUserQuery,
        assistantText: fullText,
        medicines,
        reminders,
        userProfile,
        activePatient,
        currentPage,
        action: resolvedAction,
        existingSuggestions: metadata.suggestions
      }),
      action: resolvedAction,
    };
  } catch (err: unknown) {
    console.error("DawaGPT Streaming Error:", err);

    const localAction = extractDeterministicAction(lastUserQuery, medicines, reminders, patients, messages);
    if (localAction) {
      try {
        const offlineResp = await generateDawaGPTResponse(
          lastUserQuery,
          null,
          userProfile,
          medicines,
          doseLogs,
          reminders,
          patients,
          selectedPatientId,
          currentPage,
          messages,
          localAction
        );
        onChunk(offlineResp.text);
        return { ...offlineResp, action: localAction };
      } catch (localErr) {
        console.warn("Offline action generation failed:", localErr);
      }
    }

    const rawMsg = err instanceof Error ? err.message : "";
    const isNetworkOrServerError =
      !rawMsg ||
      /body\.messages|\bvalidation\b|\bstatus\b|\bfailed\b|expected string|internal server error|json|_zod|cannot read|undefined|typeerror|null|fetch|network|econnrefused/i.test(
        rawMsg
      );
    const errorMessage = isNetworkOrServerError
      ? "⚠️ DawaGPT's AI service is temporarily unavailable. Please try again in a few minutes.\n\nFor urgent health questions, contact **NDA Uganda** toll-free: **0800 101 999** (WhatsApp: **+256 791 415 555**) or Mental Health Support: **0800 200 600**."
      : rawMsg;

    onChunk(errorMessage);
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: errorMessage,
      source: "System",
      suggestions: getContextualSuggestions({
        messages,
        userQuery: lastUserQuery,
        assistantText: errorMessage,
        medicines,
        reminders,
        userProfile,
        activePatient,
        currentPage,
        existingSuggestions: ["Try again", "Contact NDA Uganda"]
      })
    };
  }
};
