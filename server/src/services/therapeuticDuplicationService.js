/**
 * Therapeutic Duplication & Same-Task Medication Intelligence Service
 *
 * Provides authoritative clinical detection, regulatory data fetching from
 * RxNorm and openFDA APIs, and patient counseling guidance when a patient has
 * or inquires about more than one medication that performs the same task.
 */

import { resolveRxNormConcept } from './rxNormService.js';
import { fetchNdcData, fetchDrugLabel } from './openFdaService.js';

// ── Curated Clinical Knowledge Base for Major Therapeutic Classes ──────────────
export const THERAPEUTIC_CLASSES = {
  NSAID: {
    id: 'nsaid',
    name: 'Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)',
    task: 'relieving pain, reducing inflammation, and swelling',
    epcKeyword: 'Nonsteroidal Anti-inflammatory Drug',
    genericDrugs: [
      'ibuprofen', 'diclofenac', 'naproxen', 'meloxicam', 'indomethacin',
      'piroxicam', 'celecoxib', 'ketoprofen', 'mefenamic acid', 'aspirin'
    ],
    brandSynonyms: [
      'brufen', 'advil', 'motrin', 'voltaren', 'k-diclo', 'diclogem',
      'cataflam', 'aleve', 'feldene', 'mobic', 'celebrex', 'nurofen', 'ponstan'
    ],
    dangers: [
      'Severe gastrointestinal ulceration and catastrophic GI bleeding',
      'Acute kidney injury (renal impairment) from renal prostaglandin inhibition',
      'Fluid retention, worsening hypertension, and elevated cardiovascular risk',
      'No added pain relief due to analgesic ceiling effect (only additive toxicity)'
    ],
    summaryHazard: 'Concurrent use of two or more NSAIDs dramatically multiplies the risk of stomach ulcers, internal bleeding, and kidney damage without providing any extra pain relief.',
    guidance: 'Do NOT take two NSAIDs together. Choose one with guidance from your doctor or pharmacist. If additional pain relief is needed, consider alternating with or using Paracetamol within safe daily limits.'
  },
  PARACETAMOL: {
    id: 'paracetamol',
    name: 'Paracetamol / Acetaminophen Products',
    task: 'relieving mild-to-moderate pain and reducing fever (analgesic / antipyretic)',
    epcKeyword: 'Analgesic and Antipyretic',
    genericDrugs: [
      'paracetamol', 'acetaminophen', 'co-codamol', 'paracetamol-caffeine'
    ],
    brandSynonyms: [
      'panadol', 'calpol', 'tylenol', 'hedex', 'flucold', 'coldcap',
      'cafenol', 'action', 'sinutab', 'dawa-pain', 'fevadol'
    ],
    dangers: [
      'Accidental overdose exceeding the maximum safe ceiling of 4,000 mg (4 grams) in 24 hours',
      'Acute toxic liver necrosis and acute hepatic failure',
      'Higher susceptibility in patients with malnutrition, chronic alcohol use, or liver impairment (safe ceiling drops to 2,000–3,000 mg/day)'
    ],
    summaryHazard: 'Many cold, flu, and pain remedies contain hidden paracetamol. Taking duplicate paracetamol products causes accidental liver poisoning, potentially leading to irreversible liver failure.',
    guidance: 'Never combine Panadol or Paracetamol with combination cold/flu pills like Flucold or ColdCap without verifying total dosage. Never exceed 4,000 mg of paracetamol per 24 hours across all medicines combined.'
  },
  DUAL_RAAS_BLOCKADE: {
    id: 'dual_raas',
    name: 'RAAS Blockers (ACE Inhibitors & Angiotensin Receptor Blockers)',
    task: 'lowering blood pressure and protecting kidney/heart function',
    epcKeyword: 'Angiotensin Converting Enzyme Inhibitor',
    genericDrugs: [
      'lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril',
      'losartan', 'valsartan', 'telmisartan', 'candesartan', 'olmesartan'
    ],
    brandSynonyms: [
      'zestril', 'prinivil', 'vasotec', 'altace', 'cozaar', 'diovan',
      'micardis', 'atacand', 'benicar', 'coversyl'
    ],
    dangers: [
      'Life-threatening hyperkalemia (dangerously high blood potassium)',
      'Acute renal failure and sudden decline in kidney function',
      'Profound, symptomatic hypotension (dizziness, fainting, collapse)',
      'Clinical trials (e.g. ONTARGET) demonstrated harm with zero added cardiovascular protection'
    ],
    summaryHazard: 'Combining an ACE inhibitor with an ARB (dual RAAS blockade) or taking two drugs of the same class is contraindicated because it triggers dangerous potassium buildup, acute kidney shutdown, and fainting.',
    guidance: 'Never combine two RAAS inhibitors unless explicitly monitored under specialized hospital nephrology care. Immediately consult your prescribing doctor to discontinue one.'
  },
  BETA_BLOCKERS: {
    id: 'beta_blockers',
    name: 'Beta-Adrenergic Blockers',
    task: 'slowing heart rate and lowering blood pressure',
    epcKeyword: 'beta-Adrenergic Blocker',
    genericDrugs: [
      'atenolol', 'metoprolol', 'bisoprolol', 'carvedilol', 'propranolol',
      'nebivolol', 'labetalol'
    ],
    brandSynonyms: [
      'tenormin', 'lopressor', 'toprol', 'concor', 'coreg', 'inderal', 'bystolic'
    ],
    dangers: [
      'Severe, symptomatic bradycardia (heart rate falling below 40-50 bpm)',
      'High-degree atrioventricular (AV) heart block',
      'Severe hypotension and precipitation of acute heart failure'
    ],
    summaryHazard: 'Taking two beta-blockers doubles cardiac depression, leading to dangerously slow heart rates, heart block, and fainting.',
    guidance: 'Do not take multiple beta-blockers concurrently. Speak to your doctor to streamline your heart regimen.'
  },
  CALCIUM_CHANNEL_BLOCKERS: {
    id: 'ccb',
    name: 'Calcium Channel Blockers',
    task: 'relaxing blood vessels and lowering blood pressure',
    epcKeyword: 'Calcium Channel Blocker',
    genericDrugs: [
      'amlodipine', 'nifedipine', 'felodipine', 'diltiazem', 'verapamil', 'nicardipine'
    ],
    brandSynonyms: [
      'norvasc', 'adalat', 'procardia', 'plendil', 'cardizem', 'calan', 'verelan'
    ],
    dangers: [
      'Profound hypotension, severe peripheral edema (swollen ankles/legs)',
      'Severe bradycardia or heart block when combining non-dihydropyridines (verapamil/diltiazem) with other agents'
    ],
    summaryHazard: 'Duplicate calcium channel blockers can cause excessive drops in blood pressure, severe dizziness, and extensive lower-limb swelling.',
    guidance: 'Avoid taking multiple calcium channel blockers together without clear physician instruction.'
  },
  ACID_REDUCERS_PPI: {
    id: 'ppi',
    name: 'Proton Pump Inhibitors (PPIs)',
    task: 'suppressing stomach acid production for ulcers, gastritis, and GERD',
    epcKeyword: 'Proton Pump Inhibitor',
    genericDrugs: [
      'omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole'
    ],
    brandSynonyms: [
      'prilosec', 'nexium', 'protonix', 'prevacid', 'aciphex', 'omez', 'losec'
    ],
    dangers: [
      'Zero clinical benefit (proton pumps are already maximally blocked by one therapeutic dose)',
      'Increased risk of severe hypomagnesemia and calcium malabsorption (bone fractures)',
      'Higher susceptibility to Clostridioides difficile gastrointestinal infections and chronic kidney disease'
    ],
    summaryHazard: 'Taking two PPIs provides no additional acid suppression, while increasing risks of mineral depletion and gut infections.',
    guidance: 'Take only one PPI at a time, usually 30–60 minutes before the first meal of the day.'
  },
  ANTIHISTAMINES: {
    id: 'antihistamines',
    name: 'Antihistamines (Allergy & Cold Relievers)',
    task: 'relieving allergic reactions, runny nose, sneezing, and itching',
    epcKeyword: 'Histamine H1 Receptor Antagonist',
    genericDrugs: [
      'cetirizine', 'loratadine', 'fexofenadine', 'levocetirizine',
      'chlorpheniramine', 'diphenhydramine', 'promethazine'
    ],
    brandSynonyms: [
      'zyrtec', 'claritin', 'allegra', 'xyzal', 'piriton', 'benadryl', 'phenergan'
    ],
    dangers: [
      'Profound, additive central nervous system sedation and psychomotor impairment',
      'Severe anticholinergic toxicity (extreme dry mouth, urinary retention, blurred vision, confusion)',
      'Dangerous impairment for driving or operating machinery'
    ],
    summaryHazard: 'Combining multiple antihistamines (especially first-generation agents like Piriton with second-generation agents) causes extreme drowsiness, confusion, and urinary blockage.',
    guidance: 'Use only one antihistamine product at a time. If daytime drowsiness is a problem, use non-sedating agents like Cetirizine or Loratadine.'
  },
  SEDATIVES_HYPNOTICS: {
    id: 'sedatives',
    name: 'Sedatives, Anxiolytics & Sleep Aids',
    task: 'relieving severe anxiety, muscle spasms, or inducing sleep',
    epcKeyword: 'Benzodiazepine',
    genericDrugs: [
      'diazepam', 'lorazepam', 'alprazolam', 'clonazepam', 'midazolam',
      'zolpidem', 'zopiclone'
    ],
    brandSynonyms: [
      'valium', 'ativan', 'xanax', 'klonopin', 'ambien', 'imovane'
    ],
    dangers: [
      'Life-threatening central nervous system (CNS) and respiratory depression',
      'Severe coma, respiratory arrest, and fatal overdose',
      'High risk of rapid physiological dependence, falls, and cognitive impairment'
    ],
    summaryHazard: 'Combining two or more sedative medications exponentially increases the risk of slowed breathing, coma, and fatal overdose.',
    guidance: 'Never take multiple sleeping pills or anti-anxiety medications together unless prescribed under strict hospital supervision.'
  },
  ANTICOAGULANTS_ANTIPLATELETS: {
    id: 'anticoagulants',
    name: 'Anticoagulants & Antiplatelets (Blood Thinners)',
    task: 'preventing blood clots, deep vein thrombosis, stroke, and heart attacks',
    epcKeyword: 'Anticoagulant',
    genericDrugs: [
      'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'heparin',
      'enoxaparin', 'clopidogrel', 'aspirin'
    ],
    brandSynonyms: [
      'coumadin', 'xarelto', 'eliquis', 'pradaxa', 'clexane', 'plavix'
    ],
    dangers: [
      'Massive, life-threatening internal hemorrhage (intracranial hemorrhage, gastrointestinal bleeding)',
      'Severe prolonged bleeding from minor cuts or trauma'
    ],
    summaryHazard: 'Unintended duplication of blood thinners (e.g., taking Warfarin alongside Xarelto) creates an immediate, life-threatening risk of uncontrollable internal bleeding.',
    guidance: 'Never double up on blood thinners. If you are transitioning between blood thinners, follow your hematologist\'s exact bridging schedule.'
  },
  ANTIDIABETICS_SULFONYLUREAS: {
    id: 'sulfonylureas',
    name: 'Sulfonylureas (Blood Glucose Lowering)',
    task: 'stimulating insulin secretion from the pancreas to lower blood sugar',
    epcKeyword: 'Sulfonylurea',
    genericDrugs: [
      'glibenclamide', 'glimepiride', 'gliclazide', 'glipizide'
    ],
    brandSynonyms: [
      'daonil', 'amaryl', 'diamicron', 'glucotrol'
    ],
    dangers: [
      'Severe, prolonged, refractory hypoglycemia (dangerously low blood sugar < 3.0 mmol/L)',
      'Hypoglycemic coma, seizures, irreversible brain damage, and death'
    ],
    summaryHazard: 'Taking duplicate sulfonylureas causes catastrophic drops in blood glucose levels that can trigger unconsciousness or seizures.',
    guidance: 'Never take two sulfonylureas. If blood sugar remains uncontrolled, speak to your clinician about adding an agent with a different mechanism of action.'
  },
  ANTIMALARIALS_ACT: {
    id: 'antimalarials',
    name: 'Artemisinin-Based Combination Therapies (ACTs)',
    task: 'clearing Plasmodium parasites in acute malaria',
    epcKeyword: 'Antimalarial',
    genericDrugs: [
      'artemether-lumefantrine', 'artemether', 'lumefantrine',
      'dihydroartemisinin-piperaquine', 'artesunate-amodiaquine', 'quinine'
    ],
    brandSynonyms: [
      'coartem', 'duocotecxin', 'artenam', 'lonart', 'lumartem', 'quiphate'
    ],
    dangers: [
      'Cumulative cardiac toxicity (dangerous prolongation of the QT interval)',
      'Neurotoxicity, severe dizziness, tinnitus, and liver stress'
    ],
    summaryHazard: 'Taking two full courses of antimalarials simultaneously (e.g. Coartem + Duocotecxin) causes cumulative cardiac arrhythmias and toxicity without improving parasite clearance.',
    guidance: 'Complete one full 3-day course of your prescribed ACT. Never take two different antimalarials at the same time.'
  },
  STATINS: {
    id: 'statins',
    name: 'HMG-CoA Reductase Inhibitors (Statins)',
    task: 'lowering LDL cholesterol and stabilizing cardiovascular plaques',
    epcKeyword: 'HMG-CoA Reductase Inhibitor',
    genericDrugs: [
      'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin'
    ],
    brandSynonyms: [
      'lipitor', 'zocor', 'crestor', 'pravachol', 'atorva'
    ],
    dangers: [
      'Severe myopathy, muscle breakdown, and life-threatening rhabdomyolysis',
      'Acute kidney failure from myoglobin precipitation',
      'Elevated liver transaminases (hepatotoxicity)'
    ],
    summaryHazard: 'Taking two statins concurrently multiplies the risk of severe muscle breakdown (rhabdomyolysis) and kidney failure.',
    guidance: 'Take only one statin per day, exactly as dosed by your physician.'
  }
};

// ── In-Memory Fast Cache for API Clinical Lookups ──────────────────────────────
const clinicalLookupCache = new Map();
const CLINICAL_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const normalizeDrugString = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

/**
 * Normalizes a medication name and determines its local therapeutic class matching.
 */
export const findLocalTherapeuticClass = (drugName) => {
  if (!drugName) return null;
  const clean = drugName.toLowerCase().trim();
  const normalized = normalizeDrugString(clean);

  for (const [key, classDef] of Object.entries(THERAPEUTIC_CLASSES)) {
    // Check generic names
    for (const gen of classDef.genericDrugs) {
      if (clean.includes(gen) || normalized.includes(normalizeDrugString(gen))) {
        return classDef;
      }
    }
    // Check brand synonyms
    for (const brand of classDef.brandSynonyms) {
      if (clean.includes(brand) || normalized.includes(normalizeDrugString(brand))) {
        return classDef;
      }
    }
  }

  return null;
};

/**
 * Resolves comprehensive regulatory data for a medication from RxNorm & openFDA.
 */
export const resolveMedicationClinicalProfile = async (drugName) => {
  if (!drugName || typeof drugName !== 'string') return null;
  const clean = drugName.trim();
  const cacheKey = `clinical_profile:${clean.toLowerCase()}`;

  const cached = clinicalLookupCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const profile = {
    queryName: clean,
    rxNorm: null,
    openFdaNdc: null,
    openFdaLabel: null,
    pharmClasses: [],
    activeIngredients: [],
    localClass: findLocalTherapeuticClass(clean)
  };

  try {
    // 1. Resolve RxNorm concept (canonical name, RxCUI, active ingredients, brand synonyms)
    const rxNormData = await resolveRxNormConcept(clean);
    if (rxNormData) {
      profile.rxNorm = rxNormData;
      profile.activeIngredients = rxNormData.activeIngredients || [];
    }

    // 2. Fetch openFDA NDC and Label in parallel
    const [ndcData, labelData] = await Promise.all([
      fetchNdcData(clean).catch(() => null),
      fetchDrugLabel(clean).catch(() => null)
    ]);

    if (ndcData) {
      profile.openFdaNdc = ndcData;
      if (Array.isArray(ndcData.pharmClasses)) {
        profile.pharmClasses.push(...ndcData.pharmClasses);
      }
    }

    if (labelData) {
      profile.openFdaLabel = labelData;
      if (Array.isArray(labelData.pharmClasses)) {
        profile.pharmClasses.push(...labelData.pharmClasses);
      }
      if (labelData.activeIngredients?.length && profile.activeIngredients.length === 0) {
        profile.activeIngredients = labelData.activeIngredients;
      }
    }

    // Deduplicate pharmClasses
    profile.pharmClasses = Array.from(new Set(profile.pharmClasses));

    // If local class was missing, try identifying from RxNorm canonical name or ingredients
    if (!profile.localClass) {
      if (profile.rxNorm?.canonicalName) {
        profile.localClass = findLocalTherapeuticClass(profile.rxNorm.canonicalName);
      }
      if (!profile.localClass && profile.activeIngredients.length > 0) {
        for (const ing of profile.activeIngredients) {
          const matched = findLocalTherapeuticClass(ing);
          if (matched) {
            profile.localClass = matched;
            break;
          }
        }
      }
    }

    clinicalLookupCache.set(cacheKey, {
      data: profile,
      expiresAt: Date.now() + CLINICAL_CACHE_TTL_MS
    });

    return profile;
  } catch (err) {
    console.warn(`[therapeuticDuplication] Error resolving clinical profile for ${clean}:`, err.message);
    return profile;
  }
};

/**
 * Detects therapeutic duplication among a list of medications.
 * Uses both fast local knowledge and live RxNorm & openFDA API resolution.
 */
export const detectDuplicateTherapiesWithApis = async (medications = []) => {
  if (!Array.isArray(medications) || medications.length < 2) {
    return [];
  }

  // Resolve profiles for all medications concurrently
  const profiles = await Promise.all(
    medications.map(async (med) => {
      const name = med.name || med.genericName || '';
      return await resolveMedicationClinicalProfile(name);
    })
  );

  const validProfiles = profiles.filter(Boolean);
  const duplicates = [];
  const seenPairs = new Set();

  for (let i = 0; i < validProfiles.length; i++) {
    for (let j = i + 1; j < validProfiles.length; j++) {
      const pA = validProfiles[i];
      const pB = validProfiles[j];
      const pairKey = [pA.queryName.toLowerCase(), pB.queryName.toLowerCase()].sort().join('::');
      if (seenPairs.has(pairKey)) continue;

      // Neglect duplicates of the exact same medication (e.g. Ibuprofen and Ibuprofen)
      if (pA.queryName.toLowerCase().trim() === pB.queryName.toLowerCase().trim() ||
          normalizeDrugString(pA.queryName) === normalizeDrugString(pB.queryName)) {
        continue;
      }

      let detected = false;
      let sharedClass = '';
      let sharedTask = '';
      let warning = '';
      let dangerPoints = [];
      let source = 'Clinical Intelligence';

      // 1. Check for shared active ingredients via RxNorm (Chemical Duplication)
      const sharedIngredients = pA.activeIngredients.filter((ingA) =>
        pB.activeIngredients.some((ingB) =>
          ingA.toLowerCase() === ingB.toLowerCase() ||
          normalizeDrugString(ingA) === normalizeDrugString(ingB)
        )
      );

      if (sharedIngredients.length > 0) {
        detected = true;
        const ingStr = sharedIngredients.join(', ');
        sharedClass = `Identical Active Ingredient: ${ingStr}`;
        source = 'RxNorm & Clinical Intelligence';
        const localClass = pA.localClass || pB.localClass || findLocalTherapeuticClass(ingStr);
        sharedTask = localClass ? localClass.task : 'identical therapeutic action';
        warning = `Both ${pA.queryName} and ${pB.queryName} contain ${ingStr}. Taking both concurrently duplicates the active ingredient, severely raising toxicity and overdose risk.`;
        dangerPoints = localClass?.dangers || [
          `Accidental chemical overdose of ${ingStr}`,
          'Additive organ toxicity without increased efficacy'
        ];
      }

      // 2. Check for shared openFDA Established Pharmacologic Class [EPC]
      if (!detected) {
        const epcA = pA.pharmClasses.filter((c) => c.includes('[EPC]'));
        const epcB = pB.pharmClasses.filter((c) => c.includes('[EPC]'));
        const sharedEpc = epcA.filter((c) => epcB.includes(c));

        if (sharedEpc.length > 0) {
          detected = true;
          const cleanEpc = sharedEpc.map((c) => c.replace(/\s*\[EPC\]/g, '')).join(', ');
          sharedClass = cleanEpc;
          source = 'openFDA & RxNorm';
          const localClass = pA.localClass || pB.localClass;
          sharedTask = localClass ? localClass.task : `shared pharmacologic action (${cleanEpc})`;
          warning = `Both ${pA.queryName} and ${pB.queryName} belong to the same FDA pharmacologic class (${cleanEpc}). They perform the same therapeutic task; taking both causes additive toxicity with no added therapeutic benefit.`;
          dangerPoints = localClass?.dangers || [
            `Cumulative toxicity of the ${cleanEpc} class`,
            'Ceiling effect: no added healing or pain relief, only doubled side effect risk'
          ];
        }
      }

      // 3. Check for shared local clinical class (Regional & OTC brands e.g. Panadol + Flucold, Brufen + Voltaren)
      if (!detected && pA.localClass && pB.localClass && pA.localClass.id === pB.localClass.id) {
        detected = true;
        const lc = pA.localClass;
        sharedClass = lc.name;
        sharedTask = lc.task;
        source = 'NDA Uganda & Clinical Knowledge Base';
        warning = `Both ${pA.queryName} and ${pB.queryName} belong to the ${lc.name} family and perform the same task (${lc.task}). ${lc.summaryHazard}`;
        dangerPoints = lc.dangers;
      }

      // 4. Special cross-class overlap: Dual RAAS blockade (ACE Inhibitor + ARB)
      if (!detected) {
        const isAceOrArb = (p) => {
          const names = [p.queryName, p.rxNorm?.canonicalName, ...(p.activeIngredients || [])].join(' ').toLowerCase();
          const isAce = /pril\b|lisinopril|enalapril|ramipril|captopril/i.test(names);
          const isArb = /sartan\b|losartan|valsartan|telmisartan|candesartan/i.test(names);
          return { isAce, isArb };
        };
        const raasA = isAceOrArb(pA);
        const raasB = isAceOrArb(pB);
        if ((raasA.isAce && raasB.isArb) || (raasA.isArb && raasB.isAce)) {
          detected = true;
          sharedClass = 'Dual RAAS Blockade (ACE Inhibitor + ARB)';
          sharedTask = 'lowering blood pressure';
          source = 'openFDA, RxNorm & Clinical Guidelines';
          warning = `Concurrent use of ${pA.queryName} (ACE Inhibitor) and ${pB.queryName} (ARB) is contraindicated. Dual renin-angiotensin-aldosterone blockade causes acute kidney injury, hyperkalemia, and severe hypotension.`;
          dangerPoints = THERAPEUTIC_CLASSES.DUAL_RAAS_BLOCKADE.dangers;
        }
      }

      if (detected) {
        seenPairs.add(pairKey);
        duplicates.push({
          drug1: pA.queryName,
          drug2: pB.queryName,
          sharedClass,
          sharedTask,
          warning,
          dangers: dangerPoints,
          guidance: pA.localClass?.guidance || pB.localClass?.guidance || 'Do not take both together. Consult your healthcare provider to select the single best medicine.',
          source,
          rxNormIngredients: Array.from(new Set([...pA.activeIngredients, ...pB.activeIngredients]))
        });
      }
    }
  }

  return duplicates;
};

/**
 * Fast synchronous detection using curated local database (useful for instant checks and offline).
 */
export const detectDuplicateTherapiesSync = (medications = []) => {
  if (!Array.isArray(medications) || medications.length < 2) return [];

  const classified = medications.map((m) => {
    const name = m.name || m.genericName || '';
    return { name, localClass: findLocalTherapeuticClass(name) };
  });

  const duplicates = [];
  const seenPairs = new Set();

  for (let i = 0; i < classified.length; i++) {
    for (let j = i + 1; j < classified.length; j++) {
      const a = classified[i];
      const b = classified[j];
      const pairKey = [a.name.toLowerCase(), b.name.toLowerCase()].sort().join('::');
      if (seenPairs.has(pairKey)) continue;

      if (a.localClass && b.localClass && a.localClass.id === b.localClass.id) {
        seenPairs.add(pairKey);
        duplicates.push({
          drug1: a.name,
          drug2: b.name,
          sharedClass: a.localClass.name,
          sharedTask: a.localClass.task,
          warning: `Both ${a.name} and ${b.name} perform the same task (${a.localClass.task}). ${a.localClass.summaryHazard}`,
          dangers: a.localClass.dangers,
          guidance: a.localClass.guidance,
          source: 'NDA Uganda Clinical Standards'
        });
      }
    }
  }

  return duplicates;
};

/**
 * Extracts drug names mentioned in a user query, cross-referencing known active medicines
 * and common generic/brand names in our therapeutic knowledge base.
 */
export const extractDrugsFromQuery = (query, activeMeds = []) => {
  if (!query || typeof query !== 'string') return [];
  const lower = query.toLowerCase();
  const matched = new Set();

  // 1. Check active medicines
  for (const m of activeMeds) {
    if (m.name && lower.includes(m.name.toLowerCase())) matched.add(m.name);
    if (m.genericName && lower.includes(m.genericName.toLowerCase())) matched.add(m.genericName);
  }

  // 2. Check curated generic and brand names
  for (const classDef of Object.values(THERAPEUTIC_CLASSES)) {
    for (const gen of classDef.genericDrugs) {
      const regex = new RegExp(`\\b${gen}\\b`, 'i');
      if (regex.test(lower)) matched.add(gen.charAt(0).toUpperCase() + gen.slice(1));
    }
    for (const brand of classDef.brandSynonyms) {
      const regex = new RegExp(`\\b${brand}\\b`, 'i');
      if (regex.test(lower)) matched.add(brand.charAt(0).toUpperCase() + brand.slice(1));
    }
  }

  return Array.from(matched);
};

/**
 * Checks if a user's query is asking about same-task medications, duplicate therapy,
 * or taking multiple drugs together for the same purpose.
 */
export const isSameTaskOrDuplicateQuery = (query, activeMeds = []) => {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();

  const sameTaskPhrases = [
    'same task', 'same thing', 'same purpose', 'same work', 'perform the same',
    'do the same', 'doing the same', 'both do', 'duplicate', 'double up',
    'two painkiller', 'two pain killer', 'two painkillers', 'two bp',
    'two blood pressure', 'two pills for', 'two medicines for', 'two medications for',
    'can i take both', 'taking both', 'take them together', 'take both together',
    'at the same time', 'combine both', 'mix both'
  ];

  if (sameTaskPhrases.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  if (lower.includes('together') && /(take|taking|took|use|using|combine|pair|safe|interact|prescrib)/i.test(lower)) {
    return true;
  }

  // Check if multiple drugs from the same therapeutic class are mentioned in the query
  const extracted = extractDrugsFromQuery(query, activeMeds);
  if (extracted.length >= 2) {
    const classes = extracted.map((d) => findLocalTherapeuticClass(d)).filter(Boolean);
    if (classes.length >= 2 && classes[0].id === classes[1].id) {
      return true;
    }
  }

  return false;
};

/**
 * Fetches clinical grounding from RxNorm and openFDA for medications relevant to a query.
 */
export const fetchClinicalGroundingForQuery = async (query, activeMeds = []) => {
  const extractedDrugs = extractDrugsFromQuery(query, activeMeds);
  const asksAboutDuplicates = isSameTaskOrDuplicateQuery(query, activeMeds);

  // Only check full cabinet for duplicates if the query specifically asks about duplicate therapies,
  // combining medications, or same tasks; or if multiple drugs were extracted directly from the prompt.
  const targetDrugs = extractedDrugs.length >= 2
    ? extractedDrugs.map((name) => ({ name }))
    : asksAboutDuplicates && activeMeds.length >= 2
    ? activeMeds
    : extractedDrugs.map((name) => ({ name }));

  if (targetDrugs.length < 2) {
    // If only one drug or general query, fetch profile for whatever was found
    if (targetDrugs.length === 1) {
      const singleProfile = await resolveMedicationClinicalProfile(targetDrugs[0].name);
      return {
        profiles: singleProfile ? [singleProfile] : [],
        duplicates: []
      };
    }
    return { profiles: [], duplicates: [] };
  }

  // Detect duplicate therapies with live RxNorm and openFDA APIs
  const [profiles, duplicates] = await Promise.all([
    Promise.all(targetDrugs.map((d) => resolveMedicationClinicalProfile(d.name))),
    detectDuplicateTherapiesWithApis(targetDrugs)
  ]);

  return {
    profiles: profiles.filter(Boolean),
    duplicates
  };
};

/**
 * Formats structured regulatory grounding and clinical watchdog context for DawaGPT's prompt.
 */
export const formatDuplicateTherapyWatchdogContext = (grounding) => {
  const { profiles = [], duplicates = [] } = grounding || {};
  if (profiles.length === 0 && duplicates.length === 0) return '';

  let context = '=== AUTHORITATIVE REGULATORY GROUNDING (RxNorm & openFDA) ===\n';

  // Format RxNorm and openFDA details for each drug
  for (const p of profiles) {
    const rxcuiStr = p.rxNorm?.rxcui ? `RxCUI: ${p.rxNorm.rxcui}` : 'RxCUI: Unassigned';
    const canonicalStr = p.rxNorm?.canonicalName ? `Canonical Name: ${p.rxNorm.canonicalName}` : '';
    const ingredientsStr = p.activeIngredients.length > 0 ? `Active Ingredients: [${p.activeIngredients.join(', ')}]` : 'Active Ingredients: None listed';
    const epcClasses = p.pharmClasses.filter((c) => c.includes('[EPC]')).map((c) => c.replace(/\s*\[EPC\]/g, ''));
    const epcStr = epcClasses.length > 0 ? `openFDA Established Pharmacologic Class (EPC): ${epcClasses.join(', ')}` : '';
    const labelWarning = p.openFdaLabel?.boxedWarning ? `Boxed Warning: ${p.openFdaLabel.boxedWarning.slice(0, 200)}...` : '';

    context += `• ${p.queryName} (${rxcuiStr}${canonicalStr ? `, ${canonicalStr}` : ''}):\n`;
    context += `  - ${ingredientsStr}\n`;
    if (epcStr) context += `  - ${epcStr}\n`;
    if (labelWarning) context += `  - ${labelWarning}\n`;
    if (p.localClass) context += `  - Clinical Indication / Task: ${p.localClass.task}\n`;
  }

  // Format detected duplicates watchdog as clinical advisory reference (not imperative override)
  if (duplicates.length > 0) {
    context += '\n=== CLINICAL REFERENCE: THERAPEUTIC DUPLICATION (SAME-TASK MEDICATIONS) ===\n';
    context += 'Notice: The patient cabinet or query contains medications that perform the same clinical task:\n';
    for (const dup of duplicates) {
      context += `\n[DUPLICATE THERAPY]: ${dup.drug1} + ${dup.drug2}\n`;
      context += `• Shared Pharmacologic Class: ${dup.sharedClass}\n`;
      context += `• Shared Clinical Task: ${dup.sharedTask}\n`;
      context += `• Clinical Warning: ${dup.warning}\n`;
      context += `• Key Risks: ${dup.dangers.join('; ')}\n`;
      context += `• Safe Recommendation: ${dup.guidance}\n`;
      context += `• Evidence Sources: ${dup.source}\n`;
    }
    context += '\nCLINICAL GUIDELINES FOR DAWAGPT:\n';
    context += '- ALWAYS answer the user\'s primary question first (e.g. if they ask about reminders, doses, or schedule, answer that directly).\n';
    context += '- If and only if the user asks about taking these medications together, asks about drug safety/interactions, or if directly relevant to their query, advise them that these medications perform the same task, explain the ceiling effect/toxicity risks, and recommend consulting a doctor or pharmacist.\n';
  }

  return context.trim() + '\n\n';
};

