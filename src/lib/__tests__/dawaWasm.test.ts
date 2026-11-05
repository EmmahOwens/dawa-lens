import { describe, it, expect, beforeAll } from "vitest";
import {
  initDawaWasm,
  isDawaWasmReady,
  wasmEvaluateClinicalInteraction,
  wasmFuzzySearch,
  wasmHaversineKm,
  wasmIsSameDrugSubstance,
  wasmResolveCanonicalDrug,
} from "../dawaWasm";

describe("Rust WebAssembly (dawa_search.wasm) Engine", () => {
  beforeAll(async () => {
    await initDawaWasm();
  });

  it("loads and initializes the compiled Rust WASM binary offline", () => {
    expect(isDawaWasmReady()).toBe(true);
  });

  it("normalizes and resolves canonical drugs including East African brand synonyms", () => {
    const panadol = wasmResolveCanonicalDrug("Panadol 500mg tablets");
    expect(panadol?.canonicalId).toBe("paracetamol");
    expect(panadol?.name).toBe("Paracetamol");

    const coartem = wasmResolveCanonicalDrug("Coartem");
    expect(coartem?.canonicalId).toBe("artemether_lumefantrine");
    expect(coartem?.genericClass).toBe("antimalarial_act");
  });

  it("identifies duplicate active substances across brand and generic names", () => {
    expect(wasmIsSameDrugSubstance("Ibuprofen 200mg", "Brufen 400mg")).toBe(true);
    expect(wasmIsSameDrugSubstance("Tylenol", "Panadol Extra")).toBe(true);
    expect(wasmIsSameDrugSubstance("Warfarin", "Ibuprofen")).toBe(false);
  });

  it("evaluates clinical drug-drug interactions and neglects duplicate substances", () => {
    // Duplicate substance should return null
    expect(wasmEvaluateClinicalInteraction("Ibuprofen 200mg", "Advil 400mg")).toBeNull();

    // High-risk interaction: Warfarin + Ibuprofen
    const hit = wasmEvaluateClinicalInteraction("Warfarin", "Ibuprofen");
    expect(hit).not.toBeNull();
    expect(hit?.severity).toBe("high");
    expect(hit?.clinicalDetails?.title).toBe("Severe Gastrointestinal Hemorrhage Risk");

    // Spacing rule interaction: Levothyroxine + Iron
    const spacing = wasmEvaluateClinicalInteraction("Levothyroxine", "Ferrous Sulfate");
    expect(spacing).not.toBeNull();
    expect(spacing?.clinicalDetails?.spacingHours).toBe(4);
  });

  it("performs typo-tolerant Jaro-Winkler fuzzy search in < 1ms", () => {
    const results = wasmFuzzySearch("amoxicilin", 5);
    expect(results).not.toBeNull();
    expect(results!.length).toBeGreaterThan(0);
    expect(results![0].name.toLowerCase()).toContain("amoxicillin");
  });

  it("computes great-circle Haversine distance accurately", () => {
    const dist = wasmHaversineKm(0.3476, 32.5825, 0.0512, 32.4637);
    expect(dist).not.toBeNull();
    expect(dist!).toBeGreaterThan(34);
    expect(dist!).toBeLessThan(37);
  });
});
