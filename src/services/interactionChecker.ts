import {
  RxCUIResponse,
  InteractionListResponse,
  ParsedInteraction,
} from "../types/interactions";
import { Capacitor } from "@capacitor/core";
import { NativeSearch } from "@/plugins/nativeSearch";
import {
  evaluateClinicalInteraction,
  deduplicateMedicationList,
  isSameDrugSubstance,
  resolveCanonicalDrug,
  CANONICAL_DRUGS,
} from "./clinicalInteractionsData";
import { detectDuplicateTherapies } from "./therapeuticDuplicationService";
import type { Medicine } from "../contexts/AppContext";

const NLM_API_BASE = "https://rxnav.nlm.nih.gov/REST";

// Well-known RxCUIs mapped to canonical drug names for fast local resolution
const RXCUI_TO_NAME: Record<string, string> = {
  "5640": "Ibuprofen",
  "1191": "Aspirin",
  "7052": "Paracetamol",
  "3355": "Diclofenac",
  "7258": "Naproxen",
  "11289": "Warfarin",
  "1364430": "Apixaban",
  "1114195": "Rivaroxaban",
  "32968": "Clopidogrel",
  "29046": "Lisinopril",
  "3827": "Enalapril",
  "35296": "Ramipril",
  "5224": "Losartan",
  "69749": "Valsartan",
  "73494": "Telmisartan",
  "9997": "Spironolactone",
  "8591": "Potassium Chloride",
  "4603": "Furosemide",
  "5487": "Hydrochlorothiazide",
  "4917": "Nitroglycerin",
  "6054": "Isosorbide Mononitrate",
  "36437": "Sildenafil",
  "325852": "Tadalafil",
  "36567": "Simvastatin",
  "83367": "Atorvastatin",
  "301542": "Rosuvastatin",
  "2193": "Clarithromycin",
  "3992": "Erythromycin",
  "2551": "Ciprofloxacin",
  "82122": "Levofloxacin",
  "3640": "Doxycycline",
  "6922": "Metronidazole",
  "10454": "Theophylline",
  "3407": "Digoxin",
  "703": "Amiodarone",
  "11170": "Verapamil",
  "3443": "Diltiazem",
  "1202": "Atenolol",
  "6918": "Metoprolol",
  "20352": "Carvedilol",
  "4492": "Fluoxetine",
  "36341": "Sertraline",
  "32937": "Escitalopram",
  "2556": "Citalopram",
  "704": "Amitriptyline",
  "10689": "Tramadol",
  "6851": "Methotrexate",
  "1256": "Azathioprine",
  "519": "Allopurinol",
  "6448": "Lithium",
  "6809": "Metformin",
  "4815": "Glibenclamide",
  "7646": "Omeprazole",
  "283742": "Esomeprazole",
  "1895": "Calcium",
  "42568": "Ferrous Sulfate",
  "723": "Amoxicillin",
  "17767": "Amlodipine",
  "7417": "Nifedipine",
  "8787": "Propranolol",
  "614391": "Artemether + Lumefantrine (Coartem)",
  "9068": "Quinine",
  "18631": "Azithromycin",
  "10831": "Co-trimoxazole (Septrin)",
  "195085": "Efavirenz",
  "10582": "Levothyroxine",
  "6375": "Levodopa / Carbidopa",
  "190376": "Linezolid",
  "8638": "Prednisolone",
  "20610": "Cetirizine",
  "3322": "Diazepam",
};

/**
 * Fetches the RxNorm Concept Unique Identifier (RxCUI) for a given drug name.
 */
export async function getRxCUI(drugName: string): Promise<string | null> {
  if (!drugName || !drugName.trim()) return null;

  // Check local canonical mapping first (100% offline capable)
  const canonical = resolveCanonicalDrug(drugName);
  if (canonical) {
    for (const [rxcui, name] of Object.entries(RXCUI_TO_NAME)) {
      if (
        name.toLowerCase() === canonical.name.toLowerCase() ||
        name.toLowerCase().includes(canonical.canonicalId.toLowerCase())
      ) {
        return rxcui;
      }
    }
    return `local_${canonical.canonicalId}`;
  }

  // If device is offline, skip network wait
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(
      `${NLM_API_BASE}/rxcui.json?name=${encodeURIComponent(drugName.trim())}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const data: RxCUIResponse = await response.json();
    const ids = data.idGroup?.rxnormId;
    if (ids && ids.length > 0) {
      return ids[0];
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Checks for clinical drug-drug interactions between a list of medications.
 * Supports:
 * - Array of drug name strings (e.g. ["Ibuprofen", "Warfarin"])
 * - Array of RxCUIs (e.g. ["5640", "11289"])
 * - Array of Partial<Medicine> objects (e.g. [{ name: "Brufen" }, { name: "Marevan" }])
 *
 * CRITICAL FEATURES:
 * 1. Automatically neglects duplicates of the same medication (e.g. Ibuprofen and Ibuprofen).
 * 2. Runs the deterministic local clinical interaction engine first (instant, 100% reliable offline).
 * 3. Includes same-class therapeutic duplication hazards (e.g. Ibuprofen + Diclofenac).
 * 4. Fallbacks to NLM API when online and merges unique interaction records.
 */
export async function checkInteractions(
  items: (string | Partial<Medicine>)[]
): Promise<ParsedInteraction[]> {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

interface NormalizedMed {
  name: string;
  genericName?: string;
  rxcui?: string;
}

  // 1. Extract medication representations (name, genericName, rxcui)
  const normalizedMeds = items
    .map((item): NormalizedMed | null => {
      if (typeof item === "string") {
        const clean = item.trim();
        if (!clean) return null;
        // If it's a numeric RxCUI, check if we have a known drug name for it
        if (/^\d+$/.test(clean) && RXCUI_TO_NAME[clean]) {
          return { name: RXCUI_TO_NAME[clean], rxcui: clean };
        }
        return { name: clean, rxcui: /^\d+$/.test(clean) ? clean : undefined };
      } else if (item && typeof item === "object") {
        const name = item.name || item.genericName || "";
        if (!name.trim()) return null;
        return { name: name.trim(), genericName: item.genericName, rxcui: item.rxcui };
      }
      return null;
    })
    .filter((m): m is NormalizedMed => m !== null);

  // 2. DEDUPLICATE: Neglect duplicate entries of the same medication (e.g. Ibuprofen + Ibuprofen)
  const { distinctMedications } = deduplicateMedicationList(normalizedMeds);

  // If after neglecting duplicates there are fewer than 2 distinct drugs, no drug-drug interactions can exist
  if (distinctMedications.length < 2) {
    return [];
  }

  const interactions: ParsedInteraction[] = [];
  const seenPairs = new Set<string>();

  // 3. RUN LOCAL DETERMINISTIC CLINICAL ENGINE (High precision, offline-capable)
  for (let i = 0; i < distinctMedications.length; i++) {
    for (let j = i + 1; j < distinctMedications.length; j++) {
      const medA = distinctMedications[i];
      const medB = distinctMedications[j];

      // Double-check: skip if same drug substance
      if (isSameDrugSubstance(medA.name, medB.name)) {
        continue;
      }

      const result =
        evaluateClinicalInteraction(medA.name, medB.name) ||
        (medA.genericName || medB.genericName
          ? evaluateClinicalInteraction(
              medA.genericName || medA.name,
              medB.genericName || medB.name
            )
          : null);
      if (result) {
        const pairKey = [result.drug1.toLowerCase(), result.drug2.toLowerCase()].sort().join("::");
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          interactions.push(result);
        }
      }
    }
  }

  // 3.5. CHECK LOCAL THERAPEUTIC DUPLICATIONS (Same-class different drugs, e.g., Ibuprofen + Diclofenac, Lisinopril + Losartan)
  try {
    const duplicateTherapies = detectDuplicateTherapies(distinctMedications);
    for (const dup of duplicateTherapies) {
      const def1 = resolveCanonicalDrug(dup.drug1);
      const def2 = resolveCanonicalDrug(dup.drug2);
      const name1 = def1 ? def1.name : dup.drug1;
      const name2 = def2 ? def2.name : dup.drug2;
      const pairKey = [name1.toLowerCase(), name2.toLowerCase()].sort().join("::");

      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        interactions.push({
          drug1: name1,
          drug2: name2,
          severity: "high",
          description: `${dup.warning} Guidance: ${dup.guidance}`,
          clinicalDetails: {
            title: `Therapeutic Duplication (${dup.sharedClass})`,
            mechanism: `Both medications belong to ${dup.sharedClass} and perform the same clinical task (${dup.sharedTask}), creating additive toxicity without extra benefit.`,
            actionAdvice: dup.guidance,
            organRisk: dup.dangers?.[0] || "Additive Class Toxicity",
          },
        });
      }
    }
  } catch {
    // Non-fatal
  }

  // 4. OPTIONAL NLM / EXTERNAL API FALLBACK
  // Only attempt if device is online and distinct items have numeric RxCUIs
  const isOnline = typeof navigator === "undefined" || navigator.onLine;
  const validRxcuis = distinctMedications
    .map((m) => m.rxcui)
    .filter((id): id is string => !!id && /^\d+$/.test(id.trim()));

  if (isOnline && validRxcuis.length >= 2) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      const query = validRxcuis.join("+");
      const response = await fetch(
        `${NLM_API_BASE}/interaction/list.json?rxcuis=${query}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (response.ok) {
        const data: InteractionListResponse = await response.json();
        const groups = data.fullInteractionTypeGroup;
        if (groups) {
          for (const group of groups) {
            for (const type of group.fullInteractionType) {
              for (const pair of type.interactionPair) {
                const concept1 = pair.interactionConcept[0]?.minConceptItem;
                const concept2 = pair.interactionConcept[1]?.minConceptItem;

                if (concept1 && concept2) {
                  // Neglect self-interactions
                  if (isSameDrugSubstance(concept1.name, concept2.name)) {
                    continue;
                  }

                  const pairKey = [concept1.name.toLowerCase(), concept2.name.toLowerCase()].sort().join("::");
                  if (!seenPairs.has(pairKey)) {
                    seenPairs.add(pairKey);
                    interactions.push({
                      drug1: concept1.name,
                      drug2: concept2.name,
                      severity: pair.severity === "high" ? "high" : "warning",
                      description: pair.description,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      clearTimeout(timeoutId);
      // Offline or API endpoint unavailable — local clinical engine already provided findings
    }
  }

  return interactions;
}

/**
 * Compute local offline spelling suggestions from the canonical clinical drug registry.
 */
function getLocalDrugSuggestions(term: string): string[] {
  const q = term.toLowerCase().trim();
  if (!q) return [];

  const matches: string[] = [];
  const seen = new Set<string>();

  for (const drug of Object.values(CANONICAL_DRUGS)) {
    if (drug.name.toLowerCase().includes(q) && !seen.has(drug.name)) {
      seen.add(drug.name);
      matches.push(drug.name);
    }
    for (const syn of drug.synonyms) {
      if (syn.toLowerCase().includes(q)) {
        const display = `${syn.charAt(0).toUpperCase() + syn.slice(1)} (${drug.name})`;
        if (!seen.has(display) && !seen.has(drug.name)) {
          seen.add(drug.name);
          matches.push(drug.name);
        }
      }
    }
  }

  return matches.slice(0, 8);
}

/**
 * Fetches spelling suggestions for a drug name.
 * On native platforms, tries the offline Rust index first (instant, no network).
 * Also checks the local canonical clinical drug database before falling back to NLM API.
 */
export async function getSpellingSuggestions(term: string): Promise<string[]> {
  if (!term || term.trim().length < 2) return [];

  const localSuggestions = getLocalDrugSuggestions(term);

  // On native: try the offline Rust index first (instant, no network)
  if (Capacitor.isNativePlatform()) {
    try {
      const { available } = await NativeSearch.isAvailable();
      if (available) {
        const { results } = await NativeSearch.fuzzySearch({
          query: term,
          limit: 8,
        });
        if (results.length > 0) {
          return Array.from(new Set([...localSuggestions, ...results.map((r) => r.name)])).slice(0, 8);
        }
      }
    } catch {
      // Fall through
    }
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return localSuggestions;
  }

  // Web / fallback: NLM spelling suggestions API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(
      `${NLM_API_BASE}/spellingsuggestions.json?name=${encodeURIComponent(
        term
      )}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!response.ok) return localSuggestions;
    const data = await response.json();
    const remote: string[] = data.rxnormdata?.suggestionGroup?.suggestionList?.suggestion || [];
    return Array.from(new Set([...localSuggestions, ...remote])).slice(0, 8);
  } catch {
    clearTimeout(timeoutId);
    return localSuggestions;
  }
}
