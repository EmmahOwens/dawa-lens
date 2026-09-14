import { describe, it, expect } from "vitest";
import { generateDawaGPTResponse } from "../aiAssistantService";
import { UserProfile } from "@/contexts/AppContext";

describe("DawaGPT Uganda Contact Support & Emergency Directory", () => {
  const dummyProfile: UserProfile = {
    id: "user-test",
    name: "Mukasa Ivan",
    dateOfBirth: "1995-05-10",
    gender: "male",
  };

  it("provides Uganda contact support when asked 'contact support'", async () => {
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

    expect(response.text).toContain("Contact Support Directory for Uganda");
    expect(response.text).toContain("112");
    expect(response.text).toContain("999");
    expect(response.text).toContain("0800 100 066");
    expect(response.text).toContain("0800 101 622");
    expect(response.text).toContain("Mulago National Referral Hospital");
    expect(response.text).toContain("support@dawalens.ug");
    expect(response.text).toContain("[manage your emergency contacts in Settings](/settings)");
    expect(response.suggestions).toContain("Call Uganda Emergency (112)");
  });

  it("provides Uganda contact support when asked 'support for Uganda'", async () => {
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

    expect(response.text).toContain("112");
    expect(response.text).toContain("National Drug Authority");
    expect(response.text).toContain("Ministry of Health");
  });

  it("provides emergency contacts when asked 'who can I call for emergency in Uganda?'", async () => {
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

    expect(response.text).toContain("112");
    expect(response.text).toContain("999");
    expect(response.text).toContain("National Medical Emergency & Ambulance");
  });

  it("provides support contact when asked 'customer care'", async () => {
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

    expect(response.text).toContain("112");
    expect(response.text).toContain("support@dawalens.ug");
  });

  it("provides NDA contact when asked 'NDA hotline'", async () => {
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

    expect(response.text).toContain("0800 101 622");
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

    expect(response.text).not.toContain("Contact Support Directory for Uganda");
  });
});
