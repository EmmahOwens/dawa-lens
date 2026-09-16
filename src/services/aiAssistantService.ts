/**
 * DawaGPT Service
 * Conversational medical assistant with full system read/write access.
 * Focused on Ugandan healthcare context and user safety.
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
  "oli otya": "Oli otya! I am doing well{{salutation}}. How can DawaGPT help you with your health or medicines today?",
  "wasuze otya": "Wasuze otya! I hope you slept well and are ready for a healthy day. How can I help you today?",
  "osiibye otya": "Osiibye otya! How has your day been? Let's check your evening medication adherence.",
  "gyebaleko": "Gyebaleko! Thank you. I am here to help you manage your health. How are you feeling today?",
  "webale": "Kale! You're welcome. Let me know if you need help with reminders or safety checks.",
  "eddagala": "Eddagala (medicine) is key to your health. You can [view your active medications](/medications) or [set up a dose reminder](/reminders/new).",
  "contact support": "For support in Uganda: 1) National Emergency & Ambulance: 112 (Mobile Toll-Free) or 999; 2) Ministry of Health (MoH) Uganda: 0800 100 066 / 0800 203 033; 3) National Drug Authority (NDA) Drug Safety: 0800 101 622 / WhatsApp +256 791 415 555; 4) Mulago Hospital Emergency: +256 414 554 008; 5) Butabika Crisis Hotline: 0800 200 600; 6) App Support: support@dawalens.ug.",
  "support uganda": "Uganda Support Directory: National Emergency: 112 / 999; MoH Helplines: 0800 100 066 / 0800 203 033; NDA Hotline: 0800 101 622; Mulago Casualty: +256 414 554 008; App Support: support@dawalens.ug.",
  "uganda support": "Uganda Support Directory: National Emergency: 112 / 999; MoH Helplines: 0800 100 066 / 0800 203 033; NDA Hotline: 0800 101 622; Mulago Casualty: +256 414 554 008; App Support: support@dawalens.ug.",
  "emergency contact": "Official Uganda Emergency Contacts: Emergency/Ambulance: 112 (Mobile) / 999 (Landline); Police Toll-Free: 0800 199 699; MoH: 0800 100 066; Mulago Emergency: +256 414 554 008; Butabika Crisis: 0800 200 600.",
  "customer care": "For customer care and support in Uganda, email support@dawalens.ug. For official health helplines: MoH Toll-Free 0800 100 066, NDA Hotline 0800 101 622, or National Emergency 112.",
};

function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return "8:00 AM";
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export const extractDeterministicAction = (
  text: string,
  medicines: Medicine[] = [],
  reminders: Reminder[] = []
): AIAction | null => {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // 1. ADD_REMINDER
  const isReminderIntent = /\b(remind(\s+me)?|set(\s+a)?\s+reminder|add(\s+a)?\s+reminder|schedule(\s+a)?\s+reminder|create(\s+a)?\s+reminder|alarm\s+for)\b/i.test(lower);
  if (isReminderIntent) {
    let time = "08:00";
    const timeMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }

    const matchedMed = medicines.find(m => m.name && lower.includes(m.name.toLowerCase()));
    let medName = matchedMed ? matchedMed.name : null;

    if (!medName) {
      const medMatch = lower.match(/(?:take|reminder\s+for|for)\s+([a-z0-9\-]+)/i);
      if (medMatch && !['a', 'my', 'the', 'some', 'me', 'daily'].includes(medMatch[1].toLowerCase())) {
        medName = medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1);
      } else {
        medName = medicines[0]?.name || "Medication";
      }
    }

    const doseMatch = lower.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablets?|pills?|capsules?))\b/i);
    const dose = doseMatch ? doseMatch[1] : (matchedMed?.dosagePerDose ? `${matchedMed.dosagePerDose} ${matchedMed.unit || 'tablets'}` : "1 tablet");

    let repeatSchedule = "daily";
    if (lower.includes("weekly")) repeatSchedule = "weekly";
    else if (lower.includes("once")) repeatSchedule = "once";

    return {
      type: "ADD_REMINDER",
      payload: {
        medicineName: medName,
        medicineId: matchedMed?.id || null,
        dose,
        time,
        repeatSchedule
      },
      confirmMessage: `Reminder set for ${medName} (${dose}) at ${formatTimeDisplay(time)} ${repeatSchedule}.`
    };
  }

  // 2. LOG_DOSE
  const isDoseLogIntent = /\b(i took|i've taken|i just took|i already took|log (that )?i took|record (that )?i took|mark (my )?.* as taken|i missed|i skipped)\b/i.test(lower);
  if (isDoseLogIntent) {
    const isMissed = /\b(missed|skipped|forgot)\b/i.test(lower);
    const status = isMissed ? "missed" : "taken";

    let matchedMed = medicines.find(m => m.name && lower.includes(m.name.toLowerCase()));
    let medName = matchedMed ? matchedMed.name : null;

    if (!medName) {
      const medMatch = lower.match(/(?:took|taken|missed|skipped)\s+(?:my\s+)?([a-z0-9\-]+)/i);
      if (medMatch && !['my', 'the', 'a', 'dose', 'medicine', 'pills'].includes(medMatch[1].toLowerCase())) {
        medName = medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1);
      } else {
        medName = medicines[0]?.name || "Medication";
      }
    }

    return {
      type: "LOG_DOSE",
      payload: {
        medicineName: medName,
        medicineId: matchedMed?.id || null,
        status,
        timestamp: new Date().toISOString()
      },
      confirmMessage: `Logged ${medName} as ${status}.`
    };
  }

  // 3. UPDATE_MEDICINE (Med Vault Refill)
  const isRefillIntent = /\b(refill(ed)?|restock(ed)?|top\s*up|topped\s*up|update stock|set stock)\b/i.test(lower);
  if (isRefillIntent) {
    const qtyMatch = lower.match(/\b(?:to|with|have)?\s*(\d+)\s*(?:pills?|tablets?|capsules?|units?)?\b/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

    let matchedMed = medicines.find(m => m.name && lower.includes(m.name.toLowerCase()));
    if (!matchedMed && medicines.length === 1) matchedMed = medicines[0];

    if (matchedMed && qty !== null) {
      return {
        type: "UPDATE_MEDICINE",
        payload: {
          id: matchedMed.id,
          name: matchedMed.name,
          currentQuantity: qty
        },
        confirmMessage: `Updated ${matchedMed.name} stock to ${qty}.`
      };
    }
  }

  // 4. LOG_WELLNESS
  const isWellnessIntent = /\b(log (my )?mood|log (my )?symptoms?|feeling|i feel|i'm feeling|i have a headache|headache|stomach ache|dizzy|nausea|fatigue|fever)\b/i.test(lower);
  if (isWellnessIntent) {
    const symptoms: string[] = [];
    if (lower.includes("headache") || lower.includes("omutwe")) symptoms.push("headache");
    if (lower.includes("stomach") || lower.includes("olubuto")) symptoms.push("stomach ache");
    if (lower.includes("fever") || lower.includes("musujja")) symptoms.push("fever");
    if (lower.includes("dizzy") || lower.includes("dizziness")) symptoms.push("dizziness");
    if (lower.includes("nausea") || lower.includes("vomiting")) symptoms.push("nausea");
    if (lower.includes("tired") || lower.includes("fatigue")) symptoms.push("fatigue");
    if (lower.includes("cough")) symptoms.push("cough");

    let mood = "okay";
    if (lower.includes("great") || lower.includes("good") || lower.includes("happy")) mood = "great";
    else if (lower.includes("tired") || lower.includes("exhausted")) mood = "tired";
    else if (lower.includes("sad") || lower.includes("down") || lower.includes("bad")) mood = "bad";
    else if (lower.includes("stressed") || lower.includes("anxious")) mood = "stressed";

    return {
      type: "LOG_WELLNESS",
      payload: {
        type: "symptom",
        data: {
          mood,
          symptoms,
          notes: text
        }
      },
      confirmMessage: `Recorded wellness check-in (mood: ${mood}, symptoms: ${symptoms.join(', ') || 'none'}).`
    };
  }

  return null;
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

  // 1. Action Dispatching (Adding reminders, logging doses, refilling stock, wellness tracking)
  const action = extractDeterministicAction(query, allMedicines, reminders);
  if (action) {
    if (action.type === "ADD_REMINDER") {
      const payload = action.payload as any;
      const displayTime = formatTimeDisplay(payload?.time);
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've set up a reminder for you to take **${payload?.medicineName}** (${payload?.dose}) ${payload?.repeatSchedule} at **${displayTime}**.\n\nYou can [view or manage your schedule in Medication Reminders](/reminders).`,
        suggestions: ["View my reminders", "Check my medications", "How is my pill stock?"],
        source: "System",
        action
      };
    }
    if (action.type === "LOG_DOSE") {
      const payload = action.payload as any;
      const statusVerb = payload?.status === 'taken' ? 'took' : 'missed';
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've logged that you **${statusVerb}** your dose of **${payload?.medicineName}**.\n\nYou can [review your adherence streak in Dose History](/history).`,
        suggestions: ["View dose history", "Check reminders", "How is my pill stock?"],
        source: "System",
        action
      };
    }
    if (action.type === "UPDATE_MEDICINE") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've updated your Med Vault: **${payload?.name}** stock is now set to **${payload?.currentQuantity} tablets**.\n\nYou can [view and track your pill supply in Med Vault](/medvault).`,
        suggestions: ["Open Med Vault", "Check reminders", "View medications"],
        source: "System",
        action
      };
    }
    if (action.type === "LOG_WELLNESS") {
      const payload = action.payload as any;
      const symStr = payload?.data?.symptoms?.join(', ') || 'general check-in';
      const activeGender = (selectedPatientId && patients.length > 0
        ? patients.find(p => p.id === selectedPatientId)?.gender
        : undefined) || userProfile?.gender;
      const honorific = resolveHonorific(activeGender);
      const greeting = honorific ? ` ${honorific}` : "";
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've recorded this in your Wellness Hub (Mood: **${payload?.data?.mood}**, Symptoms: **${symStr}**). Bambi${greeting}, please rest, stay well-hydrated, and consult a healthcare professional if symptoms persist.\n\nYou can [review your wellness logs in Wellness Hub](/wellness).`,
        suggestions: ["Open Wellness Hub", "Check medications", "View reminders"],
        source: "System",
        action
      };
    }
  }

  // Uganda Contact Support & Emergency Directory Resolution
  const isAskingForSupport = (
    normalizedQuery.includes("support") ||
    normalizedQuery.includes("contact support") ||
    normalizedQuery.includes("customer care") ||
    normalizedQuery.includes("customer service") ||
    normalizedQuery.includes("help desk") ||
    normalizedQuery.includes("helpdesk") ||
    normalizedQuery.includes("helpline") ||
    normalizedQuery.includes("hotline") ||
    normalizedQuery.includes("emergency contact") ||
    normalizedQuery.includes("emergency number") ||
    normalizedQuery.includes("who can i call") ||
    normalizedQuery.includes("who do i contact") ||
    normalizedQuery.includes("who to contact") ||
    normalizedQuery.includes("moh contact") ||
    normalizedQuery.includes("nda hotline") ||
    normalizedQuery.includes("nda contact") ||
    (normalizedQuery.includes("help") && (
      normalizedQuery.includes("call") ||
      normalizedQuery.includes("number") ||
      normalizedQuery.includes("contact") ||
      normalizedQuery.includes("phone") ||
      normalizedQuery.includes("uganda")
    ))
  );

  if (isAskingForSupport) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "Here is the official **Contact Support Directory for Uganda**:\n\n" +
        "• **National Medical Emergency & Ambulance**: Call **112** (Toll-Free Mobile on MTN/Airtel) or **999** (Landline)\n" +
        "• **Ministry of Health (MoH) Uganda**: Toll-Free **0800 100 066** or **0800 203 033** | Email: info@health.go.ug\n" +
        "• **National Drug Authority (NDA) Uganda**: Toll-Free **0800 101 622** | WhatsApp: **+256 791 415 555** | Head Office: **+256 417 788 100** *(for medicine safety, adverse reactions & reporting fake drugs)*\n" +
        "• **Mulago National Referral Hospital (Casualty & Emergency)**: **+256 414 554 008** / **+256 414 554 001**\n" +
        "• **Mental Health & Crisis Hotline (Butabika Hospital)**: Toll-Free **0800 200 600**\n" +
        "• **Uganda Police Emergency Dispatch**: Toll-Free **0800 199 699** / **0800 199 399**\n" +
        "• **Dawa-Lens App Support**: Email **support@dawalens.ug** or [manage your emergency contacts in Settings](/settings).\n\n" +
        "If you are experiencing an acute medical emergency or severe reaction, please call **112** or proceed immediately to the nearest healthcare facility.",
      source: "MoH",
      suggestions: ["Call Uganda Emergency (112)", "National Drug Authority Helpline", "Open Settings"]
    };
  }

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

  // DawaGPT Persona & Capabilities ("who are you", "about yourself", etc.)
  if (
    normalizedQuery.includes("about yourself") ||
    normalizedQuery.includes("who are you") ||
    normalizedQuery.includes("what are you") ||
    normalizedQuery.includes("what can you do") ||
    normalizedQuery.includes("tell me about you") ||
    normalizedQuery.includes("introduce yourself")
  ) {
    const activeGender = (selectedPatientId && patients.length > 0
      ? patients.find(p => p.id === selectedPatientId)?.gender
      : undefined) || userProfile?.gender;
    const honorific = resolveHonorific(activeGender);
    const greeting = honorific ? ` ${honorific}` : "";

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: `Oli otya${greeting}! I'm **DawaGPT**, your dedicated Ugandan AI health and medication companion built for DawaLens.\n\n` +
        `Here is how I can support you:\n` +
        `• 💊 **Medication Safety & Dosage**: Provide clear dosage explanations, side effect alerts, and National Drug Authority (NDA) Uganda standards.\n` +
        `• ⚠️ **Drug & Food Interactions**: Screen your prescriptions against local foods (like *Matooke*, *Posho*, *G-nut sauce*) and alcohol (*Waragi*).\n` +
        `• ⏰ **Smart Reminders**: Keep your schedule on track with alarms and dose alerts in [Medication Reminders](/reminders).\n` +
        `• 📦 **Med Vault & Refill Tracking**: Monitor your exact pill count and calculate remaining days of supply in [Med Vault](/medvault).\n` +
        `• 🩺 **Emergency Protocols**: Instantly surface Uganda emergency hotlines (999 / 112 / 0800-100-066) when safety risks are detected.\n\n` +
        `What medication or health question can I help you with today?`,
      source: "System",
      suggestions: ["Check my medications", "How is my pill stock?", "Check drug interactions"]
    };
  }

  // Interactions & Drug-Food Safety Guard
  if (
    normalizedQuery.includes("interact") ||
    normalizedQuery.includes("safety guard") ||
    (isAskingForPageLink && (normalizedQuery.includes("safety") || normalizedQuery.includes("food check") || normalizedQuery.includes("compatibility")))
  ) {
    if (normalizedQuery.includes("metronidazole") || normalizedQuery.includes("flagyl")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: "Yes, **Flagyl (Metronidazole)** has critical interactions you must watch out for:\n\n" +
          "1. ⚠️ **Alcohol & Local Brews (Waragi, Beer, Kasese, Wine)** — **CRITICAL**: Metronidazole blocks alcohol breakdown, causing a severe **disulfiram-like reaction** with violent vomiting, rapid heartbeat (tachycardia), facial flushing, headache, and severe stomach cramps. **NEVER drink alcohol** while taking Metronidazole and for at least **48 hours** after finishing your course.\n" +
          "2. ⚠️ **Blood Thinners (Warfarin)**: Metronidazole significantly increases Warfarin's anticoagulant effect, raising your risk of heavy bleeding.\n" +
          "3. ⚠️ **Lithium**: Can cause toxic buildup of lithium in the body.\n" +
          "4. ℹ️ **Food**: Taking Metronidazole with food or milk (such as *Matooke* or *Posho*) helps reduce stomach upset and metallic taste.\n\n" +
          "You can [check your drug & food interactions](/interactions) anytime to verify how Metronidazole pairs with your active cabinet.",
        source: "MoH",
        suggestions: ["Metronidazole with alcohol", "Check my interactions", "View medicine cabinet"]
      };
    }

    if (normalizedQuery.includes("coartem") || normalizedQuery.includes("artemether") || normalizedQuery.includes("lumefantrine")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: "Here is crucial safety and interaction guidance for **Coartem (Artemether / Lumefantrine)**:\n\n" +
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
        text: "Here are important safety and interaction facts for **Panadol (Paracetamol)**:\n\n" +
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
    text: "I'm DawaGPT, your Ugandan health companion. Ask me about your medications, reminders, drug interactions, or pill stock. For urgent medical issues, please call a professional.",
    source: "System",
    suggestions: ["Check my medications", "View my reminders", "Check drug interactions"]
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
      ? "⚠️ DawaGPT's AI service is temporarily unavailable. Please try again in a few minutes.\n\nFor urgent health questions, contact **NDA Uganda** toll-free: **0800 101 622** or **MoH Uganda**: **0800 100 066**."
      : rawMsg;
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: errorMessage,
      source: "System",
      suggestions: ["Try again", "Check my medications", "Contact NDA Uganda"]
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

    // If the stream completed with a connection failure or empty text, show a clear service unavailability message
    if (!fullText || fullText.includes("trouble connecting") || fullText.includes("trouble processing that request") || fullText.includes("Error starting chat stream")) {
      console.warn("[DawaGPT] Streaming delivered connection error. AI backend unreachable.");
      const serviceDownMsg = "⚠️ DawaGPT's AI service is temporarily unavailable. Our backend AI providers are being restored. Please try again in a few minutes.\n\nFor urgent health questions, call the **Uganda National Drug Authority (NDA)** toll-free: **0800 101 622** or the **Ministry of Health**: **0800 100 066**.";
      const offlineResp: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        text: serviceDownMsg,
        source: "System",
        suggestions: ["Try again", "Check my medications", "Contact NDA Uganda"]
      };
      onChunk(serviceDownMsg);
      return offlineResp;
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
    const isNetworkOrServerError = !rawMsg || /body\.messages|\bvalidation\b|\bstatus\b|\bfailed\b|expected string|internal server error|json|_zod|cannot read|undefined|typeerror|null|fetch|network|econnrefused/i.test(rawMsg);
    const errorMessage = isNetworkOrServerError
      ? "⚠️ DawaGPT's AI service is temporarily unavailable. Please try again in a few minutes.\n\nFor urgent health questions, contact **NDA Uganda** toll-free: **0800 101 622** or **MoH Uganda**: **0800 100 066**."
      : rawMsg;
    const errResp: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      text: errorMessage,
      source: "System",
      suggestions: ["Try again", "Check my medications", "Contact NDA Uganda"]
    };
    onChunk(errorMessage);
    return errResp;
  }
};

