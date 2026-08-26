import { describe, it, expect } from "vitest";
import { resolveHonorific, generateDawaGPTResponse } from "../aiAssistantService";
import { UserProfile, Patient } from "@/contexts/AppContext";

describe("DawaGPT Gender-Aware Salutations & Honorifics", () => {
  it("resolves correct honorifics for each gender", () => {
    expect(resolveHonorific("female")).toBe("Nyabo");
    expect(resolveHonorific("male")).toBe("Ssebo");
    expect(resolveHonorific(null)).toBe("");
    expect(resolveHonorific(undefined)).toBe("");
  });

  it("addresses female users respectfully as 'Nyabo' in greetings", async () => {
    const femaleUser: UserProfile = {
      id: "user-female-1",
      name: "Amina Nakato",
      dateOfBirth: "1994-08-15",
      gender: "female",
    };

    const response = await generateDawaGPTResponse(
      "oli otya",
      null,
      femaleUser,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("Nyabo");
    expect(response.text).not.toContain("ssebo");
    expect(response.text).not.toContain("Ssebo");
  });

  it("addresses male users respectfully as 'Ssebo' in greetings", async () => {
    const maleUser: UserProfile = {
      id: "user-male-1",
      name: "Brian Kato",
      dateOfBirth: "1990-02-10",
      gender: "male",
    };

    const response = await generateDawaGPTResponse(
      "oli otya",
      null,
      maleUser,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("Ssebo");
    expect(response.text).not.toContain("nyabo");
    expect(response.text).not.toContain("Nyabo");
  });

  it("uses neutral greeting when gender is not specified without defaulting to Ssebo", async () => {
    const neutralUser: UserProfile = {
      id: "user-neutral-1",
      name: "Alex Mukasa",
      dateOfBirth: "1998-11-20",
      gender: null,
    };

    const response = await generateDawaGPTResponse(
      "oli otya",
      null,
      neutralUser,
      [],
      [],
      [],
      [],
      null
    );

    expect(response.text).toContain("Oli otya! I am doing well.");
    expect(response.text).not.toContain("Ssebo");
    expect(response.text).not.toContain("Nyabo");
  });

  it("respects active patient gender in Family Hub when patient is selected", async () => {
    const maleHost: UserProfile = {
      id: "user-host-1",
      name: "David",
      dateOfBirth: "1980-01-01",
      gender: "male",
    };

    const femalePatient: Patient = {
      id: "patient-grace",
      name: "Grace Nabirye",
      relation: "Mother",
      gender: "female",
      managedBy: "user-host-1",
      createdAt: new Date().toISOString(),
    };

    const response = await generateDawaGPTResponse(
      "oli otya",
      null,
      maleHost,
      [],
      [],
      [],
      [femalePatient],
      "patient-grace"
    );

    expect(response.text).toContain("Nyabo");
    expect(response.text).not.toContain("Ssebo");
  });
});
