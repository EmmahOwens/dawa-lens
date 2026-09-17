/**
 * Client-Side Therapeutic Duplication & Same-Task Medication Intelligence
 * Provides fast local evaluation, duplicate class matching, and clinical guidance.
 */

import { Medicine } from "../contexts/AppContext";

export interface TherapeuticClassDef {
  id: string;
  name: string;
  task: string;
  genericDrugs: string[];
  brandSynonyms: string[];
  dangers: string[];
  summaryHazard: string;
  guidance: string;
}

export interface DuplicateTherapyResult {
  drug1: string;
  drug2: string;
  sharedClass: string;
  sharedTask: string;
  warning: string;
  dangers: string[];
  guidance: string;
  source: string;
}

export const THERAPEUTIC_CLASSES: Record<string, TherapeuticClassDef> = {
  NSAID: {
    id: 'nsaid',
    name: 'Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)',
    task: 'relieving pain, reducing inflammation, and swelling',
    genericDrugs: [
      'ibuprofen', 'diclofenac', 'naproxen', 'meloxicam', 'indomethacin',
      'piroxicam', 'celecoxib', 'ketoprofen', 'mefenamic acid', 'aspirin'
    ],
    brandSynonyms: [
      'brufen', 'advil', 'motrin', 'voltaren', 'k-diclo', 'diclogem',
      'cataflam', 'aleve', 'feldene', 'mobic', 'celebrex', 'nurofen', 'ponstan'
    ],
    dangers: [
      'Severe gastrointestinal ulceration and internal GI bleeding',
      'Acute kidney injury from decreased renal blood flow',
      'Fluid retention, elevated blood pressure, and cardiovascular events',
      'No added pain relief due to receptor ceiling effect'
    ],
    summaryHazard: 'Concurrent use of two or more NSAIDs multiplies the risk of stomach ulcers, internal bleeding, and kidney damage without providing any extra pain relief.',
    guidance: 'Do NOT take two NSAIDs together. Choose one with guidance from your doctor or pharmacist. If extra pain relief is needed, consider alternating with Paracetamol within safe daily limits.'
  },
  PARACETAMOL: {
    id: 'paracetamol',
    name: 'Paracetamol / Acetaminophen Products',
    task: 'relieving mild-to-moderate pain and reducing fever',
    genericDrugs: [
      'paracetamol', 'acetaminophen', 'co-codamol', 'paracetamol-caffeine'
    ],
    brandSynonyms: [
      'panadol', 'calpol', 'tylenol', 'hedex', 'flucold', 'coldcap',
      'cafenol', 'action', 'sinutab', 'dawa-pain', 'fevadol'
    ],
    dangers: [
      'Accidental overdose exceeding the 4,000 mg (4g) 24-hour maximum limit',
      'Acute toxic liver necrosis and acute hepatic failure',
      'Heightened toxicity in patients with dehydration, malnutrition, or alcohol use'
    ],
    summaryHazard: 'Many cold, flu, and headache remedies contain hidden paracetamol. Taking duplicate paracetamol products causes accidental liver poisoning and potential liver failure.',
    guidance: 'Never combine Panadol or Paracetamol with cold & flu pills like Flucold or ColdCap without verifying total dosage. Never exceed 4,000 mg in 24 hours across all medicines.'
  },
  DUAL_RAAS_BLOCKADE: {
    id: 'dual_raas',
    name: 'RAAS Blockers (ACE Inhibitors & ARBs)',
    task: 'lowering blood pressure and protecting kidney/heart function',
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
      'Acute kidney shutdown and sudden renal failure',
      'Profound, symptomatic hypotension (dizziness, fainting, collapse)'
    ],
    summaryHazard: 'Combining an ACE inhibitor with an ARB causes severe potassium spikes, acute kidney shutdown, and fainting without added cardiovascular protection.',
    guidance: 'Never combine two RAAS inhibitors unless monitored by a hospital nephrologist. Consult your physician immediately to streamline to one agent.'
  },
  BETA_BLOCKERS: {
    id: 'beta_blockers',
    name: 'Beta-Adrenergic Blockers',
    task: 'slowing heart rate and lowering blood pressure',
    genericDrugs: [
      'atenolol', 'metoprolol', 'bisoprolol', 'carvedilol', 'propranolol',
      'nebivolol', 'labetalol'
    ],
    brandSynonyms: [
      'tenormin', 'lopressor', 'toprol', 'concor', 'coreg', 'inderal', 'bystolic'
    ],
    dangers: [
      'Severe bradycardia (heart rate dropping below 40-50 bpm)',
      'Complete heart block and cardiac arrest',
      'Severe hypotension and precipitation of acute heart failure'
    ],
    summaryHazard: 'Taking two beta-blockers doubles cardiac depression, leading to dangerously slow heart rates, heart block, and fainting.',
    guidance: 'Do not take multiple beta-blockers together. Discuss with your doctor to adjust your dose.'
  },
  ACID_REDUCERS_PPI: {
    id: 'ppi',
    name: 'Proton Pump Inhibitors (PPIs)',
    task: 'suppressing stomach acid production for ulcers and acid reflux',
    genericDrugs: [
      'omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole'
    ],
    brandSynonyms: [
      'prilosec', 'nexium', 'protonix', 'prevacid', 'aciphex', 'omez', 'losec'
    ],
    dangers: [
      'No added therapeutic benefit (proton pumps are already maximally blocked)',
      'Increased risk of severe hypomagnesemia and calcium malabsorption',
      'Higher susceptibility to Clostridioides difficile bowel infections'
    ],
    summaryHazard: 'Taking two PPIs provides no extra acid suppression while raising risks of gut infections and mineral deficiencies.',
    guidance: 'Take only one PPI daily, usually 30–60 minutes before breakfast.'
  },
  ANTIHISTAMINES: {
    id: 'antihistamines',
    name: 'Antihistamines (Allergy & Cold Relievers)',
    task: 'relieving allergy symptoms, itching, runny nose, and sneezing',
    genericDrugs: [
      'cetirizine', 'loratadine', 'fexofenadine', 'levocetirizine',
      'chlorpheniramine', 'diphenhydramine', 'promethazine'
    ],
    brandSynonyms: [
      'zyrtec', 'claritin', 'allegra', 'xyzal', 'piriton', 'benadryl', 'phenergan'
    ],
    dangers: [
      'Severe, additive sedation and cognitive impairment',
      'Severe anticholinergic toxicity (extreme dry mouth, urinary retention, delirium)',
      'Severe danger when driving or operating machinery'
    ],
    summaryHazard: 'Combining multiple antihistamines causes extreme drowsiness, confusion, and urinary blockage.',
    guidance: 'Use only one antihistamine product at a time. If daytime drowsiness is a problem, use non-drowsy options like Cetirizine or Loratadine.'
  },
  SEDATIVES_HYPNOTICS: {
    id: 'sedatives',
    name: 'Sedatives & Sleep Aids',
    task: 'relieving severe anxiety or inducing sleep',
    genericDrugs: [
      'diazepam', 'lorazepam', 'alprazolam', 'clonazepam', 'midazolam',
      'zolpidem', 'zopiclone'
    ],
    brandSynonyms: [
      'valium', 'ativan', 'xanax', 'klonopin', 'ambien', 'imovane'
    ],
    dangers: [
      'Profound, life-threatening central nervous system and respiratory depression',
      'Coma, respiratory arrest, and fatal overdose'
    ],
    summaryHazard: 'Combining multiple sedatives or sleep medications exponentially increases the risk of respiratory arrest and fatal overdose.',
    guidance: 'Never take multiple sleeping pills or anti-anxiety medications concurrently without strict clinical supervision.'
  },
  ANTICOAGULANTS: {
    id: 'anticoagulants',
    name: 'Anticoagulants & Antiplatelets (Blood Thinners)',
    task: 'preventing blood clots, stroke, and cardiovascular events',
    genericDrugs: [
      'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'heparin',
      'enoxaparin', 'clopidogrel', 'aspirin'
    ],
    brandSynonyms: [
      'coumadin', 'xarelto', 'eliquis', 'pradaxa', 'clexane', 'plavix'
    ],
    dangers: [
      'Massive, life-threatening internal hemorrhage (intracranial or gastrointestinal)',
      'Severe prolonged bleeding from minor trauma'
    ],
    summaryHazard: 'Duplication of blood thinners creates an immediate, catastrophic risk of uncontrollable internal bleeding.',
    guidance: 'Never take multiple blood thinners simultaneously unless undergoing a doctor-supervised bridging schedule.'
  },
  ANTIMALARIALS: {
    id: 'antimalarials',
    name: 'Artemisinin-Based Combination Therapies (ACTs)',
    task: 'treating acute malaria parasites',
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
    summaryHazard: 'Taking two full antimalarial regimens simultaneously causes cumulative cardiac arrhythmias without improving recovery.',
    guidance: 'Complete one full prescribed course of antimalarials. Never combine multiple antimalarial products at the same time.'
  }
};

const normalizeDrug = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

export function findLocalTherapeuticClass(drugName?: string | null): TherapeuticClassDef | null {
  if (!drugName) return null;
  const clean = drugName.toLowerCase().trim();
  const normalized = normalizeDrug(clean);

  for (const classDef of Object.values(THERAPEUTIC_CLASSES)) {
    for (const gen of classDef.genericDrugs) {
      if (clean.includes(gen) || normalized.includes(normalizeDrug(gen))) {
        return classDef;
      }
    }
    for (const brand of classDef.brandSynonyms) {
      if (clean.includes(brand) || normalized.includes(normalizeDrug(brand))) {
        return classDef;
      }
    }
  }

  return null;
}

export function detectDuplicateTherapies(medications: Partial<Medicine>[] = []): DuplicateTherapyResult[] {
  if (!Array.isArray(medications) || medications.length < 2) return [];

  const classified = medications.map((m) => {
    const name = m.name || m.genericName || '';
    return { name, localClass: findLocalTherapeuticClass(name) };
  });

  const duplicates: DuplicateTherapyResult[] = [];
  const seenPairs = new Set<string>();

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
          source: 'NDA Uganda & FDA Safety Standards'
        });
      }
    }
  }

  return duplicates;
}

export function isSameTaskOrDuplicateQuery(query?: string | null, activeMeds: Partial<Medicine>[] = []): boolean {
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

  const extracted = extractDrugsFromQuery(query, activeMeds);
  if (extracted.length >= 2) {
    const classes = extracted.map((d) => findLocalTherapeuticClass(d)).filter(Boolean);
    if (classes.length >= 2 && classes[0]?.id === classes[1]?.id) {
      return true;
    }
  }

  return false;
}

export function extractDrugsFromQuery(query?: string | null, activeMeds: Partial<Medicine>[] = []): string[] {
  if (!query || typeof query !== 'string') return [];
  const lower = query.toLowerCase();
  const matched = new Set<string>();

  for (const m of activeMeds) {
    if (m.name && lower.includes(m.name.toLowerCase())) matched.add(m.name);
    if (m.genericName && lower.includes(m.genericName.toLowerCase())) matched.add(m.genericName);
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

export function getDuplicateTherapyAdvice(duplicate: DuplicateTherapyResult, honorific = ''): string {
  const salutation = honorific ? ` ${honorific}` : '';
  const dangersList = duplicate.dangers.map((d) => `• ⚠️ **${d}**`).join('\n');

  return `⚠️ **Therapeutic Duplication Alert**:\n\n` +
    `Bambi${salutation}, taking **${duplicate.drug1}** and **${duplicate.drug2}** together is dangerous because **both medications perform the exact same clinical task** (${duplicate.sharedTask}).\n\n` +
    `**Why this is harmful (Additive Toxicity & Ceiling Effect)**:\n` +
    `Doubling up on medicines from the same class (${duplicate.sharedClass}) **does not give you double the relief**. Instead, it severely multiplies the risk of toxic side effects and organ injury:\n` +
    `${dangersList}\n\n` +
    `**Recommended Next Steps**:\n` +
    `1. **Do not take both medicines at the same time**.\n` +
    `2. ${duplicate.guidance}\n` +
    `3. You can [check your full cabinet in Drug & Food Interactions](/interactions) or [review your active prescriptions in My Medications](/medications).\n\n` +
    `*Source: National Drug Authority (NDA) Uganda & U.S. FDA Drug Safety.*`;
}
