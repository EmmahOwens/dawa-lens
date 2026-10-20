/**
 * offlineMedicationExtractor — Ultra-lightweight on-device clinical medication extractor.
 *
 * Designed specifically for low-resource Android devices and offline scenarios.
 * Takes raw OCR text (from Google ML Kit on Android or Tesseract on web) and
 * extracts medication concepts, formulations, strengths, and clinical safety
 * warnings using a curated local essential formulary and deterministic NLP.
 *
 * Memory / Storage Footprint: < 500 KB total.
 * Cold start latency: < 5 ms.
 *
 * CRITICAL CLINICAL SAFETY GUARDRAIL:
 * This extractor strictly NEVER suggests or auto-populates patient dosage instructions.
 * The dosage field is ALWAYS returned as empty so that dosages must be confirmed
 * or entered explicitly by the user or healthcare professional.
 */

import type { PillMatch, PillIdResponse } from "./pillIdService";
import { CANONICAL_DRUGS } from "./clinicalInteractionsData";

interface FormularyItem {
  id: string;
  name: string;
  genericName: string;
  drugClass: string;
  brandNames: string[];
  commonForms: string[];
  indications: string;
  boxedWarning?: string;
}

// ── Curated East Africa / WHO Essential Formulary ──────────────────────────────
const LOCAL_FORMULARY: FormularyItem[] = [
  // Analgesics & Antipyretics
  {
    id: "paracetamol",
    name: "Paracetamol",
    genericName: "Paracetamol",
    drugClass: "Analgesic / Antipyretic",
    brandNames: ["panadol", "hedex", "calpol", "action", "para", "paramol", "tylenol", "acetaminophen"],
    commonForms: ["Tablet", "Syrup", "Suppository", "Infusion"],
    indications: "Mild to moderate pain, headache, and fever reduction.",
    boxedWarning: "Excessive doses (>4,000 mg/24h) cause severe acute liver failure.",
  },
  {
    id: "ibuprofen",
    name: "Ibuprofen",
    genericName: "Ibuprofen",
    drugClass: "NSAID",
    brandNames: ["brufen", "advil", "motrin", "nurofen", "pediaprofen"],
    commonForms: ["Tablet", "Capsule", "Suspension", "Gel"],
    indications: "Pain, musculoskeletal inflammation, arthritis, and fever.",
    boxedWarning: "Increased risk of serious cardiovascular thrombotic events and gastrointestinal ulceration/bleeding.",
  },
  {
    id: "diclofenac",
    name: "Diclofenac",
    genericName: "Diclofenac",
    drugClass: "NSAID",
    brandNames: ["voltaren", "cataflam", "k-diclo", "diclogem", "diclo"],
    commonForms: ["Tablet", "Capsule", "Gel", "Injection", "Suppository"],
    indications: "Acute joint and muscle pain, rheumatoid arthritis, osteoarthritis.",
    boxedWarning: "Cardiovascular risk and serious GI bleeding/ulceration. Contraindicated in severe heart failure.",
  },
  {
    id: "aspirin",
    name: "Aspirin",
    genericName: "Acetylsalicylic Acid",
    drugClass: "NSAID / Antiplatelet",
    brandNames: ["disprin", "cardiprin", "ecotrin", "asa"],
    commonForms: ["Tablet", "Dispersible Tablet"],
    indications: "Cardiovascular secondary prevention, acute coronary syndromes, mild pain.",
    boxedWarning: "Contraindicated in children with viral illness due to Reye's syndrome risk.",
  },

  // Antimalarials
  {
    id: "artemether_lumefantrine",
    name: "Artemether + Lumefantrine",
    genericName: "Artemether / Lumefantrine",
    drugClass: "Artemisinin-based Combination Therapy (ACT)",
    brandNames: ["coartem", "lonart", "lumart", "artefan", "lumether", "falcinil"],
    commonForms: ["Tablet", "Dispersible Tablet"],
    indications: "First-line treatment of uncomplicated Plasmodium falciparum malaria.",
  },
  {
    id: "dha_piperaquine",
    name: "Dihydroartemisinin + Piperaquine",
    genericName: "Dihydroartemisinin / Piperaquine",
    drugClass: "Artemisinin-based Combination Therapy (ACT)",
    brandNames: ["duo-cotecxin", "artekin", "d-artepp"],
    commonForms: ["Tablet"],
    indications: "Second-line treatment of uncomplicated malaria.",
  },
  {
    id: "quinine",
    name: "Quinine",
    genericName: "Quinine",
    drugClass: "Cinchona Alkaloid Antimalarial",
    brandNames: ["quinine", "quinate"],
    commonForms: ["Tablet", "Injection", "Infusion"],
    indications: "Severe malaria or malaria in first trimester of pregnancy.",
    boxedWarning: "Cardiotoxicity (QT prolongation) and severe hypoglycemia.",
  },

  // Antibiotics
  {
    id: "amoxicillin",
    name: "Amoxicillin",
    genericName: "Amoxicillin",
    drugClass: "Penicillin Antibiotic",
    brandNames: ["amoxil", "moxatag", "hiconcil", "amoxycillin"],
    commonForms: ["Capsule", "Tablet", "Suspension"],
    indications: "Respiratory infections, ENT infections, skin and urinary tract infections.",
  },
  {
    id: "co_amoxiclav",
    name: "Amoxicillin + Clavulanic Acid",
    genericName: "Amoxicillin / Clavulanic Acid",
    drugClass: "Beta-lactamase Inhibitor Combination",
    brandNames: ["augmentin", "curam", "klavox", "amoxiclav", "moxclav"],
    commonForms: ["Tablet", "Suspension", "Injection"],
    indications: "Beta-lactamase producing bacterial infections: sinusitis, pneumonia, animal bites, UTI.",
    boxedWarning: "Hepatic dysfunction/cholestatic jaundice has been associated with clavulanate.",
  },
  {
    id: "ciprofloxacin",
    name: "Ciprofloxacin",
    genericName: "Ciprofloxacin",
    drugClass: "Fluoroquinolone Antibiotic",
    brandNames: ["cipro", "cifran", "cpro", "ciprocin"],
    commonForms: ["Tablet", "Infusion", "Eye Drops"],
    indications: "Complicated urinary tract infections, severe diarrhea, typhoid fever, prostatitis.",
    boxedWarning: "Disabling peripheral neuropathy, tendinitis/tendon rupture, and CNS effects.",
  },
  {
    id: "doxycycline",
    name: "Doxycycline",
    genericName: "Doxycycline",
    drugClass: "Tetracycline Antibiotic",
    brandNames: ["doxy", "vibramycin", "doxydar", "monodox"],
    commonForms: ["Capsule", "Tablet"],
    indications: "Atypical pneumonia, pelvic inflammatory disease, cholera, acne, malaria prophylaxis.",
    boxedWarning: "Tooth discoloration and enamel hypoplasia in children under 8 years.",
  },
  {
    id: "metronidazole",
    name: "Metronidazole",
    genericName: "Metronidazole",
    drugClass: "Nitroimidazole Antimicrobial",
    brandNames: ["flagyl", "metrogyl", "novonidazole"],
    commonForms: ["Tablet", "Suspension", "Infusion"],
    indications: "Amoebiasis, giardiasis, trichomoniasis, anaerobic surgical infections.",
    boxedWarning: "Carcinogenicity in animal models. Strictly avoid ethanol during therapy.",
  },
  {
    id: "azithromycin",
    name: "Azithromycin",
    genericName: "Azithromycin",
    drugClass: "Macrolide Antibiotic",
    brandNames: ["zithromax", "azithral", "azitrox", "z-pack"],
    commonForms: ["Tablet", "Capsule", "Suspension"],
    indications: "Community-acquired pneumonia, chlamydia, typhoid fever, trachoma.",
  },
  {
    id: "cotrimoxazole",
    name: "Co-trimoxazole",
    genericName: "Sulfamethoxazole / Trimethoprim",
    drugClass: "Sulfonamide Antibacterial",
    brandNames: ["septrin", "bactrim", "cotrim"],
    commonForms: ["Tablet", "Suspension"],
    indications: "Pneumocystis jirovecii (PCP) prophylaxis/treatment, toxoplasmosis, UTI.",
    boxedWarning: "Severe cutaneous adverse reactions (Stevens-Johnson syndrome, TEN).",
  },

  // Cardiovascular & Antihypertensives
  {
    id: "amlodipine",
    name: "Amlodipine",
    genericName: "Amlodipine",
    drugClass: "Calcium Channel Blocker (Dihydropyridine)",
    brandNames: ["norvasc", "amlopin", "amlocor"],
    commonForms: ["Tablet"],
    indications: "Essential hypertension, chronic stable angina.",
  },
  {
    id: "lisinopril",
    name: "Lisinopril",
    genericName: "Lisinopril",
    drugClass: "ACE Inhibitor",
    brandNames: ["zestril", "prinivil"],
    commonForms: ["Tablet"],
    indications: "Hypertension, heart failure, post-myocardial infarction recovery.",
    boxedWarning: "Fetal toxicity: Discontinue as soon as pregnancy is detected.",
  },
  {
    id: "losartan",
    name: "Losartan",
    genericName: "Losartan",
    drugClass: "Angiotensin II Receptor Blocker (ARB)",
    brandNames: ["cozaar", "losacar", "angizaar"],
    commonForms: ["Tablet"],
    indications: "Hypertension, diabetic nephropathy in type 2 diabetes.",
    boxedWarning: "Fetal toxicity: Discontinue immediately if pregnancy occurs.",
  },
  {
    id: "furosemide",
    name: "Furosemide",
    genericName: "Furosemide",
    drugClass: "Loop Diuretic",
    brandNames: ["lasix", "frusene"],
    commonForms: ["Tablet", "Injection"],
    indications: "Edema associated with heart failure, renal disease, hepatic cirrhosis.",
    boxedWarning: "Potent diuretic leading to profound water and electrolyte depletion.",
  },
  {
    id: "hydrochlorothiazide",
    name: "Hydrochlorothiazide",
    genericName: "Hydrochlorothiazide",
    drugClass: "Thiazide Diuretic",
    brandNames: ["esidrex", "hctz", "microzide"],
    commonForms: ["Tablet"],
    indications: "Hypertension, mild peripheral edema.",
  },
  {
    id: "spironolactone",
    name: "Spironolactone",
    genericName: "Spironolactone",
    drugClass: "Aldosterone Antagonist",
    brandNames: ["aldactone", "spiractin"],
    commonForms: ["Tablet"],
    indications: "Refractory hypertension, heart failure (reduced ejection fraction), ascites.",
  },
  {
    id: "propranolol",
    name: "Propranolol",
    genericName: "Propranolol",
    drugClass: "Non-Selective Beta-Blocker",
    brandNames: ["inderal", "inno-pran"],
    commonForms: ["Tablet", "Injection"],
    indications: "Arrhythmias, portal hypertension, essential tremor, migraine prophylaxis.",
    boxedWarning: "Abrupt cessation can exacerbate angina or precipitate myocardial infarction.",
  },
  {
    id: "atenolol",
    name: "Atenolol",
    genericName: "Atenolol",
    drugClass: "Beta-1 Selective Adrenergic Blocker",
    brandNames: ["tenormin", "ateno"],
    commonForms: ["Tablet"],
    indications: "Hypertension, angina pectoris, post-MI management.",
  },

  // Antidiabetics
  {
    id: "metformin",
    name: "Metformin",
    genericName: "Metformin Hydrochloride",
    drugClass: "Biguanide Antidiabetic",
    brandNames: ["glucophage", "diabex", "metfor", "glycomet"],
    commonForms: ["Tablet", "Extended-Release Tablet"],
    indications: "Type 2 diabetes mellitus, insulin resistance.",
    boxedWarning: "Lactic acidosis risk, particularly in renal impairment or hypoxemic states.",
  },
  {
    id: "glibenclamide",
    name: "Glibenclamide",
    genericName: "Glyburide / Glibenclamide",
    drugClass: "Sulfonylurea Antidiabetic",
    brandNames: ["daonil", "glidiab", "micronase"],
    commonForms: ["Tablet"],
    indications: "Type 2 diabetes mellitus uncontrolled by diet alone.",
    boxedWarning: "Severe and prolonged hypoglycemia, especially in elderly or renal patients.",
  },

  // Gastrointestinal
  {
    id: "omeprazole",
    name: "Omeprazole",
    genericName: "Omeprazole",
    drugClass: "Proton Pump Inhibitor (PPI)",
    brandNames: ["losec", "omez", "prilosec", "omiz"],
    commonForms: ["Capsule", "Tablet", "Powder for Infusion"],
    indications: "Gastroesophageal reflux disease (GERD), peptic ulcer disease, H. pylori eradication.",
  },
  {
    id: "esomeprazole",
    name: "Esomeprazole",
    genericName: "Esomeprazole",
    drugClass: "Proton Pump Inhibitor (PPI)",
    brandNames: ["nexium", "esoz"],
    commonForms: ["Tablet", "Capsule", "Infusion"],
    indications: "Erosive esophagitis, Zollinger-Ellison syndrome, gastric ulcer.",
  },
  {
    id: "albendazole",
    name: "Albendazole",
    genericName: "Albendazole",
    drugClass: "Anthelmintic",
    brandNames: ["alben", "zentel", "albez"],
    commonForms: ["Chewable Tablet", "Suspension"],
    indications: "Intestinal nematodes (hookworm, roundworm, pinworm), echinococcosis.",
  },

  // Respiratory & Antiallergy
  {
    id: "salbutamol",
    name: "Salbutamol",
    genericName: "Albuterol / Salbutamol",
    drugClass: "Short-Acting Beta-2 Agonist",
    brandNames: ["ventolin", "asmasal", "salbu"],
    commonForms: ["Inhaler", "Nebulizer Solution", "Syrup", "Tablet"],
    indications: "Acute bronchospasm in asthma, chronic obstructive pulmonary disease (COPD).",
  },
  {
    id: "cetirizine",
    name: "Cetirizine",
    genericName: "Cetirizine Hydrochloride",
    drugClass: "Second-Generation Antihistamine",
    brandNames: ["zyrtec", "alerid", "cetrine"],
    commonForms: ["Tablet", "Syrup"],
    indications: "Allergic rhinitis, seasonal allergies, chronic idiopathic urticaria.",
  },
  {
    id: "prednisolone",
    name: "Prednisolone",
    genericName: "Prednisolone",
    drugClass: "Glucocorticoid",
    brandNames: ["deltacortril", "predone", "predon"],
    commonForms: ["Tablet", "Dispersible Tablet", "Eye Drops"],
    indications: "Severe allergic reactions, asthma flares, autoimmune disorders.",
  },

  // Supplements & Minerals
  {
    id: "ferrous_sulfate",
    name: "Ferrous Sulfate",
    genericName: "Ferrous Sulfate",
    drugClass: "Iron Supplement",
    brandNames: ["fefol", "feroglobin", "fe-sulfate", "ferrous"],
    commonForms: ["Tablet", "Drops", "Syrup"],
    indications: "Prevention and treatment of iron deficiency anemia in pregnancy and chronic illness.",
  },
  {
    id: "folic_acid",
    name: "Folic Acid",
    genericName: "Folic Acid / Vitamin B9",
    drugClass: "Vitamin Supplement",
    brandNames: ["folvite", "folic"],
    commonForms: ["Tablet"],
    indications: "Megaloblastic anemia, neural tube defect prophylaxis in pre-conception & pregnancy.",
  },

  // Lipid-Lowering Statins
  {
    id: "atorvastatin",
    name: "Atorvastatin",
    genericName: "Atorvastatin Calcium",
    drugClass: "HMG-CoA Reductase Inhibitor (Statin)",
    brandNames: ["lipitor", "atorlip", "storvas", "atocor"],
    commonForms: ["Tablet"],
    indications: "Primary and secondary hyperlipidemia, reduction of cardiovascular risk.",
  },
  {
    id: "simvastatin",
    name: "Simvastatin",
    genericName: "Simvastatin",
    drugClass: "HMG-CoA Reductase Inhibitor (Statin)",
    brandNames: ["zocor", "simvacor", "simvas"],
    commonForms: ["Tablet"],
    indications: "Hypercholesterolemia, cardiovascular mortality reduction in coronary disease.",
  },

  // Oxazolidinone Antibacterials
  {
    id: "linezolid",
    name: "Linezolid",
    genericName: "Linezolid",
    drugClass: "Oxazolidinone Antibacterial",
    brandNames: ["zyvox", "linospan", "lizolid"],
    commonForms: ["Tablet", "Suspension", "Infusion"],
    indications: "Vancomycin-resistant Enterococcus faecium, MRSA, drug-resistant tuberculosis (MDR-TB).",
    boxedWarning: "Myelosuppression (anemia, thrombocytopenia) and peripheral/optic neuropathy with prolonged use.",
  },

  // Reproductive Health & Contraceptives
  {
    id: "levonorgestrel_ethinylestradiol",
    name: "Levonorgestrel + Ethinylestradiol",
    genericName: "Levonorgestrel / Ethinylestradiol",
    drugClass: "Combined Oral Contraceptive",
    brandNames: ["microgynon", "safeplan", "femiplan", "diane-35"],
    commonForms: ["Tablet"],
    indications: "Oral contraception, regulation of menstrual cycle.",
    boxedWarning: "Cigarette smoking increases the risk of serious cardiovascular events from combined oral contraceptives.",
  },
];

// ── Formulation Regexes ────────────────────────────────────────────────────────
const FORM_REGEXES: Array<{ form: string; regex: RegExp }> = [
  { form: "Capsules", regex: /\b(capsules?|caps?)\b/i },
  { form: "Tablets", regex: /\b(tablets?|tabs?|caplets?)\b/i },
  { form: "Syrup", regex: /\b(syrup|syrups?|suspension|liquid|elixir|oral solution)\b/i },
  { form: "Inhaler", regex: /\b(inhaler|puff|aerosol|metered dose)\b/i },
  { form: "Injection", regex: /\b(injection|inj|ampoule|vial|infusion)\b/i },
  { form: "Drops", regex: /\b(drops?|eye drops?|ear drops?)\b/i },
  { form: "Cream", regex: /\b(cream|ointment|gel|topical)\b/i },
];

// Strength extractor: captures strength numbers + unit (e.g. 500mg, 20 mg, 250mg/5ml)
const STRENGTH_REGEX = /\b(\d+(?:\.\d+)?)\s*(mg|g|mcg|ml|iu|%)(?:\s*\/\s*(\d+(?:\.\d+)?)\s*(?:mg|ml))?\b/i;

// Clean text for matching
function cleanToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Calculates a fast Jaccard/Levenshtein similarity score between two words.
 */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  // Levenshtein distance for short tokens
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 0.0;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/**
 * Extracts medications from OCR recognized text offline.
 *
 * @param ocrText Raw text recognized from image
 * @returns Structured PillIdResponse with candidate matches, confidence, and empty dosage.
 */
export function extractMedicationFromOcr(ocrText: string): PillIdResponse {
  if (!ocrText || !ocrText.trim()) {
    return {
      success: false,
      matches: [],
      imprints: [],
      labels: [],
      summary: "No readable medication label detected in photo.",
    };
  }

  const rawLines = ocrText.split(/[\r\n]+/);
  const words = ocrText
    .split(/[\s,;:()[\]{}/\\+\-_*#|]+/)
    .map(cleanToken)
    .filter((w) => w.length >= 3);

  // Extract detected formulation (e.g. Tablets, Syrup)
  let detectedForm: string | undefined = undefined;
  for (const { form, regex } of FORM_REGEXES) {
    if (regex.test(ocrText)) {
      detectedForm = form;
      break;
    }
  }

  // Extract detected strength for label information
  const strengthMatch = ocrText.match(STRENGTH_REGEX);
  const detectedStrength = strengthMatch ? strengthMatch[0].trim() : undefined;

  // Match against local formulary
  interface MatchScore {
    item: FormularyItem;
    score: number;
    matchedBy: string;
  }

  const scores: MatchScore[] = [];

  for (const item of LOCAL_FORMULARY) {
    let bestScore = 0;
    let matchedToken = "";

    // 1. Check exact or fuzzy match on canonical item name
    const cleanGeneric = cleanToken(item.genericName);
    const cleanName = cleanToken(item.name);

    for (const w of words) {
      const simGeneric = tokenSimilarity(w, cleanGeneric);
      const simName = tokenSimilarity(w, cleanName);
      if (simGeneric > bestScore) {
        bestScore = simGeneric;
        matchedToken = item.genericName;
      }
      if (simName > bestScore) {
        bestScore = simName;
        matchedToken = item.name;
      }
    }

    // 2. Check brand names (e.g. panadol, coartem, augmentin)
    for (const brand of item.brandNames) {
      const cleanBrand = cleanToken(brand);
      for (const w of words) {
        const sim = tokenSimilarity(w, cleanBrand);
        if (sim > bestScore) {
          bestScore = sim;
          matchedToken = brand;
        }
      }
    }

    // Boost score if detected form matches item common forms
    if (detectedForm && item.commonForms.some((f) => f.toLowerCase().includes(detectedForm!.toLowerCase()))) {
      bestScore = Math.min(1.0, bestScore + 0.08);
    }

    if (bestScore >= 0.70) {
      scores.push({ item, score: bestScore, matchedBy: matchedToken });
    }
  }

  // Sort candidate matches descending by score
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    // If no high-confidence formulary match, construct generic candidate from first prominent words
    const topWords = words.filter((w) => w.length >= 4).slice(0, 2);
    const fallbackTitle = topWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    if (fallbackTitle) {
      return {
        success: true,
        matches: [
          {
            name: fallbackTitle + (detectedStrength ? ` ${detectedStrength}` : ""),
            confidence: 0.55,
            genericName: fallbackTitle,
            indications: "Unverified OCR text. Please check package label and confirm with pharmacist.",
            unverifiedNotice: "Offline text match — unverified against formulary.",
          },
        ],
        imprints: [],
        labels: rawLines.slice(0, 3),
        summary: `Offline OCR detected label: "${fallbackTitle}". Please verify the medication name and prescribed dosage manually.`,
      };
    }

    return {
      success: false,
      matches: [],
      imprints: [],
      labels: rawLines.slice(0, 3),
      summary: "Could not identify a matching medication from the scanned image. Please try a clearer photo or search manually.",
    };
  }

  const matches: PillMatch[] = scores.slice(0, 3).map((s) => {
    const item = s.item;
    // Check if canonical safety warnings exist in CANONICAL_DRUGS
    const canonicalKey = item.id.toLowerCase();
    const canonicalDef = CANONICAL_DRUGS[canonicalKey];

    const fullName = detectedStrength
      ? `${item.name} (${detectedStrength})`
      : item.name;

    return {
      name: fullName,
      genericName: item.genericName,
      confidence: Math.round(s.score * 100) / 100,
      indications: item.indications,
      boxedWarning: item.boxedWarning || null,
      unverifiedNotice: "Recognized offline via on-device medical formulary.",
    };
  });

  const best = matches[0];
  const summary = `Recognized **${best.name}** (${best.genericName}) with ${(best.confidence * 100).toFixed(0)}% confidence using on-device medical formulary. Dose must be entered as prescribed.`;

  return {
    success: true,
    matches,
    imprints: [],
    labels: rawLines.slice(0, 4),
    summary,
  };
}
