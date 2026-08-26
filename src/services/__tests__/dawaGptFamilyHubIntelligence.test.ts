import { describe, it, expect } from "vitest";
import { generateDawaGPTResponse } from "../aiAssistantService";
import { Medicine, Reminder, Patient, UserProfile } from "@/contexts/AppContext";

describe("DawaGPT Family Hub & Client Profiles Intelligence", () => {
  const hostProfile: UserProfile = {
    id: "user-host-1",
    name: "Dr. Mukasa",
    dateOfBirth: "1985-04-12",
    gender: "male",
    isProfessional: true,
  };

  const mamaPatient: Patient = {
    id: "patient-mama-101",
    name: "Sarah Nalule",
    relation: "Mother",
    type: "family",
    age: 62,
    gender: "female",
    conditions: ["Hypertension", "Type 2 Diabetes"],
    allergies: ["Penicillin", "Sulfa drugs"],
    bloodType: "O+",
    notes: "Requires morning blood pressure check before taking medication.",
    managedBy: "user-host-1",
    createdAt: new Date().toISOString(),
  };

  const clientDavid: Patient = {
    id: "patient-david-202",
    name: "David Ochieng",
    relation: "Client",
    type: "client",
    age: 45,
    gender: "male",
    conditions: ["Asthma"],
    allergies: ["Aspirin"],
    bloodType: "A+",
    notes: "Carry inhaler at all times during travel.",
    managedBy: "user-host-1",
    createdAt: new Date().toISOString(),
  };

  const mamaMeds: Medicine[] = [
    {
      id: "med-amlodipine",
      name: "Amlodipine",
      genericName: "Amlodipine Besylate",
      dosage: "5mg",
      currentQuantity: 30,
      totalQuantity: 30,
      dosagePerDose: 1,
      frequencyPerDay: 1,
      unit: "tablets",
      patientId: "patient-mama-101",
      addedAt: new Date().toISOString(),
    },
    {
      id: "med-metformin",
      name: "Metformin",
      genericName: "Metformin Hydrochloride",
      dosage: "500mg",
      currentQuantity: 60,
      totalQuantity: 60,
      dosagePerDose: 1,
      frequencyPerDay: 2,
      unit: "tablets",
      patientId: "patient-mama-101",
      addedAt: new Date().toISOString(),
    },
  ];

  const mamaReminder: Reminder = {
    id: "rem-mama-amlo",
    medicineId: "med-amlodipine",
    medicineName: "Amlodipine",
    dose: "1 tablet",
    time: "08:00",
    repeatSchedule: "daily",
    enabled: true,
    patientId: "patient-mama-101",
    patientName: "Sarah Nalule",
    createdAt: new Date().toISOString(),
  };

  const davidMeds: Medicine[] = [
    {
      id: "med-ventolin",
      name: "Ventolin",
      genericName: "Salbutamol Inhaler",
      dosage: "100mcg",
      currentQuantity: 200,
      totalQuantity: 200,
      dosagePerDose: 2,
      frequencyPerDay: 1,
      unit: "puffs",
      patientId: "patient-david-202",
      addedAt: new Date().toISOString(),
    },
  ];

  const allMeds = [...mamaMeds, ...davidMeds];
  const allReminders = [mamaReminder];
  const allPatients = [mamaPatient, clientDavid];

  it("lists all Family Hub profiles with relationships and conditions when asked for an overview", async () => {
    const response = await generateDawaGPTResponse(
      "Who is in my Family Hub?",
      null,
      hostProfile,
      allMeds,
      [],
      allReminders,
      allPatients
    );

    expect(response.text).toContain("Sarah Nalule");
    expect(response.text).toContain("Mother");
    expect(response.text).toContain("David Ochieng");
    expect(response.text).toContain("Client");
    expect(response.text).toContain("](/family-hub)");
  });

  it("returns full profile, conditions, allergies, and assigned medications when querying a specific patient by name", async () => {
    const response = await generateDawaGPTResponse(
      "What medications is Sarah taking?",
      null,
      hostProfile,
      allMeds,
      [],
      allReminders,
      allPatients
    );

    expect(response.text).toContain("Sarah Nalule");
    expect(response.text).toContain("Amlodipine");
    expect(response.text).toContain("Metformin");
    expect(response.text).toContain("Hypertension");
    expect(response.text).toContain("Penicillin");
    expect(response.text).toContain("08:00");
    expect(response.suggestions).toContain("Add medicine for Sarah Nalule");
  });

  it("accurately reports patient notes, blood type, and assigned inhaler for client David", async () => {
    const response = await generateDawaGPTResponse(
      "Tell me about David Ochieng",
      null,
      hostProfile,
      allMeds,
      [],
      allReminders,
      allPatients
    );

    expect(response.text).toContain("David Ochieng");
    expect(response.text).toContain("Professional Client");
    expect(response.text).toContain("Ventolin");
    expect(response.text).toContain("Asthma");
    expect(response.text).toContain("Aspirin");
    expect(response.text).toContain("Carry inhaler at all times");
  });

  it("gracefully informs user and guides them to add profiles when Family Hub is empty", async () => {
    const response = await generateDawaGPTResponse(
      "Show all my clients",
      null,
      hostProfile,
      [],
      [],
      [],
      []
    );

    expect(response.text).toContain("haven't added any family members or client profiles");
    expect(response.text).toContain("](/family-hub)");
  });
});
