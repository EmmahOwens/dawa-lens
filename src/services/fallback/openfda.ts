import { DrugInformation } from '../../types/api';

export const fetchFromOpenFDA = async (query: string): Promise<DrugInformation | null> => {
  try {
    // openFDA uses exact match for branding by default, wildcard can be used
    const response = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(query)}"&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) return null;
    
    const result = data.results[0];
    const openfda = result.openfda || {};
    
    return {
      id: result.id,
      name: openfda.brand_name?.[0] || query,
      genericName: openfda.generic_name?.[0],
      brandNames: openfda.brand_name || [],
      activeIngredients: result.active_ingredient,
      indications: result.indications_and_usage?.[0],
      dosageForm: openfda.route?.[0],
      warnings: result.warnings?.[0] || result.boxed_warning?.[0],
      sideEffects: result.adverse_reactions?.[0],
      instructions: result.dosage_and_administration?.[0],
      source: "OPENFDA"
    };
  } catch (error) {
    console.warn("openFDA fallback failed:", error);
    return null;
  }
}
