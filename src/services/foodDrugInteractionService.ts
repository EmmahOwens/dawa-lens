/**
 * Offline & Deterministic Food-Drug Interaction Engine
 *
 * Parses and evaluates clinical food, beverage, herbal, and lifestyle interactions
 * against the patient's active medications completely offline.
 * Grounded in `src/data/localFoodDrugInteractions.csv` (Ugandan & East African
 * staples alongside global clinical pharmacology rules).
 */

import rawFoodDrugCsv from "@/data/localFoodDrugInteractions.csv?raw";
import { resolveCanonicalDrug } from "./clinicalInteractionsData";
import type { Medicine } from "@/contexts/AppContext";

export interface LocalFoodDrugRow {
  id: string;
  localFood: string;
  localNames: string[];
  drugGeneric: string;
  drugClass: string;
  brandSynonyms: string[];
  severity: "critical" | "high" | "moderate" | "low";
  pharmacologicalMechanism: string;
  adverseClinicalRisk: string;
  spacingHours: number;
  dietaryActionGuidance: string;
}

export interface HolisticInteractionResult {
  factor: string;
  risk: "High" | "Medium" | "Low" | "Safe";
  affectedMedicines: string[];
  mechanism: string;
  explanation: string;
  advice: string;
}

export interface OfflineNutritionalGuidance {
  recommendations: { food: string; reason: string; benefit: string }[];
  warnings: { factor: string; severity: "High" | "Medium"; explanation: string }[];
  timingAdvice: string;
}

export interface OfflineMealCheckResult {
  risk: "High" | "Medium" | "Safe";
  verdict: string;
  explanation: string;
}

/**
 * Parse a single RFC-4180 CSV line with quoted field support.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

let cachedCsvRows: LocalFoodDrugRow[] | null = null;

/**
 * Loads and parses all rows from `localFoodDrugInteractions.csv`.
 */
export function getLocalFoodDrugInteractions(): LocalFoodDrugRow[] {
  if (cachedCsvRows) return cachedCsvRows;

  const lines = (rawFoodDrugCsv || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    cachedCsvRows = [];
    return cachedCsvRows;
  }

  const rows: LocalFoodDrugRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 11) continue;

    const [
      id,
      localFood,
      localNamesRaw,
      drugGeneric,
      drugClass,
      brandSynonymsRaw,
      severityRaw,
      pharmacologicalMechanism,
      adverseClinicalRisk,
      spacingHoursRaw,
      dietaryActionGuidance,
    ] = cols;

    const sevLower = severityRaw.toLowerCase();
    const severity: LocalFoodDrugRow["severity"] =
      sevLower === "critical"
        ? "critical"
        : sevLower === "high"
        ? "high"
        : sevLower === "moderate"
        ? "moderate"
        : "low";

    rows.push({
      id,
      localFood,
      localNames: localNamesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      drugGeneric,
      drugClass,
      brandSynonyms: brandSynonymsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      severity,
      pharmacologicalMechanism,
      adverseClinicalRisk,
      spacingHours: Number.parseInt(spacingHoursRaw, 10) || 0,
      dietaryActionGuidance,
    });
  }

  cachedCsvRows = rows;
  return rows;
}

const normalizeToken = (str?: string | null): string =>
  (str || "")
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(mg|g|mcg|ml|tabs?|caps?|tablets?)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

/**
 * Broad synonym groups for common dietary & lifestyle factors so queries like
 * "Alcohol", "Dairy", "Caffeine", "Grapefruit", "Green Leafy Vegetables", etc.
 * match all relevant CSV rows and pharmacological classes.
 */
const FOOD_FACTOR_ALIASES: Record<string, string[]> = {
  alcohol: ["alcohol", "waragi", "ethanol", "beer", "wine", "spirits", "malwa", "tonto", "kasese", "enguli", "omuramba", "booze", "liquor"],
  grapefruit: ["grapefruit", "bitter orange", "seville orange", "ichenga", "pomelo", "citrus"],
  dairy: ["dairy", "milk", "cheese", "yoghurt", "yogurt", "bongo", "maziwa", "amata", "ekyanzi", "cream", "butter", "calcium"],
  caffeine: ["caffeine", "coffee", "kahawa", "espresso", "black tea", "chai", "tangawizi tea", "energy drink", "cola", "tea"],
  matooke: ["matooke", "amatooke", "ebitooke", "gonja", "plantain", "banana", "green banana", "katogo"],
  gnuts: ["g-nut", "gnut", "groundnut", "peanut", "binyebwa", "ebinyebwa", "kipooli", "odii", "simsim"],
  mukene: ["mukene", "omena", "dagaa", "silver fish", "sardine", "small fish"],
  greens: ["sukuma", "sukuma wiki", "dodo", "nakati", "bugga", "spinach", "kale", "collard", "amaranth", "green leafy", "greens", "enva"],
  porridge: ["bushera", "obushera", "kalo", "millet", "sorghum", "porridge", "uji", "posho"],
  soya: ["soya", "soy", "soybean", "tofu", "soy milk"],
  ginger: ["ginger", "tangawizi"],
  garlic: ["garlic", "katunguluccumu"],
  moringa: ["moringa", "mlonge"],
  aloe: ["aloe", "aloe vera", "ekigagi"],
  khat: ["khat", "mairungi", "miraa"],
  hibiscus: ["hibiscus", "karkadeh", "zobo", "roselle"],
  tamarind: ["tamarind", "mukwaju", "enkoma"],
  chili: ["chili", "chilli", "kamulali", "pilipili", "pepper", "spicy"],
  avocado: ["avocado", "ovacado"],
  okra: ["okra", "bamia", "enkula", "lady's finger"],
  cassava: ["cassava", "muwogo", "mogo", "muhogo"],
  beans: ["beans", "cowpeas", "kunde", "ebihimba", "legumes", "gobo"],
  muchomo: ["muchomo", "nyama choma", "bito", "roasted meat", "charcoal", "grilled meat", "smoked meat"],
  mululuza: ["mululuza", "bitter leaf", "olusia", "labwori"],
  clay: ["clay", "ekinoni", "emumbwa", "odowa", "soil"],
  magadi: ["magadi", "munyu omusula", "rock salt", "soda ash", "potash"],
};

/**
 * Checks whether a user-supplied food/factor string matches a CSV row's food.
 */
function doesFactorMatchRowFood(factor: string, row: LocalFoodDrugRow): boolean {
  const fLower = factor.toLowerCase().trim();
  const fNorm = normalizeToken(factor);
  if (!fNorm) return false;

  const rowFoodLower = row.localFood.toLowerCase();
  const rowFoodNorm = normalizeToken(row.localFood);

  if (rowFoodLower.includes(fLower) || fLower.includes(rowFoodLower)) return true;
  if (rowFoodNorm.includes(fNorm) || fNorm.includes(rowFoodNorm)) return true;

  for (const localName of row.localNames) {
    const lnLower = localName.toLowerCase();
    const lnNorm = normalizeToken(localName);
    if (lnLower && (fLower.includes(lnLower) || lnLower.includes(fLower))) return true;
    if (lnNorm && (fNorm.includes(lnNorm) || lnNorm.includes(fNorm))) return true;
  }

  // Check alias groups
  for (const aliases of Object.values(FOOD_FACTOR_ALIASES)) {
    const factorInGroup = aliases.some(
      (a) => fLower.includes(a) || a.includes(fLower) || fNorm === normalizeToken(a)
    );
    if (factorInGroup) {
      const rowInGroup = aliases.some(
        (a) =>
          rowFoodLower.includes(a) ||
          row.localNames.some((ln) => ln.toLowerCase().includes(a))
      );
      if (rowInGroup) return true;
    }
  }

  return false;
}

/**
 * Maps canonical drug classes (`clinicalInteractionsData.ts`) to CSV drug class keywords.
 */
const CLASS_EQUIVALENTS: Record<string, string[]> = {
  raas_inhibitor: ["ace inhibitor", "angiotensin", "arb"],
  potassium_sparing_diuretic: ["potassium-sparing diuretic", "aldosterone"],
  loop_diuretic: ["loop diuretic"],
  thiazide_diuretic: ["thiazide diuretic"],
  nsaid: ["nsaid", "salicylate"],
  paracetamol: ["analgesic", "antipyretic", "paracetamol"],
  anticoagulant: ["vitamin k antagonist", "anticoagulant"],
  fluoroquinolone: ["fluoroquinolone"],
  tetracycline: ["tetracycline"],
  nitroimidazole: ["nitroimidazole"],
  statin: ["statin", "hmg-coa"],
  biguanide: ["biguanide"],
  sulfonylurea: ["sulfonylurea"],
  iron_supplement: ["iron supplement"],
  xanthine: ["methylxanthine"],
  xanthine_oxidase_inhibitor: ["xanthine oxidase"],
  cardiac_glycoside: ["cardiac glycoside"],
  beta_blocker: ["beta-blocker", "beta-1"],
  tca: ["tricyclic antidepressant"],
};

/**
 * Checks whether a patient's medication matches a CSV row's target drug or class.
 */
export function doesMedicineMatchRowDrug(
  med: { name?: string; genericName?: string } | string,
  row: LocalFoodDrugRow
): boolean {
  const medName = typeof med === "string" ? med : med.name || "";
  const medGeneric = typeof med === "string" ? "" : med.genericName || "";
  const combinedRaw = `${medName} ${medGeneric}`.toLowerCase().trim();
  const medNorm = normalizeToken(medName);
  const genNorm = normalizeToken(medGeneric);

  if (!combinedRaw) return false;

  const rowGenericNorm = normalizeToken(row.drugGeneric);
  if (
    rowGenericNorm &&
    (medNorm.includes(rowGenericNorm) ||
      rowGenericNorm.includes(medNorm) ||
      (genNorm && (genNorm.includes(rowGenericNorm) || rowGenericNorm.includes(genNorm))))
  ) {
    return true;
  }

  for (const syn of row.brandSynonyms) {
    const synNorm = normalizeToken(syn);
    if (!synNorm) continue;
    if (
      medNorm === synNorm ||
      medNorm.includes(synNorm) ||
      (genNorm && (genNorm === synNorm || genNorm.includes(synNorm)))
    ) {
      return true;
    }
  }

  // Resolve canonical drug definition for class-level matching (e.g. Enalapril -> ACE Inhibitor -> matches Lisinopril/ACE Inhibitor rule)
  const canonical = resolveCanonicalDrug(medName) || resolveCanonicalDrug(medGeneric);
  if (canonical) {
    const canonicalNorm = normalizeToken(canonical.name);
    if (rowGenericNorm && (canonicalNorm.includes(rowGenericNorm) || rowGenericNorm.includes(canonicalNorm))) {
      return true;
    }

    for (const syn of canonical.synonyms || []) {
      const synNorm = normalizeToken(syn);
      if (synNorm && rowGenericNorm && (synNorm.includes(rowGenericNorm) || rowGenericNorm.includes(synNorm))) {
        return true;
      }
      if (
        synNorm &&
        row.brandSynonyms.some((bs) => {
          const bsNorm = normalizeToken(bs);
          return bsNorm && (bsNorm === synNorm || bsNorm.includes(synNorm) || synNorm.includes(bsNorm));
        })
      ) {
        return true;
      }
    }

    const rowClassLower = row.drugClass.toLowerCase();
    const eqKeywords = CLASS_EQUIVALENTS[canonical.genericClass] || [];
    if (eqKeywords.some((kw) => rowClassLower.includes(kw))) {
      return true;
    }
  }

  return false;
}

/**
 * Supplemental pharmacological rules for common global lifestyle factors
 * (e.g., Alcohol + Sedatives/Antihistamines/NSAIDs, Grapefruit + Amlodipine, Smoking, High-Fat Meals)
 * when not already covered by a specific CSV row.
 */
interface SupplementalFoodRule {
  factorGroup: keyof typeof FOOD_FACTOR_ALIASES | "smoking" | "high_fat";
  keywords: string[];
  matchDrugClasses: string[];
  matchDrugIds: string[];
  risk: "High" | "Medium" | "Low";
  mechanism: string;
  explanation: string;
  advice: string;
}

const SUPPLEMENTAL_FOOD_RULES: SupplementalFoodRule[] = [
  {
    factorGroup: "alcohol",
    keywords: FOOD_FACTOR_ALIASES.alcohol,
    matchDrugClasses: ["nsaid", "anticoagulant", "antiplatelet"],
    matchDrugIds: ["ibuprofen", "diclofenac", "naproxen", "aspirin", "warfarin", "rivaroxaban", "apixaban"],
    risk: "High",
    mechanism: "Synergistic gastric mucosal erosion and impaired coagulation",
    explanation:
      "Combining **alcohol (including Waragi, beer, or spirits)** with NSAID painkillers or blood thinners significantly multiplies the risk of **severe stomach gastritis, ulcers, and gastrointestinal bleeding**.",
    advice:
      "Avoid alcohol while taking anti-inflammatory painkillers or blood thinners. Take NSAIDs with bland food (such as Posho, rice, or Matooke) and a full glass of water.",
  },
  {
    factorGroup: "alcohol",
    keywords: FOOD_FACTOR_ALIASES.alcohol,
    matchDrugClasses: ["ssri", "tca", "opioid_serotonergic", "sedatives", "antihistamines"],
    matchDrugIds: ["amitriptyline", "fluoxetine", "sertraline", "tramadol", "cetirizine"],
    risk: "High",
    mechanism: "Additive central nervous system (CNS) & respiratory depression",
    explanation:
      "Alcohol amplifies the sedative effects of this medication on the central nervous system, causing **extreme drowsiness, dizziness, impaired coordination, and dangerously slowed breathing**.",
    advice:
      "Strictly avoid alcoholic beverages while taking this medication, and do not drive or operate motorcycles (boda-boda) if drowsy.",
  },
  {
    factorGroup: "grapefruit",
    keywords: FOOD_FACTOR_ALIASES.grapefruit,
    matchDrugClasses: ["statin", "non_dhp_ccb", "antiarrhythmic"],
    matchDrugIds: ["amlodipine", "simvastatin", "atorvastatin", "verapamil", "diltiazem", "amiodarone"],
    risk: "High",
    mechanism: "Irreversible intestinal CYP3A4 enzyme inhibition by furanocoumarins",
    explanation:
      "Grapefruit and bitter citrus juices block the intestinal **CYP3A4 enzyme** responsible for breaking down this medication, causing drug levels in your blood to spike dangerously.",
    advice:
      "Avoid grapefruit and bitter orange juice while on this medication. Safe fruit alternatives include sweet oranges, mangoes, passion fruit, or watermelon.",
  },
  {
    factorGroup: "dairy",
    keywords: FOOD_FACTOR_ALIASES.dairy,
    matchDrugClasses: ["fluoroquinolone", "tetracycline", "iron_supplement"],
    matchDrugIds: ["ciprofloxacin", "levofloxacin", "doxycycline", "iron"],
    risk: "Medium",
    mechanism: "Divalent calcium cation (Ca2+) chelation in the gastrointestinal tract",
    explanation:
      "Calcium in milk, yoghurt (*Bongo*), cheese, and dairy products binds directly to the medication molecule in the stomach, forming an insoluble complex that **blocks up to 70% of drug absorption**.",
    advice:
      "Take your medication with plain water at least **2 hours before or 4 hours after** consuming milk, yoghurt, or calcium-rich foods.",
  },
  {
    factorGroup: "caffeine",
    keywords: FOOD_FACTOR_ALIASES.caffeine,
    matchDrugClasses: ["fluoroquinolone", "xanthine", "beta_blocker"],
    matchDrugIds: ["ciprofloxacin", "theophylline", "atenolol", "metoprolol", "propranolol"],
    risk: "Medium",
    mechanism: "CYP1A2 metabolic competition & sympathetic stimulation",
    explanation:
      "Caffeine can either accumulate to toxic levels (when CYP1A2 is inhibited by antibiotics like Ciprofloxacin) or counteract blood-pressure/heart-rate lowering medications, causing **palpitations, jitters, and elevated blood pressure**.",
    advice:
      "Limit strong coffee (*Kahawa*), energy drinks, and concentrated black tea. Space caffeine intake at least **2 to 4 hours** away from your medication dose.",
  },
  {
    factorGroup: "high_fat",
    keywords: ["high-fat", "fatty", "fried", "eshabwe", "g-nut", "gnut", "groundnut", "avocado", "pork"],
    matchDrugClasses: ["antimalarials"],
    matchDrugIds: ["coartem", "artemether", "lumefantrine"],
    risk: "Safe",
    mechanism: "Enhanced lipophilic bile-salt solubilization & intestinal absorption",
    explanation:
      "**Beneficial Food Pairing:** Fat-soluble antimalarials like **Coartem (Artemether/Lumefantrine)** require dietary fat for optimal absorption. Taking it on an empty stomach can reduce absorption by up to 70%.",
    advice:
      "Take your dose **immediately with a meal or drink containing healthy fats** (such as G-nut sauce, avocado, milk, eggs, or porridge) to ensure full malaria parasite clearance.",
  },
];

/**
 * Evaluates a list of requested food / herb / lifestyle factors against the patient's
 * active medications completely offline.
 * Returns a 1-to-1 array of `HolisticInteractionResult` objects matching `InteractionsPage.tsx`.
 */
export function evaluateOfflineHolisticSafety(
  medicines: Array<Partial<Medicine> | string>,
  lifestyleFactors: string[]
): HolisticInteractionResult[] {
  const cleanFactors = Array.from(
    new Set(
      (lifestyleFactors || [])
        .map((f) => (typeof f === "string" ? f.trim() : ""))
        .filter(Boolean)
    )
  );

  if (cleanFactors.length === 0) return [];

  const rows = getLocalFoodDrugInteractions();
  const medList = (medicines || []).filter(Boolean);

  return cleanFactors.map((factor) => {
    const matchingCsvEntries: Array<{ row: LocalFoodDrugRow; matchedMedNames: string[] }> = [];

    for (const row of rows) {
      if (!doesFactorMatchRowFood(factor, row)) continue;

      const matchedMeds: string[] = [];
      for (const med of medList) {
        if (doesMedicineMatchRowDrug(med, row)) {
          const displayName = typeof med === "string" ? med : med.name || med.genericName || row.drugGeneric;
          if (!matchedMeds.includes(displayName)) {
            matchedMeds.push(displayName);
          }
        }
      }

      if (matchedMeds.length > 0) {
        matchingCsvEntries.push({ row, matchedMedNames: matchedMeds });
      }
    }

    if (matchingCsvEntries.length > 0) {
      // Sort so critical/high severity comes first
      const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1 };
      matchingCsvEntries.sort(
        (a, b) => severityOrder[b.row.severity] - severityOrder[a.row.severity]
      );

      const top = matchingCsvEntries[0].row;
      const allAffected = Array.from(
        new Set(matchingCsvEntries.flatMap((e) => e.matchedMedNames))
      );

      const risk: HolisticInteractionResult["risk"] =
        top.severity === "critical" || top.severity === "high"
          ? "High"
          : top.severity === "moderate"
          ? "Medium"
          : "Low";

      const mechanisms = Array.from(
        new Set(matchingCsvEntries.map((e) => e.row.pharmacologicalMechanism))
      ).join(" ");

      const explanations = matchingCsvEntries
        .map(
          (e) =>
            `**${e.row.localFood}** + **${e.matchedMedNames.join(", ")}**: ${e.row.adverseClinicalRisk}`
        )
        .join("\n\n");

      const advices = matchingCsvEntries
        .map((e) => {
          const spacingBadge =
            e.row.spacingHours > 0
              ? ` *(Space by at least ${e.row.spacingHours} hours)*`
              : "";
          return `${e.row.dietaryActionGuidance}${spacingBadge}`;
        })
        .join("\n\n");

      return {
        factor,
        risk,
        affectedMedicines: allAffected,
        mechanism: mechanisms,
        explanation: explanations,
        advice: advices,
      };
    }

    // Check supplemental pharmacological rules
    const fLower = factor.toLowerCase();
    for (const sup of SUPPLEMENTAL_FOOD_RULES) {
      const factorMatches = sup.keywords.some(
        (kw) => fLower.includes(kw) || kw.includes(fLower)
      );
      if (!factorMatches) continue;

      const matchedMeds: string[] = [];
      for (const med of medList) {
        const medName = typeof med === "string" ? med : med.name || "";
        const medGen = typeof med === "string" ? "" : med.genericName || "";
        const combined = `${medName} ${medGen}`.toLowerCase();
        const canonical = resolveCanonicalDrug(medName) || resolveCanonicalDrug(medGen);

        const idMatch = sup.matchDrugIds.some((id) => combined.includes(id));
        const classMatch =
          canonical && sup.matchDrugClasses.includes(canonical.genericClass);

        if (idMatch || classMatch) {
          const label = medName || medGen || canonical?.name || "Medication";
          if (!matchedMeds.includes(label)) matchedMeds.push(label);
        }
      }

      if (matchedMeds.length > 0) {
        return {
          factor,
          risk: sup.risk,
          affectedMedicines: matchedMeds,
          mechanism: sup.mechanism,
          explanation: sup.explanation,
          advice: sup.advice,
        };
      }
    }

    // No known adverse interaction with current regimen -> Safe
    const medNamesStr =
      medList
        .map((m) => (typeof m === "string" ? m : m.name || m.genericName))
        .filter(Boolean)
        .join(", ") || "your active medications";

    return {
      factor,
      risk: "Safe",
      affectedMedicines: [],
      mechanism: "No known adverse pharmacological interaction",
      explanation: `Based on our offline clinical pharmacology database, **${factor}** has no known adverse interaction with your active regimen (**${medNamesStr}**).`,
      advice: `You may safely consume **${factor}** in normal dietary amounts. Always take your tablets with a full glass of clean water unless instructed otherwise.`,
    };
  });
}

/**
 * Automatically discovers all relevant food & drink interactions from the local CSV
 * for the patient's active medications (used to populate default offline food-drug warnings).
 */
export function getAutomaticFoodInteractionsForMeds(
  medicines: Array<Partial<Medicine> | string>
): HolisticInteractionResult[] {
  const medList = (medicines || []).filter(Boolean);
  if (medList.length === 0) return [];

  const rows = getLocalFoodDrugInteractions();
  const results: HolisticInteractionResult[] = [];
  const seenFoodIds = new Set<string>();

  for (const row of rows) {
    const matchedMeds: string[] = [];
    for (const med of medList) {
      if (doesMedicineMatchRowDrug(med, row)) {
        const displayName =
          typeof med === "string" ? med : med.name || med.genericName || row.drugGeneric;
        if (!matchedMeds.includes(displayName)) {
          matchedMeds.push(displayName);
        }
      }
    }

    if (matchedMeds.length > 0 && !seenFoodIds.has(row.id)) {
      seenFoodIds.add(row.id);
      const risk: HolisticInteractionResult["risk"] =
        row.severity === "critical" || row.severity === "high"
          ? "High"
          : row.severity === "moderate"
          ? "Medium"
          : "Low";

      const spacingNote =
        row.spacingHours > 0
          ? ` (Space by at least ${row.spacingHours} hours)`
          : "";

      results.push({
        factor: row.localFood,
        risk,
        affectedMedicines: matchedMeds,
        mechanism: row.pharmacologicalMechanism,
        explanation: `**${row.localFood}** (*${row.localNames.join(", ")}*) interacts with **${matchedMeds.join(", ")}**: ${row.adverseClinicalRisk}`,
        advice: `${row.dietaryActionGuidance}${spacingNote}`,
      });
    }
  }

  // Also include supplemental food rules for medications not already covered for that factor group
  const factorDisplayLabels: Record<SupplementalFoodRule["factorGroup"], string> = {
    alcohol: "Alcohol & Spirits (Waragi / Beer)",
    grapefruit: "Grapefruit & Bitter Citrus Juice",
    dairy: "Milk, Yoghurt (Bongo) & Dairy",
    caffeine: "Coffee (Kahawa) & Caffeinated Drinks",
    high_fat: "High-Fat Meals (G-Nut Sauce / Avocado / Milk)",
    greens: "Leafy Greens (Sukuma Wiki / Dodo)",
    banana: "Matooke & Highland Bananas",
    tea: "Black Tea (Chai)",
    porridge: "Fermented Porridge (Bushera)",
    fish: "Silverfish (Mukene)",
    garlic: "Garlic (Katunguluccumu)",
    ginger: "Fresh Ginger (Tangawizi)",
    iron: "Iron & Mineral Supplements",
    moringa: "Moringa Leaf Powder",
    tamarind: "Tamarind (Mukwaju)",
    aloe: "Aloe Vera (Ekigagi)",
    khat: "Khat (Mairungi)",
    hibiscus: "Hibiscus Tea (Zobo)",
    soya: "Soya Porridge",
    chili: "Hot Chili (Kamulali)",
    gnut: "Groundnut Sauce (Binyebwa)",
    avocado: "Avocado",
    okra: "Okra (Bamia)",
    cassava: "Cassava (Muwogo)",
    beans: "Beans & Cowpeas (Kunde)",
    muchomo: "Charcoal-Roasted Meat (Muchomo)",
    mululuza: "Bitter Leaf (Mululuza)",
    clay: "Clay / Geophagia (Ekinoni)",
    magadi: "Rock Salt (Magadi)",
    smoking: "Tobacco Smoking",
  };

  for (const sup of SUPPLEMENTAL_FOOD_RULES) {
    const matchedMeds: string[] = [];
    for (const med of medList) {
      const medName = typeof med === "string" ? med : med.name || "";
      const medGen = typeof med === "string" ? "" : med.genericName || "";
      const combined = `${medName} ${medGen}`.toLowerCase();
      const canonical = resolveCanonicalDrug(medName) || resolveCanonicalDrug(medGen);

      const idMatch = sup.matchDrugIds.some((id) => combined.includes(id));
      const classMatch =
        canonical && sup.matchDrugClasses.includes(canonical.genericClass);

      if (idMatch || classMatch) {
        const label = medName || medGen || canonical?.name || "Medication";
        if (!matchedMeds.includes(label)) matchedMeds.push(label);
      }
    }

    if (matchedMeds.length > 0) {
      const displayFactor = factorDisplayLabels[sup.factorGroup] || sup.factorGroup;
      const alreadyHasSameFactorAndMed = results.some(
        (r) =>
          r.factor.toLowerCase().includes(sup.factorGroup) &&
          r.affectedMedicines.some((m) => matchedMeds.includes(m))
      );
      if (!alreadyHasSameFactorAndMed) {
        results.push({
          factor: displayFactor,
          risk: sup.risk,
          affectedMedicines: matchedMeds,
          mechanism: sup.mechanism,
          explanation: sup.explanation,
          advice: sup.advice,
        });
      }
    }
  }

  // Sort High risk first
  const riskOrder = { High: 3, Medium: 2, Low: 1, Safe: 0 };
  results.sort((a, b) => riskOrder[b.risk] - riskOrder[a.risk]);

  return results;
}

/**
 * Generates comprehensive offline Nutritional Guidance for `WellnessPage.tsx`
 * when the device is offline or the AI API is unreachable.
 */
export function generateOfflineNutritionalGuidance(
  medicines: Partial<Medicine>[]
): OfflineNutritionalGuidance {
  const autoInteractions = getAutomaticFoodInteractionsForMeds(medicines);

  const warnings: OfflineNutritionalGuidance["warnings"] = autoInteractions
    .slice(0, 5)
    .map((item) => ({
      factor: item.factor,
      severity: item.risk === "High" ? "High" : "Medium",
      explanation: `* **Affected Medication(s)**: **${item.affectedMedicines.join(", ")}**\n* **Clinical Risk**: ${item.explanation}\n* **Guidance**: ${item.advice}`,
    }));

  // If no specific CSV interaction matched, provide general safe medication-diet warnings
  if (warnings.length === 0 && medicines.length > 0) {
    const medNames = medicines.map((m) => `**${m.name}**`).join(", ");
    warnings.push({
      factor: "Alcohol & Local Spirits (Waragi)",
      severity: "High",
      explanation: `* Avoid consuming alcohol alongside ${medNames} to prevent liver strain, gastric irritation, and altered drug metabolism.`,
    });
  }

  const recommendations: OfflineNutritionalGuidance["recommendations"] = [
    {
      food: "Steamed Matooke, Posho, or Oatmeal",
      reason:
        "Provides a gentle complex-carbohydrate cushion that protects the gastric mucosa when taking oral tablets.",
      benefit: "Stomach Lining Protection & Steady Energy",
    },
    {
      food: "G-Nut Sauce, Avocado, or Eggs",
      reason:
        "Healthy dietary lipids significantly improve the intestinal absorption of fat-soluble medications (such as Coartem / Artemether-Lumefantrine and fat-soluble vitamins).",
      benefit: "Enhanced Bioavailability",
    },
    {
      food: "Warm Bushera or Plain Water (250 mL+)",
      reason:
        "Taking tablets upright with a full glass of clean water prevents esophageal irritation and supports kidney clearance.",
      benefit: "Optimal Dissolution & Hydration",
    },
  ];

  const timingLines = medicines.slice(0, 6).map((m, idx) => {
    const name = m.name || m.genericName || "Medication";
    const lower = `${name} ${m.genericName || ""}`.toLowerCase();
    if (/omeprazole|esomeprazole|pantoprazole|lansoprazole/.test(lower)) {
      return `${idx + 1}. **${name}**: Take **30 to 60 minutes before** your first meal of the day for maximum acid suppression.`;
    }
    if (/ibuprofen|diclofenac|naproxen|aspirin|metformin|prednisolone|augmentin/.test(lower)) {
      return `${idx + 1}. **${name}**: Take **with or immediately after food** (e.g., Posho, Matooke, or toast) to prevent stomach upset.`;
    }
    if (/coartem|artemether|lumefantrine/.test(lower)) {
      return `${idx + 1}. **${name}**: Take **with a meal containing healthy fats** (e.g., G-nut sauce, milk, or avocado) to ensure full antimalarial absorption.`;
    }
    if (/ciprofloxacin|doxycycline|tetracycline/.test(lower)) {
      return `${idx + 1}. **${name}**: Take with a full glass of plain water; space **at least 2 hours apart** from milk, yoghurt (*Bongo*), *Mukene*, or iron/calcium supplements.`;
    }
    if (/iron|ferrous/.test(lower)) {
      return `${idx + 1}. **${name}**: Best absorbed on an empty stomach with water or fresh fruit juice; space **2 hours away** from black tea (*Chai*), coffee, or dairy.`;
    }
    return `${idx + 1}. **${name}**: Take at your scheduled time with a full glass of clean water.`;
  });

  return {
    recommendations,
    warnings,
    timingAdvice:
      timingLines.join("\n") ||
      "1. Take all scheduled medications with a full glass of clean water unless directed otherwise.",
  };
}

/**
 * Evaluates a free-text meal description (e.g. "Matooke with G-nut sauce and Chai tea")
 * against the patient's active medications offline for `WellnessPage.tsx` Plate Analysis.
 */
export function evaluateOfflineMealSafety(
  medicines: Partial<Medicine>[],
  mealDescription: string
): OfflineMealCheckResult {
  const cleanMeal = (mealDescription || "").trim();
  if (!cleanMeal || !medicines || medicines.length === 0) {
    return {
      risk: "Safe",
      verdict: "Compatible Meal",
      explanation: "No active medication conflicts detected with this meal.",
    };
  }

  // Split meal into candidate tokens / phrases and also test against all CSV rows directly
  const rows = getLocalFoodDrugInteractions();
  const matchedInteractions: HolisticInteractionResult[] = [];

  for (const row of rows) {
    if (!doesFactorMatchRowFood(cleanMeal, row)) continue;
    const matchedMeds: string[] = [];
    for (const med of medicines) {
      if (doesMedicineMatchRowDrug(med, row)) {
        const displayName = med.name || med.genericName || row.drugGeneric;
        if (!matchedMeds.includes(displayName)) matchedMeds.push(displayName);
      }
    }
    if (matchedMeds.length > 0) {
      matchedInteractions.push({
        factor: row.localFood,
        risk:
          row.severity === "critical" || row.severity === "high"
            ? "High"
            : row.severity === "moderate"
            ? "Medium"
            : "Low",
        affectedMedicines: matchedMeds,
        mechanism: row.pharmacologicalMechanism,
        explanation: `**${row.localFood}** + **${matchedMeds.join(", ")}**: ${row.adverseClinicalRisk}`,
        advice: row.dietaryActionGuidance,
      });
    }
  }

  // Also check supplemental rules against the meal description
  const HolisticFromMeal = evaluateOfflineHolisticSafety(medicines, [cleanMeal]);
  for (const item of HolisticFromMeal) {
    if (
      item.risk !== "Safe" &&
      !matchedInteractions.some((m) => m.mechanism === item.mechanism)
    ) {
      matchedInteractions.push(item);
    }
  }

  if (matchedInteractions.length === 0) {
    const medNames = medicines
      .map((m) => m.name || m.genericName)
      .filter(Boolean)
      .join(", ");
    return {
      risk: "Safe",
      verdict: `**Safe & Compatible** with your active medications (${medNames}).`,
      explanation: `No adverse food-drug interactions were found between **"${cleanMeal}"** and your regimen in our clinical database. Enjoy your meal and stay well-hydrated!`,
    };
  }

  const hasHigh = matchedInteractions.some((i) => i.risk === "High");
  const topRisk: OfflineMealCheckResult["risk"] = hasHigh ? "High" : "Medium";
  const affectedList = Array.from(
    new Set(matchedInteractions.flatMap((i) => i.affectedMedicines))
  ).join(", ");

  const verdict = hasHigh
    ? `⚠️ **High-Risk Food-Drug Interaction Detected** with **${affectedList}**`
    : `⚡ **Moderate Timing / Absorption Caution** with **${affectedList}**`;

  const explanation = matchedInteractions
    .map(
      (i) =>
        `• ${i.explanation}\n  *Clinical Guidance*: ${i.advice}`
    )
    .join("\n\n");

  return {
    risk: topRisk,
    verdict,
    explanation,
  };
}
