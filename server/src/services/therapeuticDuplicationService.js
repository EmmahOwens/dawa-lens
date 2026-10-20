/**
 * Therapeutic Duplication & Same-Task Medication Intelligence Service
 *
 * Provides authoritative clinical detection, regulatory data fetching from
 * RxNorm and openFDA APIs, and patient counseling guidance when a patient has
 * or inquires about more than one medication that performs the same task.
 */

import { resolveRxNormConcept } from './rxNormService.js';
import { fetchNdcData, fetchDrugLabel } from './openFdaService.js';
import {
  THERAPEUTIC_CLASSES,
  normalizeDrugKey,
  findLocalTherapeuticClass,
  detectDuplicateTherapiesSync,
  extractDrugsFromQuery,
  isSameTaskOrDuplicateQuery
} from '../utils/therapeuticClasses.js';

export { isSameTaskOrDuplicateQuery };

// ── In-Memory Fast Cache for API Clinical Lookups ──────────────────────────────
const clinicalLookupCache = new Map();
const CLINICAL_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const resolveFallbackLocalClass = (profile) => {
  if (profile.localClass) return profile.localClass;
  if (profile.rxNorm?.canonicalName) {
    const byCanonical = findLocalTherapeuticClass(profile.rxNorm.canonicalName);
    if (byCanonical) return byCanonical;
  }
  for (const ing of profile.activeIngredients || []) {
    const matched = findLocalTherapeuticClass(ing);
    if (matched) return matched;
  }
  return null;
};

/**
 * Resolves comprehensive regulatory data for a medication from RxNorm & openFDA.
 */
const resolveMedicationClinicalProfile = async (drugName) => {
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
    const rxNormData = await resolveRxNormConcept(clean);
    if (rxNormData) {
      profile.rxNorm = rxNormData;
      profile.activeIngredients = rxNormData.activeIngredients || [];
    }

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

    profile.pharmClasses = Array.from(new Set(profile.pharmClasses));
    profile.localClass = resolveFallbackLocalClass(profile);

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

const evaluateProfilePairDuplication = (pA, pB) => {
  const sharedIngredients = pA.activeIngredients.filter((ingA) =>
    pB.activeIngredients.some((ingB) => normalizeDrugKey(ingA) === normalizeDrugKey(ingB))
  );

  if (sharedIngredients.length > 0) {
    const ingStr = sharedIngredients.join(', ');
    const localClass = pA.localClass || pB.localClass || findLocalTherapeuticClass(ingStr);
    return {
      sharedClass: `Identical Active Ingredient: ${ingStr}`,
      sharedTask: localClass ? localClass.task : 'identical therapeutic action',
      warning: `Both ${pA.queryName} and ${pB.queryName} contain ${ingStr}. Taking both concurrently duplicates the active ingredient, severely raising toxicity and overdose risk.`,
      dangers: localClass?.dangers || [
        `Accidental chemical overdose of ${ingStr}`,
        'Additive organ toxicity without increased efficacy'
      ],
      source: 'RxNorm & Clinical Intelligence'
    };
  }

  const epcA = pA.pharmClasses.filter((c) => c.includes('[EPC]'));
  const epcB = pB.pharmClasses.filter((c) => c.includes('[EPC]'));
  const sharedEpc = epcA.filter((c) => epcB.includes(c));

  if (sharedEpc.length > 0) {
    const cleanEpc = sharedEpc.map((c) => c.replace(/\s*\[EPC\]/g, '')).join(', ');
    const localClass = pA.localClass || pB.localClass;
    return {
      sharedClass: cleanEpc,
      sharedTask: localClass ? localClass.task : `shared pharmacologic action (${cleanEpc})`,
      warning: `Both ${pA.queryName} and ${pB.queryName} belong to the same FDA pharmacologic class (${cleanEpc}). They perform the same therapeutic task; taking both causes additive toxicity with no added therapeutic benefit.`,
      dangers: localClass?.dangers || [
        `Cumulative toxicity of the ${cleanEpc} class`,
        'Ceiling effect: no added healing or pain relief, only doubled side effect risk'
      ],
      source: 'openFDA & RxNorm'
    };
  }

  if (pA.localClass && pB.localClass && pA.localClass.id === pB.localClass.id) {
    const lc = pA.localClass;
    return {
      sharedClass: lc.name,
      sharedTask: lc.task,
      warning: `Both ${pA.queryName} and ${pB.queryName} belong to the ${lc.name} family and perform the same task (${lc.task}). ${lc.summaryHazard}`,
      dangers: lc.dangers,
      source: 'NDA Uganda & Clinical Knowledge Base'
    };
  }

  const getRaasFlags = (p) => {
    const names = [p.queryName, p.rxNorm?.canonicalName, ...(p.activeIngredients || [])].join(' ').toLowerCase();
    return {
      isAce: /pril\b|lisinopril|enalapril|ramipril|captopril/i.test(names),
      isArb: /sartan\b|losartan|valsartan|telmisartan|candesartan/i.test(names)
    };
  };
  const raasA = getRaasFlags(pA);
  const raasB = getRaasFlags(pB);
  if ((raasA.isAce && raasB.isArb) || (raasA.isArb && raasB.isAce)) {
    return {
      sharedClass: 'Dual RAAS Blockade (ACE Inhibitor + ARB)',
      sharedTask: 'lowering blood pressure',
      warning: `Concurrent use of ${pA.queryName} (ACE Inhibitor) and ${pB.queryName} (ARB) is contraindicated. Dual renin-angiotensin-aldosterone blockade causes acute kidney injury, hyperkalemia, and severe hypotension.`,
      dangers: THERAPEUTIC_CLASSES.DUAL_RAAS_BLOCKADE.dangers,
      source: 'openFDA, RxNorm & Clinical Guidelines'
    };
  }

  return null;
};

/**
 * Detects therapeutic duplication among a list of medications.
 * Uses both fast local knowledge and live RxNorm & openFDA API resolution.
 */
const detectDuplicateTherapiesWithApis = async (medications = []) => {
  if (!Array.isArray(medications) || medications.length < 2) {
    return [];
  }

  const profiles = await Promise.all(
    medications.map((med) => resolveMedicationClinicalProfile(med.name || med.genericName || ''))
  );

  const validProfiles = profiles.filter(Boolean);
  const duplicates = [];
  const seenPairs = new Set();

  for (let i = 0; i < validProfiles.length; i++) {
    for (let j = i + 1; j < validProfiles.length; j++) {
      const pA = validProfiles[i];
      const pB = validProfiles[j];
      const pairKey = [pA.queryName.toLowerCase(), pB.queryName.toLowerCase()].sort().join('::');
      if (seenPairs.has(pairKey) || normalizeDrugKey(pA.queryName) === normalizeDrugKey(pB.queryName)) {
        continue;
      }

      const match = evaluateProfilePairDuplication(pA, pB);
      if (match) {
        seenPairs.add(pairKey);
        duplicates.push({
          drug1: pA.queryName,
          drug2: pB.queryName,
          ...match,
          guidance: pA.localClass?.guidance || pB.localClass?.guidance || 'Do not take both together. Consult your healthcare provider to select the single best medicine.',
          rxNormIngredients: Array.from(new Set([...pA.activeIngredients, ...pB.activeIngredients]))
        });
      }
    }
  }

  return duplicates;
};

const buildLocalClinicalProfile = (clean) => {
  const localClass = findLocalTherapeuticClass(clean);
  return {
    queryName: clean,
    rxNorm: null,
    openFdaNdc: null,
    openFdaLabel: null,
    pharmClasses: localClass?.epcKeyword ? [`${localClass.epcKeyword} [EPC]`] : [],
    activeIngredients: localClass ? [clean.toLowerCase()] : [],
    localClass: localClass || null
  };
};

const withTimeout = (promise, ms, fallbackValue) => {
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), ms);
  });
  return Promise.race([
    promise.then((val) => { clearTimeout(timer); return val; }).catch(() => fallbackValue),
    timeoutPromise
  ]);
};

/**
 * Fetches clinical grounding from RxNorm and openFDA for medications relevant to a query.
 * Leverages local synchronous clinical intelligence first with a 500ms timeout for
 * external government APIs to guarantee low conversational latency.
 */
export const fetchClinicalGroundingForQuery = async (query, activeMeds = []) => {
  const extractedDrugs = extractDrugsFromQuery(query, activeMeds);
  const asksAboutDuplicates = isSameTaskOrDuplicateQuery(query, activeMeds);

  const targetDrugs = extractedDrugs.length >= 2
    ? extractedDrugs.map((name) => ({ name }))
    : asksAboutDuplicates && activeMeds.length >= 2
    ? activeMeds
    : extractedDrugs.map((name) => ({ name }));

  if (targetDrugs.length < 2) {
    if (targetDrugs.length === 1) {
      const drugName = targetDrugs[0].name;
      const cached = clinicalLookupCache.get(`clinical_profile:${drugName.toLowerCase()}`);
      if (cached && Date.now() < cached.expiresAt) {
        return { profiles: [cached.data], duplicates: [] };
      }
      const localProfile = buildLocalClinicalProfile(drugName);
      const singleProfile = await withTimeout(
        resolveMedicationClinicalProfile(drugName),
        500,
        localProfile
      );
      return {
        profiles: singleProfile ? [singleProfile] : (localProfile ? [localProfile] : []),
        duplicates: []
      };
    }
    return { profiles: [], duplicates: [] };
  }

  const syncDuplicates = detectDuplicateTherapiesSync(targetDrugs, 'NDA Uganda Clinical Standards');
  const localProfiles = targetDrugs.map((d) => buildLocalClinicalProfile(d.name));

  const apiCallPromise = Promise.all([
    Promise.all(targetDrugs.map((d) => resolveMedicationClinicalProfile(d.name))),
    detectDuplicateTherapiesWithApis(targetDrugs)
  ]);

  const [apiProfiles, apiDuplicates] = await withTimeout(
    apiCallPromise,
    500,
    [localProfiles, syncDuplicates]
  );

  const finalDuplicates = (apiDuplicates && apiDuplicates.length > 0) ? apiDuplicates : syncDuplicates;
  const finalProfiles = (apiProfiles && apiProfiles.filter(Boolean).length > 0)
    ? apiProfiles.filter(Boolean)
    : localProfiles.filter(Boolean);

  return {
    profiles: finalProfiles,
    duplicates: finalDuplicates
  };
};

/**
 * Formats structured regulatory grounding and clinical watchdog context for DawaGPT's prompt.
 */
export const formatDuplicateTherapyWatchdogContext = (grounding) => {
  const { profiles = [], duplicates = [] } = grounding || {};
  if (profiles.length === 0 && duplicates.length === 0) return '';

  let context = '=== AUTHORITATIVE REGULATORY GROUNDING (RxNorm & openFDA) ===\n';

  for (const p of profiles) {
    const rxcuiStr = p.rxNorm?.rxcui ? `RxCUI: ${p.rxNorm.rxcui}` : 'RxCUI: Unassigned';
    const canonicalStr = p.rxNorm?.canonicalName ? `Canonical Name: ${p.rxNorm.canonicalName}` : '';
    const ingredientsStr = p.activeIngredients.length > 0
      ? `Active Ingredients: [${p.activeIngredients.join(', ')}]`
      : 'Active Ingredients: None listed';
    const epcClasses = p.pharmClasses.filter((c) => c.includes('[EPC]')).map((c) => c.replace(/\s*\[EPC\]/g, ''));
    const epcStr = epcClasses.length > 0 ? `openFDA Established Pharmacologic Class (EPC): ${epcClasses.join(', ')}` : '';
    const labelWarning = p.openFdaLabel?.boxedWarning ? `Boxed Warning: ${p.openFdaLabel.boxedWarning.slice(0, 200)}...` : '';

    context += `• ${p.queryName} (${rxcuiStr}${canonicalStr ? `, ${canonicalStr}` : ''}):\n`;
    context += `  - ${ingredientsStr}\n`;
    if (epcStr) context += `  - ${epcStr}\n`;
    if (labelWarning) context += `  - ${labelWarning}\n`;
    if (p.localClass) context += `  - Clinical Indication / Task: ${p.localClass.task}\n`;
  }

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

/**
 * Checks for duplicate pharmacologic therapy among a list of active medications.
 */
export const checkDuplicateTherapy = async (medications = []) => {
  if (!medications || medications.length < 2) return [];
  const apiDuplicates = await detectDuplicateTherapiesWithApis(medications);
  return (apiDuplicates || []).map((d) => ({
    drug1: d.drug1,
    drug2: d.drug2,
    sharedClass: d.sharedClass,
    warning: d.warning,
  }));
};
