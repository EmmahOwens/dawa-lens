import axios from 'axios';
import https from 'https';

const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';
const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

// ── In-Memory Fast Cache with TTL ─────────────────────────────────────────────
const memoryCache = new Map();
const MEMORY_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days (RxNorm concepts are highly stable)

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
  if (memoryCache.size > 2000) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

/**
 * Generic RxNav Axios Caller with Cache, Timeout & IPv4 agent handling
 */
const makeRxNavRequest = async (endpoint, params = {}) => {
  const cacheKey = `rxnorm:${endpoint}:${JSON.stringify(params)}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${RXNORM_BASE_URL}${endpoint}`, {
      params,
      timeout: 8000,
      httpsAgent,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DawaLens/1.6 (Healthcare Informatics Platform)',
      },
    });

    if (response.data) {
      setInMemoryCache(cacheKey, response.data);
      return response.data;
    }
    return null;
  } catch (err) {
    // 404 or empty is a normal non-match in RxNav
    if (err.response?.status !== 404) {
      console.warn(`[rxNormService] Request to ${endpoint} failed: ${err.message}`);
    }
    return null;
  }
};

/**
 * Resolves any medication query (regional name, INN/BAN, brand, or typo)
 * to its standard RxNorm concept (RxCUI, USAN canonical name, UNII, ingredients, and synonyms).
 *
 * @param {string} query - e.g. "Panadol", "Salbutamol", "Co-amoxiclav", "Ventolin"
 * @returns {Promise<Object|null>}
 */
export const resolveRxNormConcept = async (query) => {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase();
  if (clean.length < 2) return null;

  const cacheKey = `rxnorm_resolved:${clean}`;
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  let rxcui = null;
  let resolvedName = null;

  // 1. Try exact concept lookup via /drugs.json
  try {
    const drugsData = await makeRxNavRequest('/drugs.json', { name: clean });
    const conceptGroup = drugsData?.drugGroup?.conceptGroup;
    if (conceptGroup) {
      for (const group of conceptGroup) {
        if (group.conceptProperties && group.conceptProperties.length > 0) {
          const prop = group.conceptProperties[0];
          rxcui = prop.rxcui;
          resolvedName = prop.name;
          break;
        }
      }
    }
  } catch {
    // Fall through to approximate match
  }

  // 2. If no exact match, try /approximateTerm.json (handles typos, international variants, and strengths)
  if (!rxcui) {
    try {
      const approxData = await makeRxNavRequest('/approximateTerm.json', {
        term: clean,
        maxEntries: 4,
        option: 1,
      });

      const candidates = approxData?.approximateGroup?.candidate;
      if (candidates && candidates.length > 0) {
        const best = candidates[0];
        rxcui = best.rxcui;
      }
    } catch {
      // Ignore
    }
  }

  // 3. If still no match, try direct /rxcui.json
  if (!rxcui) {
    try {
      const cuiData = await makeRxNavRequest('/rxcui.json', { name: clean });
      const ids = cuiData?.idGroup?.rxnormId;
      if (ids && ids.length > 0) {
        rxcui = ids[0];
      }
    } catch {
      // Ignore
    }
  }

  if (!rxcui) {
    return null;
  }

  // 4. Enrich concept details: Active Ingredients, USAN generic name, UNII, and US Brand synonyms
  let unii = null;
  let canonicalGenericName = resolvedName;
  const activeIngredients = new Set();
  const brandSynonyms = new Set();

  try {
    // Fetch all related concepts: IN (Ingredients), PIN (Precise Ingredients), BN (Brand Names), SCD (Semantic Clinical Drug)
    const relatedData = await makeRxNavRequest(`/rxcui/${rxcui}/allrelated.json`);

    const groups = relatedData?.allRelatedGroup?.conceptGroup || [];
    for (const group of groups) {
      const tty = group.tty;
      if (group.conceptProperties) {
        for (const cp of group.conceptProperties) {
          if (tty === 'IN' || tty === 'PIN' || tty === 'MIN') {
            activeIngredients.add(cp.name);
            if (!canonicalGenericName || tty === 'IN') {
              canonicalGenericName = cp.name;
            }
          } else if (tty === 'BN') {
            brandSynonyms.add(cp.name);
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // Fetch UNII identifier for openFDA cross-referencing
  try {
    const propData = await makeRxNavRequest(`/rxcui/${rxcui}/property.json`, {
      propName: 'UNII_CODE',
    });
    const propValues = propData?.propConceptGroup?.propConcept;
    if (propValues && propValues.length > 0) {
      unii = propValues[0].propValue;
    }
  } catch {
    // Non-fatal
  }

  // Build comprehensive search terms for openFDA query pipelines
  const searchTermsSet = new Set([clean]);
  if (canonicalGenericName) searchTermsSet.add(canonicalGenericName.toLowerCase());
  if (resolvedName) searchTermsSet.add(resolvedName.toLowerCase());
  activeIngredients.forEach((ai) => searchTermsSet.add(ai.toLowerCase()));
  brandSynonyms.forEach((bn) => searchTermsSet.add(bn.toLowerCase()));

  const result = {
    rxcui,
    canonicalName: canonicalGenericName || resolvedName || query,
    rawName: query,
    unii,
    activeIngredients: Array.from(activeIngredients),
    brandSynonyms: Array.from(brandSynonyms),
    searchTerms: Array.from(searchTermsSet),
  };

  setInMemoryCache(cacheKey, result);
  return result;
};

/**
 * Fetches spelling suggestions from NLM RxNorm for a given search string.
 *
 * @param {string} term
 * @returns {Promise<string[]>}
 */
export const getSpellingSuggestions = async (term) => {
  if (!term || term.trim().length < 2) return [];

  try {
    const data = await makeRxNavRequest('/spellingsuggestions.json', {
      name: term.trim(),
    });
    return data?.suggestionGroup?.suggestionList?.suggestion || data?.rxnormdata?.suggestionGroup?.suggestionList?.suggestion || [];
  } catch {
    return [];
  }
};
