/**
 * Local Food Knowledge Base
 * Focused on Ugandan nutritional context.
 */

export const LOCAL_FOODS = [
  {
    name: "Matooke",
    description: "Steamed green bananas, a staple in central Uganda.",
    benefits: "High in potassium, fiber, and Vitamin B6. Low glycemic index when steamed, providing steady energy.",
    medicationContext: "Generally safe with most meds. Good for stomach lining."
  },
  {
    name: "Kalo",
    description: "Millet bread, common in Northern and Western Uganda.",
    benefits: "Rich in iron, calcium, and essential amino acids. High fiber content.",
    medicationContext: "Excellent for patients with anemia (iron) or bone issues (calcium)."
  },
  {
    name: "Posho",
    description: "Maize meal porridge or solid bread.",
    benefits: "High energy source (carbohydrates).",
    medicationContext: "Neutral. Often used as a 'base' meal before taking medications that require food."
  },
  {
    name: "G-nut Sauce",
    description: "Groundnut (peanut) stew.",
    benefits: "High in protein, healthy fats, and Vitamin E. Good for weight maintenance.",
    medicationContext: "Fat content helps absorption of fat-soluble vitamins and certain meds like Coartem."
  },
  {
    name: "Mukene",
    description: "Silver fish (Rastrineobola argentea), usually dried and added to stews.",
    benefits: "Extremely high in calcium (eaten with bones), Vitamin A, and Omega-3 fatty acids.",
    medicationContext: "Excellent for children's growth and elderly bone health. High calcium might interact with specific antibiotics like Tetracycline (take 2 hours apart)."
  },
  {
    name: "Simsim",
    description: "Sesame seeds, often roasted or made into paste.",
    benefits: "Rich in calcium, magnesium, and healthy oils.",
    medicationContext: "Good for bone health."
  },
  {
    name: "Nakati / Dodo / Bugga",
    description: "Local green leafy vegetables.",
    benefits: "Rich in Iron, Folate, Vitamin A, and C.",
    medicationContext: "Essential for blood health. High Vitamin K might interact with blood thinners like Warfarin."
  },
  {
    name: "Malewa",
    description: "Bamboo shoots, a delicacy from Eastern Uganda (Elgon region).",
    benefits: "Rich in minerals and fiber.",
    medicationContext: "Good for digestion."
  },
  {
    name: "Katogo",
    description: "A mixture of Matooke with beans, meat, or offal, often eaten for breakfast.",
    benefits: "Balanced meal with carbs, protein, and minerals.",
    medicationContext: "Great for providing a solid start to the day for medications requiring a heavy meal."
  },
  {
    name: "Luwombo",
    description: "Stew (chicken, meat, or G-nuts) steamed in banana leaves.",
    benefits: "Preserves nutrients due to steaming. Low fat if not fried before steaming.",
    medicationContext: "Very healthy, easy to digest for recovering patients."
  },
  {
    name: "Cassava / Sweet Potatoes / Yams",
    description: "Root tubers.",
    benefits: "Complex carbohydrates and high fiber.",
    medicationContext: "Good energy source."
  },
  {
    name: "Eshabwe",
    description: "Ghee-based sauce from Western Uganda.",
    benefits: "High in fats and Vitamin A.",
    medicationContext: "Helps with absorption of fat-soluble medicines."
  },
  {
    name: "Nsenene",
    description: "Grasshoppers, a seasonal delicacy in Central Uganda.",
    benefits: "Extremely high in protein, healthy fats (Omega-3), and minerals like iron and zinc.",
    medicationContext: "Great protein boost for recovery. Generally safe."
  },
  {
    name: "Gonja",
    description: "Roasted or steamed sweet plantains.",
    benefits: "High in potassium, fiber, and Vitamin C. Provides quick energy.",
    medicationContext: "Safe with most medications. Good for quick energy boost."
  },
  {
    name: "Bushera",
    description: "Traditional fermented or non-fermented millet or sorghum porridge drink.",
    benefits: "Rich in minerals, easy to digest, warm and hydrating.",
    medicationContext: "Gentle liquid/porridge vehicle; excellent for swallowing assistance in children and elderly patients."
  }
];

export const getFoodKnowledgePrompt = () => {
  return `=== LOCAL FOOD KNOWLEDGE BASE (Uganda Baseline) ===
- Matooke: High potassium, fiber, low GI, gentle on stomach lining.
- Kalo (Millet): Rich in iron, calcium; great for anemia and bone health.
- Bushera (Millet/Sorghum porridge drink): Warm, easily digestible liquid or semi-solid; ideal soothing vehicle for swallowing difficulties in children and seniors.
- Posho: Neutral carbohydrate base before medications requiring food.
- G-nut Sauce: Healthy fats aid absorption of fat-soluble meds (e.g., Artemether/Lumefantrine / Coartem, Griseofulvin).
- Mukene (Silver fish): Extremely high calcium; take at least 2 hours apart from tetracycline and fluoroquinolone antibiotics.
- Nakati / Dodo / Bugga: Rich in Iron & Vitamin K; monitor closely with blood thinners (Warfarin).
- Alcohol / Waragi: Severe liver toxicity risk when combined with Paracetamol/Panadol; severe disulfiram reaction with Metronidazole (Flagyl); amplifies CNS sedative effects.

NOTE ON NUTRITIONAL SCOPE: This Ugandan local food knowledge base is a cultural baseline and clinical reference, NOT an exclusive list. You are expected to recommend safe foods, chewables, and drinks outside of this list (such as applesauce, oatmeal, plain yogurt, crackers, toast, white/brown rice, fruit smoothies, broths, avocados, peanut butter, and chewable options) whenever clinically suitable for the patient's age and medication.`;
};

