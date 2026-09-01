import { storage } from '../lib/storage';
import { Medicine } from '../contexts/AppContext';
import { auth } from '../lib/firebase';

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.warn('[openFdaClient] Failed to obtain auth token:', e);
    }
  }
  return headers;
}

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/v1') ? envUrl : `${envUrl}/v1`;
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1')
  ) {
    return 'http://localhost:5000/api/v1';
  }
  return 'https://dawa-lens.onrender.com/api/v1';
};

const BASE_URL = getBaseUrl();

export interface FdaLabel {
  id?: string;
  rxcui?: string | null;
  unii?: string | null;
  brandName?: string;
  genericName?: string;
  brandNames?: string[];
  substanceNames?: string[];
  activeIngredients?: string[];
  inactiveIngredients?: string[];
  boxedWarning?: string | null;
  warnings?: string | null;
  contraindications?: string | null;
  drugInteractions?: string | null;
  indicationsAndUsage?: string | null;
  dosageAndAdministration?: string | null;
  overdosage?: string | null;
  pregnancy?: string | null;
  nursingMothers?: string | null;
  pediatricUse?: string | null;
  geriatricUse?: string | null;
  storageAndHandling?: string | null;
  mechanismOfAction?: string | null;
  patientCounseling?: string | null;
  route?: string | null;
  pharmClasses?: string[];
  source?: string;
}

export interface FdaRecall {
  recallNumber: string;
  productDescription: string;
  reasonForRecall: string;
  classification: string;
  status: string;
  recallInitiationDate?: string;
  distributionPattern?: string;
}

export interface FdaAdverseReaction {
  reaction: string;
  count: number;
  percentage: number;
}

export interface FdaSafetyAlerts {
  boxedWarning: string | null;
  allergenAlerts: { allergy: string; severity: string; detail: string }[];
  contraindicationAlerts: { condition: string; severity: string; detail: string }[];
  deaSchedule: string | null;
  pregnancyRisk: string | null;
  nursingWarning: string | null;
  pediatricPrecaution: string | null;
  geriatricPrecaution: string | null;
  storageGuidelines: string | null;
  hasActiveRecalls: boolean;
}

export interface FdaDrugProfile {
  query: string;
  resolvedName: string;
  rxcui?: string | null;
  unii?: string | null;
  activeIngredients?: string[];
  brandSynonyms?: string[];
  label: FdaLabel | null;
  ndc: {
    matchedTerm?: string;
    rxcui?: string | null;
    records?: Array<{
      productNdc: string;
      brandName: string;
      genericName: string;
      dosageForm?: string;
      route?: string;
      deaSchedule?: string | null;
      marketingStatus?: string;
      pharmClasses?: string[];
    }>;
    deaSchedule?: string | null;
    pharmClasses?: string[];
    dosageForms?: string[];
  } | null;
  recalls: {
    hasActiveRecalls: boolean;
    recalls: FdaRecall[];
  };
  approvals: {
    isApproved: boolean;
    approvals: Array<{
      applicationNumber: string;
      sponsorName: string;
    }>;
  };
  adverseEvents: {
    drugName: string;
    canonicalName?: string;
    totalSampleReports: number;
    topReactions: FdaAdverseReaction[];
    disclaimer?: string;
  } | null;
  safetyAlerts: FdaSafetyAlerts;
  trustIndex: {
    score: number;
    factors: string[];
  };
  source: string;
}

export interface FdaMultiSafetyResult {
  hasCriticalAlert: boolean;
  boxedWarnings: { drugName: string; warning: string }[];
  contraindicationAlerts: { drugName: string; conflicts: { condition: string; severity: string; detail: string }[] }[];
  allergenAlerts: { drugName: string; conflicts: { allergy: string; severity: string; detail: string }[] }[];
  duplicateTherapies: { drug1: string; drug2: string; sharedClass: string; warning: string }[];
  recalls: { drugName: string; recalls: FdaRecall[] }[];
}

export interface PatientContext {
  age?: number;
  gender?: string | null;
  conditions?: string[];
  allergies?: string[];
}

export interface RxNormConceptResponse {
  success: boolean;
  concept?: {
    rxcui: string;
    canonicalName: string;
    rawName: string;
    unii: string | null;
    activeIngredients: string[];
    brandSynonyms: string[];
    searchTerms: string[];
  };
}

const CACHE_PREFIX = 'fda_cache_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface CacheWrapper<T> {
  data: T;
  timestamp: number;
}

/**
 * Resolve a medication query into its canonical RxNorm concept (RxCUI, USAN name, UNII, ingredients).
 */
export async function resolveDrugConcept(query: string): Promise<RxNormConceptResponse['concept'] | null> {
  if (!query || !query.trim()) return null;

  try {
    const res = await fetch(`${BASE_URL}/fda/resolve-concept?query=${encodeURIComponent(query.trim())}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    const data: RxNormConceptResponse = await res.json();
    return data.concept || null;
  } catch (err) {
    console.warn('[openFdaClient] Concept resolution failed:', err);
    return null;
  }
}

/**
 * Fetch comprehensive drug profile from openFDA backend service with IndexedDB caching.
 * Leverages RxNorm normalization for cross-border accuracy.
 */
export async function getFdaDrugProfile(
  query: string,
  patientContext?: PatientContext
): Promise<FdaDrugProfile | null> {
  if (!query || !query.trim()) return null;

  const normalizedKey = `${CACHE_PREFIX}profile_${query.toLowerCase().trim()}`;
  const cached = await storage.getItem<CacheWrapper<FdaDrugProfile> | null>(normalizedKey, null);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({ query: query.trim() });
    if (patientContext?.age) params.append('age', patientContext.age.toString());
    if (patientContext?.gender) params.append('gender', patientContext.gender);
    if (patientContext?.conditions?.length) params.append('conditions', patientContext.conditions.join(','));
    if (patientContext?.allergies?.length) params.append('allergies', patientContext.allergies.join(','));

    const res = await fetch(`${BASE_URL}/fda/drug-profile?${params.toString()}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`FDA Profile fetch failed: ${res.statusText}`);
    }

    const data: FdaDrugProfile = await res.json();
    await storage.setItem(normalizedKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.warn('[openFdaClient] Backend fetch failed, checking offline cache:', err);
    return cached ? cached.data : null;
  }
}

/**
 * Multi-medication safety check covering boxed warnings, allergies, contraindications, and duplicate classes.
 */
export async function checkFdaMultiSafety(
  medications: Partial<Medicine>[],
  patientContext?: PatientContext
): Promise<FdaMultiSafetyResult> {
  if (!medications || medications.length === 0) {
    return {
      hasCriticalAlert: false,
      boxedWarnings: [],
      contraindicationAlerts: [],
      allergenAlerts: [],
      duplicateTherapies: [],
      recalls: [],
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/fda/check-safety`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        medications: medications.map((m) => ({ name: m.name, genericName: m.genericName })),
        patientContext,
      }),
    });

    if (!res.ok) {
      throw new Error(`Safety check failed: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.warn('[openFdaClient] Multi safety check failed, falling back to local empty checks:', err);
    return {
      hasCriticalAlert: false,
      boxedWarnings: [],
      contraindicationAlerts: [],
      allergenAlerts: [],
      duplicateTherapies: [],
      recalls: [],
    };
  }
}

/**
 * Fetch FDA drug recalls.
 */
export async function getFdaRecalls(drugName: string): Promise<{ hasActiveRecalls: boolean; recalls: FdaRecall[] }> {
  if (!drugName) return { hasActiveRecalls: false, recalls: [] };

  try {
    const res = await fetch(`${BASE_URL}/fda/recalls?drug=${encodeURIComponent(drugName)}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return { hasActiveRecalls: false, recalls: [] };
    return await res.json();
  } catch {
    return { hasActiveRecalls: false, recalls: [] };
  }
}

/**
 * Fetch FAERS real-world adverse event signals.
 */
export async function getFdaAdverseEvents(
  drugName: string,
  ageGroup?: number,
  sex?: number
): Promise<{ drugName: string; totalSampleReports: number; topReactions: FdaAdverseReaction[] } | null> {
  if (!drugName) return null;

  try {
    const params = new URLSearchParams({ drug: drugName });
    if (ageGroup) params.append('ageGroup', ageGroup.toString());
    if (sex) params.append('sex', sex.toString());

    const res = await fetch(`${BASE_URL}/fda/adverse-events?${params.toString()}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Autocomplete suggestions using openFDA NDC, RxNorm spelling, & synonym dictionaries.
 */
export async function getFdaAutocomplete(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const res = await fetch(`${BASE_URL}/fda/autocomplete?q=${encodeURIComponent(query)}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch {
    return [];
  }
}
