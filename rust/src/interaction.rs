//! Authoritative Clinical Drug-Drug Interaction & Substance Normalization Engine (Rust Core)
//!
//! Memory-safe, zero-network-dependency clinical drug safety engine compiled to both
//! Android Native (JNI) and WebAssembly (`wasm32-unknown-unknown`).
//! Mirrors `src/services/clinicalInteractionsData.ts` 1:1.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClinicalDrugDef {
    pub canonical_id: &'static str,
    pub name: &'static str,
    pub generic_class: &'static str,
    pub synonyms: &'static [&'static str],
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClinicalDetails {
    pub title: &'static str,
    pub mechanism: &'static str,
    pub action_advice: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spacing_hours: Option<u32>,
    pub organ_risk: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedInteraction {
    pub drug1: String,
    pub drug2: String,
    pub severity: &'static str,
    pub description: String,
    pub clinical_details: ClinicalDetails,
}

pub struct ClinicalInteractionRule {
    pub id: &'static str,
    pub primary: &'static str,
    pub secondary: &'static str,
    pub severity: &'static str, // "high" | "warning" | "moderate" | "minor"
    pub title: &'static str,
    pub description: &'static str,
    pub mechanism: &'static str,
    pub spacing_hours: Option<u32>,
    pub action_advice: &'static str,
    pub organ_risk: &'static str,
}

pub static CANONICAL_DRUGS: &[ClinicalDrugDef] = &[
    // NSAIDs
    ClinicalDrugDef {
        canonical_id: "ibuprofen",
        name: "Ibuprofen",
        generic_class: "nsaid",
        synonyms: &["brufen", "advil", "motrin", "nurofen", "ibu", "pediaprofen"],
    },
    ClinicalDrugDef {
        canonical_id: "aspirin",
        name: "Aspirin (Acetylsalicylic Acid)",
        generic_class: "nsaid",
        synonyms: &["disprin", "cardiprin", "ecotrin", "asa", "acetylsalicylic acid"],
    },
    ClinicalDrugDef {
        canonical_id: "diclofenac",
        name: "Diclofenac",
        generic_class: "nsaid",
        synonyms: &["voltaren", "cataflam", "k-diclo", "diclogem", "diclo"],
    },
    ClinicalDrugDef {
        canonical_id: "naproxen",
        name: "Naproxen",
        generic_class: "nsaid",
        synonyms: &["aleve", "naprosyn", "anaprox"],
    },
    ClinicalDrugDef {
        canonical_id: "meloxicam",
        name: "Meloxicam",
        generic_class: "nsaid",
        synonyms: &["mobic", "melox"],
    },
    ClinicalDrugDef {
        canonical_id: "celecoxib",
        name: "Celecoxib",
        generic_class: "nsaid",
        synonyms: &["celebrex"],
    },
    // Analgesics & Antipyretics
    ClinicalDrugDef {
        canonical_id: "paracetamol",
        name: "Paracetamol",
        generic_class: "paracetamol",
        synonyms: &["acetaminophen", "panadol", "calpol", "tylenol", "hedex", "fevadol"],
    },
    // Anticoagulants & Antiplatelets
    ClinicalDrugDef {
        canonical_id: "warfarin",
        name: "Warfarin",
        generic_class: "anticoagulant",
        synonyms: &["coumadin", "marevan", "jantoven"],
    },
    ClinicalDrugDef {
        canonical_id: "apixaban",
        name: "Apixaban",
        generic_class: "anticoagulant",
        synonyms: &["eliquis"],
    },
    ClinicalDrugDef {
        canonical_id: "rivaroxaban",
        name: "Rivaroxaban",
        generic_class: "anticoagulant",
        synonyms: &["xarelto"],
    },
    ClinicalDrugDef {
        canonical_id: "clopidogrel",
        name: "Clopidogrel",
        generic_class: "antiplatelet",
        synonyms: &["plavix"],
    },
    // ACE Inhibitors & ARBs (RAAS)
    ClinicalDrugDef {
        canonical_id: "lisinopril",
        name: "Lisinopril",
        generic_class: "raas_inhibitor",
        synonyms: &["zestril", "prinivil"],
    },
    ClinicalDrugDef {
        canonical_id: "enalapril",
        name: "Enalapril",
        generic_class: "raas_inhibitor",
        synonyms: &["vasotec"],
    },
    ClinicalDrugDef {
        canonical_id: "ramipril",
        name: "Ramipril",
        generic_class: "raas_inhibitor",
        synonyms: &["altace"],
    },
    ClinicalDrugDef {
        canonical_id: "losartan",
        name: "Losartan",
        generic_class: "raas_inhibitor",
        synonyms: &["cozaar"],
    },
    ClinicalDrugDef {
        canonical_id: "valsartan",
        name: "Valsartan",
        generic_class: "raas_inhibitor",
        synonyms: &["diovan"],
    },
    ClinicalDrugDef {
        canonical_id: "telmisartan",
        name: "Telmisartan",
        generic_class: "raas_inhibitor",
        synonyms: &["micardis"],
    },
    // Diuretics & Potassium Agents
    ClinicalDrugDef {
        canonical_id: "spironolactone",
        name: "Spironolactone",
        generic_class: "potassium_sparing_diuretic",
        synonyms: &["aldactone", "spiro"],
    },
    ClinicalDrugDef {
        canonical_id: "potassium",
        name: "Potassium Chloride",
        generic_class: "potassium_supplement",
        synonyms: &["potassium", "k-dur", "slow-k", "potassium gluconate", "potassium citrate"],
    },
    ClinicalDrugDef {
        canonical_id: "furosemide",
        name: "Furosemide",
        generic_class: "loop_diuretic",
        synonyms: &["lasix", "frusemide"],
    },
    ClinicalDrugDef {
        canonical_id: "hydrochlorothiazide",
        name: "Hydrochlorothiazide",
        generic_class: "thiazide_diuretic",
        synonyms: &["hctz", "microzide"],
    },
    // Nitrates & Vasodilators
    ClinicalDrugDef {
        canonical_id: "nitroglycerin",
        name: "Nitroglycerin",
        generic_class: "nitrate",
        synonyms: &["nitrostat", "nitrolingual", "nitro-dur", "gtn", "glyceryl trinitrate"],
    },
    ClinicalDrugDef {
        canonical_id: "isosorbide",
        name: "Isosorbide Mononitrate / Dinitrate",
        generic_class: "nitrate",
        synonyms: &["imdur", "isordil", "isosorbide mononitrate", "isosorbide dinitrate"],
    },
    // PDE5 Inhibitors
    ClinicalDrugDef {
        canonical_id: "sildenafil",
        name: "Sildenafil",
        generic_class: "pde5_inhibitor",
        synonyms: &["viagra", "revatio"],
    },
    ClinicalDrugDef {
        canonical_id: "tadalafil",
        name: "Tadalafil",
        generic_class: "pde5_inhibitor",
        synonyms: &["cialis", "adcirca"],
    },
    // Statins
    ClinicalDrugDef {
        canonical_id: "simvastatin",
        name: "Simvastatin",
        generic_class: "statin",
        synonyms: &["zocor"],
    },
    ClinicalDrugDef {
        canonical_id: "atorvastatin",
        name: "Atorvastatin",
        generic_class: "statin",
        synonyms: &["lipitor"],
    },
    ClinicalDrugDef {
        canonical_id: "rosuvastatin",
        name: "Rosuvastatin",
        generic_class: "statin",
        synonyms: &["crestor"],
    },
    // Macrolides & Strong CYP3A4 Inhibitors
    ClinicalDrugDef {
        canonical_id: "clarithromycin",
        name: "Clarithromycin",
        generic_class: "macrolide",
        synonyms: &["biaxin", "klacid"],
    },
    ClinicalDrugDef {
        canonical_id: "erythromycin",
        name: "Erythromycin",
        generic_class: "macrolide",
        synonyms: &["erythrocin", "e-mycin"],
    },
    // Fluoroquinolones & Antibiotics
    ClinicalDrugDef {
        canonical_id: "ciprofloxacin",
        name: "Ciprofloxacin",
        generic_class: "fluoroquinolone",
        synonyms: &["cipro", "cifran", "ciprobay"],
    },
    ClinicalDrugDef {
        canonical_id: "levofloxacin",
        name: "Levofloxacin",
        generic_class: "fluoroquinolone",
        synonyms: &["levaquin", "tavanic"],
    },
    ClinicalDrugDef {
        canonical_id: "doxycycline",
        name: "Doxycycline",
        generic_class: "tetracycline",
        synonyms: &["vibramycin", "doryx"],
    },
    ClinicalDrugDef {
        canonical_id: "metronidazole",
        name: "Metronidazole",
        generic_class: "nitroimidazole",
        synonyms: &["flagyl"],
    },
    // Xanthines & Respiratory
    ClinicalDrugDef {
        canonical_id: "theophylline",
        name: "Theophylline",
        generic_class: "xanthine",
        synonyms: &["theo-dur", "uniphyl", "aminophylline"],
    },
    // Cardiac Glycosides & Antiarrhythmics
    ClinicalDrugDef {
        canonical_id: "digoxin",
        name: "Digoxin",
        generic_class: "cardiac_glycoside",
        synonyms: &["lanoxin"],
    },
    ClinicalDrugDef {
        canonical_id: "amiodarone",
        name: "Amiodarone",
        generic_class: "antiarrhythmic",
        synonyms: &["cordarone", "pacerone"],
    },
    ClinicalDrugDef {
        canonical_id: "verapamil",
        name: "Verapamil",
        generic_class: "non_dhp_ccb",
        synonyms: &["calan", "verelan", "isoptin"],
    },
    ClinicalDrugDef {
        canonical_id: "diltiazem",
        name: "Diltiazem",
        generic_class: "non_dhp_ccb",
        synonyms: &["cardizem", "tiazac"],
    },
    // Beta-Blockers
    ClinicalDrugDef {
        canonical_id: "atenolol",
        name: "Atenolol",
        generic_class: "beta_blocker",
        synonyms: &["tenormin"],
    },
    ClinicalDrugDef {
        canonical_id: "metoprolol",
        name: "Metoprolol",
        generic_class: "beta_blocker",
        synonyms: &["lopressor", "toprol"],
    },
    ClinicalDrugDef {
        canonical_id: "carvedilol",
        name: "Carvedilol",
        generic_class: "beta_blocker",
        synonyms: &["coreg"],
    },
    // SSRIs & Antidepressants
    ClinicalDrugDef {
        canonical_id: "fluoxetine",
        name: "Fluoxetine",
        generic_class: "ssri",
        synonyms: &["prozac", "sarafem"],
    },
    ClinicalDrugDef {
        canonical_id: "sertraline",
        name: "Sertraline",
        generic_class: "ssri",
        synonyms: &["zoloft"],
    },
    ClinicalDrugDef {
        canonical_id: "escitalopram",
        name: "Escitalopram",
        generic_class: "ssri",
        synonyms: &["lexapro", "cipralex"],
    },
    ClinicalDrugDef {
        canonical_id: "citalopram",
        name: "Citalopram",
        generic_class: "ssri",
        synonyms: &["celexa"],
    },
    ClinicalDrugDef {
        canonical_id: "amitriptyline",
        name: "Amitriptyline",
        generic_class: "tca",
        synonyms: &["elavil", "endep"],
    },
    // Opioids & Central Analgesics
    ClinicalDrugDef {
        canonical_id: "tramadol",
        name: "Tramadol",
        generic_class: "opioid_serotonergic",
        synonyms: &["ultram", "tramal"],
    },
    // Immunosuppressants & DMARDs
    ClinicalDrugDef {
        canonical_id: "methotrexate",
        name: "Methotrexate",
        generic_class: "antimetabolite",
        synonyms: &["trexall", "mtx"],
    },
    ClinicalDrugDef {
        canonical_id: "azathioprine",
        name: "Azathioprine",
        generic_class: "thiopurine",
        synonyms: &["imuran"],
    },
    ClinicalDrugDef {
        canonical_id: "allopurinol",
        name: "Allopurinol",
        generic_class: "xanthine_oxidase_inhibitor",
        synonyms: &["zyloprim", "alloril"],
    },
    // Mood Stabilizers
    ClinicalDrugDef {
        canonical_id: "lithium",
        name: "Lithium",
        generic_class: "mood_stabilizer",
        synonyms: &["eskalith", "lithobid", "lithium carbonate"],
    },
    // Antidiabetics
    ClinicalDrugDef {
        canonical_id: "metformin",
        name: "Metformin",
        generic_class: "biguanide",
        synonyms: &["glucophage"],
    },
    ClinicalDrugDef {
        canonical_id: "glibenclamide",
        name: "Glibenclamide (Glyburide)",
        generic_class: "sulfonylurea",
        synonyms: &["glyburide", "daonil", "micronase"],
    },
    // Proton Pump Inhibitors
    ClinicalDrugDef {
        canonical_id: "omeprazole",
        name: "Omeprazole",
        generic_class: "ppi",
        synonyms: &["prilosec", "losec", "omiz"],
    },
    ClinicalDrugDef {
        canonical_id: "esomeprazole",
        name: "Esomeprazole",
        generic_class: "ppi",
        synonyms: &["nexium"],
    },
    // Polyvalent Cations & Supplements
    ClinicalDrugDef {
        canonical_id: "calcium",
        name: "Calcium / Antacid",
        generic_class: "cation_antacid",
        synonyms: &[
            "calcium carbonate",
            "tums",
            "antacid",
            "magnesium hydroxide",
            "aluminum hydroxide",
            "maalox",
            "quick-act",
        ],
    },
    ClinicalDrugDef {
        canonical_id: "iron",
        name: "Iron (Ferrous Sulfate)",
        generic_class: "iron_supplement",
        synonyms: &[
            "ferrous sulfate",
            "ferrous gluconate",
            "feosol",
            "iron supplement",
            "orofer",
            "fefol",
            "ferrous fumarate",
        ],
    },
    // East Africa / Uganda Essential Formulary Additions
    ClinicalDrugDef {
        canonical_id: "amlodipine",
        name: "Amlodipine",
        generic_class: "dhp_ccb",
        synonyms: &["norvasc", "amlopin", "amlocor"],
    },
    ClinicalDrugDef {
        canonical_id: "nifedipine",
        name: "Nifedipine",
        generic_class: "dhp_ccb",
        synonyms: &["adalat", "procardia"],
    },
    ClinicalDrugDef {
        canonical_id: "propranolol",
        name: "Propranolol",
        generic_class: "beta_blocker",
        synonyms: &["inderal", "inno-pran"],
    },
    ClinicalDrugDef {
        canonical_id: "artemether_lumefantrine",
        name: "Artemether + Lumefantrine (Coartem)",
        generic_class: "antimalarial_act",
        synonyms: &["coartem", "lumartem", "lonart", "artefan", "artemether", "lumefantrine"],
    },
    ClinicalDrugDef {
        canonical_id: "quinine",
        name: "Quinine",
        generic_class: "antimalarial_act",
        synonyms: &["quinate", "quiphate"],
    },
    ClinicalDrugDef {
        canonical_id: "amoxicillin",
        name: "Amoxicillin",
        generic_class: "penicillin",
        synonyms: &["amoxil", "amoxyl", "penamox", "hiconcil", "augmentin", "amoxiclav"],
    },
    ClinicalDrugDef {
        canonical_id: "azithromycin",
        name: "Azithromycin",
        generic_class: "macrolide",
        synonyms: &["zithromax", "azithral", "azitrox", "z-pack"],
    },
    ClinicalDrugDef {
        canonical_id: "cotrimoxazole",
        name: "Co-trimoxazole (Septrin)",
        generic_class: "sulfonamide",
        synonyms: &["septrin", "bactrim", "sulfamethoxazole", "trimethoprim", "cotrim"],
    },
    ClinicalDrugDef {
        canonical_id: "efavirenz",
        name: "Efavirenz",
        generic_class: "nnrti_arv",
        synonyms: &["sustiva", "stocrin"],
    },
    ClinicalDrugDef {
        canonical_id: "levothyroxine",
        name: "Levothyroxine",
        generic_class: "thyroid_hormone",
        synonyms: &["eltroxin", "synthroid", "levoxyl"],
    },
    ClinicalDrugDef {
        canonical_id: "levodopa",
        name: "Levodopa / Carbidopa",
        generic_class: "dopaminergic",
        synonyms: &["sinemet", "madopar", "carbidopa"],
    },
    ClinicalDrugDef {
        canonical_id: "linezolid",
        name: "Linezolid",
        generic_class: "oxazolidinone",
        synonyms: &["zyvox", "linospan", "lizolid"],
    },
    ClinicalDrugDef {
        canonical_id: "prednisolone",
        name: "Prednisolone",
        generic_class: "corticosteroid",
        synonyms: &["deltacortril", "predone", "prednisone", "dexamethasone", "hydrocortisone"],
    },
    ClinicalDrugDef {
        canonical_id: "cetirizine",
        name: "Cetirizine",
        generic_class: "antihistamine",
        synonyms: &["zyrtec", "alerid", "cetrine", "piriton", "chlorpheniramine", "loratadine"],
    },
    ClinicalDrugDef {
        canonical_id: "diazepam",
        name: "Diazepam",
        generic_class: "sedative",
        synonyms: &["valium", "lorazepam", "ativan", "alprazolam", "xanax"],
    },
];

pub static CLINICAL_INTERACTION_RULES: &[ClinicalInteractionRule] = &[
    ClinicalInteractionRule {
        id: "nsaid_anticoagulant",
        primary: "nsaid",
        secondary: "anticoagulant",
        severity: "high",
        title: "Severe Gastrointestinal Hemorrhage Risk",
        description: "Combining an NSAID with an anticoagulant multiplies the risk of severe gastrointestinal bleeding and internal hemorrhages.",
        mechanism: "NSAIDs inhibit gastric protective prostaglandins and impair platelet aggregation, which synergizes dangerously with systemic anticoagulation.",
        spacing_hours: None,
        action_advice: "Avoid concurrent use unless strictly supervised by a hematologist or cardiologist. Paracetamol is the preferred pain/fever alternative.",
        organ_risk: "Gastrointestinal & Vascular Bleeding",
    },
    ClinicalInteractionRule {
        id: "nsaid_antiplatelet",
        primary: "nsaid",
        secondary: "antiplatelet",
        severity: "high",
        title: "Marked Bleeding & Cardioprotection Blockade",
        description: "Concurrent use markedly elevates bleeding risk. In addition, Ibuprofen competitively blocks Aspirin’s antiplatelet cardioprotective action.",
        mechanism: "Additive platelet inhibition and gastric mucosal ulceration; competitive binding for platelet COX-1 active site.",
        spacing_hours: Some(2),
        action_advice: "Take low-dose Aspirin at least 30 minutes to 2 hours BEFORE taking Ibuprofen, or switch to Paracetamol.",
        organ_risk: "Gastrointestinal & Cardiovascular",
    },
    ClinicalInteractionRule {
        id: "raas_potassium",
        primary: "raas_inhibitor",
        secondary: "potassium_sparing_diuretic",
        severity: "high",
        title: "Life-Threatening Hyperkalemia Risk",
        description: "Concurrent use severely impairs potassium excretion, causing dangerous spikes in blood potassium that can trigger cardiac arrest.",
        mechanism: "ACE inhibitors/ARBs decrease aldosterone production, while spironolactone directly blocks aldosterone receptors in the distal renal tubule.",
        spacing_hours: None,
        action_advice: "Requires regular serum potassium and renal function monitoring. Do not add potassium supplements without direct physician orders.",
        organ_risk: "Heart (Arrhythmia / Cardiac Arrest) & Kidneys",
    },
    ClinicalInteractionRule {
        id: "raas_potassium_supplement",
        primary: "raas_inhibitor",
        secondary: "potassium_supplement",
        severity: "high",
        title: "Severe Hyperkalemia Risk",
        description: "ACE inhibitors or ARBs reduce renal potassium elimination. Combining them with potassium supplements can induce life-threatening hyperkalemia.",
        mechanism: "Additive potassium retention exceeding kidney excretory capacity.",
        spacing_hours: None,
        action_advice: "Never take potassium supplements with blood pressure RAAS inhibitors unless specifically prescribed and monitored by a doctor.",
        organ_risk: "Heart (Cardiac Arrhythmias)",
    },
    ClinicalInteractionRule {
        id: "pde5_nitrate",
        primary: "pde5_inhibitor",
        secondary: "nitrate",
        severity: "high",
        title: "Fatal Hypotension & Cardiovascular Collapse",
        description: "Absolute Contraindication. Co-administration causes profound, refractory drops in systemic blood pressure and circulatory shock.",
        mechanism: "Nitrates produce nitric oxide which stimulates cGMP, while PDE5 inhibitors block cGMP breakdown, causing massive uninhibited vasodilation.",
        spacing_hours: None,
        action_advice: "DO NOT COMBINE. Nitroglycerin must not be administered within 24 hours of Sildenafil or within 48 hours of Tadalafil.",
        organ_risk: "Cardiovascular System (Profound Shock)",
    },
    ClinicalInteractionRule {
        id: "ssri_tramadol",
        primary: "ssri",
        secondary: "tramadol",
        severity: "high",
        title: "Serotonin Syndrome & Seizure Hazard",
        description: "Combining SSRI antidepressants with Tramadol increases the risk of life-threatening Serotonin Syndrome and significantly lowers seizure threshold.",
        mechanism: "Both agents inhibit serotonin reuptake. Tramadol also possesses mild direct serotonergic agonist and pro-convulsant actions.",
        spacing_hours: None,
        action_advice: "Seek urgent medical attention if experiencing high fever, muscle rigidity, tremors, agitation, or confusion. Discuss non-serotonergic analgesics with your physician.",
        organ_risk: "Central Nervous System (Serotonin Syndrome & Seizures)",
    },
    ClinicalInteractionRule {
        id: "methotrexate_nsaid",
        primary: "antimetabolite",
        secondary: "nsaid",
        severity: "high",
        title: "Severe Methotrexate Toxicity & Bone Marrow Suppression",
        description: "NSAIDs reduce the kidney clearance of Methotrexate, causing toxic blood accumulations leading to bone marrow failure and severe pancytopenia.",
        mechanism: "NSAIDs inhibit renal prostaglandin-mediated perfusion and compete for organic anion transporters (OAT3) responsible for methotrexate excretion.",
        spacing_hours: None,
        action_advice: "Do not take over-the-counter NSAIDs with Methotrexate without explicit specialist oversight. Use Paracetamol for pain or fever.",
        organ_risk: "Bone Marrow (Pancytopenia) & Kidneys",
    },
    ClinicalInteractionRule {
        id: "statin_macrolide",
        primary: "statin",
        secondary: "macrolide",
        severity: "high",
        title: "Rhabdomyolysis & Acute Renal Failure",
        description: "Clarithromycin and Erythromycin drastically increase statin concentrations, raising the risk of severe muscle breakdown (rhabdomyolysis) and kidney damage.",
        mechanism: "Potent inhibition of hepatic CYP3A4 enzyme responsible for first-pass metabolism of simvastatin and atorvastatin.",
        spacing_hours: None,
        action_advice: "Temporarily pause Simvastatin or Atorvastatin during the macrolide antibiotic course as guided by your physician.",
        organ_risk: "Skeletal Muscle (Rhabdomyolysis) & Kidneys",
    },
    ClinicalInteractionRule {
        id: "digoxin_antiarrhythmic",
        primary: "cardiac_glycoside",
        secondary: "antiarrhythmic",
        severity: "high",
        title: "Fatal Digoxin Toxicity & Heart Block",
        description: "Amiodarone substantially increases digoxin blood levels, causing lethal digitalis arrhythmias, nausea, visual halos, and heart block.",
        mechanism: "Inhibition of P-glycoprotein (P-gp) mediated renal and non-renal clearance of digoxin.",
        spacing_hours: None,
        action_advice: "Digoxin dose usually needs to be reduced by 30%–50% upon starting Amiodarone, with rigorous serum digoxin monitoring.",
        organ_risk: "Heart (Digitalis Toxicity & AV Block)",
    },
    ClinicalInteractionRule {
        id: "digoxin_non_dhp_ccb",
        primary: "cardiac_glycoside",
        secondary: "non_dhp_ccb",
        severity: "high",
        title: "Severe Bradycardia & Digoxin Toxicity",
        description: "Verapamil or Diltiazem elevates digoxin levels and exerts additive depression on the sinoatrial and atrioventricular nodes.",
        mechanism: "P-glycoprotein inhibition reduces digoxin clearance; additive negative dromotropic effects on the AV node.",
        spacing_hours: None,
        action_advice: "Monitor pulse rate daily and check digoxin blood concentrations. Report dizziness or pulse below 50 bpm immediately.",
        organ_risk: "Heart (Severe Bradycardia & AV Block)",
    },
    ClinicalInteractionRule {
        id: "beta_blocker_non_dhp_ccb",
        primary: "beta_blocker",
        secondary: "non_dhp_ccb",
        severity: "high",
        title: "Severe Bradycardia & Cardiogenic Shock",
        description: "Combining a beta-blocker with Verapamil or Diltiazem causes profound cardiac depression, severe bradycardia, and congestive heart failure.",
        mechanism: "Synergistic negative inotropic and chronotropic inhibition of cardiac contraction and electrical conduction.",
        spacing_hours: None,
        action_advice: "Do not combine unless managed in an inpatient cardiac monitoring setting.",
        organ_risk: "Heart (Cardiogenic Shock & Complete Heart Block)",
    },
    ClinicalInteractionRule {
        id: "fluoroquinolone_theophylline",
        primary: "fluoroquinolone",
        secondary: "xanthine",
        severity: "high",
        title: "Theophylline Toxicity & Seizure Risk",
        description: "Ciprofloxacin inhibits the breakdown of Theophylline, causing toxic accumulation that can trigger cardiac arrhythmias, nausea, and seizures.",
        mechanism: "Potent inhibition of hepatic CYP1A2 enzyme by Ciprofloxacin.",
        spacing_hours: None,
        action_advice: "Reduce theophylline dosage and monitor theophylline serum levels, or choose an alternative antibiotic (e.g. amoxicillin/azithromycin).",
        organ_risk: "Brain (Seizures) & Cardiovascular Arrhythmias",
    },
    ClinicalInteractionRule {
        id: "lithium_nsaid",
        primary: "mood_stabilizer",
        secondary: "nsaid",
        severity: "high",
        title: "Severe Lithium Poisoning & Neurotoxicity",
        description: "NSAIDs reduce renal lithium clearance, causing rapid toxic accumulation of lithium leading to confusion, tremors, ataxia, and renal shutdown.",
        mechanism: "Renal prostaglandin inhibition decreases glomerular filtration and increases proximal tubular reabsorption of lithium.",
        spacing_hours: None,
        action_advice: "Avoid NSAIDs like Ibuprofen or Diclofenac if taking Lithium. Paracetamol is the safe alternative.",
        organ_risk: "Brain (Neurotoxicity, Coma) & Kidneys",
    },
    ClinicalInteractionRule {
        id: "lithium_raas",
        primary: "mood_stabilizer",
        secondary: "raas_inhibitor",
        severity: "high",
        title: "Lithium Toxicity",
        description: "ACE inhibitors and ARBs significantly increase serum lithium levels by reducing renal excretion.",
        mechanism: "Decreased glomerular filtration and altered sodium-lithium counter-transport in the kidney.",
        spacing_hours: None,
        action_advice: "Requires frequent lithium therapeutic drug monitoring and dosage reductions upon initiating ACE inhibitors.",
        organ_risk: "Central Nervous System & Kidneys",
    },
    ClinicalInteractionRule {
        id: "clopidogrel_omeprazole",
        primary: "clopidogrel",
        secondary: "omeprazole",
        severity: "warning",
        title: "Diminished Antiplatelet Efficacy (Stent Thrombosis Risk)",
        description: "Omeprazole prevents Clopidogrel from converting into its active form, significantly increasing the risk of blood clots and recurrent heart attacks.",
        mechanism: "Competitive inhibition of hepatic CYP2C19, the primary enzyme required to bioactivate the prodrug Clopidogrel.",
        spacing_hours: None,
        action_advice: "Switch to a PPI with minimal CYP2C19 inhibition such as Pantoprazole, or use an H2 blocker like Famotidine.",
        organ_risk: "Cardiovascular (Stent Thrombosis / Heart Attack)",
    },
    ClinicalInteractionRule {
        id: "antibiotic_cation_calcium",
        primary: "fluoroquinolone",
        secondary: "cation_antacid",
        severity: "moderate",
        title: "Reduced Antibiotic Absorption & Treatment Failure",
        description: "Antacids and calcium bind to Ciprofloxacin in the stomach, blocking its absorption and causing bacterial infection treatment failure.",
        mechanism: "Chelation between polyvalent metal cations (Ca2+, Mg2+, Al3+) and the antibiotic molecule forming an insoluble precipitate.",
        spacing_hours: Some(2),
        action_advice: "Take Ciprofloxacin at least 2 hours before or 4 to 6 hours after antacids, dairy, or calcium supplements.",
        organ_risk: "Gastrointestinal & Systemic Infection Failure",
    },
    ClinicalInteractionRule {
        id: "tetracycline_iron",
        primary: "tetracycline",
        secondary: "iron_supplement",
        severity: "moderate",
        title: "Antibiotic Inactivation via Chelation",
        description: "Iron supplements bind Doxycycline in the gut, dramatically reducing blood absorption of both iron and the antibiotic.",
        mechanism: "Insoluble chelate complex formation between ferrous ions and tetracycline rings.",
        spacing_hours: Some(3),
        action_advice: "Space oral iron supplements and Doxycycline by at least 2 to 3 hours.",
        organ_risk: "Antibiotic Inefficacy & Iron Malabsorption",
    },
    ClinicalInteractionRule {
        id: "azathioprine_allopurinol",
        primary: "thiopurine",
        secondary: "xanthine_oxidase_inhibitor",
        severity: "high",
        title: "Fatal Bone Marrow Aplasia & Pancytopenia",
        description: "Allopurinol blocks the breakdown of Azathioprine, leading to massive accumulation of cytotoxic 6-thioguanine and fatal bone marrow failure.",
        mechanism: "Inhibition of xanthine oxidase, the primary catabolic route for 6-mercaptopurine.",
        spacing_hours: None,
        action_advice: "Reduce Azathioprine dosage to 25%–33% of standard dose with close hematologic monitoring, or avoid combination.",
        organ_risk: "Bone Marrow (Fatal Pancytopenia)",
    },
    ClinicalInteractionRule {
        id: "warfarin_metronidazole",
        primary: "anticoagulant",
        secondary: "nitroimidazole",
        severity: "high",
        title: "Profound INR Elevation & Hemorrhage Risk",
        description: "Metronidazole strongly inhibits Warfarin metabolism, causing acute spikes in the International Normalized Ratio (INR) and spontaneous bleeding.",
        mechanism: "Inhibition of CYP2C9 metabolism of the potent S-warfarin enantiomer.",
        spacing_hours: None,
        action_advice: "Anticipate a 30% to 50% warfarin dose reduction and check INR within 2 to 3 days of starting Flagyl (Metronidazole).",
        organ_risk: "Systemic Hemorrhage & Brain/GI Bleeding",
    },
    ClinicalInteractionRule {
        id: "warfarin_paracetamol",
        primary: "anticoagulant",
        secondary: "paracetamol",
        severity: "moderate",
        title: "Potential INR Elevation with Sustained Dosing",
        description: "Taking high doses of Paracetamol (above 2,000 mg/day for several days) can enhance the blood-thinning effect of Warfarin and raise INR.",
        mechanism: "Paracetamol metabolite NAPQI inhibits vitamin K carboxylase in the liver.",
        spacing_hours: None,
        action_advice: "Limit Paracetamol to the lowest effective dose (under 2,000 mg/day) and monitor INR if taken for more than 3 consecutive days.",
        organ_risk: "Coagulation Cascade",
    },
    ClinicalInteractionRule {
        id: "sulfonylurea_quinolone",
        primary: "sulfonylurea",
        secondary: "fluoroquinolone",
        severity: "warning",
        title: "Severe Dysglycemia / Hypoglycemia Shock",
        description: "Fluoroquinolones can trigger acute, profound hypoglycemia in patients taking sulfonylureas, potentially leading to coma.",
        mechanism: "Blockade of ATP-sensitive potassium channels in pancreatic beta cells, stimulating excessive insulin release.",
        spacing_hours: None,
        action_advice: "Monitor blood glucose closely. Have oral glucose or fast-acting carbohydrates readily available.",
        organ_risk: "Metabolic & Brain (Hypoglycemic Coma)",
    },
    ClinicalInteractionRule {
        id: "aspirin_ibuprofen",
        primary: "aspirin",
        secondary: "ibuprofen",
        severity: "warning",
        title: "Cardioprotection Interference & Increased GI Risk",
        description: "Ibuprofen prevents Aspirin from permanently inactivating platelets, neutralizing Aspirin’s protective action against heart attack and stroke.",
        mechanism: "Competitive reversible binding at the platelet COX-1 channel prevents Aspirin access to the Ser529 acetylation site.",
        spacing_hours: Some(2),
        action_advice: "Take immediate-release low-dose Aspirin at least 30 to 60 minutes BEFORE taking Ibuprofen, or space by at least 8 hours after.",
        organ_risk: "Cardiovascular (Loss of Antiplatelet Protection)",
    },
    ClinicalInteractionRule {
        id: "nsaid_corticosteroid",
        primary: "nsaid",
        secondary: "corticosteroid",
        severity: "high",
        title: "Severe Peptic Ulceration & GI Perforation Risk",
        description: "Combining an NSAID with a corticosteroid (such as Prednisolone) multiplies the risk of severe gastric ulceration and gastrointestinal bleeding up to 15-fold.",
        mechanism: "Dual blockade of arachidonic acid (PLA2) and cyclooxygenase (COX) pathways completely depletes protective gastric mucosal prostaglandins.",
        spacing_hours: None,
        action_advice: "Avoid combining oral NSAIDs with steroids. If co-administration is unavoidable, take with food and consult your clinician for a gastroprotective PPI (e.g. Omeprazole).",
        organ_risk: "Gastrointestinal Tract (Peptic Ulcer & Perforation)",
    },
    ClinicalInteractionRule {
        id: "nsaid_raas",
        primary: "nsaid",
        secondary: "raas_inhibitor",
        severity: "warning",
        title: "Acute Kidney Injury & Antihypertensive Blunting",
        description: "NSAIDs blunt the blood-pressure-lowering effect of ACE inhibitors/ARBs and constrict renal afferent arterioles, risking acute kidney injury.",
        mechanism: "Inhibition of vasodilatory renal prostaglandins opposes RAAS-mediated efferent arteriolar dilation, collapsing glomerular filtration pressure.",
        spacing_hours: None,
        action_advice: "Avoid routine NSAID use if taking blood pressure medications like Lisinopril or Losartan. Use Paracetamol for pain relief and stay well-hydrated.",
        organ_risk: "Kidneys (Acute Renal Impairment) & Blood Pressure",
    },
    ClinicalInteractionRule {
        id: "nsaid_loop_diuretic",
        primary: "nsaid",
        secondary: "loop_diuretic",
        severity: "warning",
        title: "Reduced Diuretic Efficacy & Nephrotoxicity",
        description: "NSAIDs counteract the fluid-clearing and blood-pressure-lowering effects of Furosemide while increasing the risk of kidney damage.",
        mechanism: "Inhibition of renal prostaglandin E2 synthesis reduces renal blood flow and sodium excretion.",
        spacing_hours: None,
        action_advice: "Monitor for ankle swelling, weight gain, or rising blood pressure. Prefer Paracetamol over NSAIDs.",
        organ_risk: "Kidneys & Fluid Balance",
    },
    ClinicalInteractionRule {
        id: "act_fluoroquinolone_qt",
        primary: "antimalarial_act",
        secondary: "fluoroquinolone",
        severity: "high",
        title: "Additive QT Interval Prolongation & Arrhythmia Risk",
        description: "Co-administering Artemether-Lumefantrine (Coartem) or Quinine with a fluoroquinolone antibiotic (e.g. Ciprofloxacin) increases the risk of dangerous ventricular arrhythmias.",
        mechanism: "Additive blockade of cardiac hERG potassium channels delays ventricular repolarization and prolongs the QTc interval.",
        spacing_hours: None,
        action_advice: "Consult a clinician before combining Coartem with Ciprofloxacin or Levofloxacin. Seek urgent care if experiencing palpitations, dizziness, or fainting.",
        organ_risk: "Heart (QT Prolongation / Torsades de Pointes)",
    },
    ClinicalInteractionRule {
        id: "act_macrolide_qt",
        primary: "antimalarial_act",
        secondary: "macrolide",
        severity: "high",
        title: "Cardiac QT Prolongation & Elevated Lumefantrine Levels",
        description: "Macrolide antibiotics (Azithromycin, Clarithromycin, Erythromycin) inhibit lumefantrine metabolism and additively prolong the cardiac QT interval.",
        mechanism: "CYP3A4 inhibition increases lumefantrine exposure while both classes delay cardiac ventricular repolarization.",
        spacing_hours: None,
        action_advice: "Avoid concurrent use unless directed by a physician; monitor for irregular heartbeat or lightheadedness.",
        organ_risk: "Heart (Ventricular Arrhythmia)",
    },
    ClinicalInteractionRule {
        id: "statin_dhp_ccb",
        primary: "statin",
        secondary: "dhp_ccb",
        severity: "moderate",
        title: "Increased Statin Exposure & Myopathy Risk",
        description: "Amlodipine moderately inhibits the breakdown of Simvastatin and Atorvastatin, increasing the risk of muscle aches and myopathy at high statin doses.",
        mechanism: "Weak-to-moderate competitive inhibition of intestinal and hepatic CYP3A4.",
        spacing_hours: None,
        action_advice: "Simvastatin dose should not exceed 20 mg daily when taken alongside Amlodipine. Report any unexplained muscle pain or weakness.",
        organ_risk: "Skeletal Muscle (Myopathy)",
    },
    ClinicalInteractionRule {
        id: "anticoagulant_sulfonamide",
        primary: "anticoagulant",
        secondary: "sulfonamide",
        severity: "high",
        title: "Severe Bleeding & Acute INR Spike",
        description: "Co-trimoxazole (Septrin) strongly potentiates Warfarin and other anticoagulants, causing dangerous spikes in INR and major internal bleeding.",
        mechanism: "Potent CYP2C9 inhibition and displacement of warfarin from plasma albumin binding sites.",
        spacing_hours: None,
        action_advice: "Avoid Septrin in patients on Warfarin if an alternative antibiotic is available, or reduce Warfarin dose and check INR within 3 days.",
        organ_risk: "Systemic Coagulation & Hemorrhage",
    },
    ClinicalInteractionRule {
        id: "sulfonamide_raas_hyperkalemia",
        primary: "sulfonamide",
        secondary: "raas_inhibitor",
        severity: "high",
        title: "Trimethoprim-Induced Hyperkalemia Risk",
        description: "Co-trimoxazole (Septrin) combined with an ACE inhibitor or ARB (e.g. Lisinopril, Losartan) can trigger dangerous spikes in serum potassium.",
        mechanism: "Trimethoprim blocks epithelial sodium channels (ENaC) in the distal nephron identically to amiloride, impairing potassium excretion.",
        spacing_hours: None,
        action_advice: "Monitor serum potassium closely, especially in older adults or patients with kidney impairment, and avoid high-potassium foods.",
        organ_risk: "Heart (Hyperkalemic Arrhythmia) & Kidneys",
    },
    ClinicalInteractionRule {
        id: "thyroid_iron",
        primary: "thyroid_hormone",
        secondary: "iron_supplement",
        severity: "moderate",
        title: "Impaired Thyroid Hormone Absorption",
        description: "Iron supplements bind to Levothyroxine in the digestive tract, preventing its absorption and causing hypothyroidism symptoms to return.",
        mechanism: "Formation of insoluble ferric-thyroxine complexes in the gastrointestinal lumen.",
        spacing_hours: Some(4),
        action_advice: "Space Levothyroxine and iron supplements by at least 4 hours.",
        organ_risk: "Endocrine (Hypothyroidism Relapse)",
    },
    ClinicalInteractionRule {
        id: "thyroid_calcium",
        primary: "thyroid_hormone",
        secondary: "cation_antacid",
        severity: "moderate",
        title: "Reduced Levothyroxine Absorption",
        description: "Calcium carbonate and antacids adsorb Levothyroxine in the stomach, significantly lowering thyroid hormone levels.",
        mechanism: "Non-specific adsorption and chelation in an alkalinized gastric environment.",
        spacing_hours: Some(4),
        action_advice: "Take Levothyroxine on an empty stomach at least 4 hours apart from calcium or antacids.",
        organ_risk: "Endocrine (Sub-therapeutic Thyroid Levels)",
    },
    ClinicalInteractionRule {
        id: "sedative_opioid",
        primary: "sedative",
        secondary: "opioid_serotonergic",
        severity: "high",
        title: "Profound CNS & Respiratory Depression",
        description: "Combining benzodiazepine sedatives (e.g. Diazepam) with opioids (e.g. Tramadol) causes extreme sedation, slowed breathing, coma, and risk of fatal overdose.",
        mechanism: "Synergistic central nervous system depression via GABA-A potentiation and mu-opioid receptor agonism.",
        spacing_hours: None,
        action_advice: "Avoid combining sedatives and opioid painkillers unless strictly supervised in a clinical setting.",
        organ_risk: "Brain & Respiratory Center",
    },
    ClinicalInteractionRule {
        id: "tca_ssri",
        primary: "tca",
        secondary: "ssri",
        severity: "high",
        title: "Serotonin Syndrome & TCA Toxicity",
        description: "SSRIs inhibit the liver enzymes that clear Amitriptyline while both raise serotonin, risking Serotonin Syndrome and cardiac arrhythmias.",
        mechanism: "CYP2D6 inhibition elevates tricyclic plasma levels alongside additive serotonergic neurotransmission.",
        spacing_hours: None,
        action_advice: "Do not combine Amitriptyline with SSRIs without specialist psychiatric monitoring.",
        organ_risk: "Central Nervous System & Heart Conduction",
    },
];

const DOSAGE_UNITS: &[&str] = &[
    "tablets", "tablet", "tabs", "tab", "caps", "cap", "mcg", "mg", "ml", "g",
];

fn is_word_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// Normalizes a drug string identically to JS:
/// `str.toLowerCase().trim().replace(/\b\d+(\.\d+)?\s*(mg|g|mcg|ml|tabs?|caps?|tablets?)\b/gi, '').replace(/[^a-z0-9]/g, '')`
pub fn normalize_drug_string(input: &str) -> String {
    let lower = input.trim().to_ascii_lowercase();
    let bytes = lower.as_bytes();
    let len = bytes.len();
    let mut cleaned = Vec::with_capacity(len);
    let mut i = 0;

    while i < len {
        // Check word boundary before digit
        let at_word_start = i == 0 || !is_word_char(bytes[i - 1]);
        if at_word_start && bytes[i].is_ascii_digit() {
            let mut j = i;
            while j < len && bytes[j].is_ascii_digit() {
                j += 1;
            }
            if j + 1 < len && bytes[j] == b'.' && bytes[j + 1].is_ascii_digit() {
                j += 1;
                while j < len && bytes[j].is_ascii_digit() {
                    j += 1;
                }
            }
            while j < len && bytes[j].is_ascii_whitespace() {
                j += 1;
            }
            let rest = &lower[j..];
            let mut matched_unit_len = None;
            for unit in DOSAGE_UNITS {
                if rest.starts_with(unit) {
                    let after_unit = j + unit.len();
                    let at_word_end = after_unit == len || !is_word_char(bytes[after_unit]);
                    if at_word_end {
                        matched_unit_len = Some(unit.len());
                        break;
                    }
                }
            }
            if let Some(u_len) = matched_unit_len {
                i = j + u_len;
                continue;
            }
        }
        if bytes[i].is_ascii_alphanumeric() {
            cleaned.push(bytes[i]);
        }
        i += 1;
    }

    // Safe because all pushed bytes are ASCII alphanumeric
    unsafe { String::from_utf8_unchecked(cleaned) }
}

/// Resolves any free-form drug name, brand synonym, or generic string to its canonical definition.
pub fn resolve_canonical_drug(query: &str) -> Option<&'static ClinicalDrugDef> {
    let raw = query.trim().to_ascii_lowercase();
    if raw.is_empty() {
        return None;
    }
    let normalized = normalize_drug_string(&raw);
    if normalized.is_empty() {
        return None;
    }

    // 1. Exact canonical_id match
    for drug in CANONICAL_DRUGS {
        if drug.canonical_id == raw || drug.canonical_id == normalized {
            return Some(drug);
        }
    }

    // 2. Iterate canonical drugs and their synonyms in declaration order (matches JS)
    for drug in CANONICAL_DRUGS {
        let norm_name = normalize_drug_string(drug.name);
        if normalized == norm_name {
            return Some(drug);
        }
        let lower_name = drug.name.to_ascii_lowercase();
        if raw.contains(&lower_name) || (!norm_name.is_empty() && normalized.contains(&norm_name)) {
            return Some(drug);
        }
        for syn in drug.synonyms {
            let norm_syn = normalize_drug_string(syn);
            if normalized == norm_syn {
                return Some(drug);
            }
            if raw.contains(syn) || (!norm_syn.is_empty() && normalized.contains(&norm_syn)) {
                return Some(drug);
            }
        }
    }

    None
}

/// Checks if two drug strings represent the same active substance.
pub fn is_same_drug_substance(drug_a: &str, drug_b: &str) -> bool {
    let raw_a = drug_a.trim().to_ascii_lowercase();
    let raw_b = drug_b.trim().to_ascii_lowercase();
    if raw_a.is_empty() || raw_b.is_empty() {
        return false;
    }
    if raw_a == raw_b {
        return true;
    }

    let norm_a = normalize_drug_string(&raw_a);
    let norm_b = normalize_drug_string(&raw_b);
    if !norm_a.is_empty() && !norm_b.is_empty() && norm_a == norm_b {
        return true;
    }

    if let (Some(can_a), Some(can_b)) = (resolve_canonical_drug(drug_a), resolve_canonical_drug(drug_b)) {
        if can_a.canonical_id == can_b.canonical_id {
            return true;
        }
    }

    false
}

fn matches_rule_side(drug: Option<&ClinicalDrugDef>, rule_target: &str) -> bool {
    match drug {
        Some(d) => d.canonical_id == rule_target || d.generic_class == rule_target,
        None => false,
    }
}

/// Evaluates clinical drug-drug interactions between a pair of medications.
/// Returns `None` if the two medications represent the same substance.
pub fn evaluate_clinical_interaction(med_a: &str, med_b: &str) -> Option<ParsedInteraction> {
    if is_same_drug_substance(med_a, med_b) {
        return None;
    }

    let def_a = resolve_canonical_drug(med_a);
    let def_b = resolve_canonical_drug(med_b);
    if def_a.is_none() && def_b.is_none() {
        return None;
    }

    for rule in CLINICAL_INTERACTION_RULES {
        let matches_a_to_b =
            matches_rule_side(def_a, rule.primary) && matches_rule_side(def_b, rule.secondary);
        let matches_b_to_a =
            matches_rule_side(def_b, rule.primary) && matches_rule_side(def_a, rule.secondary);

        if matches_a_to_b || matches_b_to_a {
            let name1 = def_a.map(|d| d.name).unwrap_or(med_a).to_string();
            let name2 = def_b.map(|d| d.name).unwrap_or(med_b).to_string();

            let mut enhanced_description = String::from(rule.description);
            if !rule.mechanism.is_empty() {
                enhanced_description.push_str(" Mechanism: ");
                enhanced_description.push_str(rule.mechanism);
            }
            if !rule.action_advice.is_empty() {
                enhanced_description.push_str(" Guidance: ");
                enhanced_description.push_str(rule.action_advice);
            }

            let mapped_severity = if rule.severity == "high" {
                "high"
            } else {
                "warning"
            };

            return Some(ParsedInteraction {
                drug1: name1,
                drug2: name2,
                severity: mapped_severity,
                description: enhanced_description,
                clinical_details: ClinicalDetails {
                    title: rule.title,
                    mechanism: rule.mechanism,
                    action_advice: rule.action_advice,
                    spacing_hours: rule.spacing_hours,
                    organ_risk: rule.organ_risk,
                },
            });
        }
    }

    None
}

/// Legacy compatibility wrapper for NativeSearchPlugin JNI (`checkInteractions`).
pub fn check_interactions(drugs_json: &str) -> String {
    let user_drugs: Vec<String> = serde_json::from_str(drugs_json).unwrap_or_default();
    let mut warnings = Vec::new();

    for i in 0..user_drugs.len() {
        for j in (i + 1)..user_drugs.len() {
            if let Some(interaction) = evaluate_clinical_interaction(&user_drugs[i], &user_drugs[j])
            {
                warnings.push(interaction);
            }
        }
    }

    serde_json::to_string(&warnings).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_drug_string() {
        assert_eq!(normalize_drug_string("Ibuprofen 200mg"), "ibuprofen");
        assert_eq!(normalize_drug_string("Ibuprofen 400 mg tablets"), "ibuprofen");
        assert_eq!(normalize_drug_string("Co-trimoxazole 480mg"), "cotrimoxazole");
        assert_eq!(normalize_drug_string("Panadol 500mg tabs"), "panadol");
    }

    #[test]
    fn test_is_same_drug_substance() {
        assert!(is_same_drug_substance("Ibuprofen 200mg", "Brufen 400mg"));
        assert!(is_same_drug_substance("Panadol", "Paracetamol 500mg"));
        assert!(!is_same_drug_substance("Ibuprofen", "Warfarin"));
    }

    #[test]
    fn test_evaluate_clinical_interaction() {
        // Duplicate substance -> None
        assert!(evaluate_clinical_interaction("Ibuprofen 200mg", "Brufen 400mg").is_none());

        // Warfarin + Ibuprofen -> High severity hemorrhage risk
        let hit = evaluate_clinical_interaction("Warfarin", "Ibuprofen").expect("Should match");
        assert_eq!(hit.severity, "high");
        assert_eq!(
            hit.clinical_details.title,
            "Severe Gastrointestinal Hemorrhage Risk"
        );

        // Coartem + Ciprofloxacin -> QT prolongation
        let qt = evaluate_clinical_interaction("Coartem", "Ciprofloxacin").expect("Should match");
        assert_eq!(qt.severity, "high");
        assert!(qt.clinical_details.title.contains("QT"));
    }
}
