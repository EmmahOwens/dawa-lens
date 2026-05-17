import { useApp, Medicine, Reminder, DoseLog, WellnessLog, Patient } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { AIAction } from "@/services/aiAssistantService";

export function useAIActions() {
  const { 
    addMedicine, updateMedicine, deleteMedicine, deleteReminder, 
    addReminder, updateReminder, logDose, 
    addWellnessLog, addPatient, reminders
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
            title: "✅ Medicine added",
            description: action.confirmMessage || `${payload.name} added to your cabinet.`,
          });
          break;

        case "UPDATE_MEDICINE":
          await updateMedicine(payload.id, payload);
          toast({
            title: "✅ Medicine updated",
            description: action.confirmMessage || "Changes applied to your medicine.",
          });
          break;

        case "REMOVE_MEDICINE":
          await deleteMedicine(payload.id);
          toast({
            title: "✅ Medicine removed",
            description: action.confirmMessage || "The medicine has been removed from your cabinet.",
          });
          break;

        case "ADD_REMINDER":
          await addReminder({
            medicineName: payload.medicineName,
            dose: payload.dose,
            time: payload.time,
            repeatSchedule: payload.repeatSchedule || "daily",
            repeatDays: payload.repeatDays || undefined,
            notes: payload.notes || "",
            enabled: true,
            color: payload.color || "blue",
            icon: payload.icon || "pill"
          });
          toast({
            title: "✅ Reminder added",
            description: action.confirmMessage || `Scheduled ${payload.medicineName} for ${payload.time}.`,
          });
          break;

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

          await updateReminder(targetId, {
            ...payload,
            enabled: payload.enabled !== undefined ? payload.enabled : true
          });
          toast({
            title: "✅ Reminder updated",
            description: action.confirmMessage || `Changes applied to ${payload.medicineName || "your reminder"}.`,
          });
          break;
        }

        case "REMOVE_REMINDER":
          await deleteReminder(payload.id);
          toast({
            title: "✅ Reminder removed",
            description: action.confirmMessage || "The reminder has been deleted.",
          });
          break;

        case "LOG_DOSE":
          await logDose({
            reminderId: payload.reminderId || "",
            medicineName: payload.medicineName,
            dose: payload.dose,
            scheduledTime: payload.scheduledTime || new Date().toISOString(),
            action: payload.action || "taken",
          });
          toast({
            title: "✅ Dose logged",
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
            title: "✅ Wellness logged",
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
            title: "✅ Family member added",
            description: action.confirmMessage || `${payload.name} is now part of your health hub.`,
          });
          break;

        default:
          console.warn("Unknown AI action type:", action.type);
      }
    } catch (e) {
      console.error("AI Action Dispatch Error:", e);
      toast({
        title: "❌ Action failed",
        description: (e as Error).message || "I couldn't complete that action. Please try manually.",
        variant: "destructive",
      });
    }
  };

  return { dispatchAIAction };
}
