import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDrugInfo } from '../services/drugInfoProvider';
import * as mlService from '../services/mlService';
import * as openfda from '../services/fallback/openfda';
import * as rxnorm from '../services/fallback/rxnorm';

// Mock the fetched services
vi.mock('../services/mlService', () => ({
  fetchFromMLModel: vi.fn(),
}));
vi.mock('../services/fallback/openfda', () => ({
  fetchFromOpenFDA: vi.fn(),
}));
vi.mock('../services/fallback/rxnorm', () => ({
  fetchFromRxNorm: vi.fn(),
}));
vi.mock('../services/fallback/dailymed', () => ({
  fetchFromDailyMed: vi.fn(),
}));
vi.mock('../services/fallback/medlineplus', () => ({
  fetchFromMedlinePlus: vi.fn(),
}));

describe('drugInfoProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return primary ML model data if successful', async () => {
    vi.mocked(mlService.fetchFromMLModel).mockResolvedValue({
      id: 'ml-123',
      name: 'Ibuprofen',
      source: 'ML_MODEL',
    });

    const result = await getDrugInfo('Ibuprofen');
    
    expect(mlService.fetchFromMLModel).toHaveBeenCalledWith('Ibuprofen');
    expect(openfda.fetchFromOpenFDA).not.toHaveBeenCalled(); // Fallback not called
    expect(result.source).toBe('ML_MODEL');
  });

  it('should fallback to openFDA if ML model returns null', async () => {
    vi.mocked(mlService.fetchFromMLModel).mockResolvedValue(null);
    vi.mocked(openfda.fetchFromOpenFDA).mockResolvedValue({
      id: 'fda-123',
      name: 'Ibuprofen',
      source: 'OPENFDA',
    });

    const result = await getDrugInfo('Ibuprofen');
    
    expect(mlService.fetchFromMLModel).toHaveBeenCalledWith('Ibuprofen');
    expect(openfda.fetchFromOpenFDA).toHaveBeenCalledWith('Ibuprofen');
    expect(result.source).toBe('OPENFDA');
  });

  it('should fallback to RxNorm if ML model and openFDA return null', async () => {
    vi.mocked(mlService.fetchFromMLModel).mockResolvedValue(null);
    vi.mocked(openfda.fetchFromOpenFDA).mockResolvedValue(null);
    vi.mocked(rxnorm.fetchFromRxNorm).mockResolvedValue({
      id: 'rx-123',
      name: 'Ibuprofen',
      source: 'RXNORM',
    });

    const result = await getDrugInfo('Ibuprofen');
    
    expect(mlService.fetchFromMLModel).toHaveBeenCalledWith('Ibuprofen');
    expect(openfda.fetchFromOpenFDA).toHaveBeenCalledWith('Ibuprofen');
    expect(rxnorm.fetchFromRxNorm).toHaveBeenCalledWith('Ibuprofen');
    expect(result.source).toBe('RXNORM');
  });

  it('should throw an error if all mock sources resolve to null (simulating failure)', async () => {
    vi.mocked(mlService.fetchFromMLModel).mockResolvedValue(null);
    vi.mocked(openfda.fetchFromOpenFDA).mockResolvedValue(null);
    vi.mocked(rxnorm.fetchFromRxNorm).mockResolvedValue(null);
    
    await expect(getDrugInfo('Unknown Drug')).rejects.toThrow('Could not find information for drug: Unknown Drug');
  });
});
