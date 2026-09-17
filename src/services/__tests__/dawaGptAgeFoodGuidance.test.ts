import { describe, it, expect } from "vitest";
import { generateDawaGPTResponse } from "../aiAssistantService";
import { Medicine, Patient, UserProfile } from "@/contexts/AppContext";

describe("DawaGPT Age-Aware Food, Chewables & Drinks Guidance", () => {
  const hostUser: UserProfile = {
    id: "user-1",
    name: "Amina Namubiru",
    dateOfBirth: "1994-06-15",
    gender: "female",
  };

  const childPatient: Patient = {
    id: "pat-child-1",
    name: "Timothy Mukasa",
    age: 4,
    gender: "male",
    relation: "Son",
    type: "family",
    managedBy: hostUser.id,
    createdAt: new Date().toISOString(),
  };

  const seniorPatient: Patient = {
    id: "pat-senior-1",
    name: "Jajja Nalule",
    age: 72,
    gender: "female",
    relation: "Grandmother",
    type: "family",
    managedBy: hostUser.id,
    createdAt: new Date().toISOString(),
  };

  const amoxicillin: Medicine = {
    id: "med-amox",
    name: "Amoxicillin",
    dosage: "250mg",
    dosagePerDose: 1,
    frequencyPerDay: 3,
    currentQuantity: 30,
    totalQuantity: 30,
    unit: "capsules",
    addedAt: new Date().toISOString(),
  };

  const coartem: Medicine = {
    id: "med-coartem",
    name: "Coartem",
    genericName: "Artemether / Lumefantrine",
    dosage: "20/120mg",
    dosagePerDose: 4,
    frequencyPerDay: 2,
    currentQuantity: 24,
    totalQuantity: 24,
    unit: "tablets",
    addedAt: new Date().toISOString(),
  };

  const lisinopril: Medicine = {
    id: "med-lisinopril",
    name: "Lisinopril",
    dosage: "10mg",
    dosagePerDose: 1,
    frequencyPerDay: 1,
    currentQuantity: 30,
    totalQuantity: 30,
    unit: "tablets",
    addedAt: new Date().toISOString(),
  };

  it("suggests chewables, soft food vehicles, and warns against infant honey for a 4-year-old child", async () => {
    const res = await generateDawaGPTResponse(
      "What chewables or food can a 4 year old take with Amoxicillin?",
      amoxicillin,
      hostUser,
      [amoxicillin],
      [],
      [],
      []
    );

    expect(res.text).toContain("Chewable & Liquid Alternatives");
    expect(res.text).toContain("applesauce");
    expect(res.text).toContain("Bushera");
    expect(res.text).toContain("NEVER give honey");
    expect(res.suggestions).toContain("Chewable medication options");
  });

  it("leverages the active child patient profile age to tailor food and drink advice", async () => {
    const res = await generateDawaGPTResponse(
      "What food or drink should be taken with this medicine?",
      amoxicillin,
      hostUser,
      [amoxicillin],
      [],
      [],
      [childPatient],
      childPatient.id
    );

    expect(res.text).toContain("child (4 yrs)");
    expect(res.text).toContain("applesauce");
    expect(res.text).toContain("Bushera");
    expect(res.text).toContain("chewable");
  });

  it("provides geriatric swallowing advice, soft foods, and upright posture guidance for seniors", async () => {
    const res = await generateDawaGPTResponse(
      "What food goes well with Lisinopril for an elderly person?",
      lisinopril,
      hostUser,
      [lisinopril],
      [],
      [],
      [seniorPatient],
      seniorPatient.id
    );

    expect(res.text).toContain("presbyphagia");
    expect(res.text).toContain("Matooke");
    expect(res.text).toContain("upright for at least 30 minutes");
    expect(res.text).toContain("Potassium");
    expect(res.suggestions).toContain("Safe foods for seniors");
  });

  it("recommends healthy fat absorption foods (local G-nut sauce and global avocado/peanut butter) for Coartem", async () => {
    const res = await generateDawaGPTResponse(
      "What food should I take with Coartem?",
      coartem,
      hostUser,
      [coartem],
      [],
      [],
      []
    );

    expect(res.text).toContain("G-nut sauce");
    expect(res.text).toMatch(/avocado|peanut butter|milk|eggs/i);
    expect(res.text).toContain("Healthy Fats for Absorption");
  });

  it("suggests foods outside the local stored knowledge base such as oatmeal, toast, crackers, and applesauce", async () => {
    const res = await generateDawaGPTResponse(
      "Can you suggest foods outside of local foods to eat with my medicine?",
      amoxicillin,
      hostUser,
      [amoxicillin],
      [],
      [],
      []
    );

    expect(res.text).toMatch(/oatmeal|toast|crackers|applesauce|yogurt/i);
    expect(res.text).toContain("full glass of plain water");
  });
});
