import express from 'express';
import * as openFdaService from '../services/openFdaService.js';
import { resolveRxNormConcept, getSpellingSuggestions } from '../services/rxNormService.js';
import { fdaLimiter } from '../middleware/rateLimiter.js';
import { protect } from '../middleware/authMiddleware.js';
import AppError from '../utils/AppError.js';

const router = express.Router();

// Simple in-memory LRU/TTL cache for read-only FDA / RxNorm queries (5-minute TTL)
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const fdaCache = new Map();

function getCached(key) {
  const item = fdaCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    fdaCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  if (fdaCache.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest entry
    const firstKey = fdaCache.keys().next().value;
    if (firstKey) fdaCache.delete(firstKey);
  }
  fdaCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Diagnostic & Status Endpoint: Check openFDA & RxNorm API Key status
 */
router.get('/status', protect, fdaLimiter, (req, res) => {
  const hasKey = !!openFdaService.getOpenFdaApiKey();
  res.json({
    status: 'ok',
    hasApiKey: hasKey,
    provider: 'openFDA + RxNorm NLM',
    rateLimit: hasKey ? '240 req/min' : '40 req/min (free tier)',
  });
});

/**
 * Resolve Medication Concept across RxNorm ontology
 */
router.get('/resolve-concept', protect, fdaLimiter, async (req, res, next) => {
  try {
    const rawQuery = req.query.query;
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      throw new AppError('Query parameter "query" is required (string, max 100 chars).', 400);
    }
    const query = rawQuery.trim().slice(0, 100);

    const cacheKey = `concept:${query.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const concept = await resolveRxNormConcept(query);
    if (!concept) {
      return res.status(404).json({
        success: false,
        message: `Could not resolve RxNorm concept for: ${query}`,
      });
    }

    const responseData = { success: true, concept };
    setCached(cacheKey, responseData);
    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Comprehensive Drug Profile (Label, NDC, Recalls, Approvals, Adverse Events, Allergies & Contraindications)
 */
router.get('/drug-profile', protect, fdaLimiter, async (req, res, next) => {
  try {
    const rawQuery = req.query.query;
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      throw new AppError('Query parameter "query" is required (string, max 100 chars).', 400);
    }
    const query = rawQuery.trim().slice(0, 100);
    const { age, gender, conditions, allergies } = req.query;

    const patientContext = {
      age: age && !isNaN(Number(age)) ? Number(age) : undefined,
      gender: gender ? String(gender).slice(0, 20) : undefined,
      conditions: conditions ? (Array.isArray(conditions) ? conditions : String(conditions).split(',')).map(c => String(c).slice(0, 100)) : [],
      allergies: allergies ? (Array.isArray(allergies) ? allergies : String(allergies).split(',')).map(a => String(a).slice(0, 100)) : [],
    };

    const cacheKey = `profile:${query.toLowerCase()}:${JSON.stringify(patientContext)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const profile = await openFdaService.getComprehensiveDrugProfile(query, patientContext);
    setCached(cacheKey, profile);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * Get FDA Recalls for a Drug
 */
router.get('/recalls', protect, fdaLimiter, async (req, res, next) => {
  try {
    const rawDrug = req.query.drug;
    if (!rawDrug || typeof rawDrug !== 'string' || !rawDrug.trim()) {
      throw new AppError('Query parameter "drug" is required (string, max 100 chars).', 400);
    }
    const drug = rawDrug.trim().slice(0, 100);

    const cacheKey = `recalls:${drug.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const recalls = await openFdaService.fetchDrugRecalls(drug);
    setCached(cacheKey, recalls);
    res.json(recalls);
  } catch (error) {
    next(error);
  }
});

/**
 * Get FAERS Real-World Adverse Event Signals
 */
router.get('/adverse-events', protect, fdaLimiter, async (req, res, next) => {
  try {
    const rawDrug = req.query.drug;
    if (!rawDrug || typeof rawDrug !== 'string' || !rawDrug.trim()) {
      throw new AppError('Query parameter "drug" is required (string, max 100 chars).', 400);
    }
    const drug = rawDrug.trim().slice(0, 100);
    const { ageGroup, sex } = req.query;

    const options = {
      ageGroup: ageGroup && !isNaN(Number(ageGroup)) ? Number(ageGroup) : undefined,
      sex: sex && !isNaN(Number(sex)) ? Number(sex) : undefined,
    };

    const cacheKey = `events:${drug.toLowerCase()}:${JSON.stringify(options)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const events = await openFdaService.fetchAdverseEvents(drug, options);
    const result = events || { drugName: drug, totalSampleReports: 0, topReactions: [] };
    setCached(cacheKey, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Multi-Drug Safety Check: Boxed Warnings, Contraindications, Allergens & Duplicate Therapy
 * Bounded to a maximum of 15 medications per request.
 */
router.post('/check-safety', protect, fdaLimiter, async (req, res, next) => {
  try {
    const { medications, patientContext = {} } = req.body;

    if (!Array.isArray(medications) || medications.length === 0) {
      return res.json({
        hasCriticalAlert: false,
        boxedWarnings: [],
        contraindicationAlerts: [],
        allergenAlerts: [],
        duplicateTherapies: [],
        recalls: [],
      });
    }

    // Strict input bounds: max 15 medications
    if (medications.length > 15) {
      return res.status(400).json({
        status: 'fail',
        message: 'A maximum of 15 medications can be evaluated in a single safety check.',
      });
    }

    const boxedWarnings = [];
    const contraindicationAlerts = [];
    const allergenAlerts = [];
    const recalls = [];

    // Evaluate each medication
    for (const med of medications) {
      const medName = med.name || med.genericName;
      if (!medName || typeof medName !== 'string') continue;
      const sanitizedName = medName.trim().slice(0, 100);

      const label = await openFdaService.fetchDrugLabel(sanitizedName);
      if (label) {
        if (label.boxedWarning) {
          boxedWarnings.push({
            drugName: sanitizedName,
            warning: label.boxedWarning,
          });
        }

        const medAllergens = openFdaService.checkAllergenConflicts(label, patientContext.allergies || []);
        if (medAllergens.length > 0) {
          allergenAlerts.push({
            drugName: sanitizedName,
            conflicts: medAllergens,
          });
        }

        const medContras = openFdaService.checkContraindicationConflicts(label, patientContext.conditions || []);
        if (medContras.length > 0) {
          contraindicationAlerts.push({
            drugName: sanitizedName,
            conflicts: medContras,
          });
        }
      }

      const medRecalls = await openFdaService.fetchDrugRecalls(sanitizedName);
      if (medRecalls?.hasActiveRecalls) {
        recalls.push({
          drugName: sanitizedName,
          recalls: medRecalls.recalls,
        });
      }
    }

    // Check duplicate therapies
    const duplicateTherapies = await openFdaService.checkDuplicateTherapy(medications);

    const hasCriticalAlert =
      boxedWarnings.length > 0 ||
      contraindicationAlerts.length > 0 ||
      allergenAlerts.some((a) => a.conflicts.some((c) => c.severity === 'high')) ||
      duplicateTherapies.length > 0 ||
      recalls.length > 0;

    res.json({
      hasCriticalAlert,
      boxedWarnings,
      contraindicationAlerts,
      allergenAlerts,
      duplicateTherapies,
      recalls,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Autocomplete / Suggestions powered by openFDA NDC + RxNorm spelling suggestions
 */
router.get('/autocomplete', protect, fdaLimiter, async (req, res, next) => {
  try {
    const rawQ = req.query.q;
    if (!rawQ || typeof rawQ !== 'string' || rawQ.trim().length < 2) {
      return res.json({ suggestions: [] });
    }
    const q = rawQ.trim().slice(0, 80);

    const cacheKey = `auto:${q.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const suggestions = new Set();

    // 1. Fetch from RxNorm spelling suggestions
    try {
      const rxSpelling = await getSpellingSuggestions(q);
      rxSpelling.forEach((s) => suggestions.add(s));
    } catch {
      // Non-fatal
    }

    // 2. Fetch from openFDA NDC Directory
    try {
      const ndc = await openFdaService.fetchNdcData(q);
      if (ndc?.records) {
        ndc.records.forEach((r) => {
          if (r.brandName) suggestions.add(r.brandName);
          if (r.genericName) suggestions.add(r.genericName);
        });
      }
    } catch {
      // Non-fatal
    }

    // 3. Also include dictionary synonyms
    const terms = openFdaService.getSearchTerms(q);
    terms.forEach((t) => suggestions.add(t));

    const result = { suggestions: Array.from(suggestions).slice(0, 10) };
    setCached(cacheKey, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
