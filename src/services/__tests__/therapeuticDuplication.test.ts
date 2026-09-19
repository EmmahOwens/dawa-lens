import { describe, it, expect } from "vitest";
import {
  findLocalTherapeuticClass,
  detectDuplicateTherapies,
  isSameTaskOrDuplicateQuery,
  extractDrugsFromQuery
} from "../therapeuticDuplicationService";
import { generateDawaGPTResponse } from "../aiAssistantService";
import { Medicine, UserProfile } from "../../contexts/AppContext";

describe("therapeuticDuplicationService (Client)", () => {
  it("maps brand and generic drug names to their correct therapeutic class", () => {
    expect(findLocalTherapeuticClass("Panadol")?.id).toBe("paracetamol");
    expect(findLocalTherapeuticClass("Flucold")?.id).toBe("paracetamol");
    expect(findLocalTherapeuticClass("Brufen")?.id).toBe("nsaid");
    expect(findLocalTherapeuticClass("Voltaren")?.id).toBe("nsaid");
    expect(findLocalTherapeuticClass("K-Diclo")?.id).toBe("nsaid");
    expect(findLocalTherapeuticClass("Lisinopril")?.id).toBe("dual_raas");
    expect(findLocalTherapeuticClass("Losartan")?.id).toBe("dual_raas");
    expect(findLocalTherapeuticClass("Omeprazole")?.id).toBe("ppi");
    expect(findLocalTherapeuticClass("Cetirizine")?.id).toBe("antihistamines");
  });

  it("detects duplicate NSAID and Paracetamol therapies in active cabinets", () => {
    const cabinetWithNsaids: Partial<Medicine>[] = [
      { name: "Brufen", dosage: "400mg" },
      { name: "Voltaren", dosage: "50mg" },
    ];
    const nsaidDups = detectDuplicateTherapies(cabinetWithNsaids);
    expect(nsaidDups).toHaveLength(1);
    expect(nsaidDups[0].sharedClass).toContain("NSAID");
    expect(nsaidDups[0].warning).toContain("stomach ulcers");

    const cabinetWithParacetamol: Partial<Medicine>[] = [
      { name: "Panadol", dosage: "500mg" },
      { name: "Flucold", dosage: "1 tab" },
    ];
    const paraDups = detectDuplicateTherapies(cabinetWithParacetamol);
    expect(paraDups).toHaveLength(1);
    expect(paraDups[0].sharedClass).toContain("Paracetamol");
    expect(paraDups[0].warning).toContain("liver");

    const nonDuplicateCabinet: Partial<Medicine>[] = [
      { name: "Panadol", dosage: "500mg" },
      { name: "Amoxicillin", dosage: "500mg" },
    ];
    expect(detectDuplicateTherapies(nonDuplicateCabinet)).toHaveLength(0);
  });

  it("detects same-task natural language queries and extracts medication names", () => {
    expect(isSameTaskOrDuplicateQuery("Can I take two medications that perform the same task?")).toBe(true);
    expect(isSameTaskOrDuplicateQuery("Is it safe to take ibuprofen and diclofenac together?")).toBe(true);
    expect(isSameTaskOrDuplicateQuery("What happens if I take two painkillers?")).toBe(true);
    expect(isSameTaskOrDuplicateQuery("When should I take my morning pill?")).toBe(false);

    const extracted = extractDrugsFromQuery("Can I take Panadol and Flucold together?", []);
    expect(extracted).toContain("Panadol");
    expect(extracted).toContain("Flucold");
  });

  it("extracts clinical duplicate therapy metadata with organ hazard details and guidance", () => {
    const cabinetWithNsaids: Partial<Medicine>[] = [
      { name: "Brufen", dosage: "400mg" },
      { name: "Voltaren", dosage: "50mg" },
    ];
    const dups = detectDuplicateTherapies(cabinetWithNsaids);
    expect(dups[0].drug1).toBe("Brufen");
    expect(dups[0].drug2).toBe("Voltaren");
    expect(dups[0].dangers.length).toBeGreaterThan(0);
    expect(dups[0].guidance).toContain("Do NOT take two NSAIDs together");
  });
});

describe("DawaGPT Same-Task Interaction Response Generation", () => {
  const mockUser: UserProfile = {
    id: "mock-user-1",
    name: "Nakato",
    gender: "female",
    dateOfBirth: "1998-01-01",
  };

  it("provides comprehensive duplicate therapy guidance when user asks about two same-task medications", async () => {
    const response = await generateDawaGPTResponse(
      "Can I take Brufen and Voltaren together for my headache?",
      null,
      mockUser,
      [
        { id: "m1", name: "Brufen", dosage: "400mg" } as Medicine,
        { id: "m2", name: "Voltaren", dosage: "50mg" } as Medicine,
      ]
    );

    expect(response.text).toContain("Therapeutic Duplication Alert");
    expect(response.text).toContain("Nyabo");
    expect(response.text).toContain("Brufen");
    expect(response.text).toContain("Voltaren");
    expect(response.text).toContain("Ceiling Effect");
    expect(response.text).toContain("/interactions");
    expect(response.text).toContain("/medications");
    expect(response.suggestions).toBeDefined();
    expect(response.source).toBe("NDA");
  });

  it("answers general inquiries about taking more than one medication that performs the same task", async () => {
    const response = await generateDawaGPTResponse(
      "What is the interaction if a user has more than one medication that performs the same task?",
      null,
      mockUser,
      []
    );

    expect(response.text).toContain("Therapeutic Duplication");
    expect(response.text).toContain("Ceiling Effect");
    expect(response.text).toContain("Additive Toxicity");
    expect(response.text).toContain("/interactions");
    expect(response.text).toContain("/medications");
  });
});
