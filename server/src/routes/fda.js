import express from 'express';
import * as openFdaService from '../services/openFdaService.js';
import { resolveRxNormConcept, getSpellingSuggestions } from '../services/rxNormService.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import AppError from '../utils/AppError.js';

const router = express.Router();

/**
 * Diagnostic & Status Endpoint: Check openFDA & RxNorm API Key status
 */
router.get('/status', (req, res) => {
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
router.get('/resolve-concept', async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      throw new AppError('Query parameter "query" is required.', 400);
    }

    const concept = await resolveRxNormConcept(query);
    if (!concept) {
      return res.status(404).json({
        success: false,
        message: `Could not resolve RxNorm concept for: ${query}`,
      });
    }

    res.json({
      success: true,
      concept,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Comprehensive Drug Profile (Label, NDC, Recalls, Approvals, Adverse Events, Allergies & Contraindications)
 */
router.get('/drug-profile', async (req, res, next) => {
  try {
    const { query, age, gender, conditions, allergies } = req.query;

    if (!query || !query.trim()) {
      throw new AppError('Query parameter "query" is required.', 400);
    }

    const patientContext = {
      age: age ? Number(age) : undefined,
      gender: gender ? String(gender) : undefined,
      conditions: conditions ? (Array.isArray(conditions) ? conditions : String(conditions).split(',')) : [],
      allergies: allergies ? (Array.isArray(allergies) ? allergies : String(allergies).split(',')) : [],
    };

    const profile = await openFdaService.getComprehensiveDrugProfile(query, patientContext);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * Get FDA Recalls for a Drug
 */
router.get('/recalls', async (req, res, next) => {
  try {
    const { drug } = req.query;
    if (!drug || !drug.trim()) {
      throw new AppError('Query parameter "drug" is required.', 400);
    }
    const recalls = await openFdaService.fetchDrugRecalls(drug);
    res.json(recalls);
  } catch (error) {
    next(error);
  }
});

/**
 * Get FAERS Real-World Adverse Event Signals
 */
router.get('/adverse-events', async (req, res, next) => {
  try {
    const { drug, ageGroup, sex } = req.query;
    if (!drug || !drug.trim()) {
      throw new AppError('Query parameter "drug" is required.', 400);
    }

    const options = {
      ageGroup: ageGroup ? Number(ageGroup) : undefined,
      sex: sex ? Number(sex) : undefined,
    };

    const events = await openFdaService.fetchAdverseEvents(drug, options);
    res.json(events || { drugName: drug, totalSampleReports: 0, topReactions: [] });
  } catch (error) {
    next(error);
  }
});

/**
 * Multi-Drug Safety Check: Boxed Warnings, Contraindications, Allergens & Duplicate Therapy
 */
router.post('/check-safety', async (req, res, next) => {
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

    const boxedWarnings = [];
    const contraindicationAlerts = [];
    const allergenAlerts = [];
    const recalls = [];

    // Evaluate each medication
    for (const med of medications) {
      const medName = med.name || med.genericName;
      if (!medName) continue;

      const label = await openFdaService.fetchDrugLabel(medName);
      if (label) {
        if (label.boxedWarning) {
          boxedWarnings.push({
            drugName: medName,
            warning: label.boxedWarning,
          });
        }

        const medAllergens = openFdaService.checkAllergenConflicts(label, patientContext.allergies || []);
        if (medAllergens.length > 0) {
          allergenAlerts.push({
            drugName: medName,
            conflicts: medAllergens,
          });
        }

        const medContras = openFdaService.checkContraindicationConflicts(label, patientContext.conditions || []);
        if (medContras.length > 0) {
          contraindicationAlerts.push({
            drugName: medName,
            conflicts: medContras,
          });
        }
      }

      const medRecalls = await openFdaService.fetchDrugRecalls(medName);
      if (medRecalls?.hasActiveRecalls) {
        recalls.push({
          drugName: medName,
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
router.get('/autocomplete', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = new Set();

    // 1. Fetch from RxNorm spelling suggestions
    try {
      const rxSpelling = await getSpellingSuggestions(q);
      rxSpelling.forEach((s) => suggestions.add(s));
    } catch {
      // Ignore
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
      // Ignore
    }

    // 3. Also include dictionary synonyms
    const terms = openFdaService.getSearchTerms(q);
    terms.forEach((t) => suggestions.add(t));

    res.json({ suggestions: Array.from(suggestions).slice(0, 10) });
  } catch (error) {
    next(error);
  }
});

export default router;
