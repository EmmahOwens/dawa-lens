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
      switch (action.type) {
        case "ADD_MEDICINE":
          await addMedicine(action.payload as any);
          toast({
            title: "✅ Medicine added",
            description: action.confirmMessage || `${action.payload.name} added to your cabinet.`,
          });
          break;

        case "UPDATE_MEDICINE":
          await updateMedicine(action.payload.id, action.payload);
          toast({
            title: "✅ Medicine updated",
            description: action.confirmMessage || "Changes applied to your medicine.",
          });
          break;

        case "REMOVE_MEDICINE":
          await deleteMedicine(action.payload.id);
          toast({
            title: "✅ Medicine removed",
            description: action.confirmMessage || "The medicine has been removed from your cabinet.",
          });
          break;

        case "ADD_REMINDER":
          await addReminder({
            medicineName: action.payload.medicineName,
            dose: action.payload.dose,
            time: action.payload.time,
            repeatSchedule: action.payload.repeatSchedule || "daily",
            repeatDays: action.payload.repeatDays || undefined,
            notes: action.payload.notes || "",
            enabled: true,
            color: action.payload.color || "blue",
            icon: action.payload.icon || "pill"
          });
          toast({
            title: "✅ Reminder added",
            description: action.confirmMessage || `Scheduled ${action.payload.medicineName} for ${action.payload.time}.`,
          });
          break;

        case "UPDATE_REMINDER": {
          let targetId = action.payload.id;
          
          // If ID is missing, try to find by name (case insensitive)
          if (!targetId && action.payload.medicineName) {
            const match = reminders.find(r => 
              r.medicineName.toLowerCase() === action.payload.medicineName.toLowerCase()
            );
            if (match) targetId = match.id;
          }

          if (!targetId) {
            throw new Error(`Could not find reminder for ${action.payload.medicineName || "specified medicine"}`);
          }

          await updateReminder(targetId, {
            ...action.payload,
            enabled: action.payload.enabled !== undefined ? action.payload.enabled : true
          } as any);
          toast({
            title: "✅ Reminder updated",
            description: action.confirmMessage || `Changes applied to ${action.payload.medicineName || "your reminder"}.`,
          });
          break;
        }

        case "REMOVE_REMINDER":
          await deleteReminder(action.payload.id);
          toast({
            title: "✅ Reminder removed",
            description: action.confirmMessage || "The reminder has been deleted.",
          });
          break;

        case "LOG_DOSE":
          await logDose({
            reminderId: action.payload.reminderId || "",
            medicineName: action.payload.medicineName,
            dose: action.payload.dose,
            scheduledTime: action.payload.scheduledTime || new Date().toISOString(),
            action: action.payload.action || "taken",
          });
          toast({
            title: `✅ Dose logged as ${action.payload.action || "taken"}`,
            description: action.confirmMessage || action.payload.medicineName,
          });
          break;

        case "LOG_WELLNESS":
          await addWellnessLog({
            type: action.payload.type || "symptom",
            data: action.payload.data || action.payload,
            patientId: action.payload.patientId
          });
          toast({
            title: "✅ Wellness log added",
            description: action.confirmMessage || "Your health status has been recorded.",
          });
          break;

        case "ADD_PATIENT":
          await addPatient({
            name: action.payload.name,
            age: action.payload.age,
            gender: action.payload.gender,
            relation: action.payload.relation
          });
          toast({
            title: "✅ Patient profile added",
            description: action.confirmMessage || `${action.payload.name} has been added to your care list.`,
          });
          break;

        default:
          console.warn("Unknown AI action type:", action.type);
      }
    } catch (err) {
      console.error("DawaGPT action dispatch failed:", err);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "Dawa-GPT couldn't complete that action. Please try manually.",
      });
    }
  };

  return { dispatchAIAction };
}
