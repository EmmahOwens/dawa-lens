/**
 * Offline Travel Intelligence Service
 *
 * Generates comprehensive, deterministic travel guidelines, local pharmacy
 * equivalents, timezone dosing adjustments, customs regulations, destination
 * health risk advisories, and verified emergency / drug regulatory authority
 * contacts completely offline when the device is disconnected or the cloud AI
 * endpoint is unreachable.
 */

import type { Medicine } from "@/contexts/AppContext";
import { lookupDRA, type DRAEntry } from "./draDatabase";
import { CANONICAL_DRUGS } from "./clinicalInteractionsData";

export interface TravelEquivalent {
  original: string;
  equivalent: string;
}

export interface TravelEmergencyContact {
  service: string;
  number: string;
  type: "ambulance" | "drug_authority";
  website?: string;
}

export interface TravelAdviceResult {
  equivalents: TravelEquivalent[];
  timezoneAdvice: string;
  customsNotes: string;
  emergencyContacts: TravelEmergencyContact[];
  healthRisks: string[];
  isOfflineGenerated?: boolean;
}

interface CountryTravelMeta {
  utcOffset: number; // Standard UTC offset in hours (e.g. +3 for EAT, +4 for UAE, 0 for UK, -5 for US East)
  timezoneLabel: string;
  region:
    | "east_africa"
    | "southern_africa"
    | "west_central_africa"
    | "north_africa"
    | "middle_east"
    | "europe"
    | "north_america"
    | "latin_america"
    | "south_asia"
    | "east_southeast_asia"
    | "oceania";
  strictCustoms?: boolean;
  customsSpecifics?: string;
  specificRisks?: string[];
}

const COUNTRY_TRAVEL_META: Record<string, CountryTravelMeta> = {
  // East Africa
  uganda: {
    utcOffset: 3,
    timezoneLabel: "EAT (UTC+3)",
    region: "east_africa",
    customsSpecifics:
      "Carry prescriptions and original National Drug Authority (NDA) or pharmacy-labeled packaging for all personal medications.",
  },
  kenya: {
    utcOffset: 3,
    timezoneLabel: "EAT (UTC+3)",
    region: "east_africa",
    customsSpecifics:
      "Kenya Pharmacy and Poisons Board (PPB) requires a valid doctor's prescription for prescription-only medicines (POM) and up to a 90-day personal supply.",
  },
  tanzania: {
    utcOffset: 3,
    timezoneLabel: "EAT (UTC+3)",
    region: "east_africa",
    customsSpecifics:
      "TMDA regulations require original labeled packaging and a physician's note for personal medications entering mainland Tanzania or Zanzibar.",
  },
  rwanda: {
    utcOffset: 2,
    timezoneLabel: "CAT (UTC+2)",
    region: "east_africa",
    customsSpecifics:
      "Rwanda FDA inspects controlled substances closely at Kigali International Airport and land borders. Note that plastic bags are strictly prohibited at customs—use paper or reusable pouches for medicine bags.",
  },
  burundi: {
    utcOffset: 2,
    timezoneLabel: "CAT (UTC+2)",
    region: "east_africa",
  },
  southsudan: {
    utcOffset: 2,
    timezoneLabel: "CAT (UTC+2)",
    region: "east_africa",
    customsSpecifics:
      "Carry a full supply of your essential medications for the entire trip, as local pharmacy stock outside Juba can be limited.",
  },
  drcongo: {
    utcOffset: 1,
    timezoneLabel: "WAT/CAT (UTC+1 to UTC+2)",
    region: "east_africa",
    customsSpecifics:
      "Ensure Yellow Fever vaccination certificate and original doctor's prescriptions are readily accessible at border entry points.",
  },
  ethiopia: {
    utcOffset: 3,
    timezoneLabel: "EAT (UTC+3)",
    region: "east_africa",
  },

  // Southern & West/North Africa
  southafrica: {
    utcOffset: 2,
    timezoneLabel: "SAST (UTC+2)",
    region: "southern_africa",
    customsSpecifics:
      "SAHPRA permits travelers to bring up to a 3-month supply of personal prescription medicine with a valid medical certificate or prescription.",
  },
  nigeria: {
    utcOffset: 1,
    timezoneLabel: "WAT (UTC+1)",
    region: "west_central_africa",
  },
  ghana: {
    utcOffset: 0,
    timezoneLabel: "GMT (UTC+0)",
    region: "west_central_africa",
  },
  egypt: {
    utcOffset: 2,
    timezoneLabel: "EET (UTC+2)",
    region: "north_africa",
    strictCustoms: true,
    customsSpecifics:
      "**Strict Controlled Medication Rules**: Egypt strictly regulates tramadol, codeine-containing painkillers, pregabalin, and certain sedatives. Carry an official stamped medical report if prescribed any strong analgesics.",
  },
  morocco: {
    utcOffset: 1,
    timezoneLabel: "CET (UTC+1)",
    region: "north_africa",
  },
  zambia: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  zimbabwe: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  malawi: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  botswana: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  namibia: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },

  // Middle East
  uae: {
    utcOffset: 4,
    timezoneLabel: "GST (UTC+4)",
    region: "middle_east",
    strictCustoms: true,
    customsSpecifics:
      "**Zero-Tolerance Controlled Drug Policy**: The UAE Ministry of Health (MOHAP) strictly regulates opioids (tramadol, codeine), benzodiazepines, sleeping aids, and certain antidepressants/ADHD medications. Prior online MOHAP permit approval and an authenticated doctor's prescription are mandatory for controlled medicines.",
  },
  saudiarabia: {
    utcOffset: 3,
    timezoneLabel: "AST (UTC+3)",
    region: "middle_east",
    strictCustoms: true,
    customsSpecifics:
      "SFDA requires an official medical report and original prescription for psychotropic, narcotic, or controlled medications.",
  },
  qatar: {
    utcOffset: 3,
    timezoneLabel: "AST (UTC+3)",
    region: "middle_east",
    strictCustoms: true,
    customsSpecifics:
      "Qatar MOPH strictly regulates pain medications containing codeine, tramadol, pregabalin, and sedatives. Always carry an official physician's letter.",
  },

  // Europe
  uk: {
    utcOffset: 0,
    timezoneLabel: "GMT/BST (UTC+0/+1)",
    region: "europe",
    customsSpecifics:
      "UK Border Force allows up to a 3-month personal supply in original packaging. A signed letter from your prescriber is required for controlled drugs (e.g., strong painkillers, sedatives, stimulants).",
  },
  france: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  germany: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  italy: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  spain: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  netherlands: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  belgium: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  switzerland: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  sweden: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  turkey: { utcOffset: 3, timezoneLabel: "TRT (UTC+3)", region: "europe" },

  // Americas
  usa: {
    utcOffset: -5,
    timezoneLabel: "EST/PST (UTC-5 to UTC-8)",
    region: "north_america",
    customsSpecifics:
      "U.S. FDA & CBP require medications to be in their original pharmacy containers with the patient's name printed on the label, accompanied by a valid English prescription or doctor's letter (generally up to a 90-day supply).",
  },
  canada: {
    utcOffset: -5,
    timezoneLabel: "EST/PST (UTC-5 to UTC-8)",
    region: "north_america",
    customsSpecifics:
      "Health Canada allows visitors to bring a single course of treatment or a 90-day supply of prescription drugs in original hospital or pharmacy-dispensed packaging.",
  },
  brazil: { utcOffset: -3, timezoneLabel: "BRT (UTC-3)", region: "latin_america" },
  mexico: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },

  // Asia & Oceania
  india: {
    utcOffset: 5.5,
    timezoneLabel: "IST (UTC+5:30)",
    region: "south_asia",
    customsSpecifics:
      "Carry your valid prescription and purchase receipts. Most essential generic formulations are widely available in licensed Indian pharmacies, though brand names often differ.",
  },
  china: { utcOffset: 8, timezoneLabel: "CST (UTC+8)", region: "east_southeast_asia" },
  japan: {
    utcOffset: 9,
    timezoneLabel: "JST (UTC+9)",
    region: "east_southeast_asia",
    strictCustoms: true,
    customsSpecifics:
      "**Strict Import Rules (Yunyu Kakunin-sho)**: Japan strictly prohibits stimulants (including pseudoephedrine found in some cold/sinus meds and Adderall) and codeine. Up to a 1-month supply of standard prescription medicine is allowed without an import certificate.",
  },
  singapore: {
    utcOffset: 8,
    timezoneLabel: "SGT (UTC+8)",
    region: "east_southeast_asia",
    strictCustoms: true,
    customsSpecifics:
      "Singapore HSA requires prior approval for sleeping pills, strong painkillers (codeine/tramadol), and anxiety medications. Always carry a physician's letter.",
  },
  thailand: { utcOffset: 7, timezoneLabel: "ICT (UTC+7)", region: "east_southeast_asia" },
  malaysia: { utcOffset: 8, timezoneLabel: "MYT (UTC+8)", region: "east_southeast_asia" },
  australia: {
    utcOffset: 10,
    timezoneLabel: "AEST (UTC+10)",
    region: "oceania",
    strictCustoms: true,
    customsSpecifics:
      "Australian Border Force & TGA require you to declare all prescription medications on your Incoming Passenger Card and carry a doctor's letter in English (up to a 3-month supply).",
  },
  newzealand: { utcOffset: 12, timezoneLabel: "NZST (UTC+12)", region: "oceania" },
};

const COUNTRY_KEY_ALIASES: Record<string, string> = {
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  america: "usa",
  us: "usa",
  unitedkingdom: "uk",
  greatbritain: "uk",
  britain: "uk",
  england: "uk",
  scotland: "uk",
  wales: "uk",
  unitedarabemirates: "uae",
  emirates: "uae",
  dubai: "uae",
  abudhabi: "uae",
  drc: "drcongo",
  democraticrepublicofthecongo: "drcongo",
  congokinshasa: "drcongo",
  republicofsouthsudan: "southsudan",
  juba: "southsudan",
};

function normalizeCountryKey(destination: string): string {
  const clean = (destination || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (!clean) return "";
  if (COUNTRY_TRAVEL_META[clean]) return clean;
  if (COUNTRY_KEY_ALIASES[clean]) return COUNTRY_KEY_ALIASES[clean];
  for (const [alias, target] of Object.entries(COUNTRY_KEY_ALIASES)) {
    if (alias.length >= 3 && (clean.includes(alias) || alias.includes(clean))) {
      return target;
    }
  }
  for (const key of Object.keys(COUNTRY_TRAVEL_META)) {
    if (key.length >= 4 && (clean.includes(key) || key.includes(clean))) {
      return key;
    }
  }
  return clean;
}

// ── Curated International Brand & Generic Equivalents Dictionary ─────────────
const INTERNATIONAL_BRAND_HINTS: Record<
  string,
  {
    generic: string;
    regionalBrands: Partial<Record<CountryTravelMeta["region"] | "default", string>>;
  }
> = {
  paracetamol: {
    generic: "Paracetamol / Acetaminophen",
    regionalBrands: {
      north_america: "Tylenol / Acetaminophen",
      europe: "Panadol / Doliprane / Paracetamol",
      south_asia: "Crocin / Dolo-650 / Calpol (Paracetamol)",
      east_africa: "Panadol / Action / Cetamol (Paracetamol)",
      default: "Panadol / Tylenol (Paracetamol)",
    },
  },
  ibuprofen: {
    generic: "Ibuprofen",
    regionalBrands: {
      north_america: "Advil / Motrin (Ibuprofen)",
      europe: "Nurofen / Brufen (Ibuprofen)",
      default: "Brufen / Advil / Nurofen (Ibuprofen)",
    },
  },
  diclofenac: {
    generic: "Diclofenac Sodium / Potassium",
    regionalBrands: {
      default: "Voltaren / Cataflam (Diclofenac)",
    },
  },
  aspirin: {
    generic: "Acetylsalicylic Acid (Aspirin)",
    regionalBrands: {
      default: "Ascard / Ecotrin / Disprin (Aspirin)",
    },
  },
  amoxicillin: {
    generic: "Amoxicillin",
    regionalBrands: {
      default: "Amoxil / Ospamox (Amoxicillin)",
    },
  },
  augmentin: {
    generic: "Amoxicillin + Clavulanic Acid",
    regionalBrands: {
      default: "Augmentin / Co-Amoxiclav / Curam",
    },
  },
  artemether: {
    generic: "Artemether + Lumefantrine",
    regionalBrands: {
      east_africa: "Coartem / Lonart / Lumartem (ACT)",
      default: "Coartem / Riamet (Artemether-Lumefantrine)",
    },
  },
  coartem: {
    generic: "Artemether + Lumefantrine",
    regionalBrands: {
      east_africa: "Coartem / Lonart / Lumartem (ACT)",
      default: "Coartem / Riamet (Artemether-Lumefantrine)",
    },
  },
  ciprofloxacin: {
    generic: "Ciprofloxacin",
    regionalBrands: {
      default: "Cipro / Ciprobay / Cifran (Ciprofloxacin)",
    },
  },
  azithromycin: {
    generic: "Azithromycin",
    regionalBrands: {
      default: "Zithromax / Azithral (Azithromycin)",
    },
  },
  metronidazole: {
    generic: "Metronidazole",
    regionalBrands: {
      default: "Flagyl / Metrogyl (Metronidazole)",
    },
  },
  doxycycline: {
    generic: "Doxycycline",
    regionalBrands: {
      default: "Vibramycin / Doryx (Doxycycline)",
    },
  },
  omeprazole: {
    generic: "Omeprazole",
    regionalBrands: {
      north_america: "Prilosec (Omeprazole)",
      default: "Losec / Omez / Prilosec (Omeprazole)",
    },
  },
  esomeprazole: {
    generic: "Esomeprazole",
    regionalBrands: {
      default: "Nexium / Esoz (Esomeprazole)",
    },
  },
  metformin: {
    generic: "Metformin Hydrochloride",
    regionalBrands: {
      default: "Glucophage / Glycomet (Metformin)",
    },
  },
  amlodipine: {
    generic: "Amlodipine Besylate",
    regionalBrands: {
      default: "Norvasc / Amlopin (Amlodipine)",
    },
  },
  lisinopril: {
    generic: "Lisinopril",
    regionalBrands: {
      default: "Zestril / Prinivil (Lisinopril)",
    },
  },
  losartan: {
    generic: "Losartan Potassium",
    regionalBrands: {
      default: "Cozaar / Losacar (Losartan)",
    },
  },
  atorvastatin: {
    generic: "Atorvastatin Calcium",
    regionalBrands: {
      default: "Lipitor / Atorlip (Atorvastatin)",
    },
  },
  simvastatin: {
    generic: "Simvastatin",
    regionalBrands: {
      default: "Zocor / Simvor (Simvastatin)",
    },
  },
  salbutamol: {
    generic: "Salbutamol / Albuterol",
    regionalBrands: {
      north_america: "ProAir / Ventolin HFA (Albuterol)",
      default: "Ventolin / Asthalin (Salbutamol Inhaler)",
    },
  },
  cetirizine: {
    generic: "Cetirizine Hydrochloride",
    regionalBrands: {
      default: "Zyrtec / Cetzine (Cetirizine)",
    },
  },
  loratadine: {
    generic: "Loratadine",
    regionalBrands: {
      default: "Claritin / Clarityne (Loratadine)",
    },
  },
  furosemide: {
    generic: "Furosemide",
    regionalBrands: {
      default: "Lasix / Frusenex (Furosemide)",
    },
  },
  warfarin: {
    generic: "Warfarin Sodium",
    regionalBrands: {
      default: "Coumadin / Marevan (Warfarin)",
    },
  },
  prednisolone: {
    generic: "Prednisolone",
    regionalBrands: {
      default: "Deltacortril / Omnacortil (Prednisolone)",
    },
  },
};

function resolveLocalEquivalent(
  med: Medicine,
  region: CountryTravelMeta["region"]
): string {
  const rawName = (med.name || "").trim();
  const rawGeneric = (med.genericName || "").trim();
  const combinedLower = `${rawName} ${rawGeneric}`.toLowerCase();

  // 1. Direct lookup in our international brand hints
  for (const [key, info] of Object.entries(INTERNATIONAL_BRAND_HINTS)) {
    if (combinedLower.includes(key)) {
      return info.regionalBrands[region] || info.regionalBrands.default || info.generic;
    }
  }

  // 2. Match via CANONICAL_DRUGS synonyms (e.g. user added "Panadol" -> canonical "paracetamol")
  for (const [canonicalId, def] of Object.entries(CANONICAL_DRUGS)) {
    const matchedSynonym =
      combinedLower.includes(canonicalId) ||
      def.synonyms.some((syn) => combinedLower.includes(syn.toLowerCase()));
    if (matchedSynonym) {
      const hint = INTERNATIONAL_BRAND_HINTS[canonicalId];
      if (hint) {
        return hint.regionalBrands[region] || hint.regionalBrands.default || hint.generic;
      }
      const topBrands = def.synonyms
        .slice(0, 2)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" / ");
      return topBrands ? `${def.name} (${topBrands})` : def.name;
    }
  }

  // 3. Fallback to generic name or original name with clear guidance
  if (rawGeneric && rawGeneric.toLowerCase() !== rawName.toLowerCase()) {
    return `${rawGeneric} (Ask for generic ${rawGeneric})`;
  }
  return `${rawName} (Request active ingredient at local pharmacy)`;
}

function estimateOriginUtcOffset(homeTimezone?: string): number {
  if (!homeTimezone) return 3; // Default EAT (Uganda/East Africa UTC+3)
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: homeTimezone }));
    return Math.round(((tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60)) * 2) / 2;
  } catch {
    return 3;
  }
}

function buildTimezoneAdvice(
  destination: string,
  meta: CountryTravelMeta | undefined,
  homeTimezone: string | undefined,
  medicines: Medicine[]
): string {
  const originOffset = estimateOriginUtcOffset(homeTimezone);
  const targetOffset = meta?.utcOffset ?? originOffset;
  const diffHours = targetOffset - originOffset;
  const medNames = medicines
    .slice(0, 3)
    .map((m) => `**${m.name}**`)
    .join(", ");

  if (!meta) {
    return (
      `• **Verify Local Time Upon Arrival**: Confirm the time difference in **${destination}** before adjusting your dose alarms.\n` +
      `• **Strict-Interval Medications**: Keep time-critical medicines (${medNames || "antibiotics, antihypertensives, and chronic therapies"}) spaced at consistent intervals (e.g., every 12 or 24 hours) during transit.\n` +
      `• **Carry On-Board**: Keep all doses needed for the journey in your cabin hand luggage.`
    );
  }

  if (Math.abs(diffHours) <= 1) {
    return (
      `• **Minimal Timezone Shift (${meta.timezoneLabel})**: **${destination}** is within **${Math.abs(diffHours)} hour** of your home timezone.\n` +
      `• **Keep Your Normal Schedule**: You can continue taking ${medNames || "your medications"} at your usual clock times without needing a gradual phase shift.\n` +
      `• **Transit Tip**: Set a backup alarm on your phone for travel days so busy airport or border schedules don't cause a missed dose.`
    );
  }

  const direction = diffHours > 0 ? "ahead of" : "behind";
  const absDiff = Math.abs(diffHours);

  return (
    `• **Time Shift (${meta.timezoneLabel})**: **${destination}** is **${absDiff} hours ${direction}** your home time.\n` +
    `• **Gradual Dosing Transition**: For daily medications (${medNames || "your regimen"}), shift your dose time by **1–2 hours per day** until aligned with local time in ${destination}.\n` +
    `• **Interval-Sensitive Drugs**: For strict-interval medications (such as antibiotics, blood thinners, or antidiabetics), maintain the exact hourly interval (e.g., every 8 or 12 hours) based on elapsed time rather than local wall-clock time during flight.\n` +
    `• **Never Double Dose**: If a timezone crossing compresses your day, never take two doses closer together than clinically recommended.`
  );
}

function buildCustomsNotes(
  destination: string,
  meta: CountryTravelMeta | undefined,
  dra: DRAEntry | null,
  medicines: Medicine[]
): string {
  const medNames = medicines.map((m) => m.name.toLowerCase()).join(" ");
  const hasControlledOrSensitive =
    /tramadol|codeine|morphine|diazepam|alprazolam|clonazepam|pregabalin|gabapentin|amitriptyline|zolpidem/i.test(
      medNames
    );

  const authorityLabel = dra?.authority || `the national drug authority in ${destination}`;
  const specificLine = meta?.customsSpecifics
    ? `• **${destination} Entry Rule**: ${meta.customsSpecifics}\n`
    : `• **Regulatory Compliance**: Medications entering **${destination}** are overseen by **${authorityLabel}**.\n`;

  const controlledWarning = hasControlledOrSensitive
    ? `• **Controlled / Sedating Medication Alert**: One or more of your medications may be classified as a controlled or restricted substance internationally. Carry a signed, stamped physician's letter stating your diagnosis and daily dosage.\n`
    : "";

  return (
    specificLine +
    controlledWarning +
    `• **Original Packaging**: Keep all tablets and capsules in their original blister packs or pharmacy-labeled bottles matching your passport name.\n` +
    `• **Prescription Copy**: Carry both a printed copy and a digital scan of your doctor's prescription in your hand luggage (avoid packing essential medicines in checked baggage).`
  );
}

function buildHealthRisks(
  destination: string,
  meta: CountryTravelMeta | undefined
): string[] {
  const region = meta?.region || "east_africa";

  switch (region) {
    case "east_africa":
    case "west_central_africa":
      return [
        `**Vector-Borne Protection (Malaria & Arboviruses)**: High year-round risk in **${destination}**. Sleep under an insecticide-treated net, apply DEET repellent in the evening, and complete any prescribed antimalarial prophylaxis.`,
        `**Yellow Fever & Immunization Requirements**: Cross-border travel in the region generally requires a valid **Yellow Fever Vaccination Certificate (Yellow Card)**. Ensure routine tetanus, typhoid, and hepatitis A vaccines are up to date.`,
        `**Food, Water & Heat Safety**: Drink only bottled, boiled, or filtered water. Store heat-sensitive medications in a cool, dry pouch away from direct equatorial sunlight.`,
      ];

    case "southern_africa":
      return [
        `**Regional Malaria & Tick-Bite Precautions**: Malaria risk is present in low-altitude and northern border areas. Use insect repellent and seek prompt testing if fever develops.`,
        `**Water & Food Hygiene**: Tap water is treated in major urban centers, but bottled water is recommended in rural areas. Protect medications from high daytime vehicle temperatures.`,
        `**Prescription Continuity**: Carry sufficient stock for your entire trip; foreign prescriptions cannot always be dispensed directly without a local doctor's co-signature.`,
      ];

    case "north_africa":
    case "middle_east":
      return [
        `**Extreme Heat & Medication Stability**: High ambient temperatures in **${destination}** can degrade tablets, insulin, and inhalers. Never leave medications in parked vehicles or direct sun; maintain hydration throughout the day.`,
        `**Strict Controlled-Substance Inspections**: Airport customs enforce rigorous screening on painkillers, sleeping aids, and sedatives. Keep your doctor's prescription letter accessible at all times.`,
        `**Traveler's Diarrhea & Hydration**: Consume sealed bottled water and carry oral rehydration salts (ORS), especially if taking diuretics or blood pressure medications.`,
      ];

    case "south_asia":
    case "east_southeast_asia":
      return [
        `**Water & Foodborne Illness Prevention**: Drink only sealed bottled or boiled water in **${destination}** and avoid raw street salads or unpeeled fruit. Dehydration can intensify side effects of blood pressure and diabetes medications.`,
        `**Mosquito-Borne Illnesses (Dengue & Malaria)**: Daytime and evening mosquito protection is essential. Avoid NSAIDs (like Ibuprofen or Aspirin) if dengue fever is suspected due to bleeding risk.`,
        `**Counterfeit & Brand Verification**: Purchase replacement medicines only from licensed hospital or chain pharmacies, and verify the generic active ingredient name on the package.`,
      ];

    case "europe":
    case "north_america":
    case "oceania":
      return [
        `**Prescription Refill Restrictions**: Pharmacies in **${destination}** generally cannot dispense prescription-only medicines using a foreign prescription. Pack enough medication for your full stay plus a 7-day buffer for travel delays.`,
        `**Climate & Seasonal Adaptation**: Cold weather or dry cabin air can affect respiratory conditions (keep rescue inhalers warm and accessible) and alter hydration needs.`,
        `**Travel Insurance & Emergency Documentation**: Medical care for visitors in **${destination}** can be costly. Keep a digital summary of your generic medication names and allergies on your phone.`,
      ];

    default:
      return [
        `**Medication Supply & Storage**: Pack enough medication for your full trip to **${destination}** plus a 7-day reserve in your carry-on bag, stored away from heat and moisture.`,
        `**Water & Dietary Caution**: Stick to safe, sealed drinking water during transit and monitor for stomach upset that could affect medication absorption.`,
        `**Emergency Preparedness**: Save the local ambulance and national drug regulatory authority numbers below before departure.`,
      ];
  }
}

/**
 * Generates a complete, high-accuracy offline travel intelligence report
 * for a given destination and list of user medications.
 */
export function generateOfflineTravelAdvice(params: {
  medicines: Medicine[];
  destination: string;
  currentCity?: string;
  homeTimezone?: string;
}): TravelAdviceResult {
  const { medicines = [], destination, homeTimezone } = params;
  const cleanDest = (destination || "Destination").trim();
  const countryKey = normalizeCountryKey(cleanDest);
  const meta = COUNTRY_TRAVEL_META[countryKey];
  const dra = lookupDRA(cleanDest);

  const region: CountryTravelMeta["region"] = meta?.region || "east_africa";

  const equivalents: TravelEquivalent[] = medicines.map((med) => ({
    original: med.name.trim(),
    equivalent: resolveLocalEquivalent(med, region),
  }));

  const timezoneAdvice = buildTimezoneAdvice(cleanDest, meta, homeTimezone, medicines);
  const customsNotes = buildCustomsNotes(cleanDest, meta, dra, medicines);
  const healthRisks = buildHealthRisks(cleanDest, meta);

  const emergencyContacts: TravelEmergencyContact[] = [
    {
      service: dra?.ambulanceService || `National Emergency & Ambulance (${cleanDest})`,
      number: dra?.ambulance || "112 / 999",
      type: "ambulance",
    },
    {
      service: dra?.authority || `National Medicines Regulatory Authority (${cleanDest})`,
      number: dra?.number || "Consult Ministry of Health / Customs Desk",
      type: "drug_authority",
      ...(dra?.website ? { website: dra.website } : {}),
    },
  ];

  return {
    equivalents,
    timezoneAdvice,
    customsNotes,
    emergencyContacts,
    healthRisks,
    isOfflineGenerated: true,
  };
}
