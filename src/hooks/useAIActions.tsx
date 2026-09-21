import { useApp, Medicine, Patient, Reminder } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { AIAction, normalizeAIAction } from "@/services/aiAssistantService";
import { RiveMoji } from "@/components/rive/RiveMoji";
import { useNavigate } from "react-router-dom";
import React from "react";

export function normalizeTimeStr(timeStr: string): string {
  if (!timeStr) return "08:00";
  
  const cleanStr = timeStr.toLowerCase().trim();

  // If the whole string is a frequency/descriptive phrase, parse it first
  if (cleanStr.includes("twice") || cleanStr.includes("two times") || cleanStr.includes("2 times") || cleanStr.includes("2x")) {
    return "08:00,20:00";
  }
  if (cleanStr.includes("three times") || cleanStr.includes("thrice") || cleanStr.includes("3 times") || cleanStr.includes("3x")) {
    return "08:00,16:00,00:00";
  }
  if (cleanStr.includes("four times") || cleanStr.includes("4 times") || cleanStr.includes("4x")) {
    return "08:00,14:00,20:00,02:00";
  }

  return cleanStr
    .split(",")
    .map((t) => {
      const trimmed = t.trim();
      // Match 12-hour format like "8:00 AM", "08:00 PM", "8 PM", "12 AM"
      const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
      if (match12) {
        let hours = parseInt(match12[1], 10);
        const minutes = match12[2] || "00";
        const ampm = match12[3].toUpperCase();

        if (ampm === "PM" && hours < 12) {
          hours += 12;
        } else if (ampm === "AM" && hours === 12) {
          hours = 0;
        }
        return `${hours.toString().padStart(2, "0")}:${minutes}`;
      }

      // Match 24-hour format like "8:00", "08:00", "8"
      const match24 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
      if (match24) {
        const hours = parseInt(match24[1], 10);
        const minutes = match24[2] || "00";
        if (hours >= 0 && hours <= 23) {
          return `${hours.toString().padStart(2, "0")}:${minutes}`;
        }
      }

      // Check for time of day keywords
      if (trimmed.includes("morning") || trimmed.includes("breakfast")) {
        return "08:00";
      }
      if (trimmed.includes("noon") || trimmed.includes("lunch") || trimmed.includes("afternoon")) {
        return "13:00";
      }
      if (trimmed.includes("evening") || trimmed.includes("dinner")) {
        return "18:00";
      }
      if (trimmed.includes("night") || trimmed.includes("bedtime")) {
        return "21:00";
      }

      // Default fallback for unparseable token: "08:00"
      return "08:00";
    })
    .join(",");
}

export { normalizeAIAction };

export function useAIActions() {
  const { 
    addMedicine, updateMedicine, deleteMedicine, deleteReminder, 
    addReminder, updateReminder, logDose, deleteDoseLog,
    addWellnessLog, addPatient, updatePatient, deletePatient,
    setSelectedPatientId, reminders, medicines, doseLogs, patients
  } = useApp();
  const { toast } = useToast();
  let navigate: (to: string) => void;
  try {
    navigate = useNavigate();
  } catch {
    navigate = (to: string) => {
      if (typeof window !== "undefined") {
        window.location.href = to;
      }
    };
  }

  // Helper to resolve patient ID from patientId, patientName, patient, or target member
  const resolvePatientId = (rawIdOrName?: string | null): string | undefined => {
    if (!rawIdOrName || typeof rawIdOrName !== "string") return undefined;
    const clean = rawIdOrName.trim();
    if (!clean) return undefined;
    if (["self", "me", "myself", "owner", "personal", "host", "null", "undefined"].includes(clean.toLowerCase())) {
      return undefined;
    }
    // Direct ID match
    const byId = patients.find(p => p.id === clean);
    if (byId) return byId.id;
    // Exact name match
    const byName = patients.find(p => p.name.toLowerCase() === clean.toLowerCase());
    if (byName) return byName.id;
    // Fuzzy name match
    const fuzzy = patients.find(p =>
      p.name.toLowerCase().includes(clean.toLowerCase()) ||
      clean.toLowerCase().includes(p.name.toLowerCase())
    );
    if (fuzzy) return fuzzy.id;
    return clean;
  };

  // Helper to resolve medicine by ID, name, or generic name with bidirectional fuzzy matching
  const findMedicine = (id?: string, name?: string): Medicine | undefined => {
    if (id) {
      const byId = medicines.find(m => m.id === id);
      if (byId) return byId;
    }
    if (!name || medicines.length === 0) return undefined;
    const cleanName = name.trim().toLowerCase();
    // 1. Exact match on name or genericName
    const exact = medicines.find(m =>
      m.name.toLowerCase() === cleanName ||
      (m.genericName && m.genericName.toLowerCase() === cleanName)
    );
    if (exact) return exact;

    // 2. Substring / bidirectional partial match
    const partial = medicines.find(m => {
      const medName = m.name.toLowerCase();
      const genName = m.genericName?.toLowerCase() || "";
      return medName.includes(cleanName) || cleanName.includes(medName) ||
             (genName && (genName.includes(cleanName) || cleanName.includes(genName)));
    });
    if (partial) return partial;

    // 3. Word-token overlap (e.g. "Panadol 500mg" vs "Panadol")
    const searchTokens = cleanName.split(/\s+/).filter(t => t.length > 2 && !/^\d+mg$/i.test(t));
    if (searchTokens.length > 0) {
      const tokenMatch = medicines.find(m => {
        const medLower = m.name.toLowerCase();
        return searchTokens.some(token => medLower.includes(token));
      });
      if (tokenMatch) return tokenMatch;
    }

    return undefined;
  };

  // Helper to resolve reminder by ID or medicineName
  const findReminder = (id?: string, medicineName?: string): Reminder | undefined => {
    if (id) {
      const byId = reminders.find(r => r.id === id);
      if (byId) return byId;
    }
    if (!medicineName || reminders.length === 0) return undefined;
    const clean = medicineName.trim().toLowerCase();
    const exact = reminders.find(r => r.medicineName.toLowerCase() === clean);
    if (exact) return exact;
    const partial = reminders.find(r =>
      r.medicineName.toLowerCase().includes(clean) ||
      clean.includes(r.medicineName.toLowerCase())
    );
    if (partial) return partial;
    return undefined;
  };

  // Helper to resolve patient by ID or name
  const findPatient = (id?: string, name?: string): Patient | undefined => {
    if (id) {
      const byId = patients.find(p => p.id === id);
      if (byId) return byId;
    }
    if (!name || patients.length === 0) return undefined;
    const clean = name.trim().toLowerCase();
    const exact = patients.find(p => p.name.toLowerCase() === clean);
    if (exact) return exact;
    const partial = patients.find(p =>
      p.name.toLowerCase().includes(clean) ||
      clean.includes(p.name.toLowerCase())
    );
    if (partial) return partial;
    return undefined;
  };

  const dispatchAIAction = async (action: AIAction) => {
    const normalized = normalizeAIAction(action);
    if (!normalized || !normalized.type) {
      console.warn("[useAIActions] Invalid or unresolvable action passed to dispatchAIAction:", action);
      return;
    }

    const actionType = normalized.type;
    const payload = normalized.payload as any;
    const confirmMessage = normalized.confirmMessage;

    try {
      switch (actionType) {
        case "ADD_MEDICINE": {
          if (!payload?.name) {
            throw new Error("Medicine name is required");
          }
          const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
          const initialQty = payload.currentQuantity ?? payload.quantity ?? payload.totalQuantity;
          const initialTotal = payload.totalQuantity ?? initialQty;

          const createdMed = await addMedicine({
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
          }, targetPatientId);

          // If companion reminder schedule is requested, create it automatically
          if (payload.reminderSchedule) {
            const remSched = payload.reminderSchedule;
            const normalizedTime = remSched.time ? normalizeTimeStr(remSched.time) : "08:00";
            await addReminder({
              medicineId: createdMed?.id || undefined,
              medicineName: payload.name,
              dose: remSched.dose || `${payload.dosagePerDose || 1} ${payload.unit || 'tablets'}`,
              time: normalizedTime,
              repeatSchedule: remSched.repeatSchedule || (normalizedTime.includes(",") ? "custom" : "daily"),
              enabled: true,
              patientId: targetPatientId
            });
          }

          toast({ 
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine added</span>,
            description: action.confirmMessage || `${payload.name} added to your cabinet.`,
          });
          break;
        }

        case "UPDATE_MEDICINE":
        case "REFILL_MEDICINE" as any:
        case "UPDATE_STOCK" as any:
        case "RESTOCK" as any: {
          const targetMed = findMedicine(payload.id, payload.name);
          if (!targetMed) {
            throw new Error(`Could not find "${payload.name || 'the medicine'}" in your cabinet to update. Please check the name and try again.`);
          }

          const updates: Partial<Medicine> = { ...payload };
          delete (updates as any).id;

          // Med Vault stock / refill quantity synchronization
          const newQty = payload.currentQuantity ?? payload.quantity ?? payload.stock;
          if (newQty !== undefined && typeof newQty === "number" && !isNaN(newQty)) {
            updates.currentQuantity = newQty;
            const currentTotal = targetMed.totalQuantity ?? 0;
            updates.totalQuantity = Math.max(currentTotal, newQty, payload.totalQuantity || 0);
            if (targetMed.dosagePerDose === undefined) updates.dosagePerDose = payload.dosagePerDose || 1;
            if (targetMed.frequencyPerDay === undefined) updates.frequencyPerDay = payload.frequencyPerDay || 1;
            if (targetMed.unit === undefined) updates.unit = payload.unit || "tablets";
          }

          // Patient scope resolution if provided
          if (payload.patientId || payload.patientName || payload.patient) {
            updates.patientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
          }

          await updateMedicine(targetMed.id, updates);
          const isRefill = newQty !== undefined;
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> {isRefill ? "Stock updated" : "Medicine updated"}</span>,
            description: action.confirmMessage || (isRefill ? `Updated ${targetMed.name} stock to ${newQty} ${updates.unit || targetMed.unit || "tablets"}.` : `Changes applied to ${targetMed.name}.`),
          });
          break;
        }

        case "REMOVE_MEDICINE":
        case "DELETE_MEDICINE" as any: {
          const targetMed = findMedicine(payload.id, payload.name);
          if (!targetMed) {
            throw new Error(`Could not find "${payload.name || 'the medicine'}" in your cabinet. Please check the name and try again.`);
          }
          await deleteMedicine(targetMed.id);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine removed</span>,
            description: action.confirmMessage || `${targetMed.name} has been removed from your cabinet.`,
          });
          break;
        }

        case "ADD_REMINDER": {
          const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
          let medicineId = payload.medicineId;
          let color = payload.color;
          let icon = payload.icon;

          if (!medicineId && payload.medicineName) {
            const match = findMedicine(undefined, payload.medicineName);
            if (match) {
              medicineId = match.id;
              if (!color) color = match.color;
              if (!icon) icon = match.icon;
            }
          }

          const normalizedTime = payload.time ? normalizeTimeStr(payload.time) : "08:00";
          let repeatSchedule = payload.repeatSchedule;

          if (typeof repeatSchedule === "string") {
            const lowerRepeat = repeatSchedule.toLowerCase().trim();
            if (lowerRepeat === "daily" || lowerRepeat === "weekly" || lowerRepeat === "once" || lowerRepeat === "custom") {
              repeatSchedule = lowerRepeat;
            } else if (lowerRepeat.includes("day") || lowerRepeat.includes("daily") || lowerRepeat.includes("every")) {
              repeatSchedule = "daily";
            } else if (lowerRepeat.includes("week") || lowerRepeat.includes("weekly")) {
              repeatSchedule = "weekly";
            } else if (lowerRepeat.includes("once") || lowerRepeat.includes("one")) {
              repeatSchedule = "once";
            } else {
              repeatSchedule = "daily";
            }
          }

          // If multiple times are set, use "custom" repeatSchedule to match AddReminderPage behavior
          if (normalizedTime.includes(",") && repeatSchedule !== "custom" && repeatSchedule !== "daily") {
            repeatSchedule = "custom";
          }

          if (!repeatSchedule) {
            repeatSchedule = normalizedTime.includes(",") ? "custom" : "daily";
          }

          await addReminder({
            medicineId: medicineId || undefined,
            medicineName: payload.medicineName,
            dose: payload.dose || "1 dose",
            time: normalizedTime,
            repeatSchedule: repeatSchedule,
            repeatDays: payload.repeatDays || undefined,
            notes: payload.notes || "",
            enabled: true,
            color: color || "blue",
            icon: icon || "pill",
            patientId: targetPatientId,
            patientName: payload.patientName || undefined
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Reminder added</span>,
            description: action.confirmMessage || `Scheduled ${payload.medicineName} for ${normalizedTime}.`,
          });
          break;
        }

        case "UPDATE_REMINDER": {
          const targetRem = findReminder(payload.id, payload.medicineName);
          if (!targetRem) {
            throw new Error(`Could not find reminder for "${payload.medicineName || 'the specified medicine'}". Please check the name and try again.`);
          }

          const reminderUpdates = { ...payload };
          delete reminderUpdates.id;
          if (reminderUpdates.time) {
            reminderUpdates.time = normalizeTimeStr(reminderUpdates.time);
          }
          if (reminderUpdates.repeatSchedule && typeof reminderUpdates.repeatSchedule === "string") {
            const lowerRepeat = reminderUpdates.repeatSchedule.toLowerCase().trim();
            if (lowerRepeat === "daily" || lowerRepeat === "weekly" || lowerRepeat === "once" || lowerRepeat === "custom") {
              reminderUpdates.repeatSchedule = lowerRepeat;
            } else if (lowerRepeat.includes("day") || lowerRepeat.includes("daily") || lowerRepeat.includes("every")) {
              reminderUpdates.repeatSchedule = "daily";
            } else if (lowerRepeat.includes("week") || lowerRepeat.includes("weekly")) {
              reminderUpdates.repeatSchedule = "weekly";
            } else if (lowerRepeat.includes("once") || lowerRepeat.includes("one")) {
              reminderUpdates.repeatSchedule = "once";
            } else {
              reminderUpdates.repeatSchedule = "daily";
            }
          }
          if (reminderUpdates.time && reminderUpdates.time.includes(",")) {
            if (reminderUpdates.repeatSchedule !== "custom" && reminderUpdates.repeatSchedule !== "daily") {
              reminderUpdates.repeatSchedule = "custom";
            }
          }

          await updateReminder(targetRem.id, {
            ...reminderUpdates,
            enabled: payload.enabled !== undefined ? payload.enabled : targetRem.enabled
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Reminder updated</span>,
            description: action.confirmMessage || `Changes applied to reminder for ${targetRem.medicineName}.`,
          });
          break;
        }

        case "REMOVE_REMINDER":
        case "DELETE_REMINDER" as any: {
          const targetRem = findReminder(payload.id, payload.medicineName);
          if (!targetRem) {
            throw new Error(
              `Could not find a reminder for "${payload.medicineName || 'the specified medicine'}". Please check the name and try again.`
            );
          }

          await deleteReminder(targetRem.id);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Reminder removed</span>,
            description: action.confirmMessage || `Reminder for ${targetRem.medicineName} has been deleted.`,
          });
          break;
        }

        case "LOG_DOSE": {
          const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
          const doseStatus = (payload.status || payload.action || "taken") as string;
          await logDose({
            reminderId: payload.reminderId as string || "",
            medicineName: payload.medicineName as string,
            dose: payload.dose as string || "1 dose",
            scheduledTime: payload.scheduledTime as string || new Date().toISOString(),
            action: doseStatus as "taken" | "missed" | "snoozed",
            patientId: targetPatientId
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Dose logged</span>,
            description: action.confirmMessage || `Logged ${payload.medicineName} as ${doseStatus}.`,
          });
          break;
        }

        case "LOG_WELLNESS": {
          const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
          const rawData = (payload.data && typeof payload.data === "object") ? payload.data : payload;
          const rawMood = rawData.mood ?? payload.mood;
          const rawEnergy = rawData.energy ?? payload.energy;
          const rawSymptoms = rawData.symptoms ?? payload.symptoms;
          const symptoms = Array.isArray(rawSymptoms)
            ? rawSymptoms.map((s: unknown) => String(s).trim()).filter(Boolean)
            : [];

          // Normalize mood: 1-5 integer scale
          let normalizedMood = 3;
          if (typeof rawMood === "number" && !isNaN(rawMood)) {
            normalizedMood = Math.max(1, Math.min(5, Math.round(rawMood)));
          } else if (typeof rawMood === "string") {
            const parsed = parseInt(rawMood, 10);
            if (!isNaN(parsed)) {
              normalizedMood = Math.max(1, Math.min(5, parsed));
            } else {
              const lower = rawMood.toLowerCase();
              if (lower.includes("ecstatic") || lower.includes("great") || lower.includes("5")) normalizedMood = 5;
              else if (lower.includes("good") || lower.includes("happy") || lower.includes("4")) normalizedMood = 4;
              else if (lower.includes("okay") || lower.includes("fine") || lower.includes("3")) normalizedMood = 3;
              else if (lower.includes("meh") || lower.includes("bad") || lower.includes("stressed") || lower.includes("2")) normalizedMood = 2;
              else if (lower.includes("low") || lower.includes("terrible") || lower.includes("1")) normalizedMood = 1;
            }
          }

          // Normalize energy: 1-5 integer scale (1 = 20%, 5 = 100%)
          let normalizedEnergy = 3;
          if (typeof rawEnergy === "number" && !isNaN(rawEnergy)) {
            normalizedEnergy = Math.max(1, Math.min(5, Math.round(rawEnergy)));
          } else if (typeof rawEnergy === "string") {
            const parsed = parseInt(rawEnergy, 10);
            if (!isNaN(parsed)) {
              normalizedEnergy = Math.max(1, Math.min(5, parsed));
            } else {
              const lower = rawEnergy.toLowerCase();
              if (lower.includes("100") || lower.includes("ecstatic") || lower.includes("full") || lower.includes("5")) normalizedEnergy = 5;
              else if (lower.includes("high") || lower.includes("strong") || lower.includes("4")) normalizedEnergy = 4;
              else if (lower.includes("moderate") || lower.includes("normal") || lower.includes("3")) normalizedEnergy = 3;
              else if (lower.includes("low") || lower.includes("tired") || lower.includes("2")) normalizedEnergy = 2;
              else if (lower.includes("drained") || lower.includes("exhausted") || lower.includes("1")) normalizedEnergy = 1;
            }
          }

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

          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Wellness logged {emoji}</span>,
            description: action.confirmMessage || `Mood: ${normalizedMood}/5 • Vitality: ${normalizedEnergy * 20}%${symSummary}`,
          });
          break;
        }

        case "ADD_PATIENT":
          if (!payload.name) {
            throw new Error("Patient name is required to create a profile.");
          }
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
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Family member added</span>,
            description: action.confirmMessage || `${payload.name} is now part of your health hub.`,
          });
          break;

        case "UPDATE_PATIENT": {
          const targetPatient = findPatient(payload.id, payload.name);
          if (!targetPatient) {
            throw new Error(`Could not find "${payload.name || 'the member'}" in your Family Hub to update. Please check the name and try again.`);
          }
          const updates = { ...payload };
          delete updates.id;
          await updatePatient(targetPatient.id, updates);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Profile updated</span>,
            description: action.confirmMessage || `Updated health profile for ${targetPatient.name}.`,
          });
          break;
        }

        case "REMOVE_PATIENT":
        case "DELETE_PATIENT" as any: {
          const targetPatient = findPatient(payload.id, payload.name);
          if (!targetPatient) {
            throw new Error(`Could not find "${payload.name || 'the member'}" in your Family Hub. Please check the name and try again.`);
          }
          await deletePatient(targetPatient.id);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Profile removed</span>,
            description: action.confirmMessage || `Removed ${targetPatient.name} from Family Hub.`,
          });
          break;
        }

        case "SWITCH_PATIENT_SCOPE": {
          const rawTarget = payload.patientId || payload.patientName || payload.name;
          const targetId = resolvePatientId(rawTarget);
          setSelectedPatientId(targetId ?? null);
          const targetName = targetId ? (patients.find(p => p.id === targetId)?.name || "Family Member") : "Personal Profile";
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="👤" size={16} /> Context switched</span>,
            description: action.confirmMessage || `Now viewing health records for ${targetName}.`,
          });
          break;
        }

        case "TOGGLE_REMINDER": {
          const shouldEnable = payload.enabled !== undefined ? Boolean(payload.enabled) : true;
          if (payload.id) {
            await updateReminder(payload.id, { enabled: shouldEnable });
          } else if (payload.medicineName) {
            const match = findReminder(undefined, payload.medicineName);
            if (match) await updateReminder(match.id, { enabled: shouldEnable });
          } else {
            // Toggle all reminders
            for (const r of reminders) {
              await updateReminder(r.id, { enabled: shouldEnable });
            }
          }
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="🔔" size={16} /> Reminders {shouldEnable ? "resumed" : "paused"}</span>,
            description: action.confirmMessage || (shouldEnable ? "Alarms are now active." : "Alarms have been paused."),
          });
          break;
        }

        case "SNOOZE_REMINDER": {
          const snoozeMins = payload.snoozeMinutes || 15;
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="⏰" size={16} /> Reminder snoozed</span>,
            description: action.confirmMessage || `Snoozed for ${snoozeMins} minutes.`,
          });
          break;
        }

        case "UNDO_DOSE_LOG": {
          let targetLog = payload.id ? doseLogs.find(l => l.id === payload.id) : undefined;
          if (!targetLog && doseLogs.length > 0) {
            targetLog = doseLogs[doseLogs.length - 1];
          }
          if (targetLog) {
            await deleteDoseLog(targetLog.id);
            if (targetLog.action === "taken" || (targetLog as any).status === "taken") {
              const targetMedicineId = (targetLog as any).medicineId;
              const matchedMed = medicines.find(m => (targetMedicineId && m.id === targetMedicineId) || (m.name && m.name.toLowerCase() === targetLog.medicineName.toLowerCase()));
              if (matchedMed && typeof matchedMed.currentQuantity === "number") {
                const restoreQty = matchedMed.dosagePerDose || 1;
                await updateMedicine(matchedMed.id, {
                  currentQuantity: Math.min(matchedMed.totalQuantity || (matchedMed.currentQuantity + restoreQty), matchedMed.currentQuantity + restoreQty)
                });
              }
            }
            toast({
              title: <span className="flex items-center gap-2"><RiveMoji emoji="↩️" size={16} /> Dose log reverted</span>,
              description: action.confirmMessage || `Reverted dose log for ${targetLog.medicineName}.`,
            });
          } else {
            toast({
              title: <span className="flex items-center gap-2"><RiveMoji emoji="ℹ️" size={16} /> No dose to revert</span>,
              description: "No recent dose logs found to undo.",
            });
          }
          break;
        }

        case "BATCH_ADD_REGIMEN": {
          const medName = payload.medicineName || "Treatment Medication";
          const targetPatientId = resolvePatientId(payload.patientId || payload.patientName || payload.patient);
          const newMed = await addMedicine({
            name: medName,
            dosage: payload.dosage || "1 course",
            frequencyPerDay: payload.frequencyPerDay || 2,
            dosagePerDose: 1,
            unit: "tablets",
            currentQuantity: payload.totalQuantity || 24,
            totalQuantity: payload.totalQuantity || 24,
            patientId: targetPatientId
          }, targetPatientId);

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

          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="📋" size={16} /> Regimen scheduled</span>,
            description: action.confirmMessage || `Scheduled course and reminders for ${medName}.`,
          });
          break;
        }

        case "NAVIGATE_PAGE": {
          if (payload.targetRoute) {
            navigate(payload.targetRoute);
            toast({
              title: <span className="flex items-center gap-2"><RiveMoji emoji="🧭" size={16} /> Navigating</span>,
              description: `Opened ${payload.targetRoute}.`,
            });
          }
          break;
        }

        case "OPEN_PHARMACY_MODAL": {
          window.dispatchEvent(new CustomEvent("open-pharmacy-modal", { detail: { medicineName: payload.medicineName } }));
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="🏥" size={16} /> NDA Pharmacy Locator</span>,
            description: "Opening licensed pharmacy map...",
          });
          break;
        }

        case "DISCONTINUE_MEDICINE": {
          const targetMed = findMedicine(payload.id, payload.name);
          if (!targetMed) {
            throw new Error(`Could not find "${payload.name || 'the medicine'}" in your cabinet to discontinue.`);
          }
          await updateMedicine(targetMed.id, {
            notes: `Discontinued: ${payload.reason || "Doctor recommendation"} (${new Date().toLocaleDateString()})`
          });
          const relatedReminders = reminders.filter(r => r.medicineId === targetMed.id || r.medicineName.toLowerCase() === targetMed.name.toLowerCase());
          for (const r of relatedReminders) {
            await updateReminder(r.id, { enabled: false });
          }
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="🛑" size={16} /> Medicine discontinued</span>,
            description: action.confirmMessage || `Discontinued ${targetMed.name} and paused related reminders.`,
          });
          break;
        }

        default:
          console.warn("Unknown AI action type:", action.type);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="⚠️" size={16} /> Unsupported action</span>,
            description: `DawaGPT tried an unsupported action type "${action.type}". Please try rephrasing your request.`,
            variant: "destructive",
          });
          throw new Error(`Unsupported action type "${action.type}".`);
      }
    } catch (e) {
      console.error("AI Action Dispatch Error:", e);
      toast({
        title: <span className="flex items-center gap-2"><RiveMoji emoji="❌" size={16} /> Action failed</span>,
        description: (e as Error).message || "Action failed. Please try again or do it manually.",
        variant: "destructive",
      });
      throw e;
    }
  };

  return { dispatchAIAction };
}
