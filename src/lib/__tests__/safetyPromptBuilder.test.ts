import { describe, it, expect } from "vitest";
import { buildSafetyConsultPrompt } from "../safetyPromptBuilder";

describe("buildSafetyConsultPrompt", () => {
  it("generates a polite fallback prompt when no alerts are present", () => {
    const prompt = buildSafetyConsultPrompt({
      medNames: ["Panadol", "Amoxicillin"],
    });

    expect(prompt).toContain("Can you review the safety and potential risks for my medications (Panadol, Amoxicillin)?");
    expect(prompt).toContain("How should I take them safely?");
  });

  it("builds a clean, bulleted prompt for duplicate therapies and boxed warnings", () => {
    const prompt = buildSafetyConsultPrompt({
      medNames: ["Warfarin", "Aspirin"],
      fdaSafety: {
        duplicateTherapies: [
          {
            drug1: "Warfarin",
            drug2: "Aspirin",
            sharedClass: "Anticoagulants",
            warning: "Bleeding risk",
          },
        ],
        boxedWarnings: [
          { drugName: "Warfarin", warning: "Major or fatal bleeding" },
        ],
      },
      interactions: [
        {
          drug1: "Warfarin",
          drug2: "Aspirin",
          description: "Increased bleeding",
          severity: "high",
        },
      ],
    });

    expect(prompt).toContain("I have active safety alerts for my medications (Warfarin, Aspirin):");
    expect(prompt).toContain("• Specifically, duplicate therapies detected: Warfarin + Aspirin");
    expect(prompt).toContain("• FDA Boxed Warning: Warfarin");
    expect(prompt).toContain("• Drug interactions: Warfarin + Aspirin");
    expect(prompt).toContain("Can you explain what these risks mean in plain language and what I should do to take them safely?");
  });

  it("includes health condition conflicts and allergen alerts", () => {
    const prompt = buildSafetyConsultPrompt({
      medNames: ["Metformin"],
      fdaSafety: {
        contraindicationAlerts: [
          {
            drugName: "Metformin",
            conflicts: [
              { condition: "Kidney Disease", severity: "severe", detail: "Lactic acidosis" },
            ],
          },
        ],
        allergenAlerts: [
          {
            drugName: "Metformin",
            conflicts: [
              { allergy: "Lactose", severity: "moderate", detail: "Contains lactose monohydrate" },
            ],
          },
        ],
      },
    });

    expect(prompt).toContain("• Health condition conflicts: Metformin (conflicts with Kidney Disease)");
    expect(prompt).toContain("• Allergy alerts: Metformin (allergen: Lactose)");
  });
});
