import { DrugInformation } from '../../types/api';

export const fetchFromRxNorm = async (query: string): Promise<DrugInformation | null> => {
  try {
    // 1. Try exact match via /drugs.json
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.drugGroup?.conceptGroup) {
        for (const group of data.drugGroup.conceptGroup) {
          if (group.conceptProperties && group.conceptProperties.length > 0) {
            const concept = group.conceptProperties[0];
            return {
              id: concept.rxcui,
              name: concept.name,
              genericName: concept.synonym || concept.name,
              source: "RXNORM"
            };
          }
        }
      }
    }

    // 2. Fallback to /approximateTerm.json for typos and regional terms
    const approxRes = await fetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=1`);
    if (approxRes.ok) {
      const approxData = await approxRes.json();
      const best = approxData.approximateGroup?.candidate?.[0];
      if (best?.rxcui) {
        return {
          id: best.rxcui,
          name: query,
          genericName: best.rxcui,
          source: "RXNORM"
        };
      }
    }

    return null;
  } catch (error) {
    console.warn("RxNorm fallback failed:", error);
    return null;
  }
};
