/// A drug entry returned by a search query.
pub struct DrugEntry {
    pub name: String,
    pub score: f32,
    pub rxcui: Option<String>,
}

/// Jaro similarity between two strings.
fn jaro(s1: &str, s2: &str) -> f32 {
    if s1 == s2 {
        return 1.0;
    }
    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();
    let s1_len = s1_chars.len();
    let s2_len = s2_chars.len();
    if s1_len == 0 || s2_len == 0 {
        return 0.0;
    }

    let match_distance = (s1_len.max(s2_len) / 2).saturating_sub(1);
    let mut s1_matches = vec![false; s1_len];
    let mut s2_matches = vec![false; s2_len];
    let mut matches = 0usize;
    let mut transpositions = 0usize;

    for i in 0..s1_len {
        let start = i.saturating_sub(match_distance);
        let end = (i + match_distance + 1).min(s2_len);
        for j in start..end {
            if s2_matches[j] || s1_chars[i] != s2_chars[j] {
                continue;
            }
            s1_matches[i] = true;
            s2_matches[j] = true;
            matches += 1;
            break;
        }
    }

    if matches == 0 {
        return 0.0;
    }

    let mut k = 0;
    for i in 0..s1_len {
        if !s1_matches[i] {
            continue;
        }
        while !s2_matches[k] {
            k += 1;
        }
        if s1_chars[i] != s2_chars[k] {
            transpositions += 1;
        }
        k += 1;
    }

    let m = matches as f32;
    let t = (transpositions / 2) as f32;
    (m / s1_len as f32 + m / s2_len as f32 + (m - t) / m) / 3.0
}

/// Jaro-Winkler similarity — boosts strings that share a common prefix (up to 4 chars).
fn jaro_winkler(s1: &str, s2: &str) -> f32 {
    let jaro_sim = jaro(s1, s2);
    let prefix_len = s1
        .chars()
        .zip(s2.chars())
        .take(4)
        .take_while(|(a, b)| a == b)
        .count() as f32;
    jaro_sim + (prefix_len * 0.1 * (1.0 - jaro_sim))
}

/// Perform a case-insensitive fuzzy search over the embedded drug index.
///
/// Returns up to `limit` (clamped to 1–20) results sorted by descending
/// Jaro-Winkler score, filtered to score >= 0.55.
/// Exact prefix matches receive a score boosted to 1.0 (minus a tiny length penalty)
/// so they always rank above fuzzy matches.
pub fn fuzzy_search(query: &str, limit: usize) -> Vec<DrugEntry> {
    if query.is_empty() {
        return Vec::new();
    }
    let q = query.to_lowercase();
    let lim = limit.max(1).min(20);

    let mut scored: Vec<(&str, &str, f32)> = DRUG_INDEX
        .iter()
        .map(|(name, rxcui)| {
            let name_lower = name.to_lowercase();
            // Exact prefix match → float to the top with a tiny length-based tiebreaker
            let score = if name_lower.starts_with(&q) {
                1.0f32 - (name_lower.len() as f32 - q.len() as f32) * 0.001
            } else {
                jaro_winkler(&q, &name_lower)
            };
            (*name, *rxcui, score)
        })
        .filter(|(_, _, score)| *score >= 0.55)
        .collect();

    scored.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(lim);

    scored
        .into_iter()
        .map(|(name, rxcui, score)| DrugEntry {
            name: name.to_string(),
            score,
            rxcui: if rxcui.is_empty() {
                None
            } else {
                Some(rxcui.to_string())
            },
        })
        .collect()
}

/// Embedded drug index: (generic/brand name, RxCUI) pairs.
///
/// Sources: EAC Essential Medicines List, WHO Model List of Essential Medicines,
/// and common East African formulary entries.
///
/// For production use, replace this slice with a compressed binary index generated
/// from the full RxNorm RXNCONSO table (~15 000 drug names, ~120 KB with zstd).
static DRUG_INDEX: &[(&str, &str)] = &[
    // ── Analgesics ──────────────────────────────────────────────────────────
    ("Paracetamol", "161"),
    ("Acetaminophen", "161"),
    ("Ibuprofen", "5640"),
    ("Aspirin", "1191"),
    ("Diclofenac", "3407"),
    ("Naproxen", "7258"),
    ("Tramadol", "10689"),
    ("Morphine", "7052"),
    ("Codeine", "2670"),
    ("Mefenamic Acid", ""),
    // ── Antibiotics ─────────────────────────────────────────────────────────
    ("Amoxicillin", "723"),
    ("Amoxicillin-Clavulanate", ""),
    ("Ampicillin", "733"),
    ("Ciprofloxacin", "2551"),
    ("Metronidazole", "6922"),
    ("Doxycycline", "3640"),
    ("Azithromycin", "18631"),
    ("Erythromycin", "4053"),
    ("Clindamycin", "2582"),
    ("Trimethoprim", "10829"),
    ("Cotrimoxazole", ""),
    ("Tetracycline", "10528"),
    ("Penicillin V", "7980"),
    ("Benzylpenicillin", ""),
    ("Ceftriaxone", ""),
    ("Cefuroxime", ""),
    ("Clarithromycin", ""),
    ("Gentamicin", "4333"),
    ("Nitrofurantoin", "7454"),
    ("Levofloxacin", "82122"),
    // ── Antimalarials ────────────────────────────────────────────────────────
    ("Artemether-Lumefantrine", ""),
    ("Artesunate", ""),
    ("Chloroquine", "2468"),
    ("Quinine", "9071"),
    ("Primaquine", "8522"),
    ("Mefloquine", "41493"),
    ("Atovaquone-Proguanil", ""),
    // ── Antifungals ──────────────────────────────────────────────────────────
    ("Fluconazole", "4450"),
    ("Ketoconazole", "6133"),
    ("Nystatin", "7454"),
    ("Griseofulvin", "4731"),
    ("Clotrimazole", "2592"),
    ("Miconazole", "6931"),
    // ── Antivirals / HIV ─────────────────────────────────────────────────────
    ("Efavirenz", "195085"),
    ("Nevirapine", "59267"),
    ("Lamivudine", "68244"),
    ("Tenofovir", ""),
    ("Zidovudine", "35613"),
    ("Lopinavir-Ritonavir", ""),
    ("Abacavir", "190521"),
    ("Dolutegravir", ""),
    ("Acyclovir", "2551"),
    ("Oseltamivir", ""),
    // ── Antihypertensives ────────────────────────────────────────────────────
    ("Amlodipine", "17767"),
    ("Nifedipine", "7417"),
    ("Atenolol", "1202"),
    ("Metoprolol", "6918"),
    ("Lisinopril", "29046"),
    ("Enalapril", "3826"),
    ("Captopril", "1827"),
    ("Losartan", "203160"),
    ("Hydrochlorothiazide", "5487"),
    ("Furosemide", "4603"),
    ("Spironolactone", "9997"),
    ("Methyldopa", "6807"),
    ("Propranolol", "8787"),
    ("Verapamil", "11170"),
    ("Amlodipine-Valsartan", ""),
    // ── Antidiabetics ────────────────────────────────────────────────────────
    ("Metformin", "6809"),
    ("Glibenclamide", ""),
    ("Glimepiride", ""),
    ("Insulin", "5856"),
    ("Insulin Glargine", ""),
    ("Insulin NPH", ""),
    ("Pioglitazone", ""),
    ("Sitagliptin", ""),
    // ── Respiratory ──────────────────────────────────────────────────────────
    ("Salbutamol", "9180"),
    ("Albuterol", "435"),
    ("Budesonide", "28029"),
    ("Prednisolone", "8638"),
    ("Prednisone", "8640"),
    ("Dexamethasone", "3264"),
    ("Beclomethasone", "1223"),
    ("Theophylline", "10509"),
    ("Ipratropium", "5691"),
    ("Montelukast", ""),
    ("Fluticasone", ""),
    ("Salmeterol", ""),
    // ── Gastrointestinal ─────────────────────────────────────────────────────
    ("Omeprazole", "40790"),
    ("Pantoprazole", ""),
    ("Ranitidine", "9143"),
    ("Domperidone", ""),
    ("Metoclopramide", "6847"),
    ("Loperamide", "6249"),
    ("Oral Rehydration Salts", ""),
    ("Bisacodyl", "1727"),
    ("Lactulose", "6121"),
    ("Antacid", ""),
    ("Cimetidine", "2517"),
    ("Hyoscine", ""),
    // ── Mental health ────────────────────────────────────────────────────────
    ("Haloperidol", "5613"),
    ("Chlorpromazine", "2456"),
    ("Diazepam", "3322"),
    ("Lorazepam", "6260"),
    ("Amitriptyline", "704"),
    ("Fluoxetine", "41493"),
    ("Sertraline", "36437"),
    ("Carbamazepine", "2002"),
    ("Phenytoin", "8123"),
    ("Sodium Valproate", ""),
    ("Valproic Acid", "11118"),
    ("Phenobarbital", "8134"),
    // ── Vitamins & supplements ───────────────────────────────────────────────
    ("Folic Acid", "4511"),
    ("Ferrous Sulphate", ""),
    ("Iron", "4978"),
    ("Vitamin A", ""),
    ("Vitamin B12", ""),
    ("Zinc Sulphate", ""),
    ("Calcium Carbonate", ""),
    ("Vitamin D", ""),
    ("Multivitamins", ""),
    // ── Contraceptives ───────────────────────────────────────────────────────
    ("Levonorgestrel", "75927"),
    ("Ethinylestradiol", ""),
    ("Depot-Medroxyprogesterone", ""),
    ("Norethisterone", ""),
    // ── Dermatology ──────────────────────────────────────────────────────────
    ("Hydrocortisone", "5494"),
    ("Betamethasone", "1327"),
    ("Calamine Lotion", ""),
    ("Permethrin", ""),
    ("Benzyl Benzoate", ""),
    // ── Ophthalmology ────────────────────────────────────────────────────────
    ("Tetracycline Eye Oint.", ""),
    ("Chloramphenicol Eye Drops", ""),
    ("Timolol Eye Drops", ""),
    ("Pilocarpine Eye Drops", ""),
    // ── Other common ─────────────────────────────────────────────────────────
    ("Rabipur", ""),
    ("ORS", ""),
    ("Quinine Sulphate", ""),
    ("Praziquantel", ""),
    ("Albendazole", "15128"),
    ("Mebendazole", "6741"),
    ("Ivermectin", "58903"),
    ("Levamisole", ""),
    ("Dapsone", "3017"),
    ("Rifampicin", ""),
    ("Isoniazid", "5874"),
    ("Pyrazinamide", ""),
    ("Ethambutol", ""),
    ("Streptomycin", "10046"),
    ("Adrenaline", "3616"),
    ("Atropine", "1223"),
    ("Digoxin", "3407"),
    ("Warfarin", "11289"),
    ("Heparin", "5154"),
    ("Aspirin Low Dose", ""),
    ("Clopidogrel", ""),
    ("Atorvastatin", "83367"),
    ("Simvastatin", "36567"),
    ("Rosuvastatin", ""),
    ("Levothyroxine", "10582"),
    ("Carbimazole", ""),
    ("Allopurinol", "519"),
    ("Colchicine", "2683"),
    ("Hydroxychloroquine", "5113"),
];
