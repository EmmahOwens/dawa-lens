import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';
import { db } from '../db.js';
import { resolveRxNormConcept, getSpellingSuggestions as getRxNormSpelling } from './rxNormService.js';

dotenv.config();

const OPENFDA_BASE_URL = 'https://api.fda.gov';
const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

/**
 * Retrieves the openFDA API key from environment variables.
 * Checks OPENFDA_API (as configured in Render) or OPENFDA_API_KEY.
 */
export const getOpenFdaApiKey = () => {
  return process.env.OPENFDA_API || process.env.OPENFDA_API_KEY || null;
};

// ── In-Memory Fast Cache with TTL ─────────────────────────────────────────────
const memoryCache = new Map();
const MEMORY_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const getFromMemoryCache = (key) => {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
};

const setInMemoryCache = (key, data, ttlMs = MEMORY_CACHE_TTL_MS) => {
  // Bound memory cache size to prevent memory leaks
  if (memoryCache.size > 1000) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

// ── Global Substance & Regional Synonym Map ──────────────────────────────────
// Maps East African / British Pharmacopoeia (BP) and INN names to US FDA terminology
export const SYNONYM_MAP = {
  paracetamol: ['acetaminophen', 'paracetamol', 'panadol', 'tylenol'],
  panadol: ['acetaminophen', 'paracetamol', 'panadol'],
  acetaminophen: ['paracetamol', 'acetaminophen', 'panadol', 'tylenol'],
  salbutamol: ['albuterol', 'salbutamol', 'ventolin', 'proventil'],
  albuterol: ['salbutamol', 'albuterol', 'ventolin'],
  frusemide: ['furosemide', 'frusemide', 'lasix'],
  furosemide: ['frusemide', 'furosemide', 'lasix'],
  adrenaline: ['epinephrine', 'adrenaline'],
  epinephrine: ['adrenaline', 'epinephrine'],
  noradrenaline: ['norepinephrine', 'noradrenaline'],
  norepinephrine: ['noradrenaline', 'norepinephrine'],
  'co-amoxiclav': ['amoxicillin and clavulanate potassium', 'augmentin', 'amoxicillin clavulanate', 'amoxicillin'],
  amoxiclav: ['amoxicillin and clavulanate potassium', 'augmentin', 'amoxicillin clavulanate'],
  augmentin: ['amoxicillin and clavulanate potassium', 'augmentin', 'amoxicillin clavulanate'],
  'artemether-lumefantrine': ['artemether and lumefantrine', 'coartem', 'lumefantrine', 'artemether'],
  coartem: ['artemether and lumefantrine', 'coartem', 'lumefantrine'],
  hyoscine: ['scopolamine', 'hyoscine', 'buscopan'],
  buscopan: ['scopolamine', 'hyoscine', 'buscopan'],
  scopolamine: ['hyoscine', 'scopolamine', 'buscopan'],
  lignocaine: ['lidocaine', 'lignocaine', 'xylocaine'],
  lidocaine: ['lignocaine', 'lidocaine', 'xylocaine'],
  chlorpheniramine: ['chlorpheniramine maleate', 'chlorpheniramine', 'piriton'],
  piriton: ['chlorpheniramine maleate', 'chlorpheniramine'],
  cotrimoxazole: ['sulfamethoxazole and trimethoprim', 'bactrim', 'septrin', 'trimethoprim', 'sulfamethoxazole'],
  septrin: ['sulfamethoxazole and trimethoprim', 'bactrim', 'septrin'],
  bactrim: ['sulfamethoxazole and trimethoprim', 'bactrim', 'septrin'],
  pethidine: ['meperidine', 'pethidine', 'demerol'],
  meperidine: ['pethidine', 'meperidine', 'demerol'],
  phenobarbitone: ['phenobarbital', 'phenobarbitone'],
  phenobarbital: ['phenobarbitone', 'phenobarbital'],
  rifampicin: ['rifampin', 'rifampicin'],
  rifampin: ['rifampicin', 'rifampin'],
  glibenclamide: ['glyburide', 'glibenclamide', 'daonil'],
  glyburide: ['glibenclamide', 'glyburide', 'daonil'],
};

/**
 * Returns candidate search terms for a drug name, normalizing regional nomenclature.
 * Synchronous version for backwards compatibility.
 */
export const getSearchTerms = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return [];
  const clean = rawName.trim().toLowerCase();
  
  const terms = new Set([clean]);
  
  // Check exact dictionary match
  if (SYNONYM_MAP[clean]) {
    SYNONYM_MAP[clean].forEach((t) => terms.add(t));
  }

  // Check sub-word / multi-word tokens
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (clean.includes(key)) {
      synonyms.forEach((t) => terms.add(t));
    }
  }

  return Array.from(terms);
};

/**
 * Enhanced asynchronous search term resolution powered by RxNorm concept normalization
 * and the regional pharmacopoeia dictionary.
 */
export const getEnrichedSearchTerms = async (rawName) => {
  if (!rawName || typeof rawName !== 'string') {
    return { concept: null, searchTerms: [] };
  }
  const clean = rawName.trim().toLowerCase();
  const terms = new Set([clean]);

  // Baseline dictionary terms (East African / Commonwealth)
  if (SYNONYM_MAP[clean]) {
    SYNONYM_MAP[clean].forEach((t) => terms.add(t));
  }
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (clean.includes(key)) {
      synonyms.forEach((t) => terms.add(t));
    }
  }

  // Dynamic RxNorm Concept Normalization
  let concept = null;
  try {
    concept = await resolveRxNormConcept(rawName);
    if (concept) {
      if (concept.canonicalName) terms.add(concept.canonicalName.toLowerCase());
      if (concept.activeIngredients && Array.isArray(concept.activeIngredients)) {
        concept.activeIngredients.forEach((ai) => terms.add(ai.toLowerCase()));
      }
      if (concept.brandSynonyms && Array.isArray(concept.brandSynonyms)) {
        concept.brandSynonyms.forEach((bn) => terms.add(bn.toLowerCase()));
      }
      if (concept.searchTerms && Array.isArray(concept.searchTerms)) {
        concept.searchTerms.forEach((st) => terms.add(st.toLowerCase()));
      }
    }
  } catch (err) {
    console.warn(`[openFdaService] RxNorm resolution fallback skipped: ${err.message}`);
  }

  return {
    concept,
    searchTerms: Array.from(terms),
  };
};

// ── Generic openFDA Axios Caller with Key Injection, Cache & IPv4 Agent ─────
const makeOpenFdaRequest = async (endpoint, params = {}) => {
  const apiKey = getOpenFdaApiKey();
  const queryParams = { ...params };
  if (apiKey) {
    queryParams.api_key = apiKey;
  }

  const cacheKey = `openfda:${endpoint}:${JSON.stringify(params)}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = `${OPENFDA_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: queryParams,
      timeout: 10000,
      httpsAgent,
      headers: {
        'User-Agent': 'DawaLens/1.6 (Healthcare Informatics Platform)',
      },
    });

    if (response.data) {
      setInMemoryCache(cacheKey, response.data);
      return response.data;
    }
    return null;
  } catch (err) {
    if (err.response?.status === 404) {
      // 404 in openFDA means zero matches found for this specific query
      return null;
    }
    console.warn(`[openFdaService] Request to ${endpoint} failed: ${err.message}`);
    return null;
  }
};

// ── Endpoint 1: Drug Labeling (/drug/label.json) ──────────────────────────────

/**
 * Fetches structured FDA label info including boxed warnings, interactions,
 * contraindications, pregnancy/pediatric/geriatric guidance, inactive ingredients, and storage.
 * Seamlessly resolves regional/international queries via RxNorm.
 */
export const fetchDrugLabel = async (drugName) => {
  const { concept, searchTerms } = await getEnrichedSearchTerms(drugName);
  
  // 1. If RxNorm provided an RxCUI, search directly by openfda.rxcui
  if (concept?.rxcui) {
    const cuiData = await makeOpenFdaRequest('/drug/label.json', {
      search: `openfda.rxcui:"${concept.rxcui}"`,
      limit: 1,
    });

    if (cuiData?.results?.[0]) {
      const label = cuiData.results[0];
      const openfda = label.openfda || {};
      return {
        id: label.id,
        rxcui: concept.rxcui,
        unii: concept.unii || openfda.unii?.[0] || null,
        brandName: openfda.brand_name?.[0] || drugName,
        genericName: concept.canonicalName || openfda.generic_name?.[0] || drugName,
        brandNames: openfda.brand_name || concept.brandSynonyms || [],
        substanceNames: openfda.substance_name || [],
        activeIngredients: label.active_ingredient || (concept.activeIngredients?.length ? concept.activeIngredients : openfda.substance_name) || [],
        inactiveIngredients: label.inactive_ingredient || [],
        boxedWarning: label.boxed_warning?.[0] || null,
        warnings: label.warnings?.[0] || label.warnings_and_cautions?.[0] || null,
        contraindications: label.contraindications?.[0] || null,
        drugInteractions: label.drug_interactions?.[0] || null,
        indicationsAndUsage: label.indications_and_usage?.[0] || null,
        dosageAndAdministration: label.dosage_and_administration?.[0] || null,
        overdosage: label.overdosage?.[0] || null,
        pregnancy: label.pregnancy?.[0] || label.pregnancy_or_breast_feeding?.[0] || null,
        nursingMothers: label.nursing_mothers?.[0] || null,
        pediatricUse: label.pediatric_use?.[0] || null,
        geriatricUse: label.geriatric_use?.[0] || null,
        storageAndHandling: label.storage_and_handling?.[0] || null,
        mechanismOfAction: label.mechanism_of_action?.[0] || label.clinical_pharmacology?.[0] || null,
        patientCounseling: label.patient_counseling_information?.[0] || label.spl_patient_package_insert?.[0] || label.information_for_patients?.[0] || null,
        route: openfda.route?.[0] || null,
        pharmClasses: openfda.pharm_class_epc || [],
        source: 'FDA_LABEL',
      };
    }
  }

  // 2. Iterate through candidate search terms
  for (const term of searchTerms) {
    // Try searching brand_name or generic_name or substance_name
    const searchQuery = `openfda.brand_name:"${term}"+openfda.generic_name:"${term}"+openfda.substance_name:"${term}"`;
    const data = await makeOpenFdaRequest('/drug/label.json', {
      search: searchQuery,
      limit: 1,
    });

    if (data?.results?.[0]) {
      const label = data.results[0];
      const openfda = label.openfda || {};

      return {
        id: label.id,
        rxcui: concept?.rxcui || openfda.rxcui?.[0] || null,
        unii: concept?.unii || openfda.unii?.[0] || null,
        brandName: openfda.brand_name?.[0] || drugName,
        genericName: concept?.canonicalName || openfda.generic_name?.[0] || term,
        brandNames: openfda.brand_name || concept?.brandSynonyms || [],
        substanceNames: openfda.substance_name || [],
        activeIngredients: label.active_ingredient || (concept?.activeIngredients?.length ? concept.activeIngredients : openfda.substance_name) || [],
        inactiveIngredients: label.inactive_ingredient || [],
        boxedWarning: label.boxed_warning?.[0] || null,
        warnings: label.warnings?.[0] || label.warnings_and_cautions?.[0] || null,
        contraindications: label.contraindications?.[0] || null,
        drugInteractions: label.drug_interactions?.[0] || null,
        indicationsAndUsage: label.indications_and_usage?.[0] || null,
        dosageAndAdministration: label.dosage_and_administration?.[0] || null,
        overdosage: label.overdosage?.[0] || null,
        pregnancy: label.pregnancy?.[0] || label.pregnancy_or_breast_feeding?.[0] || null,
        nursingMothers: label.nursing_mothers?.[0] || null,
        pediatricUse: label.pediatric_use?.[0] || null,
        geriatricUse: label.geriatric_use?.[0] || null,
        storageAndHandling: label.storage_and_handling?.[0] || null,
        mechanismOfAction: label.mechanism_of_action?.[0] || label.clinical_pharmacology?.[0] || null,
        patientCounseling: label.patient_counseling_information?.[0] || label.spl_patient_package_insert?.[0] || label.information_for_patients?.[0] || null,
        route: openfda.route?.[0] || null,
        pharmClasses: openfda.pharm_class_epc || [],
        source: 'FDA_LABEL',
      };
    }
  }

  // 3. Fallback: search general text if structured fields yielded nothing
  try {
    const fallbackTerm = concept?.canonicalName || drugName;
    const fallbackData = await makeOpenFdaRequest('/drug/label.json', {
      search: `"${encodeURIComponent(fallbackTerm)}"`,
      limit: 1,
    });
    if (fallbackData?.results?.[0]) {
      const label = fallbackData.results[0];
      const openfda = label.openfda || {};
      return {
        id: label.id,
        rxcui: concept?.rxcui || openfda.rxcui?.[0] || null,
        unii: concept?.unii || openfda.unii?.[0] || null,
        brandName: openfda.brand_name?.[0] || drugName,
        genericName: concept?.canonicalName || openfda.generic_name?.[0] || fallbackTerm,
        brandNames: openfda.brand_name || concept?.brandSynonyms || [],
        substanceNames: openfda.substance_name || [],
        activeIngredients: label.active_ingredient || [],
        inactiveIngredients: label.inactive_ingredient || [],
        boxedWarning: label.boxed_warning?.[0] || null,
        warnings: label.warnings?.[0] || null,
        contraindications: label.contraindications?.[0] || null,
        drugInteractions: label.drug_interactions?.[0] || null,
        indicationsAndUsage: label.indications_and_usage?.[0] || null,
        dosageAndAdministration: label.dosage_and_administration?.[0] || null,
        overdosage: label.overdosage?.[0] || null,
        pregnancy: label.pregnancy?.[0] || null,
        nursingMothers: label.nursing_mothers?.[0] || null,
        pediatricUse: label.pediatric_use?.[0] || null,
        geriatricUse: label.geriatric_use?.[0] || null,
        storageAndHandling: label.storage_and_handling?.[0] || null,
        mechanismOfAction: label.mechanism_of_action?.[0] || label.clinical_pharmacology?.[0] || null,
        patientCounseling: label.patient_counseling_information?.[0] || null,
        route: openfda.route?.[0] || null,
        pharmClasses: openfda.pharm_class_epc || [],
        source: 'FDA_LABEL',
      };
    }
  } catch {
    // Ignore fallback errors
  }

  return null;
};

// ── Endpoint 2: National Drug Code Directory (/drug/ndc.json) ────────────────

/**
 * Fetches structured identity, dosage form, strengths, DEA schedule, and pharmacologic classes.
 */
export const fetchNdcData = async (drugName) => {
  const { concept, searchTerms } = await getEnrichedSearchTerms(drugName);

  for (const term of searchTerms) {
    const data = await makeOpenFdaRequest('/drug/ndc.json', {
      search: `brand_name:"${term}"+generic_name:"${term}"+active_ingredients.name:"${term}"`,
      limit: 5,
    });

    if (data?.results && data.results.length > 0) {
      const records = data.results.map((r) => ({
        productNdc: r.product_ndc,
        brandName: r.brand_name,
        genericName: r.generic_name,
        dosageForm: r.dosage_form_name,
        route: r.route?.[0],
        deaSchedule: r.dea_schedule || null,
        marketingStatus: r.marketing_category,
        pharmClasses: r.pharm_class || [],
        activeIngredients: (r.active_ingredients || []).map((ai) => ({
          name: ai.name,
          strength: ai.strength,
        })),
        packaging: (r.packaging || []).map((p) => p.description),
      }));

      return {
        matchedTerm: term,
        rxcui: concept?.rxcui || null,
        records,
        deaSchedule: records.find((r) => r.deaSchedule)?.deaSchedule || null,
        pharmClasses: Array.from(new Set(records.flatMap((r) => r.pharmClasses))),
        dosageForms: Array.from(new Set(records.map((r) => r.dosageForm).filter(Boolean))),
      };
    }
  }

  return null;
};

// ── Endpoint 3: Adverse Event Reports (FAERS - /drug/event.json) ──────────────

/**
 * Retrieves top real-world reported adverse events, with optional age and sex filters.
 */
export const fetchAdverseEvents = async (drugName, options = {}) => {
  const { ageGroup, sex } = options;
  const { concept, searchTerms } = await getEnrichedSearchTerms(drugName);
  const primaryTerm = concept?.canonicalName || searchTerms[0] || drugName;

  let searchFilter = `patient.drug.medicinalproduct:"${primaryTerm}"+patient.drug.openfda.generic_name:"${primaryTerm}"`;
  if (ageGroup) {
    searchFilter += `+AND+patient.patientagegroup:${ageGroup}`;
  }
  if (sex) {
    searchFilter += `+AND+patient.patientsex:${sex}`;
  }

  const data = await makeOpenFdaRequest('/drug/event.json', {
    search: searchFilter,
    count: 'patient.reaction.reactionmeddrapt.exact',
    limit: 10,
  });

  if (data?.results && data.results.length > 0) {
    const totalReports = data.results.reduce((sum, item) => sum + (item.count || 0), 0);
    const topReactions = data.results.slice(0, 8).map((item) => ({
      reaction: item.term,
      count: item.count,
      percentage: totalReports > 0 ? Math.round((item.count / totalReports) * 100) : 0,
    }));

    return {
      drugName,
      canonicalName: primaryTerm,
      totalSampleReports: totalReports,
      topReactions,
      disclaimer: 'Adverse event reporting is voluntary and unverified. These signals represent reported experiences, not established causal proof.',
    };
  }

  return null;
};

// ── Endpoint 4: Enforcement & Recalls (/drug/enforcement.json) ────────────────

/**
 * Searches for active or recent FDA drug recalls for a medication.
 */
export const fetchDrugRecalls = async (drugName) => {
  const { searchTerms } = await getEnrichedSearchTerms(drugName);

  for (const term of searchTerms) {
    const data = await makeOpenFdaRequest('/drug/enforcement.json', {
      search: `openfda.generic_name:"${term}"+openfda.brand_name:"${term}"+product_description:"${term}"`,
      limit: 5,
    });

    if (data?.results && data.results.length > 0) {
      const recalls = data.results.map((r) => ({
        recallNumber: r.recall_number,
        productDescription: r.product_description,
        reasonForRecall: r.reason_for_recall,
        classification: r.classification, // Class I, Class II, Class III
        status: r.status, // Ongoing, Terminated, Completed
        recallInitiationDate: r.recall_initiation_date,
        distributionPattern: r.distribution_pattern,
      }));

      return {
        hasActiveRecalls: recalls.some((r) => r.status?.toLowerCase() === 'ongoing'),
        recalls,
      };
    }
  }

  return { hasActiveRecalls: false, recalls: [] };
};

// ── Endpoint 5: Drugs@FDA Approval History (/drug/drugsfda.json) ──────────────

/**
 * Fetches regulatory approval history, sponsor information, and application numbers (NDA/ANDA/BLA).
 */
export const fetchDrugApprovals = async (drugName) => {
  const { searchTerms } = await getEnrichedSearchTerms(drugName);

  for (const term of searchTerms) {
    const data = await makeOpenFdaRequest('/drug/drugsfda.json', {
      search: `openfda.generic_name:"${term}"+openfda.brand_name:"${term}"+products.brand_name:"${term}"`,
      limit: 3,
    });

    if (data?.results && data.results.length > 0) {
      const approvals = data.results.map((app) => ({
        applicationNumber: app.application_number,
        sponsorName: app.sponsor_name,
        products: (app.products || []).map((p) => ({
          brandName: p.brand_name,
          dosageForm: p.dosage_form,
          route: p.route,
          marketingStatus: p.marketing_status,
        })),
        submissions: (app.submissions || []).slice(0, 2).map((s) => ({
          submissionType: s.submission_type,
          submissionStatus: s.submission_status,
          submissionStatusDate: s.submission_status_date,
        })),
      }));

      return {
        isApproved: true,
        approvals,
      };
    }
  }

  return { isApproved: false, approvals: [] };
};

// ── High-Level Clinical Safety Engine ─────────────────────────────────────────

/**
 * Checks a patient's allergies against the drug's inactive and active ingredients.
 */
export const checkAllergenConflicts = (label, patientAllergies = []) => {
  if (!patientAllergies || patientAllergies.length === 0 || !label) return [];

  const inactiveText = Array.isArray(label.inactiveIngredients)
    ? label.inactiveIngredients.join(' ').toLowerCase()
    : String(label.inactiveIngredients || '').toLowerCase();

  const activeText = Array.isArray(label.activeIngredients)
    ? label.activeIngredients.join(' ').toLowerCase()
    : String(label.activeIngredients || '').toLowerCase();

  const fullText = `${inactiveText} ${activeText} ${String(label.warnings || '').toLowerCase()}`;

  const conflicts = [];
  for (const allergy of patientAllergies) {
    const cleanAllergy = allergy.trim().toLowerCase();
    if (!cleanAllergy) continue;

    // Check direct mention or common synonym patterns
    if (fullText.includes(cleanAllergy)) {
      conflicts.push({
        allergy,
        severity: 'high',
        detail: `The medication label lists "${allergy}" in its ingredients or formulation warnings.`,
      });
    } else if (cleanAllergy === 'lactose' && (fullText.includes('lactose') || fullText.includes('galactose'))) {
      conflicts.push({
        allergy,
        severity: 'high',
        detail: `The medication contains lactose/milk sugar binders which may cause reactions in severe intolerance.`,
      });
    } else if (cleanAllergy === 'gluten' && (fullText.includes('wheat') || fullText.includes('gluten') || fullText.includes('starch'))) {
      conflicts.push({
        allergy,
        severity: 'medium',
        detail: `The formulation contains starch/gluten excipients. Check with a pharmacist.`,
      });
    } else if (cleanAllergy === 'sulfite' && (fullText.includes('sulfite') || fullText.includes('bisulfite') || fullText.includes('metabisulfite'))) {
      conflicts.push({
        allergy,
        severity: 'high',
        detail: `Formulation contains sulfite preservatives which may trigger asthma or allergic attacks.`,
      });
    }
  }

  return conflicts;
};

/**
 * Checks patient conditions against FDA contraindications and warnings.
 */
export const checkContraindicationConflicts = (label, patientConditions = []) => {
  if (!patientConditions || patientConditions.length === 0 || !label) return [];

  const contraText = `${String(label.contraindications || '').toLowerCase()} ${String(label.boxedWarning || '').toLowerCase()} ${String(label.warnings || '').toLowerCase()}`;

  const conflicts = [];
  for (const cond of patientConditions) {
    const cleanCond = cond.trim().toLowerCase();
    if (!cleanCond) continue;

    if (contraText.includes(cleanCond)) {
      conflicts.push({
        condition: cond,
        severity: 'critical',
        detail: `FDA Contraindication: Use is restricted or cautioned for patients with ${cond}.`,
      });
    } else if (cleanCond.includes('kidney') || cleanCond.includes('renal')) {
      if (contraText.includes('renal impairment') || contraText.includes('kidney disease') || contraText.includes('renal failure')) {
        conflicts.push({
          condition: cond,
          severity: 'high',
          detail: `FDA Warning: Caution or dosage adjustment required in patients with renal impairment.`,
        });
      }
    } else if (cleanCond.includes('liver') || cleanCond.includes('hepatic')) {
      if (contraText.includes('hepatic impairment') || contraText.includes('liver disease') || contraText.includes('cirrhosis')) {
        conflicts.push({
          condition: cond,
          severity: 'high',
          detail: `FDA Warning: Caution or contraindication in patients with hepatic impairment.`,
        });
      }
    } else if (cleanCond.includes('asthma')) {
      if (contraText.includes('bronchospasm') || contraText.includes('asthma') || contraText.includes('airway disease')) {
        conflicts.push({
          condition: cond,
          severity: 'high',
          detail: `FDA Warning: May precipitate bronchospasm or exacerbate asthma symptoms.`,
        });
      }
    } else if (cleanCond.includes('ulcer') || cleanCond.includes('gastric')) {
      if (contraText.includes('gastrointestinal bleeding') || contraText.includes('peptic ulcer') || contraText.includes('gi perforation')) {
        conflicts.push({
          condition: cond,
          severity: 'high',
          detail: `FDA Warning: Increased risk of GI bleeding or peptic ulcer exacerbation.`,
        });
      }
    }
  }

  return conflicts;
};

/**
 * Checks for duplicate pharmacologic therapy among a list of active medications.
 */
export const checkDuplicateTherapy = async (medications = []) => {
  if (!medications || medications.length < 2) return [];

  const medClasses = [];
  for (const med of medications) {
    const medName = med.name || med.genericName;
    if (!medName) continue;
    const ndc = await fetchNdcData(medName);
    if (ndc?.pharmClasses?.length) {
      medClasses.push({
        name: medName,
        classes: ndc.pharmClasses,
      });
    }
  }

  const duplicates = [];
  for (let i = 0; i < medClasses.length; i++) {
    for (let j = i + 1; j < medClasses.length; j++) {
      const medA = medClasses[i];
      const medB = medClasses[j];
      const sharedClasses = medA.classes.filter((c) => medB.classes.includes(c));

      // Filter for Established Pharmacologic Class (EPC)
      const sharedEpc = sharedClasses.filter((c) => c.includes('[EPC]'));
      if (sharedEpc.length > 0) {
        duplicates.push({
          drug1: medA.name,
          drug2: medB.name,
          sharedClass: sharedEpc.map((c) => c.replace(/\s*\[EPC\]/g, '')).join(', '),
          warning: `Both medications belong to the same pharmacologic class (${sharedEpc.join(', ')}). Concurrent use increases toxicity risk.`,
        });
      }
    }
  }

  return duplicates;
};

// ── Aggregated Comprehensive Profile ──────────────────────────────────────────

/**
 * Aggregates all openFDA endpoints into a single comprehensive, clinically actionable profile.
 * Integrates RxNorm concept normalization for cross-border accuracy.
 */
export const getComprehensiveDrugProfile = async (query, patientContext = {}) => {
  if (!query || !query.trim()) {
    throw new AppError('Drug query cannot be empty', 400);
  }

  // 1. Resolve RxNorm concept first (in parallel with baseline setup)
  const { concept } = await getEnrichedSearchTerms(query);

  // 2. Concurrent fetch of all key openFDA datasets
  const [label, ndc, recalls, approvals] = await Promise.all([
    fetchDrugLabel(query),
    fetchNdcData(query),
    fetchDrugRecalls(query),
    fetchDrugApprovals(query),
  ]);

  // 3. Fetch adverse event signals if label or concept exists
  let adverseEvents = null;
  const adverseSearchTerm = concept?.canonicalName || label?.genericName || query;
  if (label || concept) {
    let ageGroup = null;
    if (patientContext.age) {
      const ageNum = Number(patientContext.age);
      if (ageNum < 2) ageGroup = 1;
      else if (ageNum < 12) ageGroup = 3;
      else if (ageNum < 18) ageGroup = 4;
      else if (ageNum >= 65) ageGroup = 6;
      else ageGroup = 5;
    }
    const sex = patientContext.gender === 'female' ? 2 : patientContext.gender === 'male' ? 1 : null;
    adverseEvents = await fetchAdverseEvents(adverseSearchTerm, { ageGroup, sex });
  }

  // 4. Calculate clinical alert checks
  const allergenAlerts = checkAllergenConflicts(label, patientContext.allergies || []);
  const contraindicationAlerts = checkContraindicationConflicts(label, patientContext.conditions || []);

  // 5. Compute composite regulatory trust score (0 - 100%)
  let trustScore = 70; // Baseline
  const trustFactors = [];

  if (concept?.rxcui) {
    trustScore += 10;
    trustFactors.push(`Verified RxNorm Concept (RxCUI: ${concept.rxcui}).`);
  }
  if (approvals?.isApproved) {
    trustScore += 15;
    trustFactors.push('Verified FDA New Drug / Abbreviated Drug approval history (NDA/ANDA).');
  }
  if (ndc?.records?.length) {
    trustScore += 10;
    trustFactors.push('Matched active National Drug Code (NDC) packaging catalog.');
  }
  if (recalls?.hasActiveRecalls) {
    trustScore -= 40;
    trustFactors.push('⚠️ Active FDA recall ongoing for this active ingredient/formulation.');
  }
  trustScore = Math.min(100, Math.max(10, trustScore));

  const resolvedGeneric = concept?.canonicalName || label?.genericName || label?.brandName || query;

  return {
    query,
    resolvedName: resolvedGeneric,
    rxcui: concept?.rxcui || label?.rxcui || null,
    unii: concept?.unii || label?.unii || null,
    activeIngredients: concept?.activeIngredients?.length ? concept.activeIngredients : label?.activeIngredients || [],
    brandSynonyms: concept?.brandSynonyms || label?.brandNames || [],
    label,
    ndc,
    recalls,
    approvals,
    adverseEvents,
    safetyAlerts: {
      boxedWarning: label?.boxedWarning || null,
      allergenAlerts,
      contraindicationAlerts,
      deaSchedule: ndc?.deaSchedule || null,
      pregnancyRisk: label?.pregnancy || null,
      nursingWarning: label?.nursingMothers || null,
      pediatricPrecaution: label?.pediatricUse || null,
      geriatricPrecaution: label?.geriatricUse || null,
      storageGuidelines: label?.storageAndHandling || null,
      hasActiveRecalls: recalls?.hasActiveRecalls || false,
    },
    trustIndex: {
      score: trustScore,
      factors: trustFactors,
    },
    source: 'OPENFDA',
  };
};

/**
 * Validates a vision pill identification prediction against the NDC directory.
 */
export const validatePillMatchWithNdc = async (drugName, strength, dosageForm) => {
  const ndc = await fetchNdcData(drugName);
  if (!ndc || !ndc.records || ndc.records.length === 0) {
    return {
      isValidated: false,
      confidenceBoost: 0,
      reason: 'No matching NDC records found in openFDA directory.',
    };
  }

  let matchFound = false;
  let formMatch = false;

  for (const rec of ndc.records) {
    if (dosageForm && rec.dosageForm?.toLowerCase().includes(dosageForm.toLowerCase())) {
      formMatch = true;
    }
    if (strength && rec.activeIngredients?.some((ai) => ai.strength?.toLowerCase().includes(strength.toLowerCase()))) {
      matchFound = true;
      break;
    }
  }

  return {
    isValidated: true,
    exactStrengthMatch: matchFound,
    dosageFormMatch: formMatch,
    deaSchedule: ndc.deaSchedule,
    confidenceBoost: matchFound ? 0.15 : formMatch ? 0.08 : 0.05,
    matchedNdc: ndc.records[0]?.productNdc,
  };
};
