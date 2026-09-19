import { describe, it, expect } from "vitest";
import { getContextualSuggestions, isGenericBoilerplate } from "../contextualSuggestions";
import { ChatMessage } from "@/services/aiAssistantService";

describe("Frontend Contextual Suggestions Engine", () => {
  it("detects generic boilerplate suggestions accurately", () => {
    expect(isGenericBoilerplate(["Check medications", "View reminders", "Drug safety"])).toBe(true);
    expect(isGenericBoilerplate(["Try again", "Check my medications"])).toBe(true);
    expect(isGenericBoilerplate([])).toBe(true);
    expect(isGenericBoilerplate(["Can I take Panadol with milk?", "Safe foods for headache"])).toBe(false);
  });

  it("generates contextual suggestions for medication inquiries (e.g., Amoxicillin)", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", text: "Can I take Amoxicillin with milk?" },
      { id: "2", role: "assistant", text: "Amoxicillin is safe with food and milk, unlike certain other antibiotics." }
    ];
    const suggestions = getContextualSuggestions({ messages });
    expect(suggestions).toHaveLength(3);
    expect(suggestions.some(s => s.includes("Amoxicillin") || s.includes("milk") || s.includes("food"))).toBe(true);
  });

  it("generates contextual suggestions for symptoms (e.g., Fever / Headache)", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", text: "I have a high fever and headache" },
      { id: "2", role: "assistant", text: "A high fever accompanied by a headache requires careful observation." }
    ];
    const suggestions = getContextualSuggestions({ messages });
    expect(suggestions).toHaveLength(3);
    expect(suggestions.some(s => s.toLowerCase().includes("fever") || s.toLowerCase().includes("headache") || s.toLowerCase().includes("doctor"))).toBe(true);
  });

  it("generates contextual suggestions following an action (e.g., ADD_REMINDER)", () => {
    const suggestions = getContextualSuggestions({
      userQuery: "Add a reminder for Metformin at 8:00 AM",
      action: {
        type: "ADD_REMINDER",
        payload: { medicineName: "Metformin", time: "08:00" }
      }
    });
    expect(suggestions).toHaveLength(3);
    expect(suggestions.some(s => s.includes("Metformin") || s.toLowerCase().includes("reminder"))).toBe(true);
  });

  it("generates page-specific suggestions on initial opening (e.g., /interactions)", () => {
    const suggestions = getContextualSuggestions({
      currentPage: "/interactions"
    });
    expect(suggestions).toHaveLength(3);
    expect(suggestions.some(s => s.toLowerCase().includes("interact") || s.toLowerCase().includes("panadol"))).toBe(true);
  });

  it("replaces generic boilerplate suggestions with context-matched suggestions", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", text: "How should I take my Coartem?" },
      { id: "2", role: "assistant", text: "Coartem needs fatty food for proper absorption." }
    ];
    const suggestions = getContextualSuggestions({
      messages,
      existingSuggestions: ["Check medications", "View reminders", "Drug safety"] // generic boilerplate
    });
    expect(suggestions).toHaveLength(3);
    expect(suggestions).not.toEqual(["Check medications", "View reminders", "Drug safety"]);
    expect(suggestions.some(s => s.toLowerCase().includes("coartem") || s.toLowerCase().includes("fat") || s.toLowerCase().includes("food"))).toBe(true);
  });

  it("handles ResolvedPatient correctly for pediatric/senior suggestions", () => {
    const childPatient = {
      id: null,
      name: "Baby",
      age: 4,
      isOwner: true,
      type: "self" as const,
    };
    const suggestions = getContextualSuggestions({
      userQuery: "How to give medicine to a child?",
      activePatient: childPatient,
    });
    expect(suggestions).toHaveLength(3);
    expect(suggestions.some(s => s.toLowerCase().includes("chewable") || s.toLowerCase().includes("porridge"))).toBe(true);
  });
});
