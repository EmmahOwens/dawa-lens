import { DrugInformation } from '../../types/api';

export const fetchFromRxNorm = async (query: string): Promise<DrugInformation | null> => {
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`);
    if (!response.ok) return null;
    const data = await response.json();
    
    if (!data.drugGroup || !data.drugGroup.conceptGroup) return null;
    
    // Find the first concept properties
    let concept = null;
    for (const group of data.drugGroup.conceptGroup) {
      if (group.conceptProperties && group.conceptProperties.length > 0) {
        concept = group.conceptProperties[0];
        break;
      }
    }
    
    if (!concept) return null;
    
    return {
      id: concept.rxcui,
      name: concept.name,
      genericName: concept.synonym || concept.name,
      source: "RXNORM"
    };
  } catch (error) {
    console.warn("RxNorm fallback failed:", error);
    return null;
  }
}
