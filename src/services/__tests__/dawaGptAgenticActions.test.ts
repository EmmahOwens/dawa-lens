import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractDeterministicAction,
  generateDawaGPTResponse
} from "../aiAssistantService";
import { renderHook, act } from "@testing-library/react";
import { useAIActions } from "@/hooks/useAIActions";

// Mock dependencies for useAIActions
const mockAddMedicine = vi.fn();
const mockUpdateMedicine = vi.fn();
const mockDeleteMedicine = vi.fn();
const mockAddReminder = vi.fn();
const mockUpdateReminder = vi.fn();
const mockDeleteReminder = vi.fn();
const mockLogDose = vi.fn();
const mockDeleteDoseLog = vi.fn();
const mockAddPatient = vi.fn();
const mockUpdatePatient = vi.fn();
const mockDeletePatient = vi.fn();
const mockSetSelectedPatientId = vi.fn();
const mockToast = vi.fn();

const sampleMedicines = [
  {
    id: "med-1",
    name: "Metformin",
    dosage: "500mg",
    dosagePerDose: 1,
    currentQuantity: 30,
    totalQuantity: 60,
    unit: "tablets",
    addedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "med-2",
    name: "Panadol",
    dosage: "500mg",
    dosagePerDose: 2,
    currentQuantity: 20,
    totalQuantity: 20,
    unit: "tablets",
    addedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "med-3",
    name: "Amoxicillin",
    dosage: "500mg",
    dosagePerDose: 2,
    frequencyPerDay: 3,
    currentQuantity: 60,
    totalQuantity: 60,
    unit: "tablets",
    addedAt: "2026-01-01T00:00:00.000Z"
  }
];

const sampleReminders = [
  {
    id: "rem-1",
    medicineId: "med-1",
    medicineName: "Metformin",
    dose: "1 tablet",
    time: "08:00",
    repeatSchedule: "daily" as const,
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

const samplePatients = [
  {
    id: "pat-1",
    name: "Babirye Mukasa",
    relation: "Daughter",
    type: "family" as const,
    age: 6,
    gender: "female" as const,
    managedBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

const sampleDoseLogs = [
  {
    id: "log-1",
    reminderId: "rem-1",
    medicineId: "med-1",
    medicineName: "Metformin",
    dose: "1 tablet",
    actionTime: new Date().toISOString(),
    scheduledTime: new Date().toISOString(),
    action: "taken" as const
  }
];

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    addMedicine: mockAddMedicine,
    updateMedicine: mockUpdateMedicine,
    deleteMedicine: mockDeleteMedicine,
    addReminder: mockAddReminder,
    updateReminder: mockUpdateReminder,
    deleteReminder: mockDeleteReminder,
    logDose: mockLogDose,
    deleteDoseLog: mockDeleteDoseLog,
    addWellnessLog: vi.fn(),
    addPatient: mockAddPatient,
    updatePatient: mockUpdatePatient,
    deletePatient: mockDeletePatient,
    setSelectedPatientId: mockSetSelectedPatientId,
    reminders: sampleReminders,
    medicines: sampleMedicines,
    doseLogs: sampleDoseLogs,
    patients: samplePatients
  })
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast
  })
}));

describe("DawaGPT Full-System Agentic Actions Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Action Intent Extraction (extractDeterministicAction)", () => {
    it("extracts ADD_MEDICINE with companion reminder schedule", () => {
      const action = extractDeterministicAction("Add Amoxicillin 500mg twice daily at 8am to my cabinet", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("ADD_MEDICINE");
      expect(action?.payload.name).toBe("Amoxicillin");
      expect(action?.payload.dosage).toBe("500mg");
      expect((action?.payload as any)?.reminderSchedule?.time).toBe("08:00");
    });

    it("extracts REMOVE_MEDICINE", () => {
      const action = extractDeterministicAction("Delete Metformin from my cabinet", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("REMOVE_MEDICINE");
      expect(action?.payload.id).toBe("med-1");
      expect(action?.payload.name).toBe("Metformin");
    });

    it("extracts TOGGLE_REMINDER (pause alarms)", () => {
      const action = extractDeterministicAction("Pause all my reminders", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("TOGGLE_REMINDER");
      expect(action?.payload.enabled).toBe(false);
    });

    it("extracts TOGGLE_REMINDER (resume alarms)", () => {
      const action = extractDeterministicAction("Resume my medication alarms", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("TOGGLE_REMINDER");
      expect(action?.payload.enabled).toBe(true);
    });

    it("extracts SNOOZE_REMINDER", () => {
      const action = extractDeterministicAction("Snooze my reminder for 15 minutes", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("SNOOZE_REMINDER");
      expect(action?.payload.snoozeMinutes).toBe(15);
    });

    it("extracts UNDO_DOSE_LOG", () => {
      const action = extractDeterministicAction("Undo my last dose log", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("UNDO_DOSE_LOG");
    });

    it("extracts ADD_PATIENT with demographic details", () => {
      const action = extractDeterministicAction("Add family member Kato age 4 son", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("ADD_PATIENT");
      expect(action?.payload.name).toContain("Kato");
      expect(action?.payload.relation).toBe("Son");
      expect(action?.payload.age).toBe(4);
      expect(action?.payload.gender).toBe("male");
    });

    it("extracts SWITCH_PATIENT_SCOPE", () => {
      const action = extractDeterministicAction("Switch profile to Babirye Mukasa", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("SWITCH_PATIENT_SCOPE");
      expect(action?.payload.patientId).toBe("pat-1");
      expect(action?.payload.patientName).toBe("Babirye Mukasa");
    });

    it("extracts BATCH_ADD_REGIMEN", () => {
      const action = extractDeterministicAction("Start a 3-day treatment regimen for Coartem", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("BATCH_ADD_REGIMEN");
      expect(action?.payload.medicineName).toContain("Coartem");
      expect(action?.payload.durationDays).toBe(3);
    });

    it("extracts NAVIGATE_PAGE to Med Vault", () => {
      const action = extractDeterministicAction("Take me to Med Vault", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("NAVIGATE_PAGE");
      expect(action?.payload.targetRoute).toBe("/medvault");
    });

    it("extracts OPEN_PHARMACY_MODAL for NDA pharmacy search", () => {
      const action = extractDeterministicAction("Where can I buy Metformin nearest pharmacy", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("OPEN_PHARMACY_MODAL");
      expect(action?.payload.medicineName).toBe("Metformin");
    });

    it("extracts ADD_REMINDER using Med Vault dosage and multi-dose frequency (2 tablets 3x daily)", () => {
      const action = extractDeterministicAction("Add a reminder for Amoxicillin at 8am", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("ADD_REMINDER");
      expect(action?.payload.medicineName).toBe("Amoxicillin");
      expect(action?.payload.dose).toBe("2 tablets");
      expect(action?.payload.time).toBe("08:00,16:00,00:00");
      expect(action?.payload.repeatSchedule).toBe("custom");
      expect(action?.payload.medicineId).toBe("med-3");
    });

    it("returns null for ADD_REMINDER when medicine exists in Med Vault but starting time is missing", () => {
      const action = extractDeterministicAction("Remind me to take Amoxicillin", sampleMedicines, sampleReminders, samplePatients);
      expect(action).toBeNull();
    });

    it("returns null for ADD_REMINDER when medicine does not exist in Med Vault", () => {
      const action = extractDeterministicAction("Set a reminder for Aspirin at 8am", sampleMedicines, sampleReminders, samplePatients);
      expect(action).toBeNull();
    });

    it("extracts ADD_REMINDER in multi-turn conversation when user provides time answering prompt", () => {
      const history = [
        { sender: "user" as const, text: "Remind me to take Amoxicillin" },
        { sender: "dawagpt" as const, text: "What time would you like to take your first dose of Amoxicillin?" }
      ];
      const action = extractDeterministicAction("Start at 8:00 AM", sampleMedicines, sampleReminders, samplePatients, history);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("ADD_REMINDER");
      expect(action?.payload.medicineName).toBe("Amoxicillin");
    });

    it("extracts UPDATE_MEDICINE for refill requests with quantity", () => {
      const action = extractDeterministicAction("Refill Panadol with 30 tablets", sampleMedicines, sampleReminders, samplePatients);
      expect(action).not.toBeNull();
      expect(action?.type).toBe("UPDATE_MEDICINE");
      expect(action?.payload.name).toBe("Panadol");
      expect(action?.payload.currentQuantity).toBe(30);
    });
  });

  describe("2. Conversational Response Formatting (generateDawaGPTResponse)", () => {
    it("formats ADD_REMINDER using Med Vault dosage (2 tablets) and distributed times", async () => {
      const resp = await generateDawaGPTResponse(
        "Add a reminder for Amoxicillin at 8am",
        null,
        null,
        sampleMedicines,
        sampleDoseLogs,
        sampleReminders,
        samplePatients
      );
      expect(resp.action?.type).toBe("ADD_REMINDER");
      expect(resp.text).toContain("Amoxicillin");
      expect(resp.text).toContain("2 tablets");
      expect(resp.text).toContain("3 times a day");
      expect(resp.text).toContain("8:00 AM, 4:00 PM, and 12:00 AM");
      expect(resp.source).toBe("Schedule Guard");
    });

    it("asks for starting time when medicine exists in Med Vault but user did not provide time", async () => {
      const resp = await generateDawaGPTResponse(
        "Remind me to take Amoxicillin",
        null,
        null,
        sampleMedicines,
        sampleDoseLogs,
        sampleReminders,
        samplePatients
      );
      expect(resp.action).toBeUndefined();
      expect(resp.text).toContain("found **Amoxicillin** in your Med Vault");
      expect(resp.text).toContain("2 tablets, 3 times a day");
      expect(resp.text).toContain("What time would you like to take your first dose");
      expect(resp.suggestions).toContain("Start at 8:00 AM");
      expect(resp.source).toBe("Schedule Guard");
    });

    it("asks for dosage and frequency when medicine does not exist in Med Vault", async () => {
      const resp = await generateDawaGPTResponse(
        "Set a reminder for Aspirin",
        null,
        null,
        sampleMedicines,
        sampleDoseLogs,
        sampleReminders,
        samplePatients
      );
      expect(resp.action).toBeUndefined();
      expect(resp.text).toContain("couldn't find **Aspirin** in your Medications or Med Vault");
      expect(resp.text).toContain("What is your prescribed dosage");
      expect(resp.text).toContain("How often should you take it");
      expect(resp.text).toContain("/medications");
      expect(resp.text).toContain("/medvault");
      expect(resp.source).toBe("Schedule Guard");
    });

    it("formats ADD_MEDICINE response with links and suggestions", async () => {
      const resp = await generateDawaGPTResponse(
        "Add Amoxicillin 500mg to my cabinet",
        null,
        null,
        sampleMedicines,
        sampleDoseLogs,
        sampleReminders,
        samplePatients
      );
      expect(resp.action?.type).toBe("ADD_MEDICINE");
      expect(resp.text).toContain("Amoxicillin");
      expect(resp.text).toContain("/medications");
      expect(resp.source).toBe("Cabinet Guard");
      expect(resp.suggestions.length).toBe(3);
    });

    it("formats SWITCH_PATIENT_SCOPE response", async () => {
      const resp = await generateDawaGPTResponse(
        "Switch context to Babirye Mukasa",
        null,
        null,
        sampleMedicines,
        sampleDoseLogs,
        sampleReminders,
        samplePatients
      );
      expect(resp.action?.type).toBe("SWITCH_PATIENT_SCOPE");
      expect(resp.text).toContain("Babirye Mukasa");
      expect(resp.source).toBe("Family Hub Guard");
    });

    it("formats UNDO_DOSE_LOG response", async () => {
      const resp = await generateDawaGPTResponse(
        "Undo my dose log",
        null,
        null,
        sampleMedicines,
        sampleDoseLogs,
        sampleReminders,
        samplePatients
      );
      expect(resp.action?.type).toBe("UNDO_DOSE_LOG");
      expect(resp.text).toContain("reverted your last logged dose");
      expect(resp.source).toBe("Adherence Guard");
    });
  });

  describe("3. useAIActions Hook Dispatching", () => {
    it("dispatches ADD_MEDICINE and automatically adds companion reminder", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "ADD_MEDICINE",
          payload: {
            name: "Amoxicillin",
            dosage: "500mg",
            dosagePerDose: 1,
            totalQuantity: 30,
            currentQuantity: 30,
            unit: "tablets",
            reminderSchedule: {
              time: "08:00",
              dose: "1 tablet",
              repeatSchedule: "daily"
            }
          }
        });
      });

      expect(mockAddMedicine).toHaveBeenCalled();
      expect(mockAddReminder).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalled();
    });

    it("dispatches SWITCH_PATIENT_SCOPE to update active context", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "SWITCH_PATIENT_SCOPE",
          payload: {
            patientId: "pat-1",
            patientName: "Babirye Mukasa"
          }
        });
      });

      expect(mockSetSelectedPatientId).toHaveBeenCalledWith("pat-1");
      expect(mockToast).toHaveBeenCalled();
    });

    it("dispatches UNDO_DOSE_LOG and restores pill count in Med Vault", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "UNDO_DOSE_LOG",
          payload: {
            medicineId: "med-1",
            medicineName: "Metformin"
          }
        });
      });

      expect(mockDeleteDoseLog).toHaveBeenCalledWith("log-1");
      expect(mockUpdateMedicine).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalled();
    });

    it("dispatches TOGGLE_REMINDER to pause all reminders", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "TOGGLE_REMINDER",
          payload: {
            enabled: false
          }
        });
      });

      expect(mockUpdateReminder).toHaveBeenCalledWith("rem-1", { enabled: false });
      expect(mockToast).toHaveBeenCalled();
    });

    it("dispatches BATCH_ADD_REGIMEN creating both medicine and paired alarms", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "BATCH_ADD_REGIMEN",
          payload: {
            medicineName: "Coartem",
            dosage: "20/120mg",
            durationDays: 3,
            frequency: "twice daily",
            times: "08:00,20:00"
          }
        });
      });

      expect(mockAddMedicine).toHaveBeenCalled();
      // Added paired custom reminder with times 08:00,20:00
      expect(mockAddReminder).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalled();
    });

    it("dispatches UPDATE_MEDICINE matching fuzzy medicine name", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "UPDATE_MEDICINE",
          payload: {
            name: "Amoxicillin 500mg",
            notes: "Take after food"
          }
        });
      });

      expect(mockUpdateMedicine).toHaveBeenCalledWith("med-3", expect.objectContaining({
        notes: "Take after food"
      }));
      expect(mockToast).toHaveBeenCalled();
    });

    it("dispatches REFILL_MEDICINE alias and expands totalQuantity capacity", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "REFILL_MEDICINE" as any,
          payload: {
            name: "Panadol",
            currentQuantity: 50
          }
        });
      });

      // Panadol initial totalQuantity was 20, new currentQuantity is 50, so totalQuantity expands to 50
      expect(mockUpdateMedicine).toHaveBeenCalledWith("med-2", expect.objectContaining({
        currentQuantity: 50,
        totalQuantity: 50
      }));
      expect(mockToast).toHaveBeenCalled();
    });

    it("resolves patientName to patientId when adding medicine for family member", async () => {
      const { result } = renderHook(() => useAIActions());
      await act(async () => {
        await result.current.dispatchAIAction({
          type: "ADD_MEDICINE",
          payload: {
            name: "Calpol",
            dosage: "120mg/5ml",
            patientName: "Babirye Mukasa"
          }
        });
      });

      expect(mockAddMedicine).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Calpol",
          patientId: "pat-1"
        }),
        "pat-1"
      );
    });

    it("throws descriptive error when target medicine is not found", async () => {
      const { result } = renderHook(() => useAIActions());
      await expect(
        result.current.dispatchAIAction({
          type: "UPDATE_MEDICINE",
          payload: {
            name: "NonExistentPillXYZ",
            currentQuantity: 10
          }
        })
      ).rejects.toThrow('Could not find "NonExistentPillXYZ" in your cabinet');
    });
  });
});
