import { describe, it, expect } from "vitest";
import { generateDawaGPTResponse } from "../aiAssistantService";
import { UserProfile } from "@/contexts/AppContext";

describe("DawaGPT Uganda Support Directory (NDA & Mental Health Support)", () => {
  const dummyProfile: UserProfile = {
    id: "user-test",
    name: "Mukasa Ivan",
    dateOfBirth: "1995-05-10",
    gender: "male",
  };

  it("provides Uganda support leaving only verified NDA and Mental Health support when asked 'contact support'", async () => {
    const response = await generateDawaGPTResponse(
      "contact support",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("Support Directory for Uganda");
    expect(response.text).toContain("National Drug Authority (NDA) Uganda");
    expect(response.text).toContain("0800 101 999");
    expect(response.text).toContain("+256 791 415 555");
    expect(response.text).toContain("Mental Health Support in Uganda");
    expect(response.text).toContain("0800 200 600");
    expect(response.text).toContain("Butabika National Referral Mental Hospital");
    expect(response.text).toContain("0800 211 306");
    
    // Strict removal assertions
    expect(response.text).not.toContain("112");
    expect(response.text).not.toContain("999 (Landline)");
    expect(response.text).not.toContain("or 999");
    expect(response.text).not.toContain("0800 100 066");
    expect(response.text).not.toContain("0800 101 622");
    expect(response.text).not.toContain("Mulago");
    expect(response.text).not.toContain("0800 199 699");
    expect(response.text).not.toContain("/settings");
    expect(response.text).not.toContain("support@dawalens.ug");

    // Suggestions check
    expect(response.suggestions).toContain("National Drug Authority Helpline");
    expect(response.suggestions).toContain("Mental Health Support Uganda");
    expect(response.suggestions).not.toContain("Call Uganda Emergency (112)");
  });

  it("provides NDA and Mental Health support when asked 'support for Uganda'", async () => {
    const response = await generateDawaGPTResponse(
      "support for Uganda",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("0800 101 999");
    expect(response.text).toContain("National Drug Authority");
    expect(response.text).toContain("Mental Health Support");
    expect(response.text).not.toContain("112");
    expect(response.text).not.toContain("Ministry of Health");
  });

  it("provides NDA and Mental Health support when asked 'who can I call for emergency in Uganda?'", async () => {
    const response = await generateDawaGPTResponse(
      "who can I call for emergency in Uganda?",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("0800 101 999");
    expect(response.text).toContain("National Drug Authority");
    expect(response.text).toContain("Mental Health Support");
    expect(response.text).not.toContain("112");
    expect(response.text).not.toContain("999 (Landline)");
    expect(response.text).not.toContain("or 999");
    expect(response.text).not.toContain("National Medical Emergency & Ambulance");
  });

  it("provides NDA and Mental Health support when asked 'customer care'", async () => {
    const response = await generateDawaGPTResponse(
      "customer care",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("0800 101 999");
    expect(response.text).toContain("National Drug Authority");
    expect(response.text).toContain("Mental Health Support");
    expect(response.text).not.toContain("112");
    expect(response.text).not.toContain("support@dawalens.ug");
    expect(response.text).not.toContain("/settings");
  });

  it("provides verified NDA contact when asked 'NDA hotline'", async () => {
    const response = await generateDawaGPTResponse(
      "what is the NDA hotline in Uganda?",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("0800 101 999");
    expect(response.text).toContain("National Drug Authority");
  });

  it("does NOT trigger contact support for general actions or medication questions", async () => {
    const response = await generateDawaGPTResponse(
      "can you help me log my dose?",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).not.toContain("Support Directory for Uganda");
  });
});
