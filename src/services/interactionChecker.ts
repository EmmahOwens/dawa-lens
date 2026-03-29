import { RxCUIResponse, InteractionListResponse, ParsedInteraction } from '../types/interactions';

const NLM_API_BASE = 'https://rxnav.nlm.nih.gov/REST';

/**
 * Fetches the RxNorm Concept Unique Identifier (RxCUI) for a given drug name.
 * We need this ID to check for interactions.
 */
export async function getRxCUI(drugName: string): Promise<string | null> {
  try {
    const response = await fetch(`${NLM_API_BASE}/rxcui.json?name=${encodeURIComponent(drugName)}`);
    if (!response.ok) return null;
    
    const data: RxCUIResponse = await response.json();
    const ids = data.idGroup?.rxnormId;
    if (ids && ids.length > 0) {
      return ids[0];
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch RxCUI for", drugName, error);
    return null;
  }
}

/**
 * Checks for interactions between a list of RxCUIs.
 * Requires at least 2 RxCUIs to check interactions.
 * Returns an array of easily consumable parsed interactions.
 */
export async function checkInteractions(rxcuis: string[]): Promise<ParsedInteraction[]> {
  // Filter out invalid/empty strings
  const validIds = rxcuis.filter(id => id && id.trim() !== "");
  
  if (validIds.length < 2) {
    return []; // Need at least two drugs for an interaction
  }

  const query = validIds.join('+');
  
  try {
    const response = await fetch(`${NLM_API_BASE}/interaction/list.json?rxcuis=${query}`);
    if (!response.ok) return [];
    
    const data: InteractionListResponse = await response.json();
    const interactions: ParsedInteraction[] = [];

    const groups = data.fullInteractionTypeGroup;
    if (!groups) return interactions;

    for (const group of groups) {
      for (const type of group.fullInteractionType) {
        for (const pair of type.interactionPair) {
          const concept1 = pair.interactionConcept[0]?.minConceptItem;
          const concept2 = pair.interactionConcept[1]?.minConceptItem;
          
          if (concept1 && concept2) {
            interactions.push({
              drug1: concept1.name,
              drug2: concept2.name,
              severity: pair.severity,
              description: pair.description
            });
          }
        }
      }
    }

    // Deduplicate (NLM API sometimes returns duplicate pairs from different sources like ONCHigh and DrugBank)
    const unique = interactions.filter((inter, index, self) =>
      index === self.findIndex((t) => (
        (t.drug1 === inter.drug1 && t.drug2 === inter.drug2) ||
        (t.drug1 === inter.drug2 && t.drug2 === inter.drug1)
      ))
    );

    return unique;
  } catch (error) {
    console.error("Failed to check interactions", error);
    return [];
  }
}
