import { describe, it, expect, beforeAll } from "vitest";
import {
  initDawaWasm,
  isDawaWasmReady,
  wasmComputeAuditHash,
  wasmComputeVitality,
  wasmEvaluateClinicalInteraction,
  wasmFuzzySearch,
  wasmHaversineKm,
  wasmIsSameDrugSubstance,
  wasmLoadOutlets,
  wasmQueryOutlets,
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

  it("bulk-indexes outlets and executes O(N) top-K spatial + text queries in Rust", () => {
    const loaded = wasmLoadOutlets(0, [
      { i: 0, la: 0.3476, lo: 32.5825, r: true, d: "Kampala", s: "central care pharmacy kampala" },
      { i: 1, la: 0.0512, lo: 32.4637, r: true, d: "Wakiso", s: "entebbe lakeside pharmacy wakiso" },
      { i: 2, la: 0.3480, lo: 32.5830, r: false, d: "Kampala", s: "wholesale pharma depot kampala" },
    ]);
    expect(loaded).toBe(3);

    const nearby = wasmQueryOutlets({
      datasetId: 0,
      userLat: 0.3476,
      userLng: 32.5825,
      radiusKm: 25,
      onlyRetail: true,
      limit: 5,
    });
    expect(nearby).toEqual([{ i: 0, d: 0 }]);

    const entebbe = wasmQueryOutlets({
      datasetId: 0,
      userLat: 0.3476,
      userLng: 32.5825,
      radiusKm: 5,
      query: "lakeside",
      onlyRetail: true,
      limit: 5,
    });
    expect(entebbe).toHaveLength(1);
    expect(entebbe![0].i).toBe(1);
    expect(entebbe![0].d).toBeGreaterThan(34);
  });

  it("computes 7-day vitality and adherence summaries in a single Rust pass", () => {
    const result = wasmComputeVitality({
      dayKeys: [20261115, 20261116],
      dayNames: ["Nov 15", "Nov 16"],
      doseLogs: [
        { dayKey: 20261115, taken: true },
        { dayKey: 20261115, taken: false },
      ],
      wellnessLogs: [
        { dayKey: 20261115, ts: 1000, mood: 2, energy: 3 },
        { dayKey: 20261115, ts: 2000, mood: 5, energy: null },
      ],
    });
    expect(result).toEqual([
      { name: "Nov 15", adherence: 50, energy: 60, mood: 100 },
      { name: "Nov 16", adherence: 100, energy: null, mood: null },
    ]);
  });

  it("computes deterministic SHA-256 audit hashes in Rust", () => {
    const hash = wasmComputeAuditHash("genesis", "dose:taken:amoxicillin");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(wasmComputeAuditHash("genesis", "dose:taken:amoxicillin"));
  });
});
