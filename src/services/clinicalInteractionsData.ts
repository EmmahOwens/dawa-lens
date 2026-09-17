/**
 * Authoritative Clinical Drug-Drug Interaction Database & Normalization Engine
 *
 * Provides instant, deterministic, and offline-capable clinical drug safety
 * intelligence. Normalizes brand synonyms to canonical molecules and detects
 * major pharmacological interactions, clinical mechanisms, dose spacing rules,
 * and organ risks.
 */

import { ParsedInteraction } from '../types/interactions';

export interface ClinicalDrugDef {
  canonicalId: string;
  name: string;
  genericClass: string;
  synonyms: string[];
}

export interface ClinicalInteractionRule {
  id: string;
  primary: string; // canonical drug ID or class ID
  secondary: string; // canonical drug ID or class ID
  severity: 'high' | 'warning' | 'moderate' | 'minor';
  title: string;
  description: string;
  mechanism: string;
  spacingHours?: number; // e.g. 2, 4, or undefined if contra-indicated
  actionAdvice: string;
  organRisk: string;
}

// ── 1. Canonical Drug Registry & Brand Synonym Mappings ──────────────────────
export const CANONICAL_DRUGS: Record<string, ClinicalDrugDef> = {
  // NSAIDs
  ibuprofen: {
    canonicalId: 'ibuprofen',
    name: 'Ibuprofen',
    genericClass: 'nsaid',
    synonyms: ['brufen', 'advil', 'motrin', 'nurofen', 'ibu', 'pediaprofen'],
  },
  aspirin: {
    canonicalId: 'aspirin',
    name: 'Aspirin (Acetylsalicylic Acid)',
    genericClass: 'nsaid',
    synonyms: ['disprin', 'cardiprin', 'ecotrin', 'asa', 'acetylsalicylic acid'],
  },
  diclofenac: {
    canonicalId: 'diclofenac',
    name: 'Diclofenac',
    genericClass: 'nsaid',
    synonyms: ['voltaren', 'cataflam', 'k-diclo', 'diclogem', 'diclo'],
  },
  naproxen: {
    canonicalId: 'naproxen',
    name: 'Naproxen',
    genericClass: 'nsaid',
    synonyms: ['aleve', 'naprosyn', 'anaprox'],
  },
  meloxicam: {
    canonicalId: 'meloxicam',
    name: 'Meloxicam',
    genericClass: 'nsaid',
    synonyms: ['mobic', 'melox'],
  },
  celecoxib: {
    canonicalId: 'celecoxib',
    name: 'Celecoxib',
    genericClass: 'nsaid',
    synonyms: ['celebrex'],
  },

  // Analgesics & Antipyretics
  paracetamol: {
    canonicalId: 'paracetamol',
    name: 'Paracetamol',
    genericClass: 'paracetamol',
    synonyms: ['acetaminophen', 'panadol', 'calpol', 'tylenol', 'hedex', 'fevadol'],
  },

  // Anticoagulants & Antiplatelets
  warfarin: {
    canonicalId: 'warfarin',
    name: 'Warfarin',
    genericClass: 'anticoagulant',
    synonyms: ['coumadin', 'marevan', 'jantoven'],
  },
  apixaban: {
    canonicalId: 'apixaban',
    name: 'Apixaban',
    genericClass: 'anticoagulant',
    synonyms: ['eliquis'],
  },
  rivaroxaban: {
    canonicalId: 'rivaroxaban',
    name: 'Rivaroxaban',
    genericClass: 'anticoagulant',
    synonyms: ['xarelto'],
  },
  clopidogrel: {
    canonicalId: 'clopidogrel',
    name: 'Clopidogrel',
    genericClass: 'antiplatelet',
    synonyms: ['plavix'],
  },

  // ACE Inhibitors & ARBs (RAAS)
  lisinopril: {
    canonicalId: 'lisinopril',
    name: 'Lisinopril',
    genericClass: 'raas_inhibitor',
    synonyms: ['zestril', 'prinivil'],
  },
  enalapril: {
    canonicalId: 'enalapril',
    name: 'Enalapril',
    genericClass: 'raas_inhibitor',
    synonyms: ['vasotec'],
  },
  ramipril: {
    canonicalId: 'ramipril',
    name: 'Ramipril',
    genericClass: 'raas_inhibitor',
    synonyms: ['altace'],
  },
  losartan: {
    canonicalId: 'losartan',
    name: 'Losartan',
    genericClass: 'raas_inhibitor',
    synonyms: ['cozaar'],
  },
  valsartan: {
    canonicalId: 'valsartan',
    name: 'Valsartan',
    genericClass: 'raas_inhibitor',
    synonyms: ['diovan'],
  },
  telmisartan: {
    canonicalId: 'telmisartan',
    name: 'Telmisartan',
    genericClass: 'raas_inhibitor',
    synonyms: ['micardis'],
  },

  // Diuretics & Potassium Agents
  spironolactone: {
    canonicalId: 'spironolactone',
    name: 'Spironolactone',
    genericClass: 'potassium_sparing_diuretic',
    synonyms: ['aldactone', 'spiro'],
  },
  potassium: {
    canonicalId: 'potassium',
    name: 'Potassium Chloride',
    genericClass: 'potassium_supplement',
    synonyms: ['potassium', 'k-dur', 'slow-k', 'potassium gluconate', 'potassium citrate'],
  },
  furosemide: {
    canonicalId: 'furosemide',
    name: 'Furosemide',
    genericClass: 'loop_diuretic',
    synonyms: ['lasix', 'frusemide'],
  },
  hydrochlorothiazide: {
    canonicalId: 'hydrochlorothiazide',
    name: 'Hydrochlorothiazide',
    genericClass: 'thiazide_diuretic',
    synonyms: ['hctz', 'microzide'],
  },

  // Nitrates & Vasodilators
  nitroglycerin: {
    canonicalId: 'nitroglycerin',
    name: 'Nitroglycerin',
    genericClass: 'nitrate',
    synonyms: ['nitrostat', 'nitrolingual', 'nitro-dur', 'gtn', 'glyceryl trinitrate'],
  },
  isosorbide: {
    canonicalId: 'isosorbide',
    name: 'Isosorbide Mononitrate / Dinitrate',
    genericClass: 'nitrate',
    synonyms: ['imdur', 'isordil', 'isosorbide mononitrate', 'isosorbide dinitrate'],
  },

  // PDE5 Inhibitors
  sildenafil: {
    canonicalId: 'sildenafil',
    name: 'Sildenafil',
    genericClass: 'pde5_inhibitor',
    synonyms: ['viagra', 'revatio'],
  },
  tadalafil: {
    canonicalId: 'tadalafil',
    name: 'Tadalafil',
    genericClass: 'pde5_inhibitor',
    synonyms: ['cialis', 'adcirca'],
  },

  // Statins
  simvastatin: {
    canonicalId: 'simvastatin',
    name: 'Simvastatin',
    genericClass: 'statin',
    synonyms: ['zocor'],
  },
  atorvastatin: {
    canonicalId: 'atorvastatin',
    name: 'Atorvastatin',
    genericClass: 'statin',
    synonyms: ['lipitor'],
  },
  rosuvastatin: {
    canonicalId: 'rosuvastatin',
    name: 'Rosuvastatin',
    genericClass: 'statin',
    synonyms: ['crestor'],
  },

  // Macrolides & Strong CYP3A4 Inhibitors
  clarithromycin: {
    canonicalId: 'clarithromycin',
    name: 'Clarithromycin',
    genericClass: 'macrolide',
    synonyms: ['biaxin', 'klacid'],
  },
  erythromycin: {
    canonicalId: 'erythromycin',
    name: 'Erythromycin',
    genericClass: 'macrolide',
    synonyms: ['erythrocin', 'e-mycin'],
  },

  // Fluoroquinolones & Antibiotics
  ciprofloxacin: {
    canonicalId: 'ciprofloxacin',
    name: 'Ciprofloxacin',
    genericClass: 'fluoroquinolone',
    synonyms: ['cipro', 'cifran', 'ciprobay'],
  },
  levofloxacin: {
    canonicalId: 'levofloxacin',
    name: 'Levofloxacin',
    genericClass: 'fluoroquinolone',
    synonyms: ['levaquin', 'tavanic'],
  },
  doxycycline: {
    canonicalId: 'doxycycline',
    name: 'Doxycycline',
    genericClass: 'tetracycline',
    synonyms: ['vibramycin', 'doryx'],
  },
  metronidazole: {
    canonicalId: 'metronidazole',
    name: 'Metronidazole',
    genericClass: 'nitroimidazole',
    synonyms: ['flagyl'],
  },

  // Xanthines & Respiratory
  theophylline: {
    canonicalId: 'theophylline',
    name: 'Theophylline',
    genericClass: 'xanthine',
    synonyms: ['theo-dur', 'uniphyl', 'aminophylline'],
  },

  // Cardiac Glycosides & Antiarrhythmics
  digoxin: {
    canonicalId: 'digoxin',
    name: 'Digoxin',
    genericClass: 'cardiac_glycoside',
    synonyms: ['lanoxin'],
  },
  amiodarone: {
    canonicalId: 'amiodarone',
    name: 'Amiodarone',
    genericClass: 'antiarrhythmic',
    synonyms: ['cordarone', 'pacerone'],
  },
  verapamil: {
    canonicalId: 'verapamil',
    name: 'Verapamil',
    genericClass: 'non_dhp_ccb',
    synonyms: ['calan', 'verelan', 'isoptin'],
  },
  diltiazem: {
    canonicalId: 'diltiazem',
    name: 'Diltiazem',
    genericClass: 'non_dhp_ccb',
    synonyms: ['cardizem', 'tiazac'],
  },

  // Beta-Blockers
  atenolol: {
    canonicalId: 'atenolol',
    name: 'Atenolol',
    genericClass: 'beta_blocker',
    synonyms: ['tenormin'],
  },
  metoprolol: {
    canonicalId: 'metoprolol',
    name: 'Metoprolol',
    genericClass: 'beta_blocker',
    synonyms: ['lopressor', 'toprol'],
  },
  carvedilol: {
    canonicalId: 'carvedilol',
    name: 'Carvedilol',
    genericClass: 'beta_blocker',
    synonyms: ['coreg'],
  },

  // SSRIs & Antidepressants
  fluoxetine: {
    canonicalId: 'fluoxetine',
    name: 'Fluoxetine',
    genericClass: 'ssri',
    synonyms: ['prozac', 'sarafem'],
  },
  sertraline: {
    canonicalId: 'sertraline',
    name: 'Sertraline',
    genericClass: 'ssri',
    synonyms: ['zoloft'],
  },
  escitalopram: {
    canonicalId: 'escitalopram',
    name: 'Escitalopram',
    genericClass: 'ssri',
    synonyms: ['lexapro', 'cipralex'],
  },
  citalopram: {
    canonicalId: 'citalopram',
    name: 'Citalopram',
    genericClass: 'ssri',
    synonyms: ['celexa'],
  },
  amitriptyline: {
    canonicalId: 'amitriptyline',
    name: 'Amitriptyline',
    genericClass: 'tca',
    synonyms: ['elavil', 'endep'],
  },

  // Opioids & Central Analgesics
  tramadol: {
    canonicalId: 'tramadol',
    name: 'Tramadol',
    genericClass: 'opioid_serotonergic',
    synonyms: ['ultram', 'tramal'],
  },

  // Immunosuppressants & DMARDs
  methotrexate: {
    canonicalId: 'methotrexate',
    name: 'Methotrexate',
    genericClass: 'antimetabolite',
    synonyms: ['trexall', 'mtx'],
  },
  azathioprine: {
    canonicalId: 'azathioprine',
    name: 'Azathioprine',
    genericClass: 'thiopurine',
    synonyms: ['imuran'],
  },
  allopurinol: {
    canonicalId: 'allopurinol',
    name: 'Allopurinol',
    genericClass: 'xanthine_oxidase_inhibitor',
    synonyms: ['zyloprim', 'alloril'],
  },

  // Mood Stabilizers
  lithium: {
    canonicalId: 'lithium',
    name: 'Lithium',
    genericClass: 'mood_stabilizer',
    synonyms: ['eskalith', 'lithobid', 'lithium carbonate'],
  },

  // Antidiabetics
  metformin: {
    canonicalId: 'metformin',
    name: 'Metformin',
    genericClass: 'biguanide',
    synonyms: ['glucophage'],
  },
  glibenclamide: {
    canonicalId: 'glibenclamide',
    name: 'Glibenclamide (Glyburide)',
    genericClass: 'sulfonylurea',
    synonyms: ['glyburide', 'daonil', 'micronase'],
  },

  // Proton Pump Inhibitors
  omeprazole: {
    canonicalId: 'omeprazole',
    name: 'Omeprazole',
    genericClass: 'ppi',
    synonyms: ['prilosec', 'losec', 'omiz'],
  },
  esomeprazole: {
    canonicalId: 'esomeprazole',
    name: 'Esomeprazole',
    genericClass: 'ppi',
    synonyms: ['nexium'],
  },

  // Polyvalent Cations & Supplements
  calcium: {
    canonicalId: 'calcium',
    name: 'Calcium / Antacid',
    genericClass: 'cation_antacid',
    synonyms: ['calcium carbonate', 'tums', 'antacid', 'magnesium hydroxide', 'aluminum hydroxide', 'maalox', 'quick-act'],
  },
  iron: {
    canonicalId: 'iron',
    name: 'Iron (Ferrous Sulfate)',
    genericClass: 'iron_supplement',
    synonyms: ['ferrous sulfate', 'ferrous gluconate', 'feosol', 'iron supplement', 'orofer'],
  },
};

// ── 2. Curated Clinical Drug-Drug Interaction Rules ──────────────────────────
export const CLINICAL_INTERACTION_RULES: ClinicalInteractionRule[] = [
  // 1. NSAID + Anticoagulant (e.g. Ibuprofen + Warfarin / Apixaban)
  {
    id: 'nsaid_anticoagulant',
    primary: 'nsaid',
    secondary: 'anticoagulant',
    severity: 'high',
    title: 'Severe Gastrointestinal Hemorrhage Risk',
    description: 'Combining an NSAID with an anticoagulant multiplies the risk of severe gastrointestinal bleeding and internal hemorrhages.',
    mechanism: 'NSAIDs inhibit gastric protective prostaglandins and impair platelet aggregation, which synergizes dangerously with systemic anticoagulation.',
    actionAdvice: 'Avoid concurrent use unless strictly supervised by a hematologist or cardiologist. Paracetamol is the preferred pain/fever alternative.',
    organRisk: 'Gastrointestinal & Vascular Bleeding',
  },

  // 2. NSAID + Antiplatelet (e.g. Ibuprofen + Clopidogrel or Aspirin + Ibuprofen)
  {
    id: 'nsaid_antiplatelet',
    primary: 'nsaid',
    secondary: 'antiplatelet',
    severity: 'high',
    title: 'Marked Bleeding & Cardioprotection Blockade',
    description: 'Concurrent use markedly elevates bleeding risk. In addition, Ibuprofen competitively blocks Aspirin’s antiplatelet cardioprotective action.',
    mechanism: 'Additive platelet inhibition and gastric mucosal ulceration; competitive binding for platelet COX-1 active site.',
    actionAdvice: 'Take low-dose Aspirin at least 30 minutes to 2 hours BEFORE taking Ibuprofen, or switch to Paracetamol.',
    spacingHours: 2,
    organRisk: 'Gastrointestinal & Cardiovascular',
  },

  // 3. RAAS Inhibitors + Potassium-Sparing Diuretics / Supplements (e.g. Lisinopril + Spironolactone / Potassium)
  {
    id: 'raas_potassium',
    primary: 'raas_inhibitor',
    secondary: 'potassium_sparing_diuretic',
    severity: 'high',
    title: 'Life-Threatening Hyperkalemia Risk',
    description: 'Concurrent use severely impairs potassium excretion, causing dangerous spikes in blood potassium that can trigger cardiac arrest.',
    mechanism: 'ACE inhibitors/ARBs decrease aldosterone production, while spironolactone directly blocks aldosterone receptors in the distal renal tubule.',
    actionAdvice: 'Requires regular serum potassium and renal function monitoring. Do not add potassium supplements without direct physician orders.',
    organRisk: 'Heart (Arrhythmia / Cardiac Arrest) & Kidneys',
  },
  {
    id: 'raas_potassium_supplement',
    primary: 'raas_inhibitor',
    secondary: 'potassium_supplement',
    severity: 'high',
    title: 'Severe Hyperkalemia Risk',
    description: 'ACE inhibitors or ARBs reduce renal potassium elimination. Combining them with potassium supplements can induce life-threatening hyperkalemia.',
    mechanism: 'Additive potassium retention exceeding kidney excretory capacity.',
    actionAdvice: 'Never take potassium supplements with blood pressure RAAS inhibitors unless specifically prescribed and monitored by a doctor.',
    organRisk: 'Heart (Cardiac Arrhythmias)',
  },

  // 4. PDE5 Inhibitors + Nitrates (e.g. Sildenafil + Nitroglycerin / Isosorbide)
  {
    id: 'pde5_nitrate',
    primary: 'pde5_inhibitor',
    secondary: 'nitrate',
    severity: 'high',
    title: 'Fatal Hypotension & Cardiovascular Collapse',
    description: 'Absolute Contraindication. Co-administration causes profound, refractory drops in systemic blood pressure and circulatory shock.',
    mechanism: 'Nitrates produce nitric oxide which stimulates cGMP, while PDE5 inhibitors block cGMP breakdown, causing massive uninhibited vasodilation.',
    actionAdvice: 'DO NOT COMBINE. Nitroglycerin must not be administered within 24 hours of Sildenafil or within 48 hours of Tadalafil.',
    organRisk: 'Cardiovascular System (Profound Shock)',
  },

  // 5. SSRI / SNRI + Tramadol (Serotonin Syndrome)
  {
    id: 'ssri_tramadol',
    primary: 'ssri',
    secondary: 'tramadol',
    severity: 'high',
    title: 'Serotonin Syndrome & Seizure Hazard',
    description: 'Combining SSRI antidepressants with Tramadol increases the risk of life-threatening Serotonin Syndrome and significantly lowers seizure threshold.',
    mechanism: 'Both agents inhibit serotonin reuptake. Tramadol also possesses mild direct serotonergic agonist and pro-convulsant actions.',
    actionAdvice: 'Seek urgent medical attention if experiencing high fever, muscle rigidity, tremors, agitation, or confusion. Discuss non-serotonergic analgesics with your physician.',
    organRisk: 'Central Nervous System (Serotonin Syndrome & Seizures)',
  },

  // 6. Methotrexate + NSAID (e.g. Methotrexate + Ibuprofen / Diclofenac / Naproxen)
  {
    id: 'methotrexate_nsaid',
    primary: 'antimetabolite',
    secondary: 'nsaid',
    severity: 'high',
    title: 'Severe Methotrexate Toxicity & Bone Marrow Suppression',
    description: 'NSAIDs reduce the kidney clearance of Methotrexate, causing toxic blood accumulations leading to bone marrow failure and severe pancytopenia.',
    mechanism: 'NSAIDs inhibit renal prostaglandin-mediated perfusion and compete for organic anion transporters (OAT3) responsible for methotrexate excretion.',
    actionAdvice: 'Do not take over-the-counter NSAIDs with Methotrexate without explicit specialist oversight. Use Paracetamol for pain or fever.',
    organRisk: 'Bone Marrow (Pancytopenia) & Kidneys',
  },

  // 7. Statins + Macrolides / Strong CYP3A4 Inhibitors (e.g. Simvastatin / Atorvastatin + Clarithromycin / Erythromycin)
  {
    id: 'statin_macrolide',
    primary: 'statin',
    secondary: 'macrolide',
    severity: 'high',
    title: 'Rhabdomyolysis & Acute Renal Failure',
    description: 'Clarithromycin and Erythromycin drastically increase statin concentrations, raising the risk of severe muscle breakdown (rhabdomyolysis) and kidney damage.',
    mechanism: 'Potent inhibition of hepatic CYP3A4 enzyme responsible for first-pass metabolism of simvastatin and atorvastatin.',
    actionAdvice: 'Temporarily pause Simvastatin or Atorvastatin during the macrolide antibiotic course as guided by your physician.',
    organRisk: 'Skeletal Muscle (Rhabdomyolysis) & Kidneys',
  },

  // 8. Digoxin + Amiodarone / Verapamil / Diltiazem
  {
    id: 'digoxin_antiarrhythmic',
    primary: 'cardiac_glycoside',
    secondary: 'antiarrhythmic',
    severity: 'high',
    title: 'Fatal Digoxin Toxicity & Heart Block',
    description: 'Amiodarone substantially increases digoxin blood levels, causing lethal digitalis arrhythmias, nausea, visual halos, and heart block.',
    mechanism: 'Inhibition of P-glycoprotein (P-gp) mediated renal and non-renal clearance of digoxin.',
    actionAdvice: 'Digoxin dose usually needs to be reduced by 30%–50% upon starting Amiodarone, with rigorous serum digoxin monitoring.',
    organRisk: 'Heart (Digitalis Toxicity & AV Block)',
  },
  {
    id: 'digoxin_non_dhp_ccb',
    primary: 'cardiac_glycoside',
    secondary: 'non_dhp_ccb',
    severity: 'high',
    title: 'Severe Bradycardia & Digoxin Toxicity',
    description: 'Verapamil or Diltiazem elevates digoxin levels and exerts additive depression on the sinoatrial and atrioventricular nodes.',
    mechanism: 'P-glycoprotein inhibition reduces digoxin clearance; additive negative dromotropic effects on the AV node.',
    actionAdvice: 'Monitor pulse rate daily and check digoxin blood concentrations. Report dizziness or pulse below 50 bpm immediately.',
    organRisk: 'Heart (Severe Bradycardia & AV Block)',
  },

  // 9. Beta-Blockers + Non-DHP Calcium Channel Blockers (e.g. Atenolol + Verapamil)
  {
    id: 'beta_blocker_non_dhp_ccb',
    primary: 'beta_blocker',
    secondary: 'non_dhp_ccb',
    severity: 'high',
    title: 'Severe Bradycardia & Cardiogenic Shock',
    description: 'Combining a beta-blocker with Verapamil or Diltiazem causes profound cardiac depression, severe bradycardia, and congestive heart failure.',
    mechanism: 'Synergistic negative inotropic and chronotropic inhibition of cardiac contraction and electrical conduction.',
    actionAdvice: 'Do not combine unless managed in an inpatient cardiac monitoring setting.',
    organRisk: 'Heart (Cardiogenic Shock & Complete Heart Block)',
  },

  // 10. Fluoroquinolones + Theophylline (e.g. Ciprofloxacin + Theophylline)
  {
    id: 'fluoroquinolone_theophylline',
    primary: 'fluoroquinolone',
    secondary: 'xanthine',
    severity: 'high',
    title: 'Theophylline Toxicity & Seizure Risk',
    description: 'Ciprofloxacin inhibits the breakdown of Theophylline, causing toxic accumulation that can trigger cardiac arrhythmias, nausea, and seizures.',
    mechanism: 'Potent inhibition of hepatic CYP1A2 enzyme by Ciprofloxacin.',
    actionAdvice: 'Reduce theophylline dosage and monitor theophylline serum levels, or choose an alternative antibiotic (e.g. amoxicillin/azithromycin).',
    organRisk: 'Brain (Seizures) & Cardiovascular Arrhythmias',
  },

  // 11. Lithium + NSAIDs / ACE Inhibitors / Diuretics
  {
    id: 'lithium_nsaid',
    primary: 'mood_stabilizer',
    secondary: 'nsaid',
    severity: 'high',
    title: 'Severe Lithium Poisoning & Neurotoxicity',
    description: 'NSAIDs reduce renal lithium clearance, causing rapid toxic accumulation of lithium leading to confusion, tremors, ataxia, and renal shutdown.',
    mechanism: 'Renal prostaglandin inhibition decreases glomerular filtration and increases proximal tubular reabsorption of lithium.',
    actionAdvice: 'Avoid NSAIDs like Ibuprofen or Diclofenac if taking Lithium. Paracetamol is the safe alternative.',
    organRisk: 'Brain (Neurotoxicity, Coma) & Kidneys',
  },
  {
    id: 'lithium_raas',
    primary: 'mood_stabilizer',
    secondary: 'raas_inhibitor',
    severity: 'high',
    title: 'Lithium Toxicity',
    description: 'ACE inhibitors and ARBs significantly increase serum lithium levels by reducing renal excretion.',
    mechanism: 'Decreased glomerular filtration and altered sodium-lithium counter-transport in the kidney.',
    actionAdvice: 'Requires frequent lithium therapeutic drug monitoring and dosage reductions upon initiating ACE inhibitors.',
    organRisk: 'Central Nervous System & Kidneys',
  },

  // 12. Clopidogrel + Omeprazole / Esomeprazole
  {
    id: 'clopidogrel_omeprazole',
    primary: 'clopidogrel',
    secondary: 'omeprazole',
    severity: 'warning',
    title: 'Diminished Antiplatelet Efficacy (Stent Thrombosis Risk)',
    description: 'Omeprazole prevents Clopidogrel from converting into its active form, significantly increasing the risk of blood clots and recurrent heart attacks.',
    mechanism: 'Competitive inhibition of hepatic CYP2C19, the primary enzyme required to bioactivate the prodrug Clopidogrel.',
    actionAdvice: 'Switch to a PPI with minimal CYP2C19 inhibition such as Pantoprazole, or use an H2 blocker like Famotidine.',
    organRisk: 'Cardiovascular (Stent Thrombosis / Heart Attack)',
  },

  // 13. Fluoroquinolones / Tetracyclines + Divalent/Trivalent Cations (Ciprofloxacin/Doxycycline + Calcium/Iron/Antacids)
  {
    id: 'antibiotic_cation_calcium',
    primary: 'fluoroquinolone',
    secondary: 'cation_antacid',
    severity: 'moderate',
    title: 'Reduced Antibiotic Absorption & Treatment Failure',
    description: 'Antacids and calcium bind to Ciprofloxacin in the stomach, blocking its absorption and causing bacterial infection treatment failure.',
    mechanism: 'Chelation between polyvalent metal cations (Ca2+, Mg2+, Al3+) and the antibiotic molecule forming an insoluble precipitate.',
    actionAdvice: 'Take Ciprofloxacin at least 2 hours before or 4 to 6 hours after antacids, dairy, or calcium supplements.',
    spacingHours: 2,
    organRisk: 'Gastrointestinal & Systemic Infection Failure',
  },
  {
    id: 'tetracycline_iron',
    primary: 'tetracycline',
    secondary: 'iron_supplement',
    severity: 'moderate',
    title: 'Antibiotic Inactivation via Chelation',
    description: 'Iron supplements bind Doxycycline in the gut, dramatically reducing blood absorption of both iron and the antibiotic.',
    mechanism: 'Insoluble chelate complex formation between ferrous ions and tetracycline rings.',
    actionAdvice: 'Space oral iron supplements and Doxycycline by at least 2 to 3 hours.',
    spacingHours: 3,
    organRisk: 'Antibiotic Inefficacy & Iron Malabsorption',
  },

  // 14. Azathioprine + Allopurinol
  {
    id: 'azathioprine_allopurinol',
    primary: 'thiopurine',
    secondary: 'xanthine_oxidase_inhibitor',
    severity: 'high',
    title: 'Fatal Bone Marrow Aplasia & Pancytopenia',
    description: 'Allopurinol blocks the breakdown of Azathioprine, leading to massive accumulation of cytotoxic 6-thioguanine and fatal bone marrow failure.',
    mechanism: 'Inhibition of xanthine oxidase, the primary catabolic route for 6-mercaptopurine.',
    actionAdvice: 'Reduce Azathioprine dosage to 25%–33% of standard dose with close hematologic monitoring, or avoid combination.',
    organRisk: 'Bone Marrow (Fatal Pancytopenia)',
  },

  // 15. Warfarin + Metronidazole
  {
    id: 'warfarin_metronidazole',
    primary: 'anticoagulant',
    secondary: 'nitroimidazole',
    severity: 'high',
    title: 'Profound INR Elevation & Hemorrhage Risk',
    description: 'Metronidazole strongly inhibits Warfarin metabolism, causing acute spikes in the International Normalized Ratio (INR) and spontaneous bleeding.',
    mechanism: 'Inhibition of CYP2C9 metabolism of the potent S-warfarin enantiomer.',
    actionAdvice: 'Anticipate a 30% to 50% warfarin dose reduction and check INR within 2 to 3 days of starting Flagyl (Metronidazole).',
    organRisk: 'Systemic Hemorrhage & Brain/GI Bleeding',
  },

  // 16. Warfarin + Paracetamol (High Dose / Chronic)
  {
    id: 'warfarin_paracetamol',
    primary: 'anticoagulant',
    secondary: 'paracetamol',
    severity: 'moderate',
    title: 'Potential INR Elevation with Sustained Dosing',
    description: 'Taking high doses of Paracetamol (above 2,000 mg/day for several days) can enhance the blood-thinning effect of Warfarin and raise INR.',
    mechanism: 'Paracetamol metabolite NAPQI inhibits vitamin K carboxylase in the liver.',
    actionAdvice: 'Limit Paracetamol to the lowest effective dose (under 2,000 mg/day) and monitor INR if taken for more than 3 consecutive days.',
    organRisk: 'Coagulation Cascade',
  },

  // 17. Sulfonylureas + Fluoroquinolones (e.g. Glibenclamide + Ciprofloxacin)
  {
    id: 'sulfonylurea_quinolone',
    primary: 'sulfonylurea',
    secondary: 'fluoroquinolone',
    severity: 'warning',
    title: 'Severe Dysglycemia / Hypoglycemia Shock',
    description: 'Fluoroquinolones can trigger acute, profound hypoglycemia in patients taking sulfonylureas, potentially leading to coma.',
    mechanism: 'Blockade of ATP-sensitive potassium channels in pancreatic beta cells, stimulating excessive insulin release.',
    actionAdvice: 'Monitor blood glucose closely. Have oral glucose or fast-acting carbohydrates readily available.',
    organRisk: 'Metabolic & Brain (Hypoglycemic Coma)',
  },

  // 18. Aspirin + Ibuprofen
  {
    id: 'aspirin_ibuprofen',
    primary: 'aspirin',
    secondary: 'ibuprofen',
    severity: 'warning',
    title: 'Cardioprotection Interference & Increased GI Risk',
    description: 'Ibuprofen prevents Aspirin from permanently inactivating platelets, neutralizing Aspirin’s protective action against heart attack and stroke.',
    mechanism: 'Competitive reversible binding at the platelet COX-1 channel prevents Aspirin access to the Ser529 acetylation site.',
    actionAdvice: 'Take immediate-release low-dose Aspirin at least 30 to 60 minutes BEFORE taking Ibuprofen, or space by at least 8 hours after.',
    spacingHours: 2,
    organRisk: 'Cardiovascular (Loss of Antiplatelet Protection)',
  },
];

// ── 3. Normalization & Matching Helpers ─────────────────────────────────────

export const normalizeDrugString = (str?: string | null): string => {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/\b\d+(\.\d+)?\s*(mg|g|mcg|ml|tabs?|caps?|tablets?)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Resolves any free-form drug name, brand synonym, or generic string
 * to its canonical drug definition.
 */
export function resolveCanonicalDrug(query?: string | null): ClinicalDrugDef | null {
  if (!query) return null;
  const raw = query.toLowerCase().trim();
  const normalized = normalizeDrugString(raw);

  // 1. Exact key match
  if (CANONICAL_DRUGS[raw]) return CANONICAL_DRUGS[raw];
  if (CANONICAL_DRUGS[normalized]) return CANONICAL_DRUGS[normalized];

  // 2. Iterate canonical drugs and their synonyms
  for (const drug of Object.values(CANONICAL_DRUGS)) {
    if (normalized === normalizeDrugString(drug.name)) return drug;
    if (raw.includes(drug.name.toLowerCase()) || normalized.includes(normalizeDrugString(drug.name))) {
      return drug;
    }
    for (const syn of drug.synonyms) {
      if (normalized === normalizeDrugString(syn)) return drug;
      if (raw.includes(syn) || normalized.includes(normalizeDrugString(syn))) {
        return drug;
      }
    }
  }

  return null;
}

/**
 * Checks if two drug strings represent the same drug substance.
 * Used to neglect duplicate entries (e.g. Ibuprofen and Ibuprofen).
 */
export function isSameDrugSubstance(drugA?: string | null, drugB?: string | null): boolean {
  if (!drugA || !drugB) return false;
  const rawA = drugA.toLowerCase().trim();
  const rawB = drugB.toLowerCase().trim();
  if (rawA === rawB) return true;

  const normA = normalizeDrugString(rawA);
  const normB = normalizeDrugString(rawB);
  if (normA && normB && normA === normB) return true;

  const canonicalA = resolveCanonicalDrug(drugA);
  const canonicalB = resolveCanonicalDrug(drugB);
  if (canonicalA && canonicalB && canonicalA.canonicalId === canonicalB.canonicalId) {
    return true;
  }

  return false;
}

/**
 * Evaluates clinical drug-drug interactions between a pair of medications.
 * Returns null if the two medications are duplicates of each other (neglecting duplicates).
 */
export function evaluateClinicalInteraction(
  medA: string,
  medB: string
): ParsedInteraction | null {
  // CRITICAL RULE: If both represent the same drug, neglect the pair!
  if (isSameDrugSubstance(medA, medB)) {
    return null;
  }

  const defA = resolveCanonicalDrug(medA);
  const defB = resolveCanonicalDrug(medB);

  // If neither drug is identified in our clinical catalog, cannot match local rules
  if (!defA && !defB) return null;

  for (const rule of CLINICAL_INTERACTION_RULES) {
    const matchesAtoB = matchesRuleSide(defA, rule.primary) && matchesRuleSide(defB, rule.secondary);
    const matchesBtoA = matchesRuleSide(defB, rule.primary) && matchesRuleSide(defA, rule.secondary);

    if (matchesAtoB || matchesBtoA) {
      const name1 = defA ? defA.name : medA;
      const name2 = defB ? defB.name : medB;

      let enhancedDescription = rule.description;
      if (rule.mechanism) {
        enhancedDescription += ` Mechanism: ${rule.mechanism}`;
      }
      if (rule.actionAdvice) {
        enhancedDescription += ` Guidance: ${rule.actionAdvice}`;
      }

      return {
        drug1: name1,
        drug2: name2,
        severity: rule.severity === 'high' ? 'high' : 'warning',
        description: enhancedDescription,
        // Clinical metadata
        clinicalDetails: {
          title: rule.title,
          mechanism: rule.mechanism,
          actionAdvice: rule.actionAdvice,
          spacingHours: rule.spacingHours,
          organRisk: rule.organRisk,
        },
      };
    }
  }

  return null;
}

function matchesRuleSide(drug: ClinicalDrugDef | null, ruleTarget: string): boolean {
  if (!drug) return false;
  return drug.canonicalId === ruleTarget || drug.genericClass === ruleTarget;
}

/**
 * Deduplicates an active medication array so that duplicate entries of the same substance
 * (e.g. Ibuprofen 200mg and Ibuprofen 400mg, or duplicate cabinet items) are neglected.
 */
export function deduplicateMedicationList<T extends { name?: string; genericName?: string }>(
  medications: T[]
): { distinctMedications: T[]; neglectedDuplicatesCount: number } {
  if (!Array.isArray(medications)) return { distinctMedications: [], neglectedDuplicatesCount: 0 };

  const distinct: T[] = [];
  let neglectedCount = 0;

  for (const med of medications) {
    const medName = med.name || med.genericName || '';
    if (!medName.trim()) continue;

    const alreadyPresent = distinct.some((existing) => {
      const existingName = existing.name || existing.genericName || '';
      return isSameDrugSubstance(existingName, medName);
    });

    if (alreadyPresent) {
      neglectedCount++;
    } else {
      distinct.push(med);
    }
  }

  return { distinctMedications: distinct, neglectedDuplicatesCount: neglectedCount };
}
