/**
 * Shared Curated Clinical Knowledge Base for Major Therapeutic Classes
 * and synchronous duplicate-therapy helpers used by both frontend and backend.
 */

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
    guidance: "Never double up on blood thinners. If you are transitioning between blood thinners, follow your hematologist's exact bridging schedule."
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

export const normalizeDrugKey = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

export function findLocalTherapeuticClass(drugName) {
  if (!drugName) return null;
  const clean = drugName.toLowerCase().trim();
  const normalized = normalizeDrugKey(clean);

  for (const classDef of Object.values(THERAPEUTIC_CLASSES)) {
    for (const gen of classDef.genericDrugs) {
      if (clean.includes(gen) || normalized.includes(normalizeDrugKey(gen))) {
        return classDef;
      }
    }
    for (const brand of classDef.brandSynonyms) {
      if (clean.includes(brand) || normalized.includes(normalizeDrugKey(brand))) {
        return classDef;
      }
    }
  }

  return null;
}

export function detectDuplicateTherapiesSync(medications = [], sourceLabel = 'NDA Uganda & FDA Safety Standards') {
  if (!Array.isArray(medications) || medications.length < 2) return [];

  const classified = medications.map((m) => {
    const name = m?.name || m?.genericName || '';
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

      if (
        a.name.toLowerCase().trim() === b.name.toLowerCase().trim() ||
        normalizeDrugKey(a.name) === normalizeDrugKey(b.name)
      ) {
        continue;
      }

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
          source: sourceLabel
        });
      }
    }
  }

  return duplicates;
}

export function extractDrugsFromQuery(query, activeMeds = []) {
  if (!query || typeof query !== 'string') return [];
  const lower = query.toLowerCase();
  const matched = new Set();

  if (Array.isArray(activeMeds)) {
    for (const m of activeMeds) {
      if (m?.name && lower.includes(m.name.toLowerCase())) matched.add(m.name);
      if (m?.genericName && lower.includes(m.genericName.toLowerCase())) matched.add(m.genericName);
    }
  }

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
}

const SAME_TASK_PHRASES = [
  'same task', 'same thing', 'same purpose', 'same work', 'perform the same',
  'do the same', 'doing the same', 'both do', 'duplicate', 'double up',
  'two painkiller', 'two pain killer', 'two painkillers', 'two bp',
  'two blood pressure', 'two pills for', 'two medicines for', 'two medications for',
  'can i take both', 'taking both', 'take them together', 'take both together',
  'at the same time', 'combine both', 'mix both'
];

export function isSameTaskOrDuplicateQuery(query, activeMeds = []) {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();

  if (SAME_TASK_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  if (lower.includes('together') && /(take|taking|took|use|using|combine|pair|safe|interact|prescrib)/i.test(lower)) {
    return true;
  }

  const extracted = extractDrugsFromQuery(query, activeMeds);
  if (extracted.length >= 2) {
    const classes = extracted.map((d) => findLocalTherapeuticClass(d)).filter(Boolean);
    if (classes.length >= 2 && classes[0]?.id === classes[1]?.id) {
      return true;
    }
  }

  return false;
}
