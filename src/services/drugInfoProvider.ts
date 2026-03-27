import { DrugInformation } from '../types/api';
import { fetchFromMLModel } from './mlService';
import { fetchFromOpenFDA } from './fallback/openfda';
import { fetchFromRxNorm } from './fallback/rxnorm';
import { fetchFromDailyMed } from './fallback/dailymed';
import { fetchFromMedlinePlus } from './fallback/medlineplus';

/**
 * Orchestrates fetching drug information.
 * Prioritizes the ML model. If it fails or returns nothing,
 * falls back to external APIs in a specific order:
 * openFDA -> RxNorm -> DailyMed -> MedlinePlus.
 */
export const getDrugInfo = async (query: string): Promise<DrugInformation> => {
  if (!query || query.trim() === '') {
    throw new Error('Query cannot be empty');
  }

  // 1. Try ML Model (Primary)
  const mlResult = await fetchFromMLModel(query);
  if (mlResult) return mlResult;

  // 2. Try openFDA
  const openFdaResult = await fetchFromOpenFDA(query);
  if (openFdaResult) return openFdaResult;

  // 3. Try RxNorm
  const rxNormResult = await fetchFromRxNorm(query);
  if (rxNormResult) return rxNormResult;

  // 4. Try DailyMed
  const dailyMedResult = await fetchFromDailyMed(query);
  if (dailyMedResult) return dailyMedResult;

  // 5. Try MedlinePlus
  const medlinePlusResult = await fetchFromMedlinePlus(query);
  if (medlinePlusResult) return medlinePlusResult;

  // If all fail, throw an error
  throw new Error(`Could not find information for drug: ${query}`);
};
