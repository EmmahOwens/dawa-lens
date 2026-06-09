import { DrugInformation } from '../../types/api';

/**
 * ANDA (African National Drug Authorities) Mock Database
 * Focused on East Africa (Uganda/Kenya/Tanzania)
 */
const AFRICAN_DRUG_DATABASE: DrugInformation[] = [
  {
    id: "UG-NDA-001",
    name: "Coartem",
    genericName: "Artemether + Lumefantrine",
    brandNames: ["Coartem", "Lumartem", "Artemether/Lumefantrine"],
    activeIngredients: ["Artemether (20mg)", "Lumefantrine (120mg)"],
    indications: "Treatment of acute, uncomplicated malaria infections caused by Plasmodium falciparum.",
    dosageForm: "Tablet",
    warnings: "Take with food (preferably fatty meal) to increase absorption. Not for prophylaxis.",
    sideEffects: "Dizziness, fatigue, palpitations, abdominal pain.",
    instructions: "Standard 3-day course. Take first dose, then second after 8 hours, then twice daily for next 2 days.",
    source: "ANDA"
  },
  {
    id: "UG-NDA-002",
    name: "Panadol",
    genericName: "Paracetamol",
    brandNames: ["Panadol", "Hedex", "Action"],
    activeIngredients: ["Paracetamol (500mg)"],
    indications: "Mild to moderate pain, fever reduction.",
    dosageForm: "Tablet",
    warnings: "Do not exceed 4g (8 tablets) in 24 hours. Avoid alcohol.",
    sideEffects: "Rarely, skin rash or allergic reactions.",
    instructions: "1-2 tablets every 4-6 hours as needed.",
    source: "ANDA"
  },
  {
    id: "UG-NDA-003",
    name: "Amoxyl",
    genericName: "Amoxicillin",
    brandNames: ["Amoxyl", "Penamox"],
    activeIngredients: ["Amoxicillin (500mg)"],
    indications: "Bacterial infections (ear, throat, skin, respiratory).",
    dosageForm: "Capsule",
    warnings: "Complete the full course even if feeling better. Avoid if allergic to penicillin.",
    sideEffects: "Diarrhea, nausea, skin rash.",
    instructions: "One capsule three times daily for 5-7 days.",
    source: "ANDA"
  }
];

export const fetchFromANDA = async (query: string): Promise<DrugInformation | null> => {
  const normalizedQuery = query.toLowerCase().trim();
  
  const match = AFRICAN_DRUG_DATABASE.find(drug => 
    drug.name.toLowerCase() === normalizedQuery ||
    drug.genericName?.toLowerCase() === normalizedQuery ||
    drug.brandNames?.some(b => b.toLowerCase() === normalizedQuery)
  );

  if (match) {
    // Simulate a small network delay
    return new Promise((resolve) => setTimeout(() => resolve(match), 300));
  }

  return null;
};
