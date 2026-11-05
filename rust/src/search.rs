use serde::{Deserialize, Serialize};

/// A drug entry returned by a search query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrugEntry {
    pub name: String,
    pub score: f32,
    pub rxcui: Option<String>,
}

/// Fast, allocation-free Jaro similarity for ASCII strings (with fallback for non-ASCII).
fn jaro(s1: &str, s2: &str) -> f32 {
    if s1 == s2 {
        return 1.0;
    }
    let b1 = s1.as_bytes();
    let b2 = s2.as_bytes();
    let s1_len = b1.len();
    let s2_len = b2.len();
    if s1_len == 0 || s2_len == 0 {
        return 0.0;
    }

    // Use stack bitmasks for typical drug names (<= 64 bytes) to eliminate heap allocations
    if s1_len <= 64 && s2_len <= 64 && s1.is_ascii() && s2.is_ascii() {
        let match_distance = (s1_len.max(s2_len) / 2).saturating_sub(1);
        let mut s1_mask: u64 = 0;
        let mut s2_mask: u64 = 0;
        let mut matches = 0usize;
        let mut transpositions = 0usize;

        for i in 0..s1_len {
            let start = i.saturating_sub(match_distance);
            let end = (i + match_distance + 1).min(s2_len);
            for j in start..end {
                if (s2_mask & (1u64 << j)) != 0 || b1[i] != b2[j] {
                    continue;
                }
                s1_mask |= 1u64 << i;
                s2_mask |= 1u64 << j;
                matches += 1;
                break;
            }
        }

        if matches == 0 {
            return 0.0;
        }

        let mut k = 0;
        for i in 0..s1_len {
            if (s1_mask & (1u64 << i)) == 0 {
                continue;
            }
            while (s2_mask & (1u64 << k)) == 0 {
                k += 1;
            }
            if b1[i] != b2[k] {
                transpositions += 1;
            }
            k += 1;
        }

        let m = matches as f32;
        let t = (transpositions / 2) as f32;
        return (m / s1_len as f32 + m / s2_len as f32 + (m - t) / m) / 3.0;
    }

    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();
    let c1_len = s1_chars.len();
    let c2_len = s2_chars.len();
    let match_distance = (c1_len.max(c2_len) / 2).saturating_sub(1);
    let mut s1_matches = vec![false; c1_len];
    let mut s2_matches = vec![false; c2_len];
    let mut matches = 0usize;
    let mut transpositions = 0usize;

    for i in 0..c1_len {
        let start = i.saturating_sub(match_distance);
        let end = (i + match_distance + 1).min(c2_len);
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
    for i in 0..c1_len {
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
    (m / c1_len as f32 + m / c2_len as f32 + (m - t) / m) / 3.0
}

/// Jaro-Winkler similarity — boosts strings that share a common prefix (up to 4 chars).
pub fn jaro_winkler(s1: &str, s2: &str) -> f32 {
    let jaro_sim = jaro(s1, s2);
    let prefix_len = s1
        .bytes()
        .zip(s2.bytes())
        .take(4)
        .take_while(|(a, b)| a == b)
        .count() as f32;
    jaro_sim + (prefix_len * 0.1 * (1.0 - jaro_sim))
}

/// Calculates great-circle distance between two coordinates in kilometers (rounded to 0.01 km),
/// matching `calculateHaversineDistance` in `src/services/pharmacyService.ts`.
pub fn haversine_distance_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let r_lat1 = lat1.to_radians();
    let r_lat2 = lat2.to_radians();

    let a = (d_lat / 2.0).sin().powi(2)
        + r_lat1.cos() * r_lat2.cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).max(0.0).sqrt());
    let distance = EARTH_RADIUS_KM * c;
    (distance * 100.0).round() / 100.0
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
    let q = query.to_ascii_lowercase();
    let lim = limit.clamp(1, 20);

    let mut scored: Vec<(&str, &str, f32)> = DRUG_INDEX
        .iter()
        .map(|(name, rxcui)| {
            let name_lower = name.to_ascii_lowercase();
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
/// Sources: Uganda Essential Medicines List (EMLU), WHO Model List of Essential Medicines,
/// and common Ugandan national formulary & brand entries.
static DRUG_INDEX: &[(&str, &str)] = &[
    // ── Analgesics & NSAIDs ─────────────────────────────────────────────────
    ("Paracetamol", "161"),
    ("Acetaminophen", "161"),
    ("Panadol", "161"),
    ("Ibuprofen", "5640"),
    ("Brufen", "5640"),
    ("Aspirin", "1191"),
    ("Diclofenac", "3407"),
    ("Naproxen", "7258"),
    ("Meloxicam", "41493"),
    ("Celecoxib", "140587"),
    ("Tramadol", "10689"),
    ("Morphine", "7052"),
    ("Codeine", "2670"),
    ("Mefenamic Acid", ""),
    // ── Antibiotics ─────────────────────────────────────────────────────────
    ("Amoxicillin", "723"),
    ("Amoxicillin-Clavulanate", ""),
    ("Augmentin", ""),
    ("Ampicillin", "733"),
    ("Ciprofloxacin", "2551"),
    ("Metronidazole", "6922"),
    ("Flagyl", "6922"),
    ("Doxycycline", "3640"),
    ("Azithromycin", "18631"),
    ("Erythromycin", "4053"),
    ("Clindamycin", "2582"),
    ("Trimethoprim", "10829"),
    ("Cotrimoxazole", ""),
    ("Septrin", ""),
    ("Tetracycline", "10528"),
    ("Penicillin V", "7980"),
    ("Benzylpenicillin", ""),
    ("Ceftriaxone", ""),
    ("Cefuroxime", ""),
    ("Clarithromycin", ""),
    ("Gentamicin", "4333"),
    ("Nitrofurantoin", "7454"),
    ("Levofloxacin", "82122"),
    ("Linezolid", "190376"),
    // ── Antimalarials ────────────────────────────────────────────────────────
    ("Artemether-Lumefantrine", ""),
    ("Coartem", ""),
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
    // ── Cardiovascular & Antihypertensives ───────────────────────────────────
    ("Amlodipine", "17767"),
    ("Nifedipine", "7417"),
    ("Atenolol", "1202"),
    ("Metoprolol", "6918"),
    ("Carvedilol", "20352"),
    ("Lisinopril", "29046"),
    ("Enalapril", "3826"),
    ("Ramipril", "35296"),
    ("Captopril", "1827"),
    ("Losartan", "203160"),
    ("Valsartan", "69749"),
    ("Telmisartan", "73494"),
    ("Hydrochlorothiazide", "5487"),
    ("Furosemide", "4603"),
    ("Spironolactone", "9997"),
    ("Potassium Chloride", "8591"),
    ("Methyldopa", "6807"),
    ("Propranolol", "8787"),
    ("Verapamil", "11170"),
    ("Diltiazem", "3443"),
    ("Amiodarone", "703"),
    ("Nitroglycerin", "4917"),
    ("Isosorbide", "6058"),
    ("Sildenafil", "136411"),
    ("Tadalafil", "358263"),
    ("Apixaban", "1364430"),
    ("Rivaroxaban", "1114195"),
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
    // ── Respiratory & Allergy ────────────────────────────────────────────────
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
    ("Cetirizine", "20610"),
    // ── Gastrointestinal ─────────────────────────────────────────────────────
    ("Omeprazole", "40790"),
    ("Esomeprazole", "283742"),
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
    // ── Mental Health & Neurology ────────────────────────────────────────────
    ("Haloperidol", "5613"),
    ("Chlorpromazine", "2456"),
    ("Diazepam", "3322"),
    ("Lorazepam", "6260"),
    ("Amitriptyline", "704"),
    ("Fluoxetine", "41493"),
    ("Sertraline", "36437"),
    ("Escitalopram", "321988"),
    ("Citalopram", "2556"),
    ("Lithium", "6448"),
    ("Levodopa", "6375"),
    ("Carbamazepine", "2002"),
    ("Phenytoin", "8123"),
    ("Sodium Valproate", ""),
    ("Valproic Acid", "11118"),
    ("Phenobarbital", "8134"),
    // ── Vitamins & Supplements ───────────────────────────────────────────────
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
    // ── Immunosuppressants & Other Common ────────────────────────────────────
    ("Methotrexate", "6851"),
    ("Azathioprine", "1256"),
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
