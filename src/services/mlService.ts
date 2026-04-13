import { DrugInformation } from '../types/api';

const ML_API_ENDPOINT = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000/api/v1/predict';

export const fetchFromMLModel = async (query: string): Promise<DrugInformation | null> => {
  try {
    const response = await fetch(`${ML_API_ENDPOINT}?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      if (response.status === 404) return null; // Not found in ML
      throw new Error(`ML Model responded with status ${response.status}`);
    }
    const data = await response.json();
    
    // Map data to DrugInformation... assuming standard mapping for now
    return {
      id: data.id || `ml-${Date.now()}`,
      name: data.name,
      genericName: data.genericName,
      brandNames: data.brandNames || [],
      activeIngredients: data.activeIngredients || [],
      indications: data.indications,
      dosageForm: data.dosageForm,
      warnings: data.warnings,
      sideEffects: data.sideEffects,
      instructions: data.instructions,
      source: "ML_MODEL"
    };
  } catch (error) {
    console.warn("Failed to fetch from ML Model:", error);
    return null; // Return null to trigger fallback
  }
}
