import { describe, it, expect, vi } from "vitest";
import {
  extractDeterministicAction,
  extractWellnessData,
  generateDawaGPTResponse
} from "../aiAssistantService";
import { renderHook, act } from "@testing-library/react";
import { useAIActions } from "@/hooks/useAIActions";

// Mock dependencies for useAIActions
const mockAddWellnessLog = vi.fn();
const mockToast = vi.fn();

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    addMedicine: vi.fn(),
    updateMedicine: vi.fn(),
    deleteMedicine: vi.fn(),
    deleteReminder: vi.fn(),
    addReminder: vi.fn(),
    updateReminder: vi.fn(),
    logDose: vi.fn(),
    addWellnessLog: mockAddWellnessLog,
    addPatient: vi.fn(),
    reminders: [],
    medicines: []
  })
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast
  })
}));

describe("DawaGPT Wellness & Symptom Extraction", () => {
  it("extracts headache with low vitality (energy: 2, mood: 2)", () => {
    const data = extractWellnessData("I have a headache");
    expect(data).not.toBeNull();
    expect(data?.symptoms).toContain("Headache");
    expect(data?.mood).toBe(2);
    expect(data?.energy).toBe(2);
  });

  it("extracts stomachache with low vitality (energy: 2, mood: 2)", () => {
    const data = extractWellnessData("I have a stomachache");
    expect(data).not.toBeNull();
    expect(data?.symptoms).toContain("Stomach Ache");
    expect(data?.mood).toBe(2);
    expect(data?.energy).toBe(2);
  });

  it("extracts multiple symptoms (headache and stomachache)", () => {
    const data = extractWellnessData("I have a headache and stomachache and feel so sick");
    expect(data).not.toBeNull();
    expect(data?.symptoms).toContain("Headache");
    expect(data?.symptoms).toContain("Stomach Ache");
    expect(data?.mood).toBe(2);
    expect(data?.energy).toBe(2);
  });

  it("extracts 'very happy' state with peak mood 5 and high vitality", () => {
    const data = extractWellnessData("I am very happy today!");
    expect(data).not.toBeNull();
    expect(data?.symptoms).toContain("Happy");
    expect(data?.mood).toBe(5);
    expect(data?.energy).toBeGreaterThanOrEqual(4);
  });

  it("extracts 'ecstatic' state with peak mood 5 and peak energy 5", () => {
    const data = extractWellnessData("I'm feeling ecstatic right now!");
    expect(data).not.toBeNull();
    expect(data?.symptoms).toContain("Happy");
    expect(data?.mood).toBe(5);
    expect(data?.energy).toBe(5);
  });

  it("extracts Luganda pain expressions ('Omutwe gunnuma' and 'Olubuto lunnuma')", () => {
    const headData = extractWellnessData("Bambi omutwe gunnuma");
    expect(headData?.symptoms).toContain("Headache");

    const stomachData = extractWellnessData("Olubuto lunnuma nnyo");
    expect(stomachData?.symptoms).toContain("Stomach Ache");
  });

  it("extracts severe symptoms with mood 1 and energy 1", () => {
    const data = extractWellnessData("I have a severe headache, completely exhausted and drained");
    expect(data).not.toBeNull();
    expect(data?.symptoms).toContain("Headache");
    expect(data?.symptoms).toContain("Fatigue");
    expect(data?.mood).toBe(1);
    expect(data?.energy).toBe(1);
  });

  it("does not trigger wellness log on medical interaction questions", () => {
    const data = extractWellnessData("Can I take Panadol with Flagyl together?");
    expect(data).toBeNull();

    const action = extractDeterministicAction("Can I take Aspirin if I have a headache?");
    expect(action).toBeNull();
  });

  it("produces a valid LOG_WELLNESS action from extractDeterministicAction", () => {
    const action = extractDeterministicAction("I'm feeling ecstatic today");
    expect(action).not.toBeNull();
    expect(action?.type).toBe("LOG_WELLNESS");
    expect(action?.payload?.type).toBe("symptom");
    const payloadData = (action?.payload as any)?.data;
    expect(payloadData.mood).toBe(5);
    expect(payloadData.energy).toBe(5);
    expect(payloadData.symptoms).toContain("Happy");
  });

  it("generates empathetic response for headache in generateDawaGPTResponse", async () => {
    const res = await generateDawaGPTResponse(
      "I have a headache",
      null,
      { id: "u1", name: "Amina", gender: "female", dateOfBirth: null },
      [],
      [],
      [],
      []
    );
    expect(res.action).toBeDefined();
    expect(res.action?.type).toBe("LOG_WELLNESS");
    expect(res.text).toContain("Wellness Hub");
    expect(res.text).toContain("Nyabo");
    expect(res.text).toContain("Bambi");
  });

  it("generates enthusiastic congratulatory response for ecstatic state in generateDawaGPTResponse", async () => {
    const res = await generateDawaGPTResponse(
      "I am ecstatic today!",
      null,
      { id: "u1", name: "Sarah", gender: "female", dateOfBirth: null },
      [],
      [],
      [],
      []
    );
    expect(res.action).toBeDefined();
    expect(res.action?.type).toBe("LOG_WELLNESS");
    expect(res.text).toContain("Wellness Hub");
    expect(res.text).toContain("Nyabo");
    expect(res.text).toContain("wonderful");
    expect(res.text).not.toContain("Bambi");
  });
});

describe("useAIActions hook LOG_WELLNESS dispatching", () => {
  it("normalizes and dispatches LOG_WELLNESS with numeric mood and energy", async () => {
    mockAddWellnessLog.mockClear();
    mockToast.mockClear();

    const { result } = renderHook(() => useAIActions());

    await act(async () => {
      await result.current.dispatchAIAction({
        type: "LOG_WELLNESS",
        payload: {
          type: "symptom",
          data: {
            mood: 5,
            energy: 5,
            symptoms: ["Happy"],
            notes: "I am ecstatic"
          }
        },
        confirmMessage: "Recorded check-in"
      });
    });

    expect(mockAddWellnessLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "symptom",
        data: expect.objectContaining({
          mood: 5,
          energy: 5,
          symptoms: ["Happy"]
        })
      })
    );

    expect(mockToast).toHaveBeenCalled();
  });

  it("handles flat payload and string values gracefully", async () => {
    mockAddWellnessLog.mockClear();

    const { result } = renderHook(() => useAIActions());

    await act(async () => {
      await result.current.dispatchAIAction({
        type: "LOG_WELLNESS",
        payload: {
          type: "symptom",
          mood: "ecstatic" as any,
          energy: "100%" as any,
          symptoms: ["Happy"]
        },
        confirmMessage: "Recorded check-in"
      });
    });

    expect(mockAddWellnessLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "symptom",
        data: expect.objectContaining({
          mood: 5,
          energy: 5,
          symptoms: ["Happy"]
        })
      })
    );
  });
});
