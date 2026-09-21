/**
 * DawaGPT Service
 * Conversational medical assistant with full system read/write access.
 * Focused on Ugandan healthcare context and user safety.
 */

import { Medicine, Reminder, UserProfile, DoseLog, WellnessLog, Patient } from "../contexts/AppContext";
import { checkConditionSafety } from "./conditionInteractionService";
import { calculateRefillStatus, getDailyDoseRate } from "./refillService";
import { aiApi } from "./api";
import {
  isSameTaskOrDuplicateQuery,
  detectDuplicateTherapies,
  extractDrugsFromQuery,
  findLocalTherapeuticClass
} from "./therapeuticDuplicationService";
import { getContextualSuggestions, isGenericBoilerplate } from "@/lib/contextualSuggestions";
import { resolveToInternalRoute } from "@/components/MessageRenderer";

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
  source?: ChatMessageSource;
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

/**
 * Sanitizes markdown links in DawaGPT assistant text to ensure all links resolve
 * strictly to internal in-app routes and strips non-existent or external URLs.
 */
export function sanitizeMarkdownLinks(text: string): string {
  if (typeof text !== "string") return "";

  // Remove support@dawalens.ug and any dawalens.ug references
  let cleaned = text.replace(/support@dawalens\.ug/gi, "[Settings](/settings)");
  cleaned = cleaned.replace(/https?:\/\/(?:www\.)?dawalens\.ug[^\s)\]]*/gi, "/settings");

  return cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, rawHref) => {
    const resolved = resolveToInternalRoute(rawHref, label);
    if (resolved) {
      return `[${label}](${resolved})`;
    }
    return `[${label}](/)`;
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

export function distributeTimes(startTime: string = "08:00", freq: number = 1): string[] {
  if (!startTime || !startTime.includes(":")) return [startTime || "08:00"];
  const [hStr, mStr] = startTime.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return [startTime];
  if (freq <= 1) {
    const hh = String(h % 24).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return [`${hh}:${mm}`];
  }
  const intervalHours = 24 / freq;
  const newTimes: string[] = [];
  for (let i = 0; i < freq; i++) {
    const totalMinutes = Math.round(h * 60 + m + i * intervalHours * 60) % (24 * 60);
    const newH = Math.floor(totalMinutes / 60);
    const newM = Math.floor(totalMinutes % 60);
    newTimes.push(`${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`);
  }
  return newTimes;
}

export function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return "8:00 AM";
  if (timeStr.includes(",")) {
    const parts = timeStr.split(",").map(t => formatTimeDisplay(t.trim()));
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  }
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
  reminders: Reminder[] = [],
  patients: Patient[] = []
): AIAction | null => {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Guard: if it's purely an informational/safety question, do not misroute to actions
  const isMedQuestion = /\b(can i take|should i take|is it safe|interact|safe to|together|can i use|should i use|side effects?|what is|tell me about)\b/i.test(lower) || isSameTaskOrDuplicateQuery(lower, medicines);

  // 1. UNDO_DOSE_LOG
  const isUndoDose = /\b(undo(\s+my)?(\s+last)?\s+(dose|log|record)|revert(\s+my)?\s+dose|cancel(\s+my)?(\s+last)?\s+dose|i didn't take|didn't take my dose|made a mistake.*take)\b/i.test(lower);
  if (isUndoDose) {
    return {
      type: "UNDO_DOSE_LOG",
      payload: {},
      confirmMessage: "Reverted your last dose log and restored your Med Vault inventory."
    };
  }

  // 2. SWITCH_PATIENT_SCOPE
  const switchMatch = lower.match(/\b(?:switch\s+(?:to|context\s+to|profile\s+to)|view\s+profile\s+(?:for|of)|show\s+me\s+profile\s+(?:for|of))\s+([a-z0-9\s'-]+)/i);
  if (switchMatch) {
    const rawTarget = switchMatch[1].replace(/'s.*/, '').trim();
    if (['me', 'myself', 'self', 'my account', 'my profile'].includes(rawTarget)) {
      return {
        type: "SWITCH_PATIENT_SCOPE",
        payload: { patientId: null, patientName: "Self" },
        confirmMessage: "Switched context back to your personal health profile."
      };
    }
    const matchedPatient = patients.find(p => p.name.toLowerCase().includes(rawTarget) || rawTarget.includes(p.name.toLowerCase()));
    if (matchedPatient) {
      return {
        type: "SWITCH_PATIENT_SCOPE",
        payload: { patientId: matchedPatient.id, patientName: matchedPatient.name },
        confirmMessage: `Switched active context to ${matchedPatient.name}.`
      };
    }
  }

  // 3. SNOOZE_REMINDER
  const snoozeMatch = lower.match(/\bsnooze(?:\s+my)?(?:\s+[a-z0-9-]+)?(?:\s+reminder|\s+alarm)?\s+(?:for\s+)?(\d+)\s*(?:mins?|minutes?)\b/i);
  if (snoozeMatch) {
    const snoozeMinutes = parseInt(snoozeMatch[1], 10) || 15;
    return {
      type: "SNOOZE_REMINDER",
      payload: { snoozeMinutes },
      confirmMessage: `Snoozed your reminder for ${snoozeMinutes} minutes.`
    };
  }

  // 4. TOGGLE_REMINDER (Pause/Resume)
  const isPause = /\b(pause|turn off|disable|mute)\s+(?:all\s+)?(?:my\s+)?(?:medication\s+|medicine\s+)?(?:reminders?|alarms?)\b/i.test(lower);
  const isResume = /\b(resume|turn on|enable|unmute)\s+(?:all\s+)?(?:my\s+)?(?:medication\s+|medicine\s+)?(?:reminders?|alarms?)\b/i.test(lower);
  if (isPause || isResume) {
    const enabled = isResume;
    return {
      type: "TOGGLE_REMINDER",
      payload: { enabled },
      confirmMessage: enabled ? "All active medication reminders have been resumed." : "Your medication reminders have been paused."
    };
  }

  // 5. REMOVE_REMINDER
  const removeRemMatch = lower.match(/\b(?:delete|remove|cancel|stop)\s+(?:my\s+)?(?:reminder|alarm)\s*(?:for\s+([a-z0-9-]+))?\b/i) ||
                         lower.match(/\bstop\s+reminding\s+me\s+(?:about|for|to\s+take)\s+([a-z0-9-]+)\b/i);
  if (removeRemMatch) {
    const medQuery = (removeRemMatch[1] || "").trim();
    let matchedReminder = reminders.find(r => medQuery && r.medicineName.toLowerCase().includes(medQuery.toLowerCase()));
    if (!matchedReminder && medQuery) {
      matchedReminder = reminders.find(r => r.medicineName.toLowerCase() === medQuery.toLowerCase());
    }
    return {
      type: "REMOVE_REMINDER",
      payload: {
        id: matchedReminder?.id || null,
        medicineName: matchedReminder?.medicineName || medQuery || "Medication"
      },
      confirmMessage: `Removed reminder for ${matchedReminder?.medicineName || medQuery || "the medication"}.`
    };
  }

  // 6. UPDATE_REMINDER (Reschedule/Change time)
  const updateRemMatch = lower.match(/\b(?:change|move|reschedule|update|shift)\s+(?:my\s+)?([a-z0-9-]+)?\s*(?:reminder|alarm|schedule)\s*(?:to|for|at)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (updateRemMatch) {
    const medQuery = (updateRemMatch[1] || "").trim();
    const rawTime = updateRemMatch[2];
    const normalizedTime = rawTime ? formatTimeDisplay(rawTime) : "08:00";
    let matchedReminder = reminders.find(r => medQuery && r.medicineName.toLowerCase().includes(medQuery.toLowerCase()));
    return {
      type: "UPDATE_REMINDER",
      payload: {
        id: matchedReminder?.id || null,
        medicineName: matchedReminder?.medicineName || medQuery || "Reminder",
        time: rawTime
      },
      confirmMessage: `Updated reminder time for ${matchedReminder?.medicineName || medQuery || "your medication"} to ${normalizedTime}.`
    };
  }

  // 7. REMOVE_MEDICINE
  const removeMedMatch = lower.match(/\b(?:delete|remove|archive|stop\s+taking)\s+(?:the\s+|my\s+)?(?:medicine|medication|drug|pill)?\s*([a-z0-9-]+)(?:\s+from\s+(?:my\s+)?(?:cabinet|medications?|meds?|vault))?\b/i);
  if (removeMedMatch && !lower.includes("reminder") && !lower.includes("alarm") && !lower.includes("patient") && !lower.includes("member")) {
    const medQuery = removeMedMatch[1].trim();
    if (!['a', 'the', 'my', 'some', 'this'].includes(medQuery.toLowerCase())) {
      const matchedMed = medicines.find(m => m.name.toLowerCase().includes(medQuery.toLowerCase()));
      return {
        type: "REMOVE_MEDICINE",
        payload: {
          id: matchedMed?.id || null,
          name: matchedMed?.name || (medQuery.charAt(0).toUpperCase() + medQuery.slice(1))
        },
        confirmMessage: `Removed ${matchedMed?.name || medQuery} from your medicine cabinet.`
      };
    }
  }

  // 8. ADD_PATIENT
  const addPatientMatch = lower.match(/\b(?:add|create|register)\s+(?:a\s+|my\s+)?(?:family\s+member|dependent|client|patient|child|parent|mother|father|son|daughter|relative)\s+([a-z0-9\s'-]+)/i);
  if (addPatientMatch) {
    const rawInfo = addPatientMatch[1].trim();
    const ageMatch = lower.match(/\bage\s+(\d{1,3})\b/i) || lower.match(/\b(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|yo)\b/i);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;
    const gender = /\b(female|mother|daughter|girl|woman)\b/i.test(lower) ? 'female' : /\b(male|father|son|boy|man)\b/i.test(lower) ? 'male' : undefined;
    const cleanName = rawInfo.split(/,\s*|\s+(?:age|\d+|who|with)\b/i)[0].trim();
    const formattedName = cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    let relation = "Family";
    if (lower.includes("mother") || lower.includes("mama")) relation = "Mother";
    else if (lower.includes("father") || lower.includes("baba")) relation = "Father";
    else if (lower.includes("son")) relation = "Son";
    else if (lower.includes("daughter")) relation = "Daughter";
    else if (lower.includes("child") || lower.includes("baby")) relation = "Child";
    else if (lower.includes("client")) relation = "Client";

    return {
      type: "ADD_PATIENT",
      payload: {
        name: formattedName || "New Member",
        age,
        gender,
        relation,
        type: lower.includes("client") ? "client" : "family"
      },
      confirmMessage: `Added ${formattedName || "family member"} to your Family Hub.`
    };
  }

  // 9. BATCH_ADD_REGIMEN (e.g. Coartem 3-day treatment)
  const isRegimen = /\b(?:add|start|set up)\s+(?:a\s+)?(?:\d+[- ]day\s+)?(?:treatment|regimen|course|treatment\s+regimen|malaria\s*treatment)\s*(?:of|for)?\s*([a-z0-9-]+)\b/i.test(lower);
  if (isRegimen) {
    const regMatch = lower.match(/\b(?:of|for)\s+([a-z0-9-]+)/i);
    const medName = regMatch ? (regMatch[1].charAt(0).toUpperCase() + regMatch[1].slice(1)) : "Coartem (Artemether/Lumefantrine)";
    return {
      type: "BATCH_ADD_REGIMEN",
      payload: {
        medicineName: medName,
        dosage: "20/120mg",
        durationDays: 3,
        frequency: "twice daily",
        times: "08:00,20:00"
      },
      confirmMessage: `Set up 3-day treatment regimen and reminders for ${medName}.`
    };
  }

  // 10. NAVIGATE_PAGE
  const navMatch = lower.match(/\b(?:go to|take me to|open|navigate to)\s+(?:the\s+|my\s+)?(medvault|med\s*vault|inventory|stock|reminders?|alarms?|medications?|cabinet|history|logs|wellness|wellness\s*hub|family|family\s*hub|dependents?|interactions?|safety|safety\s*guard|travel|travel\s*companion|reports?|doctor\s*report|scanner|scan|settings?)\b/i);
  if (navMatch && !lower.includes("page") && !lower.includes("how") && !lower.includes("link") && !lower.startsWith("show") && !lower.includes("add") && !lower.includes("remind me") && !lower.includes("log") && !lower.includes("refill")) {
    const rawTarget = navMatch[1].toLowerCase().replace(/\s+/g, '');
    let targetRoute = "/";
    if (rawTarget.includes("medvault") || rawTarget.includes("inventory") || rawTarget.includes("stock")) targetRoute = "/medvault";
    else if (rawTarget.includes("reminder") || rawTarget.includes("alarm")) targetRoute = "/reminders";
    else if (rawTarget.includes("medication") || rawTarget.includes("cabinet")) targetRoute = "/medications";
    else if (rawTarget.includes("history") || rawTarget.includes("log")) targetRoute = "/history";
    else if (rawTarget.includes("wellness")) targetRoute = "/wellness";
    else if (rawTarget.includes("family") || rawTarget.includes("dependent")) targetRoute = "/family";
    else if (rawTarget.includes("interaction") || rawTarget.includes("safety")) targetRoute = "/interactions";
    else if (rawTarget.includes("travel")) targetRoute = "/travel";
    else if (rawTarget.includes("report")) targetRoute = "/report";
    else if (rawTarget.includes("scan")) targetRoute = "/scan";
    else if (rawTarget.includes("setting")) targetRoute = "/settings";

    return {
      type: "NAVIGATE_PAGE",
      payload: { targetRoute },
      confirmMessage: `Navigating to ${targetRoute}.`
    };
  }

  // 11. OPEN_PHARMACY_MODAL
  const isPharmacyFinder = /\b(find\s+(?:a\s+)?pharmacy|where\s+(?:can\s+i|to)\s+buy|nearest\s+pharmacy|pharmacies\s+near\s+me|open\s+pharmacy\s+finder|locate\s+pharmacy)\b/i.test(lower);
  if (isPharmacyFinder) {
    const medMatch = lower.match(/\b(?:buy|find|for)\s+([a-z0-9-]+)\b/i);
    const targetMed = medMatch && !['a', 'the', 'some', 'me', 'pharmacy', 'medicine', 'pills'].includes(medMatch[1].toLowerCase()) ? (medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1)) : undefined;
    return {
      type: "OPEN_PHARMACY_MODAL",
      payload: { medicineName: targetMed },
      confirmMessage: `Opening National Drug Authority (NDA) pharmacy locator${targetMed ? ` for ${targetMed}` : ""}.`
    };
  }

  // 12. ADD_REMINDER
  const isReminderIntent = /\b(remind(\s+me)?|set(\s+a)?\s+reminder|add(\s+a)?\s+reminder|schedule(\s+a)?\s+reminder|create(\s+a)?\s+reminder|alarm\s+for)\b/i.test(lower);
  if (isReminderIntent) {
    const timeMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    let explicitTime: string | null = null;
    if (timeMatch && (timeMatch[3] || lower.includes("at ") || timeMatch[2])) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        explicitTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }

    const matchedMed = medicines
      .filter(m => (m.name && lower.includes(m.name.toLowerCase())) || (m.genericName && lower.includes(m.genericName.toLowerCase())))
      .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))[0];

    // If medication exists in Med Vault / Medications:
    if (matchedMed) {
      // If user did not provide a starting time, return null so DawaGPT asks for the starting time
      if (!explicitTime) {
        return null;
      }

      // Read dosage from user prompt or Med Vault / Medications
      const doseMatch = lower.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablets?|pills?|capsules?))\b/i);
      const dose = doseMatch ? doseMatch[1] : (
        matchedMed.dosagePerDose
          ? `${matchedMed.dosagePerDose} ${matchedMed.unit || 'tablets'}`
          : (matchedMed.dosage || "1 tablet")
      );

      // Read daily frequency from user prompt or Med Vault / Medications
      let freq = matchedMed.frequencyPerDay && matchedMed.frequencyPerDay > 0 ? matchedMed.frequencyPerDay : 1;
      let repeatSchedule: "daily" | "weekly" | "once" | "custom" = freq > 1 ? "custom" : "daily";

      if (lower.includes("weekly")) {
        repeatSchedule = "weekly";
        freq = 1;
      } else if (lower.includes("once")) {
        repeatSchedule = "once";
        freq = 1;
      } else if (lower.includes("twice") || lower.includes("2 times") || lower.includes("2x") || lower.includes("two times")) {
        freq = 2;
        repeatSchedule = "custom";
      } else if (lower.includes("three times") || lower.includes("thrice") || lower.includes("3 times") || lower.includes("3x")) {
        freq = 3;
        repeatSchedule = "custom";
      } else if (lower.includes("four times") || lower.includes("4 times") || lower.includes("4x")) {
        freq = 4;
        repeatSchedule = "custom";
      }

      const timesList = distributeTimes(explicitTime, freq);
      const finalTimeStr = timesList.join(",");
      const freqDesc = freq > 1 ? `${freq} times a day` : repeatSchedule;

      return {
        type: "ADD_REMINDER",
        payload: {
          medicineName: matchedMed.name,
          medicineId: matchedMed.id,
          dose,
          time: finalTimeStr,
          repeatSchedule,
          frequencyPerDay: freq
        },
        confirmMessage: `Reminder set for ${matchedMed.name} (${dose}) at ${formatTimeDisplay(finalTimeStr)} (${freqDesc}).`
      };
    }

    // Medication does NOT exist in the cabinet/vault.
    // Return null so DawaGPT can ask for dosage and frequency.
    return null;
  }

  // 13. LOG_DOSE
  const isDoseLogIntent = /\b(i took|i've taken|i just took|i already took|log (that )?i took|record (that )?i took|mark (my )?.* as taken|i missed|i skipped)\b/i.test(lower);
  if (isDoseLogIntent) {
    const isMissed = /\b(missed|skipped|forgot)\b/i.test(lower);
    const status = isMissed ? "missed" : "taken";

    const matchedMed = medicines.find(m => m.name && lower.includes(m.name.toLowerCase()));
    let medName = matchedMed ? matchedMed.name : null;

    if (!medName) {
      const medMatch = lower.match(/(?:took|taken|missed|skipped)\s+(?:my\s+)?([a-z0-9-]+)/i);
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

  // 14. UPDATE_MEDICINE (Med Vault Refill)
  const isRefillIntent = /\b(refill(ed)?|restock(ed)?|top\s*up|topped\s*up|update stock|set stock|purchased|bought)\b/i.test(lower);
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

  // 15. ADD_MEDICINE (Direct Cabinet Addition)
  const isAddMedIntent = !isMedQuestion && (
    /\b(?:add|put|register|save)\s+(?:a\s+|my\s+)?(?:new\s+)?(?:medicine|medication|pill|drug|tablet|prescription)\b/i.test(lower) ||
    /\b(?:add|put)\s+([a-z0-9-]+(?:\s+[a-z0-9-]+)?)\s+(?:to\s+(?:my\s+)?(?:cabinet|medications?|meds?|vault|inventory))\b/i.test(lower) ||
    (/\b(?:add|register)\s+([a-z0-9-]+)\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablets?|pills?|capsules?|mcg))\b/i.test(lower) && !isReminderIntent)
  );
  if (isAddMedIntent) {
    let name = "Medication";
    const nameMatch = lower.match(/\b(?:add|put|register|new)\s+(?:a\s+|my\s+)?(?:new\s+)?(?:medicine|medication|pill|drug|tablet)?\s*(?:called\s+|named\s+)?([a-z0-9-]+(?:\s+[a-z0-9-]+)?)/i);
    if (nameMatch && !['a', 'the', 'my', 'some', 'new', 'to', 'in'].includes(nameMatch[1].toLowerCase())) {
      name = nameMatch[1].split(/\s+(?:to|in|at|dosage|\d+mg|\d+\s*mg)/)[0].trim();
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    const doseMatch = lower.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|tablets?|pills?|capsules?|drops?|puffs?))\b/i);
    const dosage = doseMatch ? doseMatch[1] : "500mg";

    let dosagePerDose = 1;
    const dosagePerDoseMatch = lower.match(/\b(\d+)\s*(?:tablets?|pills?|capsules?|drops?|puffs?)\s*(?:per\s+dose|each\s+time|twice|three|daily|per\s+day)?\b/i);
    if (dosagePerDoseMatch) {
      dosagePerDose = parseInt(dosagePerDoseMatch[1], 10) || 1;
    }

    let frequencyPerDay = 1;
    if (lower.includes("twice") || lower.includes("2x") || lower.includes("2 times") || lower.includes("two times")) frequencyPerDay = 2;
    else if (lower.includes("three times") || lower.includes("3x") || lower.includes("thrice") || lower.includes("3 times")) frequencyPerDay = 3;
    else if (lower.includes("four times") || lower.includes("4x") || lower.includes("4 times")) frequencyPerDay = 4;

    let unit = "tablets";
    if (lower.includes("capsule")) unit = "capsules";
    else if (lower.includes("ml") || lower.includes("syrup") || lower.includes("liquid")) unit = "ml";
    else if (lower.includes("puff") || lower.includes("inhaler")) unit = "puffs";
    else if (lower.includes("drop")) unit = "drops";

    const qtyMatch = lower.match(/\b(?:with|have|total\s+of)?\s*(\d+)\s*(?:pills?|tablets?|capsules?|units?|bottles?)\b/i);
    const totalQuantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 30;

    let time: string | null = null;
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

    return {
      type: "ADD_MEDICINE",
      payload: {
        name,
        dosage,
        dosagePerDose,
        frequencyPerDay,
        totalQuantity,
        currentQuantity: totalQuantity,
        unit,
        reminderSchedule: time ? {
          time,
          dose: `${dosagePerDose} ${unit}`,
          repeatSchedule: frequencyPerDay === 2 ? "custom" : "daily"
        } : undefined
      },
      confirmMessage: `Added **${name}** (${dosage}) to your medicine cabinet.`
    };
  }

  // 16. LOG_WELLNESS (Guard against medication questions)
  if (isMedQuestion) return null;

  const wellnessData = extractWellnessData(text);
  if (wellnessData) {
    const moodLabels: Record<number, string> = { 1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great" };
    const moodStr = moodLabels[wellnessData.mood] || `${wellnessData.mood}/5`;
    const symSummary = wellnessData.symptoms.length > 0 ? wellnessData.symptoms.join(', ') : 'none';

    return {
      type: "LOG_WELLNESS",
      payload: {
        type: "symptom",
        data: {
          mood: wellnessData.mood,
          energy: wellnessData.energy,
          symptoms: wellnessData.symptoms,
          notes: wellnessData.notes
        }
      },
      confirmMessage: `Recorded wellness check-in (mood: ${moodStr} [${wellnessData.mood}/5], vitality: ${wellnessData.energy * 20}%, symptoms: ${symSummary}).`
    };
  }

  return null;
};

export interface ExtractedWellnessData {
  mood: number;
  energy: number;
  symptoms: string[];
  notes: string;
}

export function extractWellnessData(text: string): ExtractedWellnessData | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Guard against medication questions
  const isMedQuestion = /\b(can i take|should i take|is it safe|interact|safe to|together|can i use|should i use)\b/i.test(lower);
  if (isMedQuestion) return null;

  const isWellnessIntent = /\b(log (my )?(mood|symptoms?|wellness|energy)|feeling|i feel|i'm feeling|i am feeling|i have (a|an)?\s*(headache|stomachache|stomach\s*ache|migraine|fever|cough|cramp|pain)|headache|stomachache|stomach\s*ache|dizzy|dizziness|nausea|fatigue|fever|ecstatic|thrilled|overjoyed|very\s*happy|super\s*happy|so\s*happy|extremely\s*happy|happy|delighted|joyful|depressed|sad|unwell|sick|omutwe|olubuto|musujja)\b/i.test(lower);

  if (!isWellnessIntent) return null;

  const symptoms: string[] = [];

  // Physical symptoms (aligned with Wellness Hub standard categories)
  if (/\b(headache|migraine|omutwe|head\s*ache|head\s*hurts?)\b/i.test(lower)) {
    symptoms.push("Headache");
  }
  if (/\b(stomachache|stomach\s*ache|olubuto|tummy\s*ache|belly\s*ache|abdominal\s*pain|cramps?|indigestion)\b/i.test(lower)) {
    symptoms.push("Stomach Ache");
  }
  if (/\b(fever|musujja|high\s*temp(erature)?|feverish|chills)\b/i.test(lower)) {
    symptoms.push("Fever");
  }
  if (/\b(dizzy|dizziness|lightheaded(ness)?|vertigo)\b/i.test(lower)) {
    symptoms.push("Dizziness");
  }
  if (/\b(nausea|nauseous|vomit(ing)?|throwing\s*up|queasy)\b/i.test(lower)) {
    symptoms.push("Nausea");
  }
  if (/\b(fatigue|exhaust(ed|ion)?|tired|weak(ness)?|drained|worn\s*out|no\s*energy|low\s*energy)\b/i.test(lower)) {
    symptoms.push("Fatigue");
  }
  if (/\b(pain|hurts?|aching|sore|obulumi|body\s*ache)\b/i.test(lower)) {
    if (!symptoms.includes("Headache") && !symptoms.includes("Stomach Ache")) {
      symptoms.push("Pain");
    }
  }
  if (/\b(cough(ing)?|ekifuba)\b/i.test(lower)) {
    symptoms.push("Cough");
  }

  // Mental / Emotional symptoms (aligned with Wellness Hub standard categories)
  const isEcstatic = /\b(ecstatic|thrilled|overjoyed|on\s*cloud\s*nine|blissful|extremely\s*happy|so\s*happy|super\s*happy|very\s*happy)\b/i.test(lower);
  const isHappy = isEcstatic || /\b(happy|cheerful|joyful|delighted|in\s*a\s*great\s*mood|feeling\s*great|amazing|fantastic)\b/i.test(lower);
  const isRelaxed = /\b(relaxed|calm|peaceful|serene|chill)\b/i.test(lower);
  const isFocused = /\b(good\s*focus|focused|sharp|productive)\b/i.test(lower);
  const isAnxious = /\b(anxious|anxiety|nervous|worried|panicky)\b/i.test(lower);
  const isStressed = /\b(stressed|stress|overwhelmed|under\s*pressure)\b/i.test(lower);
  const isIrritable = /\b(irritable|irritated|annoyed|cranky|grumpy)\b/i.test(lower);

  if (isHappy) symptoms.push("Happy");
  if (isRelaxed) symptoms.push("Relaxed");
  if (isFocused) symptoms.push("Good Focus");
  if (isAnxious) symptoms.push("Anxious");
  if (isStressed) symptoms.push("Stressed");
  if (isIrritable) symptoms.push("Irritable");

  // Determine Mood (1 to 5 scale)
  let mood = 3;
  const isSevere = /\b(severe|terrible|awful|unbearable|horrible|excruciating|depressed|miserable|agony)\b/i.test(lower);
  const hasPhysicalIllness = symptoms.some(s => ["Headache", "Stomach Ache", "Fever", "Nausea", "Dizziness", "Pain", "Cough"].includes(s));

  if (isEcstatic) {
    mood = 5;
  } else if (isHappy) {
    mood = 4;
  } else if (isRelaxed || isFocused) {
    mood = 4;
  } else if (isSevere) {
    mood = 1;
  } else if (hasPhysicalIllness || isAnxious || isStressed || isIrritable || /\b(sad|down|bad|unwell|sick)\b/i.test(lower)) {
    mood = 2;
  } else if (/\b(okay|fine|alright|neutral|meh)\b/i.test(lower)) {
    mood = lower.includes("meh") ? 2 : 3;
  }

  // Determine Energy (1 to 5 scale)
  let energy = 3;
  const isExhausted = /\b(exhaust(ed|ion)?|drained|fatigued|depleted|no\s*energy|burned\s*out|completely\s*tired|dead\s*tired)\b/i.test(lower);
  const isHighEnergy = /\b(full\s*of\s*energy|bursting\s*with\s*energy|super\s*energetic|hyper|invigorated|high\s*energy|energetic|feeling\s*strong)\b/i.test(lower);

  if (isEcstatic || isHighEnergy) {
    energy = 5;
  } else if (isExhausted) {
    energy = 1;
  } else if (mood === 5) {
    energy = isHighEnergy ? 5 : 4;
  } else if (mood === 4) {
    energy = isRelaxed ? 3 : 4;
  } else if (isSevere) {
    energy = 1;
  } else if (hasPhysicalIllness || symptoms.includes("Fatigue") || /\b(tired|sluggish|weak|low\s*energy)\b/i.test(lower)) {
    energy = 2;
  } else if (mood === 2) {
    energy = 2;
  } else {
    energy = 3;
  }

  return {
    mood,
    energy,
    symptoms,
    notes: text,
  };
}

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

  // 1. Action Dispatching (All full-system agentic actions)
  const action = extractDeterministicAction(query, allMedicines, reminders, patients);
  if (action) {
    if (action.type === "ADD_MEDICINE") {
      const payload = action.payload as any;
      const remText = payload.reminderSchedule ? ` Companion reminder set for **${formatTimeDisplay(payload.reminderSchedule.time)}**.` : "";
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've added **${payload?.name}** (${payload?.dosage}) to your medicine cabinet.${remText}\n\nYou can [view your active prescriptions in My Medications](/medications) or [track stock in Med Vault](/medvault).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Cabinet Guard",
        action
      };
    }
    if (action.type === "REMOVE_MEDICINE") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've removed **${payload?.name}** from your active medicine cabinet.\n\nYou can [review your updated cabinet in My Medications](/medications).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Cabinet Guard",
        action
      };
    }
    if (action.type === "ADD_REMINDER") {
      const payload = action.payload as any;
      const displayTime = formatTimeDisplay(payload?.time);
      const freqCount = payload?.time?.includes(",") ? payload.time.split(",").length : (payload?.frequencyPerDay || 1);
      const freqText = freqCount > 1 ? ` ${freqCount} times a day` : ` ${payload?.repeatSchedule || "daily"}`;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've set up a reminder for you to take **${payload?.medicineName}** (${payload?.dose})${freqText} at **${displayTime}**.\n\nYou can [view or manage your schedule in Medication Reminders](/reminders) or [check stock in Med Vault](/medvault).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Schedule Guard",
        action
      };
    }
    if (action.type === "UPDATE_REMINDER") {
      const payload = action.payload as any;
      const displayTime = formatTimeDisplay(payload?.time);
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've updated your reminder for **${payload?.medicineName}** to **${displayTime}**.\n\nYou can [review all alarms in Medication Reminders](/reminders).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Schedule Guard",
        action
      };
    }
    if (action.type === "REMOVE_REMINDER") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've removed the reminder for **${payload?.medicineName}**.\n\nYou can [manage remaining alarms in Medication Reminders](/reminders).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Schedule Guard",
        action
      };
    }
    if (action.type === "TOGGLE_REMINDER") {
      const payload = action.payload as any;
      const statusText = payload.enabled ? "resumed" : "paused";
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I have **${statusText}** your medication reminders.\n\nYou can [view or toggle individual alarms in Medication Reminders](/reminders).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Schedule Guard",
        action
      };
    }
    if (action.type === "SNOOZE_REMINDER") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Snoozed your medication reminder for **${payload.snoozeMinutes || 15} minutes**. I'll alert you again shortly!`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Schedule Guard",
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
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Adherence Guard",
        action
      };
    }
    if (action.type === "UNDO_DOSE_LOG") {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've reverted your last logged dose and restored your pill count in Med Vault.\n\nYou can [check your updated logs in Dose History](/history).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Adherence Guard",
        action
      };
    }
    if (action.type === "UPDATE_MEDICINE") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've updated your Med Vault: **${payload?.name}** stock is now set to **${payload?.currentQuantity} tablets**.\n\nYou can [view and track your pill supply in Med Vault](/medvault).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Med Vault",
        action
      };
    }
    if (action.type === "ADD_PATIENT") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've added **${payload.name}**${payload.relation ? ` (${payload.relation})` : ""} to your Family Hub.\n\nYou can [manage multi-dependent profiles in Family Hub](/family).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Family Hub Guard",
        action
      };
    }
    if (action.type === "SWITCH_PATIENT_SCOPE") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Active context switched to **${payload.patientName || "Personal Profile"}**.\n\nAll subsequent queries and schedules are now scoped to this profile. You can [view family profiles in Family Hub](/family).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Family Hub Guard",
        action
      };
    }
    if (action.type === "BATCH_ADD_REGIMEN") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I've configured the 3-day treatment course and alarms for **${payload.medicineName}** (${payload.frequency} at ${payload.times}).\n\nYou can [manage these alarms in Medication Reminders](/reminders).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Schedule Guard",
        action
      };
    }
    if (action.type === "NAVIGATE_PAGE") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Navigating directly to [${payload.targetRoute}](${payload.targetRoute}).`,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Navigator Guard",
        action
      };
    }
    if (action.type === "OPEN_PHARMACY_MODAL") {
      const payload = action.payload as any;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Opening the official **NDA Uganda Pharmacy Finder**${payload.medicineName ? ` for **${payload.medicineName}**` : ""}. Locating licensed dispensaries near you...`,
        suggestions: ["Find 24/7 pharmacies", "Call nearest pharmacy", "Check pill stock"],
        source: "NDA Locator Guard",
        action
      };
    }
    if (action.type === "LOG_WELLNESS") {
      const payload = action.payload as any;
      const moodVal = Number(payload?.data?.mood) || 3;
      const energyVal = Number(payload?.data?.energy) || 3;
      const symptomsList = (payload?.data?.symptoms as string[]) || [];
      const symStr = symptomsList.length > 0 ? symptomsList.join(', ') : 'general check-in';
      const activeGender = (selectedPatientId && patients.length > 0
        ? patients.find(p => p.id === selectedPatientId)?.gender
        : undefined) || userProfile?.gender;
      const honorific = resolveHonorific(activeGender);
      const greeting = honorific ? ` ${honorific}` : "";
      const moodLabels: Record<number, string> = { 1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great / Ecstatic" };
      const moodDisplay = moodLabels[moodVal] || `${moodVal}/5`;

      const isPositiveVibe = moodVal >= 4 && !symptomsList.some(s => ["Headache", "Stomach Ache", "Fever", "Nausea", "Dizziness", "Pain", "Cough"].includes(s));

      const responseText = isPositiveVibe
        ? `That's wonderful to hear${greeting}! 🌟 I've recorded your positive vibe in the Wellness Hub (Mood: **${moodDisplay}**, Vitality: **${energyVal * 20}%**). Keep embracing that great vitality!\n\nYou can [review your wellness logs in Wellness Hub](/wellness).`
        : `I've recorded this in your Wellness Hub (Mood: **${moodDisplay}**, Vitality: **${energyVal * 20}%**, Symptoms: **${symStr}**). Bambi${greeting}, please rest, stay well-hydrated, and consult a healthcare professional if symptoms persist.\n\nYou can [review your wellness logs in Wellness Hub](/wellness).`;

      return {
        id: Date.now().toString(),
        role: "assistant",
        text: responseText,
        suggestions: getContextualSuggestions({ userQuery: query, action, medicines: allMedicines, reminders }),
        source: "Wellness Guard",
        action
      };
    }
  }

  // 1.5 Handle Reminder Intent when no action was generated (clarification needed)
  const isReminderIntent = /\b(remind(\s+me)?|set(\s+a)?\s+reminder|add(\s+a)?\s+reminder|schedule(\s+a)?\s+reminder|create(\s+a)?\s+reminder|alarm\s+for)\b/i.test(normalizedQuery);
  if (isReminderIntent) {
    const matchedMed = allMedicines
      .filter(m => (m.name && normalizedQuery.includes(m.name.toLowerCase())) || (m.genericName && normalizedQuery.includes(m.genericName.toLowerCase())))
      .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))[0];

    if (matchedMed) {
      // Case 1: Medicine exists in Med Vault / Medications, but user didn't provide starting time
      const doseStr = matchedMed.dosagePerDose
        ? `${matchedMed.dosagePerDose} ${matchedMed.unit || "tablets"}`
        : (matchedMed.dosage || "1 tablet");
      const freqVal = matchedMed.frequencyPerDay && matchedMed.frequencyPerDay > 0 ? matchedMed.frequencyPerDay : 1;
      const freqStr = freqVal > 1 ? `${freqVal} times a day` : "once daily";

      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `I found **${matchedMed.name}** in your Med Vault, prescribed as **${doseStr}, ${freqStr}**.\n\nWhat time would you like to take your first dose so I can set up your reminder schedule?`,
        suggestions: ["Start at 7:00 AM", "Start at 8:00 AM", "Start at 9:00 AM", "Take at 8:00 PM"],
        source: "Schedule Guard"
      };
    }

    // Case 2: Medicine does NOT exist in Med Vault / Medications
    let targetMedName = "this medication";
    const medMatch = normalizedQuery.match(/(?:take|reminder\s+for|set\s+a\s+reminder\s+for|add\s+a\s+reminder\s+for|remind\s+me\s+to\s+take|remind\s+me\s+for|alarm\s+for|for)\s+([a-z0-9-]+)/i);
    if (medMatch && !['a', 'my', 'the', 'some', 'me', 'daily', 'twice', 'an', 'once', 'alarm'].includes(medMatch[1].toLowerCase())) {
      targetMedName = medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1);
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: `I couldn't find **${targetMedName}** in your Medications or Med Vault cabinet.\n\nTo set up the right reminder schedule for you, could you please tell me:\n1. **What is your prescribed dosage** (e.g., *1 tablet*, *500mg*, or *10ml*)?\n2. **How often should you take it** (e.g., *once daily*, *twice a day*, or *3 times a day*) and at what preferred times?\n\nYou can also [add it to your medicine cabinet](/medications) or [track stock in Med Vault](/medvault) so I can automatically sync your dosage and refill alerts.`,
      suggestions: [
        "1 tablet once daily at 8am",
        "2 tablets twice daily at 8am",
        "2 tablets 3 times daily at 8am",
        `Add ${targetMedName} to cabinet`
      ],
      source: "Schedule Guard"
    };
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
      text: "Here is the official **Support Directory for Uganda**:\n\n" +
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
        `• 🩺 **Verified Support**: Instantly surface Uganda support contacts for the National Drug Authority (NDA 0800 101 999) and Mental Health Support (0800 200 600).\n\n` +
        `What medication or health question can I help you with today?`,
      source: "System",
      suggestions: ["Check my medications", "How is my pill stock?", "Check drug interactions"]
    };
  }

  // Therapeutic Duplication & Same-Task Medication Intelligence
  const isDupQuery = isSameTaskOrDuplicateQuery(normalizedQuery, allMedicines);
  const activeGender = (selectedPatientId && patients.length > 0
    ? patients.find(p => p.id === selectedPatientId)?.gender
    : undefined) || userProfile?.gender;
  const honorific = resolveHonorific(activeGender);

  if (isDupQuery || (allMedicines.length >= 2 && detectDuplicateTherapies(allMedicines).length > 0 && (normalizedQuery.includes("interact") || normalizedQuery.includes("safe") || normalizedQuery.includes("conflict")))) {
    const cabinetDuplicates = detectDuplicateTherapies(allMedicines);
    const queryDrugs = extractDrugsFromQuery(normalizedQuery, allMedicines);
    const queryDuplicates = queryDrugs.length >= 2 ? detectDuplicateTherapies(queryDrugs.map(name => ({ name }))) : [];
    const activeDup = queryDuplicates[0] || cabinetDuplicates[0];

    const salutation = honorific ? ` ${honorific}` : "";
    if (activeDup) {
      const dangersList = activeDup.dangers.map((d: string) => `• ⚠️ **${d}**`).join('\n');
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `⚠️ **Therapeutic Duplication Alert**:\n\n` +
          `Bambi${salutation}, taking **${activeDup.drug1}** and **${activeDup.drug2}** together is dangerous because **both medications perform the exact same clinical task** (${activeDup.sharedTask}).\n\n` +
          `**Why this is harmful (Additive Toxicity & Ceiling Effect)**:\n` +
          `Doubling up on medicines from the same class (${activeDup.sharedClass}) **does not give you double the relief**. Instead, it severely multiplies the risk of toxic side effects and organ injury:\n` +
          `${dangersList}\n\n` +
          `**Recommended Next Steps**:\n` +
          `1. **Do not take both medicines at the same time**.\n` +
          `2. ${activeDup.guidance}\n` +
          `3. You can [check your full cabinet in Drug & Food Interactions](/interactions) or [review your active prescriptions in My Medications](/medications).\n\n` +
          `*Source: National Drug Authority (NDA) Uganda & U.S. FDA Drug Safety.*`,
        source: "NDA",
        suggestions: ["Which one should I stop?", "Check drug interactions", "View active medications"]
      };
    }

    if (queryDrugs.length >= 2) {
      const class1 = findLocalTherapeuticClass(queryDrugs[0]);
      const class2 = findLocalTherapeuticClass(queryDrugs[1]);
      if (class1 && class2 && class1.id === class2.id) {
        const dangersList = class1.dangers.map((d: string) => `• ⚠️ **${d}**`).join('\n');
        return {
          id: Date.now().toString(),
          role: "assistant",
          text: `⚠️ **Therapeutic Duplication Alert**:\n\n` +
            `Bambi${salutation}, taking **${queryDrugs[0]}** and **${queryDrugs[1]}** together is dangerous because **both medications perform the exact same clinical task** (${class1.task}).\n\n` +
            `**Why this is harmful (Additive Toxicity & Ceiling Effect)**:\n` +
            `Doubling up on medicines from the same class (${class1.name}) **does not give you double the relief**. Instead, it severely multiplies the risk of toxic side effects and organ injury:\n` +
            `${dangersList}\n\n` +
            `**Recommended Next Steps**:\n` +
            `1. **Do not take both medicines at the same time**.\n` +
            `2. ${class1.guidance}\n` +
            `3. You can [check your full cabinet in Drug & Food Interactions](/interactions) or [review your active prescriptions in My Medications](/medications).\n\n` +
            `*Source: National Drug Authority (NDA) Uganda & U.S. FDA Drug Safety.*`,
          source: "NDA",
          suggestions: ["Which one is safer for me?", "Check drug interactions", "View active medications"]
        };
      }
    }

    const greeting = honorific ? ` ${honorific}` : "";
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: `⚠️ **Clinical Interaction Warning: Medications Performing the Same Task**\n\n` +
        `Bambi${greeting}, taking more than one medication that performs the same clinical task is known as **Therapeutic Duplication**.\n\n` +
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

  // Age-Aware Food, Chewables & Drinks Guidance (Local Ugandan & Global Scope)
  const isFoodDrinkQuery = !isAskingForPageLink && (
    normalizedQuery.includes("food") ||
    normalizedQuery.includes("eat") ||
    normalizedQuery.includes("drink") ||
    normalizedQuery.includes("chew") ||
    normalizedQuery.includes("chewable") ||
    normalizedQuery.includes("swallow") ||
    normalizedQuery.includes("meal") ||
    normalizedQuery.includes("take with") ||
    normalizedQuery.includes("beverage") ||
    normalizedQuery.includes("applesauce") ||
    normalizedQuery.includes("yogurt") ||
    normalizedQuery.includes("oatmeal") ||
    normalizedQuery.includes("bushera") ||
    normalizedQuery.includes("matooke") ||
    normalizedQuery.includes("g-nut") ||
    normalizedQuery.includes("posho")
  );

  if (isFoodDrinkQuery) {
    // 1. Resolve age from explicit query text or active patient / user profile
    let queryAge: number | null = null;
    if (/\b(infant|baby|newborn)\b/i.test(normalizedQuery)) queryAge = 0;
    else if (/\b(toddler)\b/i.test(normalizedQuery)) queryAge = 2;
    else {
      const match = normalizedQuery.match(/\b(?:age|aged)\s*(\d{1,2})\b/) ||
                    normalizedQuery.match(/\b(\d{1,2})\s*(?:years?\s*old|yrs?\s*old|yo|-year-old|-yr-old)\b/) ||
                    normalizedQuery.match(/\b(?:child|kid|boy|girl)\s*(?:of|aged)?\s*(\d{1,2})\b/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 120) queryAge = parsed;
      }
    }
    if (queryAge === null) {
      if (/\b(child|kid)\b/i.test(normalizedQuery)) queryAge = 7;
      else if (/\b(elderly|senior|geriatric|old person|older adult|grandma|grandpa|granny|jajja)\b/i.test(normalizedQuery)) queryAge = 72;
    }

    const activePatient = selectedPatientId && patients.length > 0 ? patients.find(p => p.id === selectedPatientId) : null;
    const targetEntity = activePatient || userProfile;
    let profileAge: number | null = null;
    if (targetEntity) {
      if (typeof (targetEntity as any).age === 'number') {
        profileAge = (targetEntity as any).age;
      } else if (targetEntity.dateOfBirth) {
        const dob = new Date(targetEntity.dateOfBirth);
        if (!isNaN(dob.getTime())) {
          const now = new Date();
          let age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
          if (age >= 0 && age <= 150) profileAge = age;
        }
      }
    }

    const resolvedAge = queryAge !== null ? queryAge : profileAge;
    const greeting = honorific ? ` ${honorific}` : "";

    // 2. Identify target medication
    let matchedMed = (allMedicines || []).find(m => m.name && normalizedQuery.includes(m.name.toLowerCase()));
    if (!matchedMed) {
      if (normalizedQuery.includes("panadol") || normalizedQuery.includes("paracetamol")) matchedMed = { name: "Panadol (Paracetamol)" } as any;
      else if (normalizedQuery.includes("coartem") || normalizedQuery.includes("artemether") || normalizedQuery.includes("lumefantrine")) matchedMed = { name: "Coartem (Artemether/Lumefantrine)" } as any;
      else if (normalizedQuery.includes("ibuprofen") || normalizedQuery.includes("nurofen")) matchedMed = { name: "Nurofen (Ibuprofen)" } as any;
      else if (normalizedQuery.includes("flagyl") || normalizedQuery.includes("metronidazole")) matchedMed = { name: "Flagyl (Metronidazole)" } as any;
      else if (normalizedQuery.includes("amoxicillin") || normalizedQuery.includes("augmentin")) matchedMed = { name: "Amoxicillin" } as any;
      else if (normalizedQuery.includes("ciprofloxacin") || normalizedQuery.includes("cipro")) matchedMed = { name: "Ciprofloxacin" } as any;
      else if (normalizedQuery.includes("metformin")) matchedMed = { name: "Metformin" } as any;
      else if (activeMedicine) matchedMed = activeMedicine;
      else if (allMedicines && allMedicines.length > 0) matchedMed = allMedicines[0];
    }
    const medName = matchedMed?.name || "your medication";

    // 3. Pediatric guidance (< 12 years)
    if (resolvedAge !== null && resolvedAge < 12) {
      const ageDetail = resolvedAge === 0 ? "an infant" : resolvedAge <= 3 ? `a toddler (${resolvedAge} yrs)` : `a child (${resolvedAge} yrs)`;
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Here is age-tailored food, chewables, and drink guidance for **${medName}** for ${ageDetail}${greeting}:\n\n` +
          `• 🍬 **Chewable & Liquid Alternatives**: Swallowing whole pills is a serious choking risk for young children. Ask your pharmacist or clinician for **chewable tablets**, **orally dispersible tablets (ODTs)**, or **oral syrups/suspensions**.\n` +
          `• 🥣 **Soft Food Vehicles for Crushed Meds**: If the tablet is approved by a doctor or pharmacist to be crushed (never crush extended-release or coated pills), mix the dose into 1–2 teaspoons of smooth, palatable food:\n` +
          `  - **Everyday options**: Smooth applesauce, plain yogurt, fruit puree, or oatmeal.\n` +
          `  - **Local Ugandan options**: Warm smooth *Bushera* (millet porridge) or mashed soft *Matooke*.\n` +
          `  - *Instruction*: Have the child take the spoonful immediately without chewing, followed by a drink.\n` +
          `• 💧 **Safe Drinks**: Ample water, breast milk, infant formula, or oral rehydration solution (ORS). If taking antibiotics like Ciprofloxacin, space high-calcium dairy by at least 2 hours.\n` +
          `• ⚠️ **Critical Pediatric Warning**: **NEVER give honey** to infants under 1 year of age due to the severe risk of infant botulism. Avoid whole nuts, crunchy raw vegetables, or hard chewables due to choking hazards.\n\n` +
          `You can [check your drug & food interactions](/interactions) or [review active medications](/medications).`,
        suggestions: ["Chewable medication options", "Safe drinks with medication", "Check drug interactions"],
        source: "MoH"
      };
    }

    // 4. Geriatric guidance (65+ years)
    if (resolvedAge !== null && resolvedAge >= 65) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Here is age-tailored food and beverage guidance for **${medName}** for seniors (Age: ${resolvedAge} yrs)${greeting}:\n\n` +
          `• 🥣 **Soft & Moist Foods (Swallowing Ease)**: To prevent swallowing difficulties (presbyphagia) and soothe the stomach:\n` +
          `  - **Local Ugandan options**: Steamed soft *Matooke*, warm smooth *Bushera* (millet/sorghum porridge), or steamed *Luwombo*.\n` +
          `  - **Everyday staples**: Warm oatmeal, Greek yogurt, soft scrambled eggs, applesauce, or pureed vegetable soups.\n` +
          `• 💧 **Swallowing Technique & Drinks**: Take a sip of water first to lubricate your throat, swallow the pill with a full glass of water (250ml) while sitting upright, and **remain sitting or standing upright for at least 30 minutes** to avoid esophageal irritation.\n` +
          `• ⚠️ **Nutritional & Drug Cautions**:\n` +
          `  - *Potassium*: If taking blood pressure or heart medications (ACE inhibitors like Lisinopril, ARBs, or Spironolactone), avoid excessive high-potassium foods (*Matooke*, bananas, avocados) or potassium salt substitutes.\n` +
          `  - *Calcium Spacing*: Space high-calcium foods (*Mukene*, dairy, fortified milks) at least 2 hours apart from thyroid medications (Levothyroxine) or certain antibiotics.\n` +
          `  - *Grapefruit & Alcohol*: Strictly avoid grapefruit juice and alcohol/Waragi.\n\n` +
          `You can [check your drug & food interactions](/interactions) or [review active medications](/medications).`,
        suggestions: ["Safe foods for seniors", "Check drug interactions", "View active medications"],
        source: "MoH"
      };
    }

    // 5. Adult / General guidance
    const isFatSoluble = /coartem|artemether|lumefantrine|griseofulvin|isotretinoin|vitamin d/i.test(medName);
    const fatGuidance = isFatSoluble
      ? `• 🥑 **Healthy Fats for Absorption (Crucial)**: **${medName}** requires dietary fats to be absorbed effectively into the bloodstream:\n` +
        `  - **Local options**: *G-nut sauce* (groundnut stew) or *Eshabwe*.\n` +
        `  - **Everyday options**: Fresh avocado, whole milk, eggs, peanut butter, or yogurt.\n`
      : `• 🍲 **Stomach Buffers**: To buffer the stomach lining and prevent gastric irritation:\n` +
        `  - **Local options**: Steamed *Matooke*, *Posho*, or *Kalo*.\n` +
        `  - **Everyday staples**: Plain oatmeal, white rice, toast, crackers, or plain yogurt.\n`;

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: `Here is recommended food, chewables, and drink guidance for **${medName}**${greeting}:\n\n` +
        fatGuidance +
        `• 💧 **Drink Pairings & Hydration**: Always take your medication with a **full glass of plain water** (250ml+) to ensure the tablet dissolves smoothly in your stomach and prevents esophageal irritation.\n` +
        `• 🍬 **Chewables & Formulation Notes**: If you struggle with swallowing solid tablets, ask your doctor or pharmacist about chewable tablets, dispersible tablets, or smooth oral suspensions.\n` +
        `• ⚠️ **Key Dietary Warnings**:\n` +
        `  - **Alcohol & Waragi**: Strictly avoid with Paracetamol (liver damage) and Metronidazole (severe violent reaction).\n` +
        `  - **Grapefruit & Grapefruit Juice**: Avoid with statins and blood pressure medications (blocks CYP3A4 enzyme).\n` +
        `  - **Calcium & Mukene**: Space calcium-rich foods and dairy at least 2 hours away from fluoroquinolone (Ciprofloxacin) and tetracycline antibiotics.\n\n` +
        `You can [check your drug & food interactions](/interactions) to test specific dishes.`,
      suggestions: ["What foods should I avoid?", "Can I take with milk?", "Check drug interactions"],
      source: "MoH"
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
    suggestions: getContextualSuggestions({
      userQuery: query,
      medicines: allMedicines,
      reminders,
      userProfile,
      activePatient: patients.find(p => p.id === selectedPatientId) || null,
      currentPage
    })
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
    const cleanText = sanitizeMarkdownLinks(rawText
      .replace(/(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###\s*Metadata\s*###|###METADATA###|---METADATA---)[\s\S]*$/i, '')
      .replace(/\n\s*\{\s*"(?:suggestions|source|action)"[\s\S]*\}\s*$/i, '')
      .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
      .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '')
      .trim());

    const rawAction = response.action as any;
    const actionObj = rawAction ? {
      ...rawAction,
      payload: rawAction.payload || rawAction.data
    } : undefined;

    const activePatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : undefined;
    const lastUserQuery = messages.filter(m => m.role === 'user').pop()?.text || '';

    const enrichedSuggestions = getContextualSuggestions({
      messages,
      userQuery: lastUserQuery,
      assistantText: cleanText,
      medicines,
      reminders,
      userProfile,
      activePatient,
      currentPage,
      action: actionObj?.type ? actionObj : undefined,
      existingSuggestions: response.suggestions
    });

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: cleanText,
      source: (response.source as ChatMessage['source']) || "Gemini",
      suggestions: enrichedSuggestions,
      // Include the action from the AI if present and meaningful
      action: actionObj?.type ? actionObj : undefined,
    };
  } catch (err: unknown) {
    console.error("DawaGPT Chat Error:", err);

    const activePatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : undefined;
    const lastUserQuery = messages.filter(m => m.role === 'user').pop()?.text || '';
    const rawMsg = err instanceof Error ? err.message : "";
    const isTechnicalError = !rawMsg || /body\.messages|\bvalidation\b|\bstatus\b|\bfailed\b|expected string|internal server error|json|_zod|cannot read|undefined|typeerror|null|fetch|network|econnrefused/i.test(rawMsg);
    const errorMessage = isTechnicalError
      ? "⚠️ DawaGPT's AI service is temporarily unavailable. Please try again in a few minutes.\n\nFor urgent health questions, contact **NDA Uganda** toll-free: **0800 101 999** (WhatsApp: **+256 791 415 555**) or Mental Health Support: **0800 200 600**."
      : rawMsg;
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
            const metaDelimRegex = /(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###METADATA###|---METADATA---)/i;
            const delimMatch = allText.match(metaDelimRegex);
            let rawVisibleText = allText;
            if (delimMatch && delimMatch.index !== undefined) {
              rawVisibleText = allText.substring(0, delimMatch.index);
            } else {
              // Guard against partial delimiter at the tail during active streaming
              rawVisibleText = allText.replace(/(?:###|---|###\s*META?D?A?T?A?)\s*$/i, '');
            }
            const visibleText = rawVisibleText
              .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
              .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '');
            onChunk(visibleText);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    // Split on any variant of the metadata delimiter to separate display text from metadata (Requirement 2.3)
    const metaDelimRegex = /(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###METADATA###|---METADATA---)/i;
    const delimMatch = allText.match(metaDelimRegex);

    let displayText: string;
    let rawMetadata: string = "";

    if (delimMatch && delimMatch.index !== undefined) {
      displayText = sanitizeMarkdownLinks(allText.substring(0, delimMatch.index)
        .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
        .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '')
        .trim());
      rawMetadata = allText.substring(delimMatch.index + delimMatch[0].length).trim();
    } else {
      // Delimiter absent — try to extract a trailing JSON block as a secondary fallback.
      // Some models output valid JSON at the end of their response without the delimiter.
      const trailingJsonMatch = allText.match(/(\{[\s\S]*\})\s*$/);
      if (trailingJsonMatch && trailingJsonMatch.index !== undefined) {
        try {
          const candidate = JSON.parse(trailingJsonMatch[1]);
          // Only use it as metadata if it has the expected shape
          if (candidate && (candidate.suggestions || candidate.action || candidate.source)) {
            rawMetadata = trailingJsonMatch[1];
            displayText = allText.substring(0, trailingJsonMatch.index)
              .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
              .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '')
              .trim();
          } else {
            displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
          }
        } catch {
          displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
        }
      } else {
        // No JSON found at all — treat entire text as display text, no metadata
        displayText = allText.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
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
        const sanitizedRaw = rawMetadata.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        metadata = JSON.parse(sanitizedRaw);
        if (metadata.action) {
          const rawAction = metadata.action as any;
          if (!rawAction.payload && rawAction.data) {
            rawAction.payload = rawAction.data;
          }
        }
      } catch (e) {
        console.warn('Failed to parse stream metadata JSON', e);
        // Graceful degradation: return text with empty metadata
      }
    }

    const activePatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : undefined;
    const lastUserQuery = messages.filter(m => m.role === 'user').pop()?.text || '';

    // If metadata action is missing from server stream, attempt local deterministic fallback
    const localAction = !metadata.action?.type
      ? extractDeterministicAction(lastUserQuery, medicines, reminders, patients)
      : undefined;
    const resolvedAction = metadata.action?.type ? metadata.action : (localAction || undefined);

    // If the stream completed with a connection failure or empty text, attempt offline clinical response
    if (!fullText || fullText.includes("trouble connecting") || fullText.includes("trouble processing that request") || fullText.includes("Error starting chat stream")) {
      console.warn("[DawaGPT] Streaming delivered connection error. Attempting local clinical fallback.");
      if (localAction) {
        const offlineResp = await generateDawaGPTResponse(
          lastUserQuery,
          null,
          userProfile,
          medicines,
          doseLogs,
          reminders,
          patients,
          selectedPatientId,
          currentPage
        );
        onChunk(offlineResp.text);
        return offlineResp;
      }

      const serviceDownMsg = "⚠️ DawaGPT's AI service is temporarily unavailable. Our backend AI providers are being restored. Please try again in a few minutes.\n\nFor urgent health questions, call the **Uganda National Drug Authority (NDA)** toll-free: **0800 101 999** (WhatsApp: **+256 791 415 555**) or **Mental Health Support**: **0800 200 600**.";
      const offlineResp: ChatMessage = {
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
      onChunk(serviceDownMsg);
      return offlineResp;
    }

    const resolvedSuggestions = getContextualSuggestions({
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
    });

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: fullText,
      source: metadata.source,
      suggestions: resolvedSuggestions,
      action: resolvedAction,
    };
  } catch (err: unknown) {
    console.error("DawaGPT Streaming Error:", err);

    const activePatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : undefined;
    const lastUserQuery = messages.filter(m => m.role === 'user').pop()?.text || '';

    // If an action was requested, execute it offline even if the network failed
    const localAction = extractDeterministicAction(lastUserQuery, medicines, reminders, patients);
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
          currentPage
        );
        onChunk(offlineResp.text);
        return offlineResp;
      } catch (localErr) {
        console.warn("Offline action generation failed:", localErr);
      }
    }

    const rawMsg = err instanceof Error ? err.message : "";
    const isNetworkOrServerError = !rawMsg || /body\.messages|\bvalidation\b|\bstatus\b|\bfailed\b|expected string|internal server error|json|_zod|cannot read|undefined|typeerror|null|fetch|network|econnrefused/i.test(rawMsg);
    const errorMessage = isNetworkOrServerError
      ? "⚠️ DawaGPT's AI service is temporarily unavailable. Please try again in a few minutes.\n\nFor urgent health questions, contact **NDA Uganda** toll-free: **0800 101 999** (WhatsApp: **+256 791 415 555**) or Mental Health Support: **0800 200 600**."
      : rawMsg;
    const errResp: ChatMessage = {
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
    onChunk(errorMessage);
    return errResp;
  }
};

