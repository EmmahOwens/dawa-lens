import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { AIAction } from "@/services/aiAssistantService";
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

  const dispatchAIAction = async (action: AIAction) => {
    const rawAction = action as any;
    const actionType = action.type;
    const payload = (action.payload || rawAction?.data) as any;
    if (!actionType || !payload) return;

    try {
      switch (action.type) {
        case "ADD_MEDICINE": {
          if (!payload?.name) {
            throw new Error("Medicine name is required");
          }
          const createdMed = await addMedicine({
            name: payload.name,
            dosage: payload.dosage || "500mg",
            genericName: payload.genericName,
            dosagePerDose: payload.dosagePerDose || 1,
            frequencyPerDay: payload.frequencyPerDay || 1,
            totalQuantity: payload.totalQuantity,
            currentQuantity: payload.currentQuantity ?? payload.totalQuantity,
            unit: payload.unit || "tablets",
            notes: payload.notes || "",
            patientId: payload.patientId || undefined
          }, payload.patientId);

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
              patientId: payload.patientId || undefined
            });
          }

          toast({ 
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine added</span>,
            description: action.confirmMessage || `${payload.name} added to your cabinet.`,
          });
          break;
        }

        case "UPDATE_MEDICINE": {
          let targetMedId = payload.id;
          if (!targetMedId && payload.name && medicines.length > 0) {
            const match = medicines.find(m => m.name.toLowerCase() === payload.name.toLowerCase());
            if (match) targetMedId = match.id;
          }
          if (!targetMedId) {
            throw new Error(`Could not find medicine ${payload.name || ""} to update`);
          }
          await updateMedicine(targetMedId, payload);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine updated</span>,
            description: action.confirmMessage || "Changes applied to your medicine.",
          });
          break;
        }

        case "REMOVE_MEDICINE": {
          let targetMedId = payload.id;
          if (!targetMedId && payload.name && medicines.length > 0) {
            const match = medicines.find(m => m.name.toLowerCase() === payload.name.toLowerCase());
            // Also try partial match for common name variations
            if (!match) {
              const fuzzy = medicines.find(m => m.name.toLowerCase().includes((payload.name as string).toLowerCase()) || (payload.name as string).toLowerCase().includes(m.name.toLowerCase()));
              if (fuzzy) targetMedId = fuzzy.id;
            } else {
              targetMedId = match.id;
            }
          }
          if (!targetMedId) {
            throw new Error(`Could not find "${payload.name || 'the medicine'}" in your cabinet. Please check the name and try again.`);
          }
          await deleteMedicine(targetMedId);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine removed</span>,
            description: action.confirmMessage || `${payload.name || 'Medicine'} has been removed from your cabinet.`,
          });
          break;
        }

        case "ADD_REMINDER": {
          let medicineId = payload.medicineId;
          let color = payload.color;
          let icon = payload.icon;

          if (!medicineId && payload.medicineName && medicines.length > 0) {
            const match = medicines.find(m => 
              m.name.toLowerCase() === payload.medicineName.toLowerCase() ||
              (m.genericName && m.genericName.toLowerCase() === payload.medicineName.toLowerCase())
            );
            if (match) {
              medicineId = match.id;
              if (!color) color = match.color;
              if (!icon) icon = match.icon;
            }
          }

          const normalizedTime = payload.time ? normalizeTimeStr(payload.time) : "";
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
          if (normalizedTime.includes(",")) {
            if (repeatSchedule !== "custom" && repeatSchedule !== "daily") {
              repeatSchedule = "custom";
            }
          }

          if (!repeatSchedule) {
            repeatSchedule = normalizedTime.includes(",") ? "custom" : "daily";
          }

          await addReminder({
            medicineId: medicineId || undefined,
            medicineName: payload.medicineName,
            dose: payload.dose,
            time: normalizedTime,
            repeatSchedule: repeatSchedule,
            repeatDays: payload.repeatDays || undefined,
            notes: payload.notes || "",
            enabled: true,
            color: color || "blue",
            icon: icon || "pill",
            patientId: payload.patientId || undefined,
            patientName: payload.patientName || undefined
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Reminder added</span>,
            description: action.confirmMessage || `Scheduled ${payload.medicineName} for ${normalizedTime}.`,
          });
          break;
        }

        case "UPDATE_REMINDER": {
          let targetId = payload.id;
          
          // If ID is missing, try to find by name (case insensitive)
          if (!targetId && payload.medicineName) {
            const match = reminders.find(r => 
              r.medicineName.toLowerCase() === payload.medicineName.toLowerCase()
            );
            if (match) targetId = match.id;
          }

          if (!targetId) {
            throw new Error(`Could not find reminder for ${payload.medicineName || "specified medicine"}`);
          }

          const reminderUpdates = { ...payload };
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

          await updateReminder(targetId, {
            ...reminderUpdates,
            enabled: payload.enabled !== undefined ? payload.enabled : true
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Reminder updated</span>,
            description: action.confirmMessage || `Changes applied to ${payload.medicineName || "your reminder"}.`,
          });
          break;
        }

        case "REMOVE_REMINDER": {
          let targetId = payload.id;

          // Fuzzy fallback: if id is absent, search by medicineName (case-insensitive)
          if (!targetId && payload.medicineName) {
            const match = reminders.find(r =>
              r.medicineName.toLowerCase() === payload.medicineName.toLowerCase()
            );
            // Also try partial match
            if (!match) {
              const fuzzy = reminders.find(r =>
                r.medicineName.toLowerCase().includes((payload.medicineName as string).toLowerCase()) ||
                (payload.medicineName as string).toLowerCase().includes(r.medicineName.toLowerCase())
              );
              if (fuzzy) targetId = fuzzy.id;
            } else {
              targetId = match.id;
            }
          }

          if (!targetId) {
            throw new Error(
              `Could not find a reminder for "${payload.medicineName || 'the specified medicine'}". Please check the name and try again.`
            );
          }

          await deleteReminder(targetId);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Reminder removed</span>,
            description: action.confirmMessage || `Reminder for ${payload.medicineName || 'medicine'} has been deleted.`,
          });
          break;
        }

        case "LOG_DOSE": {
          // Bug fix: server sends `status` field, but legacy fallback also uses `action`.
          // Normalize both so either field works.
          const doseStatus = (payload.status || payload.action || "taken") as string;
          await logDose({
            reminderId: payload.reminderId as string || "",
            medicineName: payload.medicineName as string,
            dose: payload.dose as string,
            scheduledTime: payload.scheduledTime as string || new Date().toISOString(),
            action: doseStatus as "taken" | "missed" | "snoozed",
            patientId: payload.patientId as string | undefined || undefined
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Dose logged</span>,
            description: action.confirmMessage || `Logged ${payload.medicineName} as ${doseStatus}.`,
          });
          break;
        }

        case "LOG_WELLNESS": {
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
            patientId: payload.patientId || rawData.patientId
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
          if (payload.id) {
            await updatePatient(payload.id, payload);
            toast({
              title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Profile updated</span>,
              description: action.confirmMessage || `Updated health profile for ${payload.name || "dependent"}.`,
            });
          }
          break;
        }

        case "REMOVE_PATIENT": {
          let targetId = payload.id;
          if (!targetId && payload.name && patients.length > 0) {
            const match = patients.find(p => p.name.toLowerCase() === payload.name.toLowerCase());
            if (!match) {
              const fuzzy = patients.find(p => p.name.toLowerCase().includes((payload.name as string).toLowerCase()));
              if (fuzzy) targetId = fuzzy.id;
            } else {
              targetId = match.id;
            }
          }
          if (!targetId) {
            throw new Error(`Could not find "${payload.name || 'the member'}" in your Family Hub. Please check the name and try again.`);
          }
          await deletePatient(targetId);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Profile removed</span>,
            description: action.confirmMessage || `Removed ${payload.name || "member"} from Family Hub.`,
          });
          break;
        }

        case "SWITCH_PATIENT_SCOPE": {
          const targetId = payload.patientId ?? null;
          setSelectedPatientId(targetId);
          const targetName = payload.patientName || (targetId ? (patients.find(p => p.id === targetId)?.name || "Family Member") : "Personal Profile");
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
            const match = reminders.find(r => r.medicineName.toLowerCase() === payload.medicineName.toLowerCase());
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
          const newMed = await addMedicine({
            name: medName,
            dosage: payload.dosage || "1 course",
            frequencyPerDay: payload.frequencyPerDay || 2,
            dosagePerDose: 1,
            unit: "tablets",
            currentQuantity: payload.totalQuantity || 24,
            totalQuantity: payload.totalQuantity || 24,
            patientId: payload.patientId || undefined
          }, payload.patientId);

          const normalizedTime = payload.times ? normalizeTimeStr(payload.times) : "08:00,20:00";
          await addReminder({
            medicineId: newMed?.id || undefined,
            medicineName: medName,
            dose: payload.dose || "1 tablet",
            time: normalizedTime,
            repeatSchedule: "custom",
            enabled: true,
            patientId: payload.patientId || undefined
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
          let targetMedId = payload.id;
          if (!targetMedId && payload.name && medicines.length > 0) {
            const match = medicines.find(m => m.name.toLowerCase() === payload.name.toLowerCase());
            if (match) targetMedId = match.id;
          }
          if (targetMedId) {
            await updateMedicine(targetMedId, {
              notes: `Discontinued: ${payload.reason || "Doctor recommendation"} (${new Date().toLocaleDateString()})`
            });
            const relatedReminders = reminders.filter(r => r.medicineId === targetMedId || r.medicineName.toLowerCase() === (payload.name || "").toLowerCase());
            for (const r of relatedReminders) {
              await updateReminder(r.id, { enabled: false });
            }
            toast({
              title: <span className="flex items-center gap-2"><RiveMoji emoji="🛑" size={16} /> Medicine discontinued</span>,
              description: action.confirmMessage || `Discontinued ${payload.name || "medicine"} and paused related reminders.`,
            });
          }
          break;
        }

        default:
          console.warn("Unknown AI action type:", action.type);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="⚠️" size={16} /> Unsupported action</span>,
            description: "DawaGPT tried an unsupported action. Please try rephrasing your request.",
            variant: "destructive",
          });
      }
    } catch (e) {
      console.error("AI Action Dispatch Error:", e);
      toast({
        title: <span className="flex items-center gap-2"><RiveMoji emoji="❌" size={16} /> Action failed</span>,
        description: (e as Error).message || "Action failed. Please try again or do it manually.",
        variant: "destructive",
      });
    }
  };

  return { dispatchAIAction };
}
