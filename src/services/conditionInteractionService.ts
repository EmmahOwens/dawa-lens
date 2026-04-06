import { ConditionSafetyCheck } from '../types/interactions';

/**
 * Regional Condition-Drug Safety Database
 * Focusing on East African health context (Uganda, etc.)
 */
const CONDITION_SAFETY_DATABASE: ConditionSafetyCheck[] = [
  {
    condition: "G6PD Deficiency",
    drug: "Primaquine",
    severity: "high",
    warning: "Risk of hemolytic anemia. Test for G6PD deficiency before starting Primaquine.",
    source: "WHO Guidelines for Malaria"
  },
  {
    condition: "Pregnancy",
    drug: "Ciprofloxacin",
    severity: "high",
    warning: "Quinolones should be avoided in pregnancy due to potential cartilage damage in the fetus.",
    source: "NDA Uganda Clinical Guidelines"
  },
  {
    condition: "Sickle Cell Disease",
    drug: "Decongestants",
    severity: "moderate",
    warning: "Some decongestants can trigger vaso-occlusive crises in some patients. Use with caution.",
    source: "Regional Hematology Protocols"
  },
  {
    condition: "Malaria (Acute)",
    drug: "Corticosteroids",
    severity: "moderate",
    warning: "Corticosteroids are not recommended in cerebral malaria and may worsen outcomes.",
    source: "Ministry of Health Uganda"
  },
  {
    condition: "Kidney Disease (CKD)",
    drug: "Ibuprofen",
    severity: "high",
    warning: "NSAIDS like Ibuprofen can cause further decline in kidney function. Use Paracetamol instead.",
    source: "NDA Uganda Essential Medicines"
  }
];

/**
 * Checks for safety issues between a list of user conditions and a specific drug.
 */
export const checkConditionSafety = (
  drugName: string, 
  genericName: string | undefined, 
  userConditions: string[]
): ConditionSafetyCheck[] => {
  const normalizedDrug = drugName.toLowerCase().trim();
  const normalizedGeneric = genericName?.toLowerCase().trim();
  const normalizedConditions = userConditions.map(c => c.toLowerCase().trim());

  return CONDITION_SAFETY_DATABASE.filter(check => {
    const isDrugMatch = check.drug.toLowerCase() === normalizedDrug || 
                        (normalizedGeneric && check.drug.toLowerCase() === normalizedGeneric);
    const isConditionMatch = normalizedConditions.includes(check.condition.toLowerCase());
    
    return isDrugMatch && isConditionMatch;
  });
};
