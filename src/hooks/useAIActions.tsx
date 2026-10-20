import { useApp, Medicine, Patient, Reminder } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { AIAction, normalizeAIAction, distributeTimes } from "@/services/aiAssistantService";
import { RiveMoji } from "@/components/rive/RiveMoji";
import { useNavigate } from "react-router-dom";
import React from "react";

const TIME_PHRASE_DEFAULTS: Array<{ keys: string[]; value: string }> = [
  { keys: ["twice", "two times", "2 times", "2x"], value: "08:00,20:00" },
  { keys: ["three times", "thrice", "3 times", "3x"], value: "08:00,16:00,00:00" },
  { keys: ["four times", "4 times", "4x"], value: "08:00,14:00,20:00,02:00" }
];

const TIME_OF_DAY_KEYWORDS: Array<{ keys: string[]; value: string }> = [
  { keys: ["morning", "breakfast"], value: "08:00" },
  { keys: ["noon", "lunch", "afternoon"], value: "13:00" },
  { keys: ["evening", "dinner"], value: "18:00" },
  { keys: ["night", "bedtime"], value: "21:00" }
];

function normalizeSingleTimeToken(rawToken: string): string {
  const trimmed = rawToken.trim();
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] || "00";
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    else if (ampm === "AM" && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  }

  const match24 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = match24[2] || "00";
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    }
  }

  const keywordMatch = TIME_OF_DAY_KEYWORDS.find((entry) => entry.keys.some((k) => trimmed.includes(k)));
  return keywordMatch ? keywordMatch.value : "08:00";
}

export function normalizeTimeStr(timeStr: string): string {
  if (!timeStr) return "08:00";
  const cleanStr = timeStr.toLowerCase().trim();
  const phraseMatch = TIME_PHRASE_DEFAULTS.find((entry) => entry.keys.some((k) => cleanStr.includes(k)));
  if (phraseMatch) return phraseMatch.value;

  return cleanStr.split(",").map(normalizeSingleTimeToken).join(",");
}

function normalizeRepeatSchedule(
  rawSchedule: unknown,
  normalizedTime?: string
): "daily" | "weekly" | "once" | "custom" {
  let repeatSchedule: "daily" | "weekly" | "once" | "custom" | undefined;
  if (typeof rawSchedule === "string") {
    const lower = rawSchedule.toLowerCase().trim();
    if (lower === "daily" || lower === "weekly" || lower === "once" || lower === "custom") {
      repeatSchedule = lower;
    } else if (lower.includes("week")) {
      repeatSchedule = "weekly";
    } else if (lower.includes("once") || lower.includes("one")) {
      repeatSchedule = "once";
    } else {
      repeatSchedule = "daily";
    }
  }

  if (normalizedTime?.includes(",") && repeatSchedule !== "custom" && repeatSchedule !== "daily") {
    return "custom";
  }
  return repeatSchedule || (normalizedTime?.includes(",") ? "custom" : "daily");
}

const MOOD_SCALE_RULES: Array<{ score: number; keys: string[] }> = [
  { score: 5, keys: ["ecstatic", "great", "5"] },
  { score: 4, keys: ["good", "happy", "4"] },
  { score: 3, keys: ["okay", "fine", "3"] },
  { score: 2, keys: ["meh", "bad", "stressed", "2"] },
  { score: 1, keys: ["low", "terrible", "1"] }
];

const ENERGY_SCALE_RULES: Array<{ score: number; keys: string[] }> = [
  { score: 5, keys: ["100", "ecstatic", "full", "5"] },
  { score: 4, keys: ["high", "strong", "4"] },
  { score: 3, keys: ["moderate", "normal", "3"] },
  { score: 2, keys: ["low", "tired", "2"] },
  { score: 1, keys: ["drained", "exhausted", "1"] }
];

function normalizeFivePointScale(rawVal: unknown, rules: Array<{ score: number; keys: string[] }>): number {
  if (typeof rawVal === "number" && !isNaN(rawVal)) {
    return Math.max(1, Math.min(5, Math.round(rawVal)));
  }
  if (typeof rawVal === "string") {
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed)) return Math.max(1, Math.min(5, parsed));
    const lower = rawVal.toLowerCase();
    const matched = rules.find((r) => r.keys.some((k) => lower.includes(k)));
    if (matched) return matched.score;
  }
  return 3;
}

export function useAIActions() {
  const {
    addMedicine, updateMedicine, deleteMedicine, deleteReminder,
    addReminder, updateReminder, logDose, deleteDoseLog,
    addWellnessLog, addPatient, updatePatient, deletePatient,
    setSelectedPatientId, reminders, medicines, doseLogs, patients
  } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const showToast = (emoji: string, titleText: string, description: string, variant?: "default" | "destructive") => {
    toast({
      title: <span className="flex items-center gap-2"><RiveMoji emoji={emoji} size={16} /> {titleText}</span>,
      description,
      variant
    });
  };

  const resolvePatientId = (rawIdOrName?: string | null): string | undefined => {
    if (!rawIdOrName || typeof rawIdOrName !== "string") return undefined;
    const clean = rawIdOrName.trim();
    if (!clean || ["self", "me", "myself", "owner", "personal", "host", "null", "undefined"].includes(clean.toLowerCase())) {
      return undefined;
    }
    const cleanLower = clean.toLowerCase();
    const matched =
      patients.find((p) => p.id === clean) ||
      patients.find((p) => p.name.toLowerCase() === cleanLower) ||
      patients.find((p) => p.name.toLowerCase().includes(cleanLower) || cleanLower.includes(p.name.toLowerCase()));
    return matched ? matched.id : clean;
  };

  const findMedicine = (id?: string, name?: string): Medicine | undefined => {
    if (id) {
      const byId = medicines.find((m) => m.id === id);
      if (byId) return byId;
    }
    if (!name || medicines.length === 0) return undefined;
    const cleanName = name.trim().toLowerCase();

    const exact = medicines.find(
      (m) => m.name.toLowerCase() === cleanName || m.genericName?.toLowerCase() === cleanName
    );
    if (exact) return exact;

    const partial = medicines.find((m) => {
      const medName = m.name.toLowerCase();
      const genName = m.genericName?.toLowerCase() || "";
      return (
        medName.includes(cleanName) ||
        cleanName.includes(medName) ||
        (genName && (genName.includes(cleanName) || cleanName.includes(genName)))
      );
    });
    if (partial) return partial;

    const searchTokens = cleanName.split(/\s+/).filter((t) => t.length > 2 && !/^\d+mg$/i.test(t));
    if (searchTokens.length > 0) {
      return medicines.find((m) => {
        const medLower = m.name.toLowerCase();
        return searchTokens.some((token) => medLower.includes(token));
      });
    }
    return undefined;
  };

  const findReminder = (id?: string, medicineName?: string): Reminder | undefined => {
    if (id) {
      const byId = reminders.find((r) => r.id === id);
      if (byId) return byId;
    }
    if (!medicineName || reminders.length === 0) return undefined;
    const clean = medicineName.trim().toLowerCase();
    return (
      reminders.find((r) => r.medicineName.toLowerCase() === clean) ||
      reminders.find(
        (r) => r.medicineName.toLowerCase().includes(clean) || clean.includes(r.medicineName.toLowerCase())
      )
    );
  };

  const findPatient = (id?: string, name?: string): Patient | undefined => {
    if (id) {
      const byId = patients.find((p) => p.id === id);
      if (byId) return byId;
    }
    if (!name || patients.length === 0) return undefined;
    const clean = name.trim().toLowerCase();
    return (
      patients.find((p) => p.name.toLowerCase() === clean) ||
      patients.find((p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()))
    );
  };

  const handleMedicineAction = async (actionType: string, payload: Record<string, any>, confirmMessage?: string): Promise<boolean> => {
    if (actionType === "ADD_MEDICINE") {
      if (!payload?.name) throw new Error("Medicine name is required");
      const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
      const initialQty = payload.currentQuantity ?? payload.quantity ?? payload.totalQuantity;
      const initialTotal = payload.totalQuantity ?? initialQty;

      const createdMed = await addMedicine(
        {
          name: payload.name,
          dosage: payload.dosage || "500mg",
          genericName: payload.genericName,
          dosagePerDose: payload.dosagePerDose || 1,
          frequencyPerDay: payload.frequencyPerDay || 1,
          totalQuantity: initialTotal,
          currentQuantity: initialQty,
          unit: payload.unit || "tablets",
          notes: payload.notes || "",
          patientId: targetPatientId
        },
        targetPatientId
      );

      if (payload.reminderSchedule) {
        const remSched = payload.reminderSchedule;
        const normalizedTime = remSched.time ? normalizeTimeStr(remSched.time) : "08:00";
        await addReminder({
          medicineId: createdMed?.id || undefined,
          medicineName: payload.name,
          dose: remSched.dose || `${payload.dosagePerDose || 1} ${payload.unit || "tablets"}`,
          time: normalizedTime,
          repeatSchedule: remSched.repeatSchedule || (normalizedTime.includes(",") ? "custom" : "daily"),
          enabled: true,
          patientId: targetPatientId
        });
      }

      showToast("✅", "Medicine added", confirmMessage || `${payload.name} added to your cabinet.`);
      return true;
    }

    if (["UPDATE_MEDICINE", "REFILL_MEDICINE", "UPDATE_STOCK", "RESTOCK"].includes(actionType)) {
      const targetMed = findMedicine(payload.id, payload.name);
      if (!targetMed) {
        throw new Error(`Could not find "${payload.name || "the medicine"}" in your cabinet to update. Please check the name and try again.`);
      }

      const updates: Partial<Medicine> = { ...payload };
      delete (updates as any).id;

      const newQty = payload.currentQuantity ?? payload.quantity ?? payload.stock;
      if (newQty !== undefined && typeof newQty === "number" && !isNaN(newQty)) {
        updates.currentQuantity = newQty;
        updates.totalQuantity = Math.max(targetMed.totalQuantity ?? 0, newQty, payload.totalQuantity || 0);
        if (targetMed.dosagePerDose === undefined) updates.dosagePerDose = payload.dosagePerDose || 1;
        if (targetMed.frequencyPerDay === undefined) updates.frequencyPerDay = payload.frequencyPerDay || 1;
        if (targetMed.unit === undefined) updates.unit = payload.unit || "tablets";
      }

      if (payload.patientId || payload.patientName || payload.patient) {
        updates.patientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
      }

      await updateMedicine(targetMed.id, updates);
      const isRefill = newQty !== undefined;
      showToast(
        "✅",
        isRefill ? "Stock updated" : "Medicine updated",
        confirmMessage ||
          (isRefill
            ? `Updated ${targetMed.name} stock to ${newQty} ${updates.unit || targetMed.unit || "tablets"}.`
            : `Changes applied to ${targetMed.name}.`)
      );
      return true;
    }

    if (actionType === "REMOVE_MEDICINE" || actionType === "DELETE_MEDICINE") {
      const targetMed = findMedicine(payload.id, payload.name);
      if (!targetMed) {
        throw new Error(`Could not find "${payload.name || "the medicine"}" in your cabinet. Please check the name and try again.`);
      }
      await deleteMedicine(targetMed.id);
      showToast("✅", "Medicine removed", confirmMessage || `${targetMed.name} has been removed from your cabinet.`);
      return true;
    }

    if (actionType === "DISCONTINUE_MEDICINE") {
      const targetMed = findMedicine(payload.id, payload.name);
      if (!targetMed) {
        throw new Error(`Could not find "${payload.name || "the medicine"}" in your cabinet to discontinue.`);
      }
      await updateMedicine(targetMed.id, {
        notes: `Discontinued: ${payload.reason || "Doctor recommendation"} (${new Date().toLocaleDateString()})`
      });
      const relatedReminders = reminders.filter(
        (r) => r.medicineId === targetMed.id || r.medicineName.toLowerCase() === targetMed.name.toLowerCase()
      );
      for (const r of relatedReminders) {
        await updateReminder(r.id, { enabled: false });
      }
      showToast("✅", "Medicine discontinued", confirmMessage || `Discontinued ${targetMed.name} and paused related reminders.`);
      return true;
    }

    return false;
  };

  const handleReminderAction = async (actionType: string, payload: Record<string, any>, confirmMessage?: string): Promise<boolean> => {
    if (actionType === "ADD_REMINDER") {
      const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
      const matchedMed = findMedicine(payload.medicineId, payload.medicineName);
      const medicineId = matchedMed?.id || payload.medicineId;
      const color = payload.color || matchedMed?.color || "blue";
      const icon = payload.icon || matchedMed?.icon || "pill";

      let resolvedDose = payload.dose;
      if (matchedMed) {
        const definedDose = matchedMed.dosagePerDose
          ? `${matchedMed.dosagePerDose} ${matchedMed.unit || "tablets"}`
          : matchedMed.dosage || undefined;
        if (
          !resolvedDose ||
          resolvedDose === "1 dose" ||
          (resolvedDose === "1 tablet" && matchedMed.dosagePerDose && matchedMed.dosagePerDose > 1)
        ) {
          resolvedDose = definedDose || resolvedDose || "1 tablet";
        }
      }
      resolvedDose = resolvedDose || "1 tablet";

      let normalizedTime = payload.time ? normalizeTimeStr(payload.time) : "08:00";
      if (matchedMed?.frequencyPerDay && matchedMed.frequencyPerDay > 1 && !normalizedTime.includes(",")) {
        normalizedTime = distributeTimes(normalizedTime, matchedMed.frequencyPerDay).join(",");
      }
      const repeatSchedule = normalizeRepeatSchedule(payload.repeatSchedule, normalizedTime);

      await addReminder({
        medicineId: medicineId || undefined,
        medicineName: payload.medicineName,
        dose: resolvedDose,
        time: normalizedTime,
        repeatSchedule,
        repeatDays: payload.repeatDays || undefined,
        notes: payload.notes || "",
        enabled: true,
        color,
        icon,
        patientId: targetPatientId,
        patientName: payload.patientName || undefined
      });
      showToast("✅", "Reminder added", confirmMessage || `Scheduled ${payload.medicineName} (${resolvedDose}) for ${normalizedTime}.`);
      return true;
    }

    if (actionType === "UPDATE_REMINDER") {
      const targetRem = findReminder(payload.id, payload.medicineName);
      if (!targetRem) {
        throw new Error(`Could not find reminder for "${payload.medicineName || "the specified medicine"}". Please check the name and try again.`);
      }

      const reminderUpdates = { ...payload };
      delete reminderUpdates.id;
      if (reminderUpdates.time) {
        reminderUpdates.time = normalizeTimeStr(reminderUpdates.time);
      }
      if (reminderUpdates.repeatSchedule || reminderUpdates.time?.includes(",")) {
        reminderUpdates.repeatSchedule = normalizeRepeatSchedule(reminderUpdates.repeatSchedule, reminderUpdates.time);
      }

      await updateReminder(targetRem.id, {
        ...reminderUpdates,
        enabled: payload.enabled !== undefined ? payload.enabled : targetRem.enabled
      });
      showToast("✅", "Reminder updated", confirmMessage || `Changes applied to reminder for ${targetRem.medicineName}.`);
      return true;
    }

    if (actionType === "REMOVE_REMINDER" || actionType === "DELETE_REMINDER") {
      const targetRem = findReminder(payload.id, payload.medicineName);
      if (!targetRem) {
        throw new Error(`Could not find a reminder for "${payload.medicineName || "the specified medicine"}". Please check the name and try again.`);
      }
      await deleteReminder(targetRem.id);
      showToast("✅", "Reminder removed", confirmMessage || `Reminder for ${targetRem.medicineName} has been deleted.`);
      return true;
    }

    if (actionType === "TOGGLE_REMINDER") {
      const shouldEnable = payload.enabled !== undefined ? Boolean(payload.enabled) : true;
      if (payload.id) {
        await updateReminder(payload.id, { enabled: shouldEnable });
      } else if (payload.medicineName) {
        const match = findReminder(undefined, payload.medicineName);
        if (match) await updateReminder(match.id, { enabled: shouldEnable });
      } else {
        for (const r of reminders) {
          await updateReminder(r.id, { enabled: shouldEnable });
        }
      }
      showToast(
        "🔔",
        `Reminders ${shouldEnable ? "resumed" : "paused"}`,
        confirmMessage || (shouldEnable ? "Alarms are now active." : "Alarms have been paused.")
      );
      return true;
    }

    if (actionType === "SNOOZE_REMINDER") {
      const snoozeMins = payload.snoozeMinutes || 15;
      showToast("⏰", "Reminder snoozed", confirmMessage || `Snoozed for ${snoozeMins} minutes.`);
      return true;
    }

    if (actionType === "BATCH_ADD_REGIMEN") {
      const medName = payload.medicineName || "Treatment Medication";
      const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
      const newMed = await addMedicine(
        {
          name: medName,
          dosage: payload.dosage || "1 course",
          frequencyPerDay: payload.frequencyPerDay || 2,
          dosagePerDose: 1,
          unit: "tablets",
          currentQuantity: payload.totalQuantity || 24,
          totalQuantity: payload.totalQuantity || 24,
          patientId: targetPatientId
        },
        targetPatientId
      );

      const normalizedTime = payload.times ? normalizeTimeStr(payload.times) : "08:00,20:00";
      await addReminder({
        medicineId: newMed?.id || undefined,
        medicineName: medName,
        dose: payload.dose || "1 tablet",
        time: normalizedTime,
        repeatSchedule: "custom",
        enabled: true,
        patientId: targetPatientId
      });

      showToast("📋", "Regimen scheduled", confirmMessage || `Scheduled course and reminders for ${medName}.`);
      return true;
    }

    return false;
  };

  const handleDoseOrWellnessAction = async (actionType: string, payload: Record<string, any>, confirmMessage?: string): Promise<boolean> => {
    if (actionType === "LOG_DOSE") {
      const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
      const doseStatus = (payload.status || payload.action || "taken") as "taken" | "missed" | "snoozed";
      await logDose({
        reminderId: (payload.reminderId as string) || "",
        medicineName: payload.medicineName as string,
        dose: (payload.dose as string) || "1 dose",
        scheduledTime: (payload.scheduledTime as string) || new Date().toISOString(),
        action: doseStatus,
        patientId: targetPatientId
      });
      showToast("✅", "Dose logged", confirmMessage || `Logged ${payload.medicineName} as ${doseStatus}.`);
      return true;
    }

    if (actionType === "UNDO_DOSE_LOG") {
      const targetLog = (payload.id ? doseLogs.find((l) => l.id === payload.id) : undefined) || doseLogs[doseLogs.length - 1];
      if (!targetLog) {
        showToast("ℹ️", "No dose to revert", "No recent dose logs found to undo.");
        return true;
      }

      await deleteDoseLog(targetLog.id);
      if (targetLog.action === "taken" || (targetLog as any).status === "taken") {
        const targetMedicineId = (targetLog as any).medicineId;
        const matchedMed = medicines.find(
          (m) =>
            (targetMedicineId && m.id === targetMedicineId) ||
            (m.name && m.name.toLowerCase() === targetLog.medicineName.toLowerCase())
        );
        if (matchedMed && typeof matchedMed.currentQuantity === "number") {
          const restoreQty = matchedMed.dosagePerDose || 1;
          await updateMedicine(matchedMed.id, {
            currentQuantity: Math.min(
              matchedMed.totalQuantity || matchedMed.currentQuantity + restoreQty,
              matchedMed.currentQuantity + restoreQty
            )
          });
        }
      }
      showToast("↩️", "Dose log reverted", confirmMessage || `Reverted dose log for ${targetLog.medicineName}.`);
      return true;
    }

    if (actionType === "LOG_WELLNESS") {
      const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
      const rawData = payload.data && typeof payload.data === "object" ? payload.data : payload;
      const rawSymptoms = rawData.symptoms ?? payload.symptoms;
      const symptoms = Array.isArray(rawSymptoms)
        ? rawSymptoms.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [];

      const normalizedMood = normalizeFivePointScale(rawData.mood ?? payload.mood, MOOD_SCALE_RULES);
      const normalizedEnergy = normalizeFivePointScale(rawData.energy ?? payload.energy, ENERGY_SCALE_RULES);

      await addWellnessLog({
        type: payload.type || rawData.type || "symptom",
        data: {
          ...rawData,
          mood: normalizedMood,
          energy: normalizedEnergy,
          symptoms,
          notes: rawData.notes || payload.notes || ""
        },
        patientId: targetPatientId
      });

      const moodEmojis: Record<number, string> = { 1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "🤩" };
      const emoji = moodEmojis[normalizedMood] || "✨";
      const symSummary = symptoms.length > 0 ? ` • ${symptoms.join(", ")}` : "";
      showToast(
        "✅",
        `Wellness logged ${emoji}`,
        confirmMessage || `Mood: ${normalizedMood}/5 • Vitality: ${normalizedEnergy * 20}%${symSummary}`
      );
      return true;
    }

    return false;
  };

  const handlePatientOrNavAction = async (actionType: string, payload: Record<string, any>, confirmMessage?: string): Promise<boolean> => {
    if (actionType === "ADD_PATIENT") {
      if (!payload.name) throw new Error("Patient name is required to create a profile.");
      await addPatient({
        name: payload.name,
        age: payload.age,
        dateOfBirth: payload.dateOfBirth,
        gender: payload.gender,
        relation: payload.relation,
        type: payload.type,
        conditions: payload.conditions,
        allergies: payload.allergies,
        bloodType: payload.bloodType,
        notes: payload.notes,
        color: payload.color,
      });
      showToast("✅", "Family member added", confirmMessage || `${payload.name} is now part of your health hub.`);
      return true;
    }

    if (actionType === "UPDATE_PATIENT") {
      const targetPatient = findPatient(payload.id, payload.name);
      if (!targetPatient) {
        throw new Error(`Could not find "${payload.name || "the member"}" in your Family Hub to update. Please check the name and try again.`);
      }
      const updates = { ...payload };
      delete updates.id;
      await updatePatient(targetPatient.id, updates);
      showToast("✅", "Profile updated", confirmMessage || `Updated health profile for ${targetPatient.name}.`);
      return true;
    }

    if (actionType === "REMOVE_PATIENT" || actionType === "DELETE_PATIENT") {
      const targetPatient = findPatient(payload.id, payload.name);
      if (!targetPatient) {
        throw new Error(`Could not find "${payload.name || "the member"}" in your Family Hub. Please check the name and try again.`);
      }
      await deletePatient(targetPatient.id);
      showToast("✅", "Profile removed", confirmMessage || `Removed ${targetPatient.name} from Family Hub.`);
      return true;
    }

    if (actionType === "SWITCH_PATIENT_SCOPE") {
      const rawTarget = payload.patientId || payload.patientName || payload.name;
      const targetId = resolvePatientId(rawTarget);
      setSelectedPatientId(targetId ?? null);
      const targetName = targetId ? patients.find((p) => p.id === targetId)?.name || "Family Member" : "Personal Profile";
      showToast("👤", "Context switched", confirmMessage || `Now viewing health records for ${targetName}.`);
      return true;
    }

    if (actionType === "NAVIGATE_PAGE") {
      if (payload.targetRoute) {
        navigate(payload.targetRoute);
        showToast("🧭", "Navigating", `Opened ${payload.targetRoute}.`);
      }
      return true;
    }

    if (actionType === "OPEN_PHARMACY_MODAL") {
      window.dispatchEvent(new CustomEvent("open-pharmacy-modal", { detail: { medicineName: payload.medicineName } }));
      showToast("🏥", "NDA Pharmacy Locator", "Opening licensed pharmacy map...");
      return true;
    }

    return false;
  };

  const dispatchAIAction = async (action: AIAction) => {
    const normalized = normalizeAIAction(action);
    if (!normalized || !normalized.type) {
      console.warn("[useAIActions] Invalid or unresolvable action passed to dispatchAIAction:", action);
      return;
    }

    const actionType = normalized.type as string;
    const payload = (normalized.payload || {}) as Record<string, any>;
    const confirmMessage = action.confirmMessage || normalized.confirmMessage;

    try {
      const handled =
        (await handleMedicineAction(actionType, payload, confirmMessage)) ||
        (await handleReminderAction(actionType, payload, confirmMessage)) ||
        (await handleDoseOrWellnessAction(actionType, payload, confirmMessage)) ||
        (await handlePatientOrNavAction(actionType, payload, confirmMessage));

      if (!handled) {
        console.warn("Unknown AI action type:", action.type);
        showToast(
          "⚠️",
          "Unsupported action",
          `DawaGPT tried an unsupported action type "${action.type}". Please try rephrasing your request.`,
          "destructive"
        );
        throw new Error(`Unsupported action type "${action.type}".`);
      }
    } catch (e) {
      console.error("AI Action Dispatch Error:", e);
      showToast(
        "❌",
        "Action failed",
        (e as Error).message || "Action failed. Please try again or do it manually.",
        "destructive"
      );
      throw e;
    }
  };

  return { dispatchAIAction };
}
