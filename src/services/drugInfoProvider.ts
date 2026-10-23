import { DrugInformation } from '../types/api';
import { fetchFromMLModel } from './mlService';
import { fetchFromOpenFDA } from './fallback/openfda';
import { fetchFromRxNorm } from './fallback/rxnorm';
import { fetchFromDailyMed } from './fallback/dailymed';
import { fetchFromMedlinePlus } from './fallback/medlineplus';

import { fetchFromANDA } from './fallback/anda';
import { resolveCanonicalDrug } from './clinicalInteractionsData';
import { getAutomaticFoodInteractionsForMeds } from './foodDrugInteractionService';

/**
 * Orchestrates fetching drug information.
 * Prioritizes the ML model. If it fails or returns nothing,
 * falls back to external APIs in a specific order:
 * ANDA (African regional) -> openFDA -> RxNorm -> DailyMed -> MedlinePlus -> Local Clinical Formulary.
 */
export const getDrugInfo = async (query: string): Promise<DrugInformation> => {
  if (!query || query.trim() === '') {
    throw new Error('Query cannot be empty');
  }

  // 1. Try ML Model (Primary)
  const mlResult = await fetchFromMLModel(query);
  if (mlResult) return mlResult;

  // 2. Try ANDA (African regional - highest priority fallback)
  const andaResult = await fetchFromANDA(query);
  if (andaResult) return andaResult;

  // 3. Try openFDA
  const openFdaResult = await fetchFromOpenFDA(query);
  if (openFdaResult) return openFdaResult;

  // 4. Try RxNorm
  const rxNormResult = await fetchFromRxNorm(query);
  if (rxNormResult) return rxNormResult;

  // 5. Try DailyMed
  const dailyMedResult = await fetchFromDailyMed(query);
  if (dailyMedResult) return dailyMedResult;

  // 6. Try MedlinePlus
  const medlinePlusResult = await fetchFromMedlinePlus(query);
  if (medlinePlusResult) return medlinePlusResult;

  // 7. Offline Local Clinical Formulary Fallback (when network sources are unreachable)
  const canonical = resolveCanonicalDrug(query);
  if (canonical) {
    const foodInteractions = getAutomaticFoodInteractionsForMeds([
      { name: canonical.name, genericName: canonical.name },
    ]);
    const foodWarningText =
      foodInteractions.length > 0
        ? foodInteractions
            .map((f) => `${f.factor} (${f.risk} Risk): ${f.advice.replace(/[*#]/g, '')}`)
            .join(' ')
        : 'Follow standard administration spacing and consult a pharmacist before combining with other medicines.';

    return {
      id: `local-${canonical.canonicalId}`,
      name: query.trim(),
      genericName: canonical.name,
      brandNames: (canonical.synonyms || []).slice(0, 5),
      activeIngredients: [canonical.name],
      indications: `Pharmacologic Class: ${canonical.genericClass.replace(/_/g, ' ')}.`,
      dosageForm: 'Oral / Standard Formulation',
      warnings: foodWarningText,
      sideEffects: 'Monitor for class-specific adverse effects and drug-drug or food-drug interactions.',
      instructions: 'Take as prescribed by your healthcare provider.',
      source: 'NDA',
    };
  }

  // If all fail, throw an error
  throw new Error(`Could not find information for drug: ${query}`);
};
