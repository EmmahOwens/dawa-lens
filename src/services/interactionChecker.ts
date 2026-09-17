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
} from "./clinicalInteractionsData";
import { Medicine } from "../contexts/AppContext";

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
};

/**
 * Fetches the RxNorm Concept Unique Identifier (RxCUI) for a given drug name.
 */
export async function getRxCUI(drugName: string): Promise<string | null> {
  if (!drugName || !drugName.trim()) return null;

  // Check local canonical mapping first
  const canonical = resolveCanonicalDrug(drugName);
  if (canonical) {
    for (const [rxcui, name] of Object.entries(RXCUI_TO_NAME)) {
      if (name.toLowerCase() === canonical.name.toLowerCase()) {
        return rxcui;
      }
    }
  }

  try {
    const response = await fetch(
      `${NLM_API_BASE}/rxcui.json?name=${encodeURIComponent(drugName.trim())}`
    );
    if (!response.ok) return null;

    const data: RxCUIResponse = await response.json();
    const ids = data.idGroup?.rxnormId;
    if (ids && ids.length > 0) {
      return ids[0];
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch RxCUI for", drugName, error);
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
 * 3. Fallbacks to NLM API when available and merges unique interaction records.
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

      const result = evaluateClinicalInteraction(medA.name, medB.name);
      if (result) {
        const pairKey = [result.drug1.toLowerCase(), result.drug2.toLowerCase()].sort().join("::");
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          interactions.push(result);
        }
      }
    }
  }

  // 4. OPTIONAL NLM / EXTERNAL API FALLBACK
  // If distinct items have RxCUIs, attempt to fetch supplemental interactions if online
  const validRxcuis = distinctMedications
    .map((m) => m.rxcui)
    .filter((id): id is string => !!id && id.trim() !== "");

  if (validRxcuis.length >= 2) {
    try {
      const query = validRxcuis.join("+");
      const response = await fetch(
        `${NLM_API_BASE}/interaction/list.json?rxcuis=${query}`
      );
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
      // Offline or API endpoint unavailable — local clinical engine already provided findings
    }
  }

  return interactions;
}

/**
 * Fetches spelling suggestions for a drug name.
 * On native platforms, tries the offline Rust index first (instant, no network).
 * Falls back to the NLM RxNorm spelling suggestions API on web or if native is unavailable.
 */
export async function getSpellingSuggestions(term: string): Promise<string[]> {
  if (!term || term.trim().length < 2) return [];

  // On native: try the offline Rust index first (instant, no network)
  if (Capacitor.isNativePlatform()) {
    try {
      const { available } = await NativeSearch.isAvailable();
      if (available) {
        const { results } = await NativeSearch.fuzzySearch({
          query: term,
          limit: 8,
        });
        if (results.length > 0) return results.map((r) => r.name);
      }
    } catch {
      // Fall through to NLM API
    }
  }

  // Web / fallback: NLM spelling suggestions API
  try {
    const response = await fetch(
      `${NLM_API_BASE}/spellingsuggestions.json?name=${encodeURIComponent(
        term
      )}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.rxnormdata?.suggestionGroup?.suggestionList?.suggestion || [];
  } catch (error) {
    console.error("Failed to fetch spelling suggestions for", term, error);
    return [];
  }
}
