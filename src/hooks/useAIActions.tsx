import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { AIAction } from "@/services/aiAssistantService";
import { RiveMoji } from "@/components/rive/RiveMoji";
import React from "react";

export function normalizeTimeStr(timeStr: string): string {
  if (!timeStr) return "08:00";
  
  const cleanStr = timeStr.toLowerCase().trim();

  // If the whole string is a frequency/descriptive phrase, parse it first
  if (cleanStr.includes("twice") || cleanStr.includes("two times") || cleanStr.includes("2 times") || cleanStr.includes("2x")) {
    return "08:00,20:00";
  }
  if (cleanStr.includes("three times") || cleanStr.includes("thrice") || cleanStr.includes("3 times") || cleanStr.includes("3x")) {
    return "08:00,14:00,20:00";
  }
  if (cleanStr.includes("four times") || cleanStr.includes("4 times") || cleanStr.includes("4x")) {
    return "08:00,12:00,16:00,20:00";
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
    addReminder, updateReminder, logDose, 
    addWellnessLog, addPatient, reminders, medicines
  } = useApp();
  const { toast } = useToast();

  const dispatchAIAction = async (action: AIAction) => {
    if (!action.type || !action.payload) return;

    try {
      const payload = action.payload as any; // Temporary cast to fix unknown errors while keeping types clean in logic
      switch (action.type) {
        case "ADD_MEDICINE":
          await addMedicine(payload);
          toast({ 
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine added</span>,
            description: action.confirmMessage || `${payload.name} added to your cabinet.`,
          });
          break;

        case "UPDATE_MEDICINE":
          await updateMedicine(payload.id, payload);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine updated</span>,
            description: action.confirmMessage || "Changes applied to your medicine.",
          });
          break;

        case "REMOVE_MEDICINE":
          await deleteMedicine(payload.id);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Medicine removed</span>,
            description: action.confirmMessage || "The medicine has been removed from your cabinet.",
          });
          break;

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
            if (match) targetId = match.id;
          }

          if (!targetId) {
            throw new Error(
              `Could not find a reminder for ${payload.medicineName || 'the specified medicine'}`
            );
          }

          await deleteReminder(targetId);
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Reminder removed</span>,
            description: action.confirmMessage || "The reminder has been deleted.",
          });
          break;
        }

        case "LOG_DOSE":
          await logDose({
            reminderId: payload.reminderId || "",
            medicineName: payload.medicineName,
            dose: payload.dose,
            scheduledTime: payload.scheduledTime || new Date().toISOString(),
            action: payload.action || "taken",
            patientId: payload.patientId || undefined
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Dose logged</span>,
            description: action.confirmMessage || `Logged ${payload.medicineName} as ${payload.action || 'taken'}.`,
          });
          break;

        case "LOG_WELLNESS":
          await addWellnessLog({
            type: payload.type || "symptom",
            data: payload.data || {},
            patientId: payload.patientId
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Wellness logged</span>,
            description: action.confirmMessage || "Your health data has been recorded.",
          });
          break;

        case "ADD_PATIENT":
          await addPatient({
            name: payload.name,
            age: payload.age,
            gender: payload.gender,
            relation: payload.relation
          });
          toast({
            title: <span className="flex items-center gap-2"><RiveMoji emoji="✅" size={16} /> Family member added</span>,
            description: action.confirmMessage || `${payload.name} is now part of your health hub.`,
          });
          break;

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
