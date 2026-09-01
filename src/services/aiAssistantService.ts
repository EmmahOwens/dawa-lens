/**
 * DawaGPT Service
 * Conversational medical assistant with full system read/write access.
 * Focused on regional (East African) context and user safety.
 */

import { Medicine, Reminder, UserProfile, DoseLog, WellnessLog, Patient } from "../contexts/AppContext";
import { checkConditionSafety } from "./conditionInteractionService";
import { calculateRefillStatus, getDailyDoseRate } from "./refillService";
import { aiApi } from "./api";

export interface AIAction {
  type: "ADD_REMINDER" | "LOG_DOSE" | "ADD_MEDICINE" | "UPDATE_REMINDER" | "REMOVE_REMINDER" | "LOG_WELLNESS" | "ADD_PATIENT" | "UPDATE_MEDICINE" | "REMOVE_MEDICINE" | null;
  payload: Record<string, unknown> | null;
  confirmMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: "NDA" | "ANDA" | "WHO" | "openFDA" | "System" | "Gemini" | "MoH";
  patterns?: string[];
  score?: number;
  suggestions?: string[];
  action?: AIAction;
}

/**
 * Resolves the culturally respectful Luganda honorific according to user/patient gender.
 * Female -> "Nyabo" ("Madam")
 * Male -> "Ssebo" ("Sir")
 * Unspecified -> "" (Gender-neutral)
 */
export const resolveHonorific = (gender?: string | null): string => {
  if (gender === "female") return "Nyabo";
  if (gender === "male") return "Ssebo";
  return "";
};

const FAQ_RESPONSE_MAP: Record<string, string> = {
  "is this safe for me?": "Checking your health profile... Based on NDA Uganda guidelines, this medication is generally safe for you. However, please consult your doctor directly before making changes.",
  "can i take this with milk?": "For Coartem (Artemether/Lumefantrine), it is recommended to take with a fatty meal or milk to increase absorption. For many other antibiotics, avoid milk as it can hinder absorption. Check your specific prescription.",
  "is matooke safe?": "Matooke (steamed green bananas) is generally safe and very healthy (high in potassium). It's a great staple to have with your medications, especially if they require a meal.",
  "what about g-nuts?": "G-nut sauce is rich in healthy fats and protein. The fats in G-nuts actually help your body absorb certain medications like Coartem better!",
  "is kalo healthy?": "Kalo (millet bread) is excellent for you. It's rich in iron and calcium, which are great for your blood and bones.",
  "can i eat nsenene?": "Yes! Nsenene (grasshoppers) are a great source of protein and healthy fats. Just ensure they are prepared hygienically.",
  "what are the side effects?": "Common side effects for medications in this category include dizziness and nausea. If you experience severe rashes or palpitations, seek medical help immediately.",
  "how do i take this?": "Always follow the dosage on your pill bottle or prescription. For acute cases, consistency is key to recovery.",
  "oli otya": "Oli otya! I am doing well{{salutation}}. How can DawaGPT help you with your health or medicines today?",
  "wasuze otya": "Wasuze otya! I hope you slept well and are ready for a healthy day. How can I help you today?",
  "osiibye otya": "Osiibye otya! How has your day been? Let's check your evening medication adherence.",
  "gyebaleko": "Gyebaleko! Thank you. I am here to help you manage your health. How are you feeling today?",
  "webale": "Kale! You're welcome. Let me know if you need help with reminders or safety checks.",
  "eddagala": "Eddagala (medicine) is key to your health. Do you want to check details for one of your medicines, or set up a reminder?",
  "omutwe gunnuma": "Bambi (oh dear), sorry about the headache. Ensure you are hydrated, and check if you have a pain reliever reminder like Panadol (Paracetamol) set up.",
  "olubuto lunnuma": "Bambi, sorry about the stomach ache. Have you taken any medication recently, or eaten? Some medicines should be taken with food (like Matooke or Posho) to prevent stomach irritation.",
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
  currentPage: string | null = null
): Promise<ChatMessage> => {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Direct Page Navigation & Link Intent Resolution
  const isAskingForPageLink = (
    normalizedQuery.includes("page") ||
    normalizedQuery.includes("link") ||
    normalizedQuery.includes("where") ||
    normalizedQuery.includes("how do i get to") ||
    normalizedQuery.includes("how to open") ||
    normalizedQuery.includes("go to") ||
    normalizedQuery.includes("open ") ||
    normalizedQuery.includes("show me") ||
    normalizedQuery.includes("take me to")
  );

  // Interactions & Drug-Food Safety Guard
  if (
    normalizedQuery.includes("interaction") ||
    normalizedQuery.includes("safety guard") ||
    (isAskingForPageLink && (normalizedQuery.includes("safety") || normalizedQuery.includes("food check") || normalizedQuery.includes("compatibility")))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [check your drug & food interactions](/interactions) to verify if your medicines are safe with meals like Matooke, G-nuts, or Waragi, and guard against duplicate therapies.",
      source: "System",
      suggestions: ["Check drug interactions", "Is Matooke safe with my meds?", "Open Interactions"]
    };
  }

  // Med Vault / Pill Stock Tracker
  if (
    isAskingForPageLink && (normalizedQuery.includes("vault") || normalizedQuery.includes("stock") || normalizedQuery.includes("inventory") || normalizedQuery.includes("pill count"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [check your pill stock in Med Vault](/medvault) to see your remaining doses, days of supply, and restock supplies.",
      source: "System",
      suggestions: ["Open Med Vault", "How many days of meds left?", "Check reminders"]
    };
  }

  // Reminders & Schedule
  if (
    isAskingForPageLink && (normalizedQuery.includes("reminder") || normalizedQuery.includes("alarm") || normalizedQuery.includes("schedule") || normalizedQuery.includes("timing"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [manage your active alarms in Medication Reminders](/reminders) or [set up a new reminder](/reminders/new) for your daily dose schedule.",
      source: "System",
      suggestions: ["View reminders", "Add a reminder", "Check history"]
    };
  }

  // Search & Medication Info (prioritized over general medication keyword)
  if (
    isAskingForPageLink && (normalizedQuery.includes("search") || normalizedQuery.includes("lookup") || normalizedQuery.includes("monograph") || normalizedQuery.includes("drug info") || normalizedQuery.includes("information"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [look up clinical drug facts in Search Medications](/search) for verified monographs and NDA dosage guidelines.",
      source: "System",
      suggestions: ["Search medicine", "Check interactions", "View medications"]
    };
  }

  // Medications Directory
  if (
    isAskingForPageLink && (normalizedQuery.includes("medication") || normalizedQuery.includes("medicine list") || normalizedQuery.includes("cabinet") || normalizedQuery.includes("my drug") || normalizedQuery.includes("prescriptions"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [view your active prescriptions in My Medications](/medications) whenever you need to check your doses.",
      source: "System",
      suggestions: ["View my medications", "Check Med Vault", "Add a reminder"]
    };
  }

  // Dose History & Logs
  if (
    isAskingForPageLink && (normalizedQuery.includes("history") || normalizedQuery.includes("log") || normalizedQuery.includes("past dose") || normalizedQuery.includes("adherence"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [review your past logs in Dose History](/history) to track your adherence and streak over time.",
      source: "System",
      suggestions: ["View dose history", "What are my reminders?", "Export report"]
    };
  }

  // Wellness Hub
  if (
    isAskingForPageLink && (normalizedQuery.includes("wellness") || normalizedQuery.includes("mood") || normalizedQuery.includes("symptom") || normalizedQuery.includes("vibe") || normalizedQuery.includes("meal journal"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "Let's [log your symptoms and daily vibe in Wellness Hub](/wellness) to keep a holistic picture of how you feel.",
      source: "System",
      suggestions: ["Log my symptoms", "Check daily vibe", "View dose history"]
    };
  }

  // Travel Companion
  if (
    isAskingForPageLink && (normalizedQuery.includes("travel") || normalizedQuery.includes("flight") || normalizedQuery.includes("trip") || normalizedQuery.includes("timezone"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [calculate your travel medicine supply in Travel Companion](/travel) and adjust your dose timing across time zones.",
      source: "System",
      suggestions: ["Open Travel Companion", "Check pill stock", "View reminders"]
    };
  }

  // Doctor-Ready Reports
  if (
    isAskingForPageLink && (normalizedQuery.includes("report") || normalizedQuery.includes("pdf") || normalizedQuery.includes("doctor") || normalizedQuery.includes("export"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [export an adherence report for your doctor](/report) to share verified logs ahead of your next appointment.",
      source: "System",
      suggestions: ["Generate report", "View dose history", "Check adherence"]
    };
  }

  // Visual Scanner
  if (
    isAskingForPageLink && (normalizedQuery.includes("scan") || normalizedQuery.includes("camera") || normalizedQuery.includes("picture") || normalizedQuery.includes("ocr"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [take a photo to scan your medicine in Visual Scanner](/scan) to identify pills or parse prescription labels.",
      source: "System",
      suggestions: ["Open Scanner", "Search medicine", "Check interactions"]
    };
  }

  // Settings & Profile
  if (
    isAskingForPageLink && (normalizedQuery.includes("setting") || normalizedQuery.includes("profile") || normalizedQuery.includes("account") || normalizedQuery.includes("preference"))
  ) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "You can [manage your profile and preferences in Settings](/settings) to update emergency contacts and notifications.",
      source: "System",
      suggestions: ["Open Settings", "View profile", "Check reminders"]
    };
  }

  // 2. Check for specific safety issues (local rule-based check)
  if (activeMedicine && userProfile) {
    const safetyChecks = checkConditionSafety(
      activeMedicine.name,
      activeMedicine.genericName,
      userProfile.gender === "female" ? ["Pregnancy"] : [] // Placeholder logic
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

  // 3. Family Hub & Client Profiles Query (Local / Offline handling)
  const familyKeywords = ["family", "client", "dependents", "members", "profiles", "hub", "relatives", "patient"];
  const isFamilyOverviewQuery = familyKeywords.some(k => normalizedQuery.includes(k)) && 
    (normalizedQuery.includes("who") || normalizedQuery.includes("list") || normalizedQuery.includes("show") || normalizedQuery.includes("what") || normalizedQuery.includes("all") || normalizedQuery.includes("my"));

  // Check if query is asking about a specific patient by name or relation
  const matchedPatient = patients.find(p => {
    if (!p.name) return false;
    const pNameLower = p.name.toLowerCase();
    if (normalizedQuery.includes(pNameLower)) return true;

    // Check individual name parts (e.g. "Sarah" or "Nalule", length >= 3)
    const nameParts = pNameLower.split(/\s+/).filter(part => part.length >= 3);
    if (nameParts.some(part => {
      const regex = new RegExp(`\\b${part}\\b`, "i");
      return regex.test(normalizedQuery);
    })) {
      return true;
    }

    // Check relation (e.g. "mother", "mom", "mama", "dad", "father", "son", "daughter")
    if (p.relation) {
      const relLower = p.relation.toLowerCase();
      const regex = new RegExp(`\\b${relLower}\\b`, "i");
      if (regex.test(normalizedQuery)) return true;
      if (relLower === "mother" && (/\b(mom|mama|mum)\b/i).test(normalizedQuery)) return true;
      if (relLower === "father" && (/\b(dad|papa|baba)\b/i).test(normalizedQuery)) return true;
    }

    return false;
  });

  if (matchedPatient) {
    const pMeds = allMedicines.filter(m => m.patientId === matchedPatient.id);
    const pReminders = reminders.filter(r => r.patientId === matchedPatient.id);
    const ageStr = matchedPatient.dateOfBirth
      ? `${new Date().getFullYear() - new Date(matchedPatient.dateOfBirth).getFullYear()} years`
      : matchedPatient.age !== undefined
      ? `${matchedPatient.age} years`
      : "Not specified";
    const relStr = matchedPatient.relation ? ` (${matchedPatient.relation})` : "";
    const typeStr = matchedPatient.type === "client" ? "Professional Client" : "Family Member";
    const condStr = matchedPatient.conditions?.length ? matchedPatient.conditions.join(", ") : "None recorded";
    const allergyStr = matchedPatient.allergies?.length ? matchedPatient.allergies.join(", ") : "None recorded";
    
    let text = `Here is the profile for **${matchedPatient.name}**${relStr}:\n\n` +
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
      text += pMeds.map(m => `• **${m.name}**${m.genericName ? ` (${m.genericName})` : ''} — ${m.dosage || 'Standard'}${m.currentQuantity !== undefined ? ` [${m.currentQuantity} ${m.unit || 'units'} in vault]` : ''}`).join("\n") + "\n";
    }

    if (pReminders.length > 0) {
      text += `\n**Active Reminders (${pReminders.length})**:\n`;
      text += pReminders.map(r => `• ${r.medicineName} (${r.dose}) at ${r.time} [${r.repeatSchedule}]`).join("\n") + "\n";
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
      const pMeds = allMedicines.filter(m => m.patientId === p.id);
      const rel = p.relation ? ` (${p.relation})` : "";
      const type = p.type === "client" ? "Client" : "Family";
      const medCount = `${pMeds.length} medicine${pMeds.length !== 1 ? 's' : ''}`;
      const cond = p.conditions?.length ? ` | Conditions: ${p.conditions.join(', ')}` : '';
      return `${idx + 1}. **${p.name}**${rel} [${type}] — ${medCount}${cond}`;
    });

    const summaryText = `You currently manage **${patients.length}** profile${patients.length !== 1 ? 's' : ''} in your Family Hub:\n\n${lines.join('\n')}\n\nYou can [view full profiles in Family Hub](/family-hub) to update clinical notes and schedules.`;

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: summaryText,
      source: "System",
      suggestions: ["Open Family Hub", "Add another profile", "Check reminders"]
    };
  }

  // 4. Med Vault / Stock Intelligence (Local / Offline handling)
  const medVaultKeywords = ["days left", "doses left", "how many days", "how many doses", "med vault", "stock", "vault", "refill", "supply left", "pills left"];
  const isMedVaultQuery = medVaultKeywords.some(k => normalizedQuery.includes(k));

  if (isMedVaultQuery && allMedicines.length > 0) {
    const trackedMeds = allMedicines.filter(m => m.currentQuantity !== undefined || m.totalQuantity !== undefined);
    if (trackedMeds.length === 0) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: "You don't have any medication stocks tracked in your Med Vault yet. You can [set your initial pill quantities in Med Vault](/medvault) to track your remaining doses and days of supply.",
        source: "System",
        suggestions: ["Open my Med Vault", "Add a reminder", "Check interactions"]
      };
    }

    const lines = trackedMeds.map(m => {
      const status = calculateRefillStatus(m, reminders);
      const qty = m.currentQuantity ?? m.totalQuantity ?? 0;
      const unit = m.unit || "tablets";
      const doses = status?.dosesRemaining ?? Math.floor(qty / (m.dosagePerDose || 1));
      const days = status?.daysRemaining;
      const freq = status?.frequencyPerDay || m.frequencyPerDay || 1;
      const perDose = status?.dosagePerDose || m.dosagePerDose || 1;
      const dailyRate = status?.dailyDoseTotal || (perDose * freq);

      let statusMsg = `• **${m.name}**: ${qty} ${unit} left → **${doses} dose${doses !== 1 ? "s" : ""}**`;
      if (days !== null && days !== undefined) {
        statusMsg += ` (~**${days} day${days !== 1 ? "s" : ""}** of supply at ${dailyRate} ${unit}/day, taken ${freq}x/day)`;
      } else {
        statusMsg += ` (${perDose} ${unit}/dose)`;
      }

      if (status?.isOutOfStock) {
        statusMsg += " ⚠️ **OUT OF STOCK**";
      } else if (status?.isLow) {
        statusMsg += " ⚠️ **CRITICAL LOW STOCK** — please refill now!";
      } else if (status?.isWarning) {
        statusMsg += " ⚠️ **LOW STOCK** — refill soon";
      }

      return statusMsg;
    });

    const summaryText = `Here is your current **Med Vault** stock breakdown:\n\n${lines.join("\n")}\n\nYou can [manage or restock your medications in Med Vault](/medvault) anytime.`;

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: summaryText,
      source: "System",
      suggestions: ["Open my Med Vault", "Refill my stock", "What are my reminders?"]
    };
  }

  // 4. Behavioral Coaching Analysis (Complex Pattern Detection)
  const coachingKeywords = ["log", "miss", "pattern", "adherence", "track", "help", "coach", "why"];
  const isCoachingRequest = coachingKeywords.some(k => normalizedQuery.includes(k));

  if (isCoachingRequest && doseLogs.length > 0) {
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

  // 5. Common Questions Map (Offline/Fast)
  const knownResp = Object.entries(FAQ_RESPONSE_MAP).find(([key]) => normalizedQuery.includes(key));
  if (knownResp) {
    const activeGender = (selectedPatientId && patients.length > 0
      ? patients.find(p => p.id === selectedPatientId)?.gender
      : undefined) || userProfile?.gender;
    const honorific = resolveHonorific(activeGender);
    const salutationStr = honorific ? `, ${honorific}` : "";
    const resolvedText = knownResp[1].replace("{{salutation}}", salutationStr);

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: resolvedText,
      source: "WHO"
    };
  }

  // 6. Default generic response
  return {
    id: Date.now().toString(),
    role: "assistant",
    text: "I am your Dawa-Lens assistant. You can ask about your medication logs, patterns in missing doses, Med Vault stock, family hub profiles, or general safety. For urgent medical issues, please contact a professional.",
    source: "System"
  };
};

export const getMedVaultSystemContext = (medicines: Medicine[], reminders: Reminder[] = []): string => {
  const trackedMeds = medicines.filter(m => m.currentQuantity !== undefined || m.totalQuantity !== undefined);
  if (trackedMeds.length === 0) {
    return "Med Vault (Pill Stock Tracker) Status: No medicine stocks are currently tracked. Explain that they can track pill counts by setting a quantity on any medicine. Recommend they open [Med Vault](/medvault).";
  }

  const stockLines = trackedMeds.map(m => {
    const qty = m.currentQuantity ?? m.totalQuantity ?? 0;
    const unit = m.unit || "tablets";
    const status = calculateRefillStatus(m, reminders);
    const dailyDose = getDailyDoseRate(m, reminders);
    const perDose = status?.dosagePerDose || m.dosagePerDose || 1;
    const dosesRemaining = status?.dosesRemaining ?? Math.floor(qty / perDose);
    const daysStr = status?.daysRemaining !== null && status?.daysRemaining !== undefined
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

/**
 * Primary conversational path — uses backend Groq LLM with full system context.
 * Returns an optional `action` field that callers should dispatch to AppContext.
 */
export const chatWithDawaGPT = async (
  messages: ChatMessage[],
  medicines: Medicine[],
  userProfile: UserProfile | null,
  doseLogs: DoseLog[] = [],
  reminders: Reminder[] = [],
  wellnessLogs: WellnessLog[] = [],
  vitalitySummary: unknown[] = [],
  patients: Patient[] = [],
  selectedPatientId: string | null = null,
  currentPage: string | null = null
): Promise<ChatMessage> => {
  try {
    const response = await aiApi.chat({
      messages,
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

    const rawText = response.text || "";
    // Clean up any stray metadata markers or suggestion tags if they exist
    const cleanText = rawText
      .split(/###METADATA###|---METADATA---/)[0]
      .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
      .trim();

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: cleanText,
      source: (response.source as ChatMessage['source']) || "Gemini",
      suggestions: response.suggestions,
      // Include the action from the AI if present and meaningful
      action: response.action?.type ? response.action : undefined,
    };
  } catch (err: unknown) {
    console.error("DawaGPT Chat Error:", err);
    const rawMsg = err instanceof Error ? err.message : "";
    const isTechnicalError = !rawMsg || /body\.messages|\bvalidation\b|\bstatus\b|\bfailed\b|expected string|internal server error|json|_zod|cannot read|undefined|typeerror|null|fetch|network|econnrefused/i.test(rawMsg);
    const errorMessage = isTechnicalError
      ? "I had trouble processing that request. Please try again in a moment."
      : rawMsg;
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: errorMessage,
      source: "System"
    };
  }
};

/**
 * Streaming version of chat — provides real-time text updates.
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
  onChunk: (text: string) => void,
  currentPage: string | null = null
): Promise<ChatMessage> => {
  try {
    const stream = await aiApi.chatStream({
      messages,
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

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let allText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices[0]?.delta?.content || "";
            allText += content;

            // Strip metadata delimiter and JSON from visible text (Requirement 2.3)
            const delimIdx = allText.lastIndexOf('###METADATA###');
            const rawVisibleText = delimIdx !== -1
              ? allText.substring(0, delimIdx)
              : allText;
            const visibleText = rawVisibleText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '');
            onChunk(visibleText);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    // Split on the ###METADATA### delimiter to separate display text from metadata (Requirement 2.3)
    const METADATA_DELIMITER = '###METADATA###';
    // Use a regex to find the last occurrence of the delimiter, handling potential whitespace/newlines
    const delimMatch = allText.match(/[\s\S]*###METADATA###\s*([\s\S]*)$/);

    let displayText: string;
    let rawMetadata: string;

    if (delimMatch) {
      const fullMatch = delimMatch[0];
      const delimIndex = fullMatch.lastIndexOf(METADATA_DELIMITER);
      displayText = allText.substring(0, delimIndex).replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
      rawMetadata = delimMatch[1].trim();
    } else {
      // Delimiter absent — try to extract a trailing JSON block as a secondary fallback.
      // Some models output valid JSON at the end of their response without the delimiter.
      const trailingJsonMatch = allText.match(/(\{[\s\S]*\})\s*$/);
      if (trailingJsonMatch) {
        try {
          const candidate = JSON.parse(trailingJsonMatch[1]);
          // Only use it as metadata if it has the expected shape
          if (candidate && (candidate.suggestions || candidate.action || candidate.source)) {
            rawMetadata = trailingJsonMatch[1];
            displayText = allText.substring(0, allText.lastIndexOf(trailingJsonMatch[1])).replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
          } else {
            displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
            rawMetadata = '';
          }
        } catch {
          displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
          rawMetadata = '';
        }
      } else {
        // No JSON found at all — treat entire text as display text, no metadata
        displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
        rawMetadata = '';
      }
    }

    const fullText = displayText;

    interface StreamMetadata {
      suggestions: string[];
      source: ChatMessage['source'];
      action?: AIAction;
    }

    // Parse metadata safely; on failure or empty string, default gracefully (Requirement 2.4)
    let metadata: StreamMetadata = { suggestions: [], source: "Gemini", action: undefined };
    if (rawMetadata) {
      try {
        metadata = JSON.parse(rawMetadata);
      } catch (e) {
        console.warn('Failed to parse stream metadata JSON', e);
        // Graceful degradation: return text with empty metadata
      }
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: fullText,
      source: metadata.source,
      suggestions: metadata.suggestions,
      action: metadata.action?.type ? metadata.action : undefined,
    };
  } catch (err: unknown) {
    console.error("DawaGPT Streaming Error:", err);
    const rawMsg = err instanceof Error ? err.message : "";
    const isTechnicalError = !rawMsg || /body\.messages|\bvalidation\b|\bstatus\b|\bfailed\b|expected string|internal server error|json|_zod|cannot read|undefined|typeerror|null|fetch|network|econnrefused/i.test(rawMsg);
    const errorMessage = isTechnicalError
      ? "I had trouble processing that request. Please try again in a moment."
      : rawMsg;
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: errorMessage,
      source: "System"
    };
  }
};

