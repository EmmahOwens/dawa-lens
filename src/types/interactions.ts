export interface RxCUIResponse {
  idGroup?: {
    rxnormId?: string[];
  };
}

// Deeply nested NIH interaction structure
export interface InteractionConceptItem {
  minConceptItem: {
    rxcui: string;
    name: string;
    tty: string;
  };
}

export interface InteractionPair {
  interactionConcept: InteractionConceptItem[];
  severity: string;  // Usually "high" or "N/A"
  description: string;
}

export interface FullInteractionType {
  minConcept: any[];
  interactionPair: InteractionPair[];
}

export interface FullInteractionTypeGroup {
  sourceName: string;
  sourceDisclaimer: string;
  fullInteractionType: FullInteractionType[];
}

export interface InteractionListResponse {
  nlmDatasourceUrl?: string;
  fullInteractionTypeGroup?: FullInteractionTypeGroup[];
}

export interface ParsedInteraction {
  drug1: string;
  drug2: string;
  severity: string;
  description: string;
}

export interface ConditionSafetyCheck {
  condition: string;
  drug: string;
  severity: "high" | "moderate" | "low";
  warning: string;
  source: string;
}
