import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';
import { resolveRxNormConcept } from './rxNormService.js';

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
const SYNONYM_MAP = {
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
 */
export const getSearchTerms = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return [];
  const clean = rawName.trim().toLowerCase();
  const terms = new Set([clean]);

  if (SYNONYM_MAP[clean]) {
    SYNONYM_MAP[clean].forEach((t) => terms.add(t));
  }
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (clean.includes(key)) {
      synonyms.forEach((t) => terms.add(t));
    }
  }
  return Array.from(terms);
};

const addRxNormTermsToSet = (concept, terms) => {
  if (!concept) return;
  if (concept.canonicalName) terms.add(concept.canonicalName.toLowerCase());
  const listFields = [concept.activeIngredients, concept.brandSynonyms, concept.searchTerms];
  for (const list of listFields) {
    if (Array.isArray(list)) {
      list.forEach((item) => terms.add(item.toLowerCase()));
    }
  }
};

/**
 * Enhanced asynchronous search term resolution powered by RxNorm concept normalization.
 */
const getEnrichedSearchTerms = async (rawName) => {
  if (!rawName || typeof rawName !== 'string') {
    return { concept: null, searchTerms: [] };
  }
  const terms = new Set(getSearchTerms(rawName));

  let concept = null;
  try {
    concept = await resolveRxNormConcept(rawName);
    addRxNormTermsToSet(concept, terms);
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
  const queryParams = apiKey ? { ...params, api_key: apiKey } : { ...params };

  const cacheKey = `openfda:${endpoint}:${JSON.stringify(params)}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${OPENFDA_BASE_URL}${endpoint}`, {
      params: queryParams,
      timeout: 2500,
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
    if (err.response?.status !== 404) {
      console.warn(`[openFdaService] Request to ${endpoint} failed: ${err.message}`);
    }
    return null;
  }
};

// ── Endpoint 1: Drug Labeling (/drug/label.json) ──────────────────────────────

const pickFirstLabelEntry = (label, keys) => {
  for (const key of keys) {
    const val = label[key]?.[0];
    if (val) return val;
  }
  return null;
};

const mapFdaLabelResult = (label, concept, drugName, fallbackGeneric) => {
  const openfda = label.openfda || {};
  const conceptIngredients = concept?.activeIngredients?.length ? concept.activeIngredients : null;

  return {
    id: label.id,
    rxcui: concept?.rxcui || openfda.rxcui?.[0] || null,
    unii: concept?.unii || openfda.unii?.[0] || null,
    brandName: openfda.brand_name?.[0] || drugName,
    genericName: concept?.canonicalName || openfda.generic_name?.[0] || fallbackGeneric,
    brandNames: openfda.brand_name || concept?.brandSynonyms || [],
    substanceNames: openfda.substance_name || [],
    activeIngredients: label.active_ingredient || conceptIngredients || openfda.substance_name || [],
    inactiveIngredients: label.inactive_ingredient || [],
    boxedWarning: pickFirstLabelEntry(label, ['boxed_warning']),
    warnings: pickFirstLabelEntry(label, ['warnings', 'warnings_and_cautions']),
    contraindications: pickFirstLabelEntry(label, ['contraindications']),
    drugInteractions: pickFirstLabelEntry(label, ['drug_interactions']),
    indicationsAndUsage: pickFirstLabelEntry(label, ['indications_and_usage']),
    dosageAndAdministration: pickFirstLabelEntry(label, ['dosage_and_administration']),
    overdosage: pickFirstLabelEntry(label, ['overdosage']),
    pregnancy: pickFirstLabelEntry(label, ['pregnancy', 'pregnancy_or_breast_feeding']),
    nursingMothers: pickFirstLabelEntry(label, ['nursing_mothers']),
    pediatricUse: pickFirstLabelEntry(label, ['pediatric_use']),
    geriatricUse: pickFirstLabelEntry(label, ['geriatric_use']),
    storageAndHandling: pickFirstLabelEntry(label, ['storage_and_handling']),
    mechanismOfAction: pickFirstLabelEntry(label, ['mechanism_of_action', 'clinical_pharmacology']),
    patientCounseling: pickFirstLabelEntry(label, [
      'patient_counseling_information',
      'spl_patient_package_insert',
      'information_for_patients'
    ]),
    route: openfda.route?.[0] || null,
    pharmClasses: openfda.pharm_class_epc || [],
    source: 'FDA_LABEL',
  };
};

/**
 * Fetches structured FDA label info including boxed warnings, interactions,
 * contraindications, pregnancy/pediatric/geriatric guidance, inactive ingredients, and storage.
 */
export const fetchDrugLabel = async (drugName) => {
  const { concept, searchTerms } = await getEnrichedSearchTerms(drugName);

  if (concept?.rxcui) {
    const cuiData = await makeOpenFdaRequest('/drug/label.json', {
      search: `openfda.rxcui:"${concept.rxcui}"`,
      limit: 1,
    });
    if (cuiData?.results?.[0]) {
      return mapFdaLabelResult(cuiData.results[0], concept, drugName, drugName);
    }
  }

  for (const term of searchTerms) {
    const searchQuery = `openfda.brand_name:"${term}"+openfda.generic_name:"${term}"+openfda.substance_name:"${term}"`;
    const data = await makeOpenFdaRequest('/drug/label.json', { search: searchQuery, limit: 1 });
    if (data?.results?.[0]) {
      return mapFdaLabelResult(data.results[0], concept, drugName, term);
    }
  }

  try {
    const fallbackTerm = concept?.canonicalName || drugName;
    const fallbackData = await makeOpenFdaRequest('/drug/label.json', {
      search: `"${encodeURIComponent(fallbackTerm)}"`,
      limit: 1,
    });
    if (fallbackData?.results?.[0]) {
      return mapFdaLabelResult(fallbackData.results[0], concept, drugName, fallbackTerm);
    }
  } catch {
    // Ignore fallback errors
  }

  return null;
};

// ── Endpoint 2: National Drug Code Directory (/drug/ndc.json) ────────────────

export const fetchNdcData = async (drugName) => {
  const { concept, searchTerms } = await getEnrichedSearchTerms(drugName);

  for (const term of searchTerms) {
    const data = await makeOpenFdaRequest('/drug/ndc.json', {
      search: `brand_name:"${term}"+generic_name:"${term}"+active_ingredients.name:"${term}"`,
      limit: 5,
    });

    if (data?.results?.length > 0) {
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

export const fetchAdverseEvents = async (drugName, options = {}) => {
  const { ageGroup, sex } = options;
  const { concept, searchTerms } = await getEnrichedSearchTerms(drugName);
  const primaryTerm = concept?.canonicalName || searchTerms[0] || drugName;

  let searchFilter = `patient.drug.medicinalproduct:"${primaryTerm}"+patient.drug.openfda.generic_name:"${primaryTerm}"`;
  if (ageGroup) searchFilter += `+AND+patient.patientagegroup:${ageGroup}`;
  if (sex) searchFilter += `+AND+patient.patientsex:${sex}`;

  const data = await makeOpenFdaRequest('/drug/event.json', {
    search: searchFilter,
    count: 'patient.reaction.reactionmeddrapt.exact',
    limit: 10,
  });

  if (data?.results?.length > 0) {
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
      disclaimer:
        'Adverse event reporting is voluntary and unverified. These signals represent reported experiences, not established causal proof.',
    };
  }

  return null;
};

// ── Endpoint 4: Enforcement & Recalls (/drug/enforcement.json) ────────────────

export const fetchDrugRecalls = async (drugName) => {
  const { searchTerms } = await getEnrichedSearchTerms(drugName);

  for (const term of searchTerms) {
    const data = await makeOpenFdaRequest('/drug/enforcement.json', {
      search: `openfda.generic_name:"${term}"+openfda.brand_name:"${term}"+product_description:"${term}"`,
      limit: 5,
    });

    if (data?.results?.length > 0) {
      const recalls = data.results.map((r) => ({
        recallNumber: r.recall_number,
        productDescription: r.product_description,
        reasonForRecall: r.reason_for_recall,
        classification: r.classification,
        status: r.status,
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

const fetchDrugApprovals = async (drugName) => {
  const { searchTerms } = await getEnrichedSearchTerms(drugName);

  for (const term of searchTerms) {
    const data = await makeOpenFdaRequest('/drug/drugsfda.json', {
      search: `openfda.generic_name:"${term}"+openfda.brand_name:"${term}"+products.brand_name:"${term}"`,
      limit: 3,
    });

    if (data?.results?.length > 0) {
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

      return { isApproved: true, approvals };
    }
  }

  return { isApproved: false, approvals: [] };
};

// ── High-Level Clinical Safety Engine ─────────────────────────────────────────

const ALLERGY_EXCIPIENT_RULES = [
  {
    key: 'lactose',
    triggers: ['lactose', 'galactose'],
    severity: 'high',
    detail: 'The medication contains lactose/milk sugar binders which may cause reactions in severe intolerance.'
  },
  {
    key: 'gluten',
    triggers: ['wheat', 'gluten', 'starch'],
    severity: 'medium',
    detail: 'The formulation contains starch/gluten excipients. Check with a pharmacist.'
  },
  {
    key: 'sulfite',
    triggers: ['sulfite', 'bisulfite', 'metabisulfite'],
    severity: 'high',
    detail: 'Formulation contains sulfite preservatives which may trigger asthma or allergic attacks.'
  }
];

export const checkAllergenConflicts = (label, patientAllergies = []) => {
  if (!patientAllergies?.length || !label) return [];

  const toLowerText = (val) => (Array.isArray(val) ? val.join(' ') : String(val || '')).toLowerCase();
  const fullText = `${toLowerText(label.inactiveIngredients)} ${toLowerText(label.activeIngredients)} ${toLowerText(label.warnings)}`;

  const conflicts = [];
  for (const allergy of patientAllergies) {
    const cleanAllergy = allergy.trim().toLowerCase();
    if (!cleanAllergy) continue;

    if (fullText.includes(cleanAllergy)) {
      conflicts.push({
        allergy,
        severity: 'high',
        detail: `The medication label lists "${allergy}" in its ingredients or formulation warnings.`,
      });
      continue;
    }

    const rule = ALLERGY_EXCIPIENT_RULES.find(
      (r) => cleanAllergy === r.key && r.triggers.some((t) => fullText.includes(t))
    );
    if (rule) {
      conflicts.push({ allergy, severity: rule.severity, detail: rule.detail });
    }
  }

  return conflicts;
};

const CONTRAINDICATION_RULES = [
  {
    condTriggers: ['kidney', 'renal'],
    labelTriggers: ['renal impairment', 'kidney disease', 'renal failure'],
    detail: 'FDA Warning: Caution or dosage adjustment required in patients with renal impairment.'
  },
  {
    condTriggers: ['liver', 'hepatic'],
    labelTriggers: ['hepatic impairment', 'liver disease', 'cirrhosis'],
    detail: 'FDA Warning: Caution or contraindication in patients with hepatic impairment.'
  },
  {
    condTriggers: ['asthma'],
    labelTriggers: ['bronchospasm', 'asthma', 'airway disease'],
    detail: 'FDA Warning: May precipitate bronchospasm or exacerbate asthma symptoms.'
  },
  {
    condTriggers: ['ulcer', 'gastric'],
    labelTriggers: ['gastrointestinal bleeding', 'peptic ulcer', 'gi perforation'],
    detail: 'FDA Warning: Increased risk of GI bleeding or peptic ulcer exacerbation.'
  }
];

export const checkContraindicationConflicts = (label, patientConditions = []) => {
  if (!patientConditions?.length || !label) return [];

  const contraText = `${label.contraindications || ''} ${label.boxedWarning || ''} ${label.warnings || ''}`.toLowerCase();
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
      continue;
    }

    const rule = CONTRAINDICATION_RULES.find(
      (r) => r.condTriggers.some((ct) => cleanCond.includes(ct)) && r.labelTriggers.some((lt) => contraText.includes(lt))
    );
    if (rule) {
      conflicts.push({ condition: cond, severity: 'high', detail: rule.detail });
    }
  }

  return conflicts;
};

// ── Aggregated Comprehensive Profile ──────────────────────────────────────────

const resolveFaersAgeGroup = (age) => {
  if (!age) return null;
  const ageNum = Number(age);
  if (ageNum < 2) return 1;
  if (ageNum < 12) return 3;
  if (ageNum < 18) return 4;
  if (ageNum >= 65) return 6;
  return 5;
};

const computeRegulatoryTrustIndex = (concept, approvals, ndc, recalls) => {
  let score = 70;
  const factors = [];

  if (concept?.rxcui) {
    score += 10;
    factors.push(`Verified RxNorm Concept (RxCUI: ${concept.rxcui}).`);
  }
  if (approvals?.isApproved) {
    score += 15;
    factors.push('Verified FDA New Drug / Abbreviated Drug approval history (NDA/ANDA).');
  }
  if (ndc?.records?.length) {
    score += 10;
    factors.push('Matched active National Drug Code (NDC) packaging catalog.');
  }
  if (recalls?.hasActiveRecalls) {
    score -= 40;
    factors.push('⚠️ Active FDA recall ongoing for this active ingredient/formulation.');
  }
  return { score: Math.min(100, Math.max(10, score)), factors };
};

export const getComprehensiveDrugProfile = async (query, patientContext = {}) => {
  if (!query || !query.trim()) {
    throw new AppError('Drug query cannot be empty', 400);
  }

  const { concept } = await getEnrichedSearchTerms(query);
  const [label, ndc, recalls, approvals] = await Promise.all([
    fetchDrugLabel(query),
    fetchNdcData(query),
    fetchDrugRecalls(query),
    fetchDrugApprovals(query),
  ]);

  let adverseEvents = null;
  if (label || concept) {
    const adverseSearchTerm = concept?.canonicalName || label?.genericName || query;
    const ageGroup = resolveFaersAgeGroup(patientContext.age);
    const sex = patientContext.gender === 'female' ? 2 : patientContext.gender === 'male' ? 1 : null;
    adverseEvents = await fetchAdverseEvents(adverseSearchTerm, { ageGroup, sex });
  }

  const allergenAlerts = checkAllergenConflicts(label, patientContext.allergies || []);
  const contraindicationAlerts = checkContraindicationConflicts(label, patientContext.conditions || []);
  const trustIndex = computeRegulatoryTrustIndex(concept, approvals, ndc, recalls);
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
    trustIndex,
    source: 'OPENFDA',
  };
};
