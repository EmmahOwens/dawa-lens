export interface DrugInformation {
  id: string; // Internal id or primary source id
  name: string;
  genericName?: string;
  brandNames?: string[];
  activeIngredients?: string[];
  indications?: string; // What it is used for
  dosageForm?: string; // e.g., tablet, capsule
  warnings?: string;
  sideEffects?: string;
  instructions?: string; // How to take it
  source: "ML_MODEL" | "RXNORM" | "OPENFDA" | "DAILYMED" | "MEDLINEPLUS" | "ANDA";
}
