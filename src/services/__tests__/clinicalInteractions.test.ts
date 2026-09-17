import { describe, it, expect } from "vitest";
import {
  evaluateClinicalInteraction,
  isSameDrugSubstance,
  deduplicateMedicationList,
  resolveCanonicalDrug,
} from "../clinicalInteractionsData";
import { checkInteractions } from "../interactionChecker";
import { detectDuplicateTherapies } from "../therapeuticDuplicationService";

describe("Clinical Drug Interactions & Duplicate Neglect Engine", () => {
  describe("Duplicate Neglect & Drug Substance Identity", () => {
    it("recognizes exact duplicate drug names as the same substance", () => {
      expect(isSameDrugSubstance("Ibuprofen", "Ibuprofen")).toBe(true);
      expect(isSameDrugSubstance("Panadol", "Panadol")).toBe(true);
      expect(isSameDrugSubstance("ibuprofen", "IBUPROFEN")).toBe(true);
    });

    it("recognizes dosage variations as the same drug substance", () => {
      expect(isSameDrugSubstance("Ibuprofen 200mg", "Ibuprofen 400mg")).toBe(true);
      expect(isSameDrugSubstance("Panadol 500mg", "Panadol Extra 500mg")).toBe(true);
      expect(isSameDrugSubstance("Lisinopril 10mg", "Lisinopril 20mg tab")).toBe(true);
    });

    it("recognizes brand names of the same generic drug as the same substance", () => {
      expect(isSameDrugSubstance("Brufen", "Ibuprofen")).toBe(true);
      expect(isSameDrugSubstance("Panadol", "Paracetamol")).toBe(true);
      expect(isSameDrugSubstance("Voltaren", "Diclofenac")).toBe(true);
      expect(isSameDrugSubstance("Plavix", "Clopidogrel")).toBe(true);
    });

    it("distinguishes genuinely different drugs", () => {
      expect(isSameDrugSubstance("Ibuprofen", "Paracetamol")).toBe(false);
      expect(isSameDrugSubstance("Ibuprofen", "Warfarin")).toBe(false);
      expect(isSameDrugSubstance("Lisinopril", "Spironolactone")).toBe(false);
      expect(isSameDrugSubstance("Brufen", "Voltaren")).toBe(false);
    });

    it("deduplicates medication lists and counts neglected duplicates", () => {
      const cabinet = [
        { name: "Ibuprofen 200mg" },
        { name: "Ibuprofen 400mg" },
        { name: "Panadol" },
        { name: "Panadol 500mg" },
        { name: "Warfarin" },
      ];

      const { distinctMedications, neglectedDuplicatesCount } = deduplicateMedicationList(cabinet);
      expect(neglectedDuplicatesCount).toBe(2);
      expect(distinctMedications).toHaveLength(3);
      expect(distinctMedications.map(m => m.name)).toEqual([
        "Ibuprofen 200mg",
        "Panadol",
        "Warfarin",
      ]);
    });

    it("therapeuticDuplicationService neglects duplicate entries of the exact same drug", () => {
      const duplicateCabinet = [
        { name: "Ibuprofen", dosage: "200mg" },
        { name: "Ibuprofen", dosage: "400mg" },
      ];

      // Duplicate entries of Ibuprofen must be neglected!
      const dups = detectDuplicateTherapies(duplicateCabinet);
      expect(dups).toHaveLength(0);
    });

    it("therapeuticDuplicationService still detects distinct drugs in the same class", () => {
      const distinctSameClassCabinet = [
        { name: "Brufen", dosage: "400mg" },
        { name: "Voltaren", dosage: "50mg" },
      ];

      const dups = detectDuplicateTherapies(distinctSameClassCabinet);
      expect(dups).toHaveLength(1);
      expect(dups[0].sharedClass).toContain("NSAID");
    });
  });

  describe("Clinical Drug-Drug Interaction Checking", () => {
    it("neglects self-interactions between identical drugs", () => {
      expect(evaluateClinicalInteraction("Ibuprofen", "Ibuprofen")).toBeNull();
      expect(evaluateClinicalInteraction("Ibuprofen 200mg", "Ibuprofen 400mg")).toBeNull();
    });

    it("detects severe interaction between NSAIDs and Anticoagulants (Ibuprofen + Warfarin)", async () => {
      const interactions = await checkInteractions(["Ibuprofen", "Warfarin"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].description).toMatch(/gastrointestinal/i);
      expect(interactions[0].clinicalDetails?.title).toContain("Gastrointestinal");
      expect(interactions[0].clinicalDetails?.organRisk).toContain("Gastrointestinal");
    });

    it("detects severe interaction when using brand synonyms (Brufen + Marevan)", async () => {
      const interactions = await checkInteractions(["Brufen", "Marevan"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].description).toMatch(/gastrointestinal/i);
      expect(interactions[0].clinicalDetails?.title).toContain("Gastrointestinal");
    });

    it("detects fatal hyperkalemia risk between ACE inhibitors and Spironolactone", async () => {
      const interactions = await checkInteractions(["Lisinopril", "Spironolactone"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].clinicalDetails?.title).toContain("Hyperkalemia");
    });

    it("detects absolute contraindication between PDE5 inhibitors and Nitrates (Sildenafil + Nitroglycerin)", async () => {
      const interactions = await checkInteractions(["Sildenafil", "Nitroglycerin"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].clinicalDetails?.title).toContain("Hypotension");
    });

    it("detects Serotonin Syndrome between SSRIs and Tramadol (Fluoxetine + Tramadol)", async () => {
      const interactions = await checkInteractions(["Fluoxetine", "Tramadol"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].description).toContain("Serotonin Syndrome");
    });

    it("detects Methotrexate + NSAID interaction (Methotrexate + Naproxen)", async () => {
      const interactions = await checkInteractions(["Methotrexate", "Naproxen"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].clinicalDetails?.title).toContain("Bone Marrow");
    });

    it("detects Statin + Macrolide rhabdomyolysis hazard (Simvastatin + Clarithromycin)", async () => {
      const interactions = await checkInteractions(["Simvastatin", "Clarithromycin"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].clinicalDetails?.title).toContain("Rhabdomyolysis");
    });

    it("detects Digoxin + Amiodarone toxicity", async () => {
      const interactions = await checkInteractions(["Digoxin", "Amiodarone"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].description).toContain("Digoxin");
    });

    it("detects Ciprofloxacin + Theophylline toxicity", async () => {
      const interactions = await checkInteractions(["Ciprofloxacin", "Theophylline"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("high");
      expect(interactions[0].description).toContain("Theophylline");
    });

    it("detects Clopidogrel + Omeprazole efficacy reduction", async () => {
      const interactions = await checkInteractions(["Clopidogrel", "Omeprazole"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].severity).toBe("warning");
      expect(interactions[0].description).toContain("Clopidogrel");
    });

    it("detects chelation between Ciprofloxacin and Calcium/Antacid", async () => {
      const interactions = await checkInteractions(["Ciprofloxacin", "Calcium Carbonate"]);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].clinicalDetails?.title).toContain("Absorption");
      expect(interactions[0].clinicalDetails?.spacingHours).toBe(2);
    });

    it("returns zero interactions when a user only has duplicate entries of the same drug", async () => {
      const onlyDuplicates = ["Ibuprofen", "Ibuprofen"];
      const interactions = await checkInteractions(onlyDuplicates);
      expect(interactions).toHaveLength(0);
    });

    it("evaluates genuine interactions while neglecting duplicates in a mixed list", async () => {
      const mixedList = [
        "Ibuprofen",
        "Ibuprofen 400mg",
        "Warfarin",
      ];
      const interactions = await checkInteractions(mixedList);
      // Only Ibuprofen <-> Warfarin should be evaluated; duplicate Ibuprofen is neglected!
      expect(interactions).toHaveLength(1);
      expect(interactions[0].drug1).toContain("Ibuprofen");
      expect(interactions[0].drug2).toContain("Warfarin");
    });
  });
});
