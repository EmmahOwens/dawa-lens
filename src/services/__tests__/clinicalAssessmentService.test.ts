import { describe, it, expect } from "vitest";
import { generateLocalClinicalAssessment } from "../clinicalAssessmentService";
import { DoseLog, WellnessLog, Medicine } from "../../contexts/AppContext";

describe("clinicalAssessmentService - generateLocalClinicalAssessment", () => {
  it("generates a complete clinical assessment with default empty logs", () => {
    const assessment = generateLocalClinicalAssessment([], [], []);
    expect(assessment).toBeDefined();
    expect(assessment.summary).toContain("Patient");
    expect(assessment.dosagePatterns).toBeDefined();
    expect(assessment.lifestyleAnalysis).toBeDefined();
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(100);
    expect(["improving", "declining", "stable"]).toContain(assessment.status);
    expect(assessment.insights.length).toBeGreaterThan(0);
    expect(assessment.actionItems.length).toBeGreaterThan(0);
    expect(assessment.insight).toBeDefined();
    expect(assessment.recommendation).toBeDefined();
    expect(assessment.source).toBe("local");
  });

  it("accurately correlates adherence and symptoms for active patient context", () => {
    const medicines: Medicine[] = [
      { id: "m1", name: "Amoxicillin", dosage: "500mg" } as Medicine,
      { id: "m2", name: "Paracetamol", dosage: "1000mg" } as Medicine,
    ];

    const doseLogs: DoseLog[] = [
      {
        id: "d1",
        reminderId: "r1",
        medicineName: "Amoxicillin",
        dose: "500mg",
        action: "taken",
        scheduledTime: "2026-09-01T08:00:00Z",
        actionTime: "2026-09-01T08:05:00Z",
      },
      {
        id: "d2",
        reminderId: "r1",
        medicineName: "Amoxicillin",
        dose: "500mg",
        action: "taken",
        scheduledTime: "2026-09-02T08:00:00Z",
        actionTime: "2026-09-02T08:02:00Z",
      },
      {
        id: "d3",
        reminderId: "r2",
        medicineName: "Paracetamol",
        dose: "1000mg",
        action: "skipped",
        scheduledTime: "2026-09-02T20:00:00Z",
        actionTime: "2026-09-02T20:00:00Z",
      },
    ];

    const wellnessLogs: WellnessLog[] = [
      {
        id: "w1",
        userId: "u1",
        type: "symptom",
        timestamp: "2026-09-02T10:00:00Z",
        data: { mood: 4, energy: 3, symptoms: ["Headache", "Fatigue"] },
      },
    ];

    const patientContext = {
      name: "Sarah",
      age: 32,
      gender: "female",
      conditions: ["Hypertension"],
      allergies: ["Penicillin"],
    };

    const assessment = generateLocalClinicalAssessment(doseLogs, wellnessLogs, medicines, patientContext);

    expect(assessment.summary).toContain("Sarah");
    expect(assessment.summary).toContain("Hypertension");
    expect(assessment.summary).toContain("Penicillin");
    expect(assessment.summary).toContain("67%"); // 2 of 3 taken
    expect(assessment.dosagePatterns).toContain("Paracetamol");
    expect(assessment.dosagePatterns).toContain("skipped");
    expect(assessment.lifestyleAnalysis).toContain("Headache");
    expect(assessment.status).toBeDefined();
    expect(assessment.score).toBe(assessment.correlationScore);
  });
});
