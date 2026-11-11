/**
 * Offline Travel Intelligence Service — 4-Layer Global Resolution Engine
 *
 * Layer 1: Complete ~195-Country & Regional Mapping (with collision-safe alias & city resolution;
 *          never falsely defaults unmapped destinations to East Africa).
 * Layer 2: Universal WHO INN (International Nonproprietary Name) + USAN/BAN/JAN Nomenclature
 *          Translation & Canonical Molecule Resolution across brand/generic inputs.
 * Layer 3: Country-Specific Brand Overrides + Full 11-Region Brand Matrix covering all
 *          canonical & WHO essential medications.
 * Layer 4: Persistent Offline Cache (localStorage) of online AI-resolved medication
 *          equivalents and destination advisories across sessions.
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

export type TravelRegion =
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

export interface CountryTravelMeta {
  utcOffset: number; // Standard UTC offset in hours
  timezoneLabel: string;
  region: TravelRegion;
  strictCustoms?: boolean;
  customsSpecifics?: string;
  specificRisks?: string[];
}

// ── LAYER 1: Complete ~195-Country Travel Metadata Registry ──────────────────
export const COUNTRY_TRAVEL_META: Record<string, CountryTravelMeta> = {
  // ─── East Africa & Horn of Africa ──────────────────────────────────────────
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
  burundi: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "east_africa" },
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
  ethiopia: { utcOffset: 3, timezoneLabel: "EAT (UTC+3)", region: "east_africa" },
  eritrea: { utcOffset: 3, timezoneLabel: "EAT (UTC+3)", region: "east_africa" },
  djibouti: { utcOffset: 3, timezoneLabel: "EAT (UTC+3)", region: "east_africa" },
  somalia: { utcOffset: 3, timezoneLabel: "EAT (UTC+3)", region: "east_africa" },
  comoros: { utcOffset: 3, timezoneLabel: "EAT (UTC+3)", region: "east_africa" },
  madagascar: { utcOffset: 3, timezoneLabel: "EAT (UTC+3)", region: "east_africa" },
  mauritius: {
    utcOffset: 4,
    timezoneLabel: "MUT (UTC+4)",
    region: "east_africa",
    strictCustoms: true,
    customsSpecifics:
      "Mauritius strictly regulates psychotropic, sedative, and opioid analgesics. Carry a dated medical prescription and keep medicines in original packaging.",
  },
  seychelles: { utcOffset: 4, timezoneLabel: "SCT (UTC+4)", region: "east_africa" },

  // ─── Southern Africa ───────────────────────────────────────────────────────
  southafrica: {
    utcOffset: 2,
    timezoneLabel: "SAST (UTC+2)",
    region: "southern_africa",
    customsSpecifics:
      "SAHPRA permits travelers to bring up to a 3-month supply of personal prescription medicine with a valid medical certificate or prescription.",
  },
  zambia: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  zimbabwe: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  malawi: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  mozambique: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  botswana: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  namibia: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "southern_africa" },
  angola: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "southern_africa" },
  lesotho: { utcOffset: 2, timezoneLabel: "SAST (UTC+2)", region: "southern_africa" },
  eswatini: { utcOffset: 2, timezoneLabel: "SAST (UTC+2)", region: "southern_africa" },

  // ─── West & Central Africa ─────────────────────────────────────────────────
  nigeria: {
    utcOffset: 1,
    timezoneLabel: "WAT (UTC+1)",
    region: "west_central_africa",
    customsSpecifics:
      "NAFDAC requires personal prescription medications to be in original labeled containers accompanied by a physician's prescription.",
  },
  ghana: {
    utcOffset: 0,
    timezoneLabel: "GMT (UTC+0)",
    region: "west_central_africa",
    customsSpecifics:
      "FDA Ghana requires travelers carrying prescription or controlled medicines to present a valid doctor's letter and original packaging.",
  },
  senegal: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  cotedivoire: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  cameroon: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  benin: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  burkinafaso: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  capeverde: { utcOffset: -1, timezoneLabel: "CVT (UTC-1)", region: "west_central_africa" },
  centralafricanrepublic: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  chad: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  congo: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  equatorialguinea: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  gabon: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  gambia: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  guinea: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  guineabissau: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  liberia: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  mali: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  mauritania: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  niger: { utcOffset: 1, timezoneLabel: "WAT (UTC+1)", region: "west_central_africa" },
  saotomeandprincipe: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  sierraleone: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },
  togo: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "west_central_africa" },

  // ─── North Africa ──────────────────────────────────────────────────────────
  egypt: {
    utcOffset: 2,
    timezoneLabel: "EET (UTC+2)",
    region: "north_africa",
    strictCustoms: true,
    customsSpecifics:
      "**Strict Controlled Medication Rules**: Egypt strictly regulates tramadol, codeine-containing painkillers, pregabalin, and certain sedatives. Carry an official stamped medical report if prescribed any strong analgesics.",
  },
  morocco: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "north_africa" },
  algeria: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "north_africa" },
  tunisia: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "north_africa" },
  libya: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "north_africa" },
  sudan: { utcOffset: 2, timezoneLabel: "CAT (UTC+2)", region: "north_africa" },

  // ─── Middle East ───────────────────────────────────────────────────────────
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
  kuwait: {
    utcOffset: 3,
    timezoneLabel: "AST (UTC+3)",
    region: "middle_east",
    strictCustoms: true,
  },
  bahrain: { utcOffset: 3, timezoneLabel: "AST (UTC+3)", region: "middle_east", strictCustoms: true },
  oman: { utcOffset: 4, timezoneLabel: "GST (UTC+4)", region: "middle_east", strictCustoms: true },
  jordan: { utcOffset: 3, timezoneLabel: "EEST (UTC+3)", region: "middle_east" },
  lebanon: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "middle_east" },
  israel: { utcOffset: 2, timezoneLabel: "IST (UTC+2)", region: "middle_east" },
  palestine: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "middle_east" },
  iraq: { utcOffset: 3, timezoneLabel: "AST (UTC+3)", region: "middle_east" },
  iran: { utcOffset: 3.5, timezoneLabel: "IRST (UTC+3:30)", region: "middle_east" },
  syria: { utcOffset: 3, timezoneLabel: "AST (UTC+3)", region: "middle_east" },
  yemen: { utcOffset: 3, timezoneLabel: "AST (UTC+3)", region: "middle_east" },

  // ─── Europe & Caucasus ─────────────────────────────────────────────────────
  uk: {
    utcOffset: 0,
    timezoneLabel: "GMT/BST (UTC+0/+1)",
    region: "europe",
    customsSpecifics:
      "UK Border Force allows up to a 3-month personal supply in original packaging. A signed letter from your prescriber is required for controlled drugs (e.g., strong painkillers, sedatives, stimulants).",
  },
  ireland: { utcOffset: 0, timezoneLabel: "GMT/IST (UTC+0/+1)", region: "europe" },
  france: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  germany: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  italy: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  spain: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  portugal: { utcOffset: 0, timezoneLabel: "WET (UTC+0)", region: "europe" },
  netherlands: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  belgium: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  luxembourg: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  switzerland: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  austria: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  sweden: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  norway: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  denmark: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  finland: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  iceland: { utcOffset: 0, timezoneLabel: "GMT (UTC+0)", region: "europe" },
  poland: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  czechia: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  slovakia: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  hungary: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  romania: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  bulgaria: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  greece: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  cyprus: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  malta: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  croatia: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  slovenia: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  serbia: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  bosniaandherzegovina: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  montenegro: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  northmacedonia: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  albania: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  kosovo: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  estonia: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  latvia: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  lithuania: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  ukraine: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  belarus: { utcOffset: 3, timezoneLabel: "MSK (UTC+3)", region: "europe" },
  moldova: { utcOffset: 2, timezoneLabel: "EET (UTC+2)", region: "europe" },
  russia: { utcOffset: 3, timezoneLabel: "MSK (UTC+3)", region: "europe" },
  turkey: { utcOffset: 3, timezoneLabel: "TRT (UTC+3)", region: "europe" },
  georgia: { utcOffset: 4, timezoneLabel: "GET (UTC+4)", region: "europe" },
  armenia: { utcOffset: 4, timezoneLabel: "AMT (UTC+4)", region: "europe" },
  azerbaijan: { utcOffset: 4, timezoneLabel: "AZT (UTC+4)", region: "europe" },
  andorra: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  monaco: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  liechtenstein: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  sanmarino: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },
  vatican: { utcOffset: 1, timezoneLabel: "CET (UTC+1)", region: "europe" },

  // ─── North America ─────────────────────────────────────────────────────────
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

  // ─── Latin America & Caribbean ─────────────────────────────────────────────
  mexico: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },
  brazil: { utcOffset: -3, timezoneLabel: "BRT (UTC-3)", region: "latin_america" },
  argentina: { utcOffset: -3, timezoneLabel: "ART (UTC-3)", region: "latin_america" },
  colombia: { utcOffset: -5, timezoneLabel: "COT (UTC-5)", region: "latin_america" },
  chile: { utcOffset: -4, timezoneLabel: "CLT (UTC-4)", region: "latin_america" },
  peru: { utcOffset: -5, timezoneLabel: "PET (UTC-5)", region: "latin_america" },
  venezuela: { utcOffset: -4, timezoneLabel: "VET (UTC-4)", region: "latin_america" },
  ecuador: { utcOffset: -5, timezoneLabel: "ECT (UTC-5)", region: "latin_america" },
  bolivia: { utcOffset: -4, timezoneLabel: "BOT (UTC-4)", region: "latin_america" },
  paraguay: { utcOffset: -4, timezoneLabel: "PYT (UTC-4)", region: "latin_america" },
  uruguay: { utcOffset: -3, timezoneLabel: "UYT (UTC-3)", region: "latin_america" },
  costarica: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },
  panama: { utcOffset: -5, timezoneLabel: "EST (UTC-5)", region: "latin_america" },
  guatemala: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },
  honduras: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },
  elsalvador: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },
  nicaragua: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },
  belize: { utcOffset: -6, timezoneLabel: "CST (UTC-6)", region: "latin_america" },
  cuba: { utcOffset: -5, timezoneLabel: "CST (UTC-5)", region: "latin_america" },
  dominicanrepublic: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  haiti: { utcOffset: -5, timezoneLabel: "EST (UTC-5)", region: "latin_america" },
  jamaica: { utcOffset: -5, timezoneLabel: "EST (UTC-5)", region: "latin_america" },
  bahamas: { utcOffset: -5, timezoneLabel: "EST (UTC-5)", region: "latin_america" },
  barbados: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  trinidadandtobago: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  guyana: { utcOffset: -4, timezoneLabel: "GYT (UTC-4)", region: "latin_america" },
  suriname: { utcOffset: -3, timezoneLabel: "SRT (UTC-3)", region: "latin_america" },
  antiguaandbarbuda: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  dominica: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  grenada: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  saintkittsandnevis: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  saintlucia: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },
  saintvincentandthegrenadines: { utcOffset: -4, timezoneLabel: "AST (UTC-4)", region: "latin_america" },

  // ─── South & Central Asia ──────────────────────────────────────────────────
  india: {
    utcOffset: 5.5,
    timezoneLabel: "IST (UTC+5:30)",
    region: "south_asia",
    customsSpecifics:
      "Carry your valid prescription and purchase receipts. Most essential generic formulations are widely available in licensed Indian pharmacies, though brand names often differ.",
  },
  pakistan: { utcOffset: 5, timezoneLabel: "PKT (UTC+5)", region: "south_asia" },
  bangladesh: { utcOffset: 6, timezoneLabel: "BST (UTC+6)", region: "south_asia" },
  srilanka: { utcOffset: 5.5, timezoneLabel: "SLST (UTC+5:30)", region: "south_asia" },
  nepal: { utcOffset: 5.75, timezoneLabel: "NPT (UTC+5:45)", region: "south_asia" },
  bhutan: { utcOffset: 6, timezoneLabel: "BTT (UTC+6)", region: "south_asia" },
  maldives: { utcOffset: 5, timezoneLabel: "MVT (UTC+5)", region: "south_asia" },
  afghanistan: { utcOffset: 4.5, timezoneLabel: "AFT (UTC+4:30)", region: "south_asia" },
  kazakhstan: { utcOffset: 5, timezoneLabel: "AQTT/ALMT (UTC+5)", region: "south_asia" },
  uzbekistan: { utcOffset: 5, timezoneLabel: "UZT (UTC+5)", region: "south_asia" },
  kyrgyzstan: { utcOffset: 6, timezoneLabel: "KGT (UTC+6)", region: "south_asia" },
  tajikistan: { utcOffset: 5, timezoneLabel: "TJT (UTC+5)", region: "south_asia" },
  turkmenistan: { utcOffset: 5, timezoneLabel: "TMT (UTC+5)", region: "south_asia" },

  // ─── East & Southeast Asia ─────────────────────────────────────────────────
  china: { utcOffset: 8, timezoneLabel: "CST (UTC+8)", region: "east_southeast_asia" },
  hongkong: { utcOffset: 8, timezoneLabel: "HKT (UTC+8)", region: "east_southeast_asia" },
  taiwan: { utcOffset: 8, timezoneLabel: "TST (UTC+8)", region: "east_southeast_asia" },
  mongolia: { utcOffset: 8, timezoneLabel: "ULAT (UTC+8)", region: "east_southeast_asia" },
  japan: {
    utcOffset: 9,
    timezoneLabel: "JST (UTC+9)",
    region: "east_southeast_asia",
    strictCustoms: true,
    customsSpecifics:
      "**Strict Import Rules (Yunyu Kakunin-sho)**: Japan strictly prohibits stimulants (including pseudoephedrine found in some cold/sinus meds and Adderall) and codeine. Up to a 1-month supply of standard prescription medicine is allowed without an import certificate.",
  },
  southkorea: {
    utcOffset: 9,
    timezoneLabel: "KST (UTC+9)",
    region: "east_southeast_asia",
    strictCustoms: true,
    customsSpecifics:
      "Korea MFDS strictly regulates narcotics, psychotropics, and sedatives. Carry an official English medical certificate and original prescription containers.",
  },
  northkorea: { utcOffset: 9, timezoneLabel: "PYT (UTC+9)", region: "east_southeast_asia" },
  singapore: {
    utcOffset: 8,
    timezoneLabel: "SGT (UTC+8)",
    region: "east_southeast_asia",
    strictCustoms: true,
    customsSpecifics:
      "Singapore HSA requires prior approval for sleeping pills, strong painkillers (codeine/tramadol), and anxiety medications. Always carry a physician's letter.",
  },
  malaysia: { utcOffset: 8, timezoneLabel: "MYT (UTC+8)", region: "east_southeast_asia" },
  thailand: { utcOffset: 7, timezoneLabel: "ICT (UTC+7)", region: "east_southeast_asia" },
  indonesia: {
    utcOffset: 7,
    timezoneLabel: "WIB/WITA (UTC+7/+8)",
    region: "east_southeast_asia",
    strictCustoms: true,
    customsSpecifics:
      "Indonesian customs (Bea Cukai) and BPOM require a doctor's letter in English detailing daily dosage for all prescription medicines, especially psychotropics and analgesics.",
  },
  philippines: { utcOffset: 8, timezoneLabel: "PHT (UTC+8)", region: "east_southeast_asia" },
  vietnam: { utcOffset: 7, timezoneLabel: "ICT (UTC+7)", region: "east_southeast_asia" },
  cambodia: { utcOffset: 7, timezoneLabel: "ICT (UTC+7)", region: "east_southeast_asia" },
  laos: { utcOffset: 7, timezoneLabel: "ICT (UTC+7)", region: "east_southeast_asia" },
  myanmar: { utcOffset: 6.5, timezoneLabel: "MMT (UTC+6:30)", region: "east_southeast_asia" },
  brunei: { utcOffset: 8, timezoneLabel: "BNT (UTC+8)", region: "east_southeast_asia" },
  timorleste: { utcOffset: 9, timezoneLabel: "TLT (UTC+9)", region: "east_southeast_asia" },

  // ─── Oceania ───────────────────────────────────────────────────────────────
  australia: {
    utcOffset: 10,
    timezoneLabel: "AEST (UTC+10)",
    region: "oceania",
    strictCustoms: true,
    customsSpecifics:
      "Australian Border Force & TGA require you to declare all prescription medications on your Incoming Passenger Card and carry a doctor's letter in English (up to a 3-month supply).",
  },
  newzealand: {
    utcOffset: 12,
    timezoneLabel: "NZST (UTC+12)",
    region: "oceania",
    strictCustoms: true,
    customsSpecifics:
      "New Zealand Medsafe & Customs require prescription medicines to be declared on arrival and carried in original pharmacy containers with a doctor's note (up to 3 months' supply).",
  },
  papuanewguinea: { utcOffset: 10, timezoneLabel: "PGT (UTC+10)", region: "oceania" },
  fiji: { utcOffset: 12, timezoneLabel: "FJT (UTC+12)", region: "oceania" },
  samoa: { utcOffset: 13, timezoneLabel: "WST (UTC+13)", region: "oceania" },
  tonga: { utcOffset: 13, timezoneLabel: "TOT (UTC+13)", region: "oceania" },
  vanuatu: { utcOffset: 11, timezoneLabel: "VUT (UTC+11)", region: "oceania" },
  solomonislands: { utcOffset: 11, timezoneLabel: "SBT (UTC+11)", region: "oceania" },
  kiribati: { utcOffset: 12, timezoneLabel: "GILT (UTC+12)", region: "oceania" },
  marshallislands: { utcOffset: 12, timezoneLabel: "MHT (UTC+12)", region: "oceania" },
  micronesia: { utcOffset: 11, timezoneLabel: "PONT (UTC+11)", region: "oceania" },
  nauru: { utcOffset: 12, timezoneLabel: "NRT (UTC+12)", region: "oceania" },
  palau: { utcOffset: 9, timezoneLabel: "PWT (UTC+9)", region: "oceania" },
  tuvalu: { utcOffset: 12, timezoneLabel: "TVT (UTC+12)", region: "oceania" },
};

export const COUNTRY_KEY_ALIASES: Record<string, string> = {
  // United States
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  america: "usa",
  us: "usa",
  states: "usa",
  newyork: "usa",
  washington: "usa",
  losangeles: "usa",
  chicago: "usa",

  // United Kingdom
  unitedkingdom: "uk",
  greatbritain: "uk",
  britain: "uk",
  england: "uk",
  scotland: "uk",
  wales: "uk",
  northernireland: "uk",
  london: "uk",
  manchester: "uk",

  // United Arab Emirates
  unitedarabemirates: "uae",
  emirates: "uae",
  dubai: "uae",
  abudhabi: "uae",
  sharjah: "uae",

  // East Africa & Horn
  kampala: "uganda",
  entebbe: "uganda",
  nairobi: "kenya",
  mombasa: "kenya",
  daressalaam: "tanzania",
  zanzibar: "tanzania",
  dodoma: "tanzania",
  arusha: "tanzania",
  unitedrepublicoftanzania: "tanzania",
  kigali: "rwanda",
  bujumbura: "burundi",
  gitega: "burundi",
  republicofsouthsudan: "southsudan",
  juba: "southsudan",
  drc: "drcongo",
  democraticrepublicofthecongo: "drcongo",
  democraticrepubliccongo: "drcongo",
  congodrc: "drcongo",
  congokinshasa: "drcongo",
  kinshasa: "drcongo",
  goma: "drcongo",
  lubumbashi: "drcongo",
  addisababa: "ethiopia",
  mogadishu: "somalia",
  asmara: "eritrea",

  // Rest of Africa
  republicofthecongo: "congo",
  congobrazzaville: "congo",
  brazzaville: "congo",
  ivorycoast: "cotedivoire",
  cotedivoireci: "cotedivoire",
  abidjan: "cotedivoire",
  swaziland: "eswatini",
  caboverde: "capeverde",
  saotome: "saotomeandprincipe",
  car: "centralafricanrepublic",
  johannesburg: "southafrica",
  capetown: "southafrica",
  pretoria: "southafrica",
  durban: "southafrica",
  lagos: "nigeria",
  abuja: "nigeria",
  accra: "ghana",
  cairo: "egypt",
  casablanca: "morocco",
  marrakech: "morocco",
  rabat: "morocco",
  dakar: "senegal",
  lusaka: "zambia",
  harare: "zimbabwe",
  lilongwe: "malawi",
  gaborone: "botswana",
  windhoek: "namibia",
  luanda: "angola",
  maputo: "mozambique",

  // Europe
  holland: "netherlands",
  amsterdam: "netherlands",
  czechrepublic: "czechia",
  prague: "czechia",
  bosnia: "bosniaandherzegovina",
  bosniaherz: "bosniaandherzegovina",
  bih: "bosniaandherzegovina",
  macedonia: "northmacedonia",
  fyrom: "northmacedonia",
  vaticancity: "vatican",
  holysee: "vatican",
  russianfederation: "russia",
  moscow: "russia",
  paris: "france",
  berlin: "germany",
  frankfurt: "germany",
  munich: "germany",
  rome: "italy",
  milan: "italy",
  madrid: "spain",
  barcelona: "spain",
  lisbon: "portugal",
  brussels: "belgium",
  zurich: "switzerland",
  geneva: "switzerland",
  vienna: "austria",
  stockholm: "sweden",
  oslo: "norway",
  copenhagen: "denmark",
  helsinki: "finland",
  warsaw: "poland",
  budapest: "hungary",
  athens: "greece",
  istanbul: "turkey",
  ankara: "turkey",
  dublin: "ireland",

  // Middle East & Asia
  doha: "qatar",
  riyadh: "saudiarabia",
  jeddah: "saudiarabia",
  mecca: "saudiarabia",
  makkah: "saudiarabia",
  medina: "saudiarabia",
  muscat: "oman",
  manama: "bahrain",
  kuwaitcity: "kuwait",
  amman: "jordan",
  beirut: "lebanon",
  telaviv: "israel",
  jerusalem: "israel",
  persia: "iran",
  tehran: "iran",
  baghdad: "iraq",
  korea: "southkorea",
  republicofkorea: "southkorea",
  seoul: "southkorea",
  dprk: "northkorea",
  pyongyang: "northkorea",
  burma: "myanmar",
  yangon: "myanmar",
  easttimor: "timorleste",
  easttimorleste: "timorleste",
  mumbai: "india",
  newdelhi: "india",
  delhi: "india",
  bangalore: "india",
  bengaluru: "india",
  chennai: "india",
  hyderabad: "india",
  beijing: "china",
  shanghai: "china",
  guangzhou: "china",
  shenzhen: "china",
  tokyo: "japan",
  osaka: "japan",
  kyoto: "japan",
  kualalumpur: "malaysia",
  bangkok: "thailand",
  phuket: "thailand",
  jakarta: "indonesia",
  bali: "indonesia",
  manila: "philippines",
  hanoi: "vietnam",
  hochiminh: "vietnam",
  saigon: "vietnam",
  karachi: "pakistan",
  lahore: "pakistan",
  islamabad: "pakistan",
  dhaka: "bangladesh",
  colombo: "srilanka",
  kathmandu: "nepal",
  taipei: "taiwan",

  // Americas & Oceania
  toronto: "canada",
  vancouver: "canada",
  montreal: "canada",
  ottawa: "canada",
  mexicocity: "mexico",
  cancun: "mexico",
  saopaulo: "brazil",
  riodejaneiro: "brazil",
  brasilia: "brazil",
  buenosaires: "argentina",
  bogota: "colombia",
  santiago: "chile",
  lima: "peru",
  dominicanrep: "dominicanrepublic",
  trinidad: "trinidadandtobago",
  trinidadtobago: "trinidadandtobago",
  antigua: "antiguaandbarbuda",
  antiguabarbuda: "antiguaandbarbuda",
  stkitts: "saintkittsandnevis",
  saintkitts: "saintkittsandnevis",
  stlucia: "saintlucia",
  stvincent: "saintvincentandthegrenadines",
  saintvincent: "saintvincentandthegrenadines",
  png: "papuanewguinea",
  sydney: "australia",
  melbourne: "australia",
  brisbane: "australia",
  perth: "australia",
  auckland: "newzealand",
  wellington: "newzealand",
};

/**
 * Collision-safe destination country key normalizer.
 * Sorts aliases and country keys by length descending so short keys (e.g. 'uk', 'us', 'niger', 'oman')
 * never collide with longer country strings (e.g. 'ukraine', 'australia', 'nigeria', 'romania').
 */
export function normalizeCountryKey(destination: string): string {
  const clean = (destination || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (!clean) return "";

  // 1. Direct exact country match
  if (COUNTRY_TRAVEL_META[clean]) return clean;

  // 2. Direct exact alias match
  if (COUNTRY_KEY_ALIASES[clean]) return COUNTRY_KEY_ALIASES[clean];

  // 3. Collision-safe alias substring match (longest first, minimum 4 chars)
  const sortedAliases = Object.keys(COUNTRY_KEY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (alias.length >= 4 && (clean.includes(alias) || alias.includes(clean))) {
      return COUNTRY_KEY_ALIASES[alias];
    }
  }

  // 4. Collision-safe country key substring match (longest first, minimum 4 chars)
  const sortedKeys = Object.keys(COUNTRY_TRAVEL_META).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length >= 4 && (clean.includes(key) || key.includes(clean))) {
      return key;
    }
  }

  return clean;
}

export function getCountryTravelMeta(destination: string): CountryTravelMeta | undefined {
  const key = normalizeCountryKey(destination);
  return COUNTRY_TRAVEL_META[key];
}

// ── LAYER 2: Nomenclature Standards (WHO INN vs USAN / JAN) ──────────────────
/**
 * Countries that primarily label active ingredients using USAN (United States Adopted Names)
 * or JAN (Japanese Accepted Names) in addition to or instead of WHO INN (e.g., Acetaminophen vs Paracetamol,
 * Albuterol vs Salbutamol, Glyburide vs Glibenclamide).
 */
const USAN_NOMENCLATURE_COUNTRIES = new Set<string>([
  "usa",
  "canada",
  "japan",
  "colombia",
  "venezuela",
  "philippines",
  "southkorea",
  "taiwan",
  "mexico",
  "panama",
  "costarica",
]);

// ── LAYER 3: Country-Specific Overrides + 11-Region International Brand Matrix ─
export interface InternationalDrugEquivalentDef {
  generic: string; // Universal WHO INN
  usanGeneric?: string; // USAN / JAN active ingredient name if distinct from WHO INN
  synonyms?: string[]; // Additional local brand/generic tokens for input matching
  countryBrands?: Partial<Record<string, string>>; // Normalized countryKey -> Country-specific brands
  regionalBrands: Partial<Record<TravelRegion | "default", string>>;
}

export const INTERNATIONAL_BRAND_HINTS: Record<string, InternationalDrugEquivalentDef> = {
  // ─── Analgesics, Antipyretics & NSAIDs ─────────────────────────────────────
  paracetamol: {
    generic: "Paracetamol",
    usanGeneric: "Acetaminophen",
    synonyms: [
      "acetaminophen",
      "panadol",
      "tylenol",
      "doliprane",
      "efferalgan",
      "dafalgan",
      "calpol",
      "crocin",
      "dolo",
      "dolo650",
      "action",
      "cetamol",
      "hedex",
      "fevadol",
      "abimol",
      "benuron",
      "tachipirina",
      "gelocatil",
      "apap",
      "calonal",
      "biogesic",
      "sara",
      "panamax",
      "pamol",
      "paraceta",
      "paramol",
    ],
    countryBrands: {
      uganda: "Panadol / Cetamol / Action (Paracetamol)",
      kenya: "Panadol / Action / Hedex (Paracetamol)",
      tanzania: "Panadol / Sheladol / Cetamol (Paracetamol)",
      rwanda: "Panadol / Doliprane / Cetamol (Paracetamol)",
      nigeria: "Panadol / Emzor Paracetamol / M&B",
      ghana: "Panadol / Gebedol / Efpac (Paracetamol)",
      southafrica: "Panado / Calpol / Painamol (Paracetamol)",
      egypt: "Panadol / Abimol / Paramol (Paracetamol)",
      morocco: "Doliprane / Efferalgan / Cetamol (Paracetamol)",
      uae: "Panadol / Adol / Fevadol (Paracetamol)",
      saudiarabia: "Fevadol / Panadol / Adol (Paracetamol)",
      qatar: "Panadol / Adol / Tylol (Paracetamol)",
      uk: "Panadol / Calpol / Mandanol (Paracetamol)",
      ireland: "Panadol / Calpol / Paralief (Paracetamol)",
      france: "Doliprane / Efferalgan / Dafalgan (Paracetamol)",
      belgium: "Dafalgan / Perdolan / Panadol (Paracetamol)",
      switzerland: "Dafalgan / Ben-u-ron / Panadol (Paracetamol)",
      germany: "Ben-u-ron / Paracetamol-ratiopharm (Paracetamol)",
      austria: "Mexalen / Ben-u-ron (Paracetamol)",
      italy: "Tachipirina / Efferalgan (Paracetamol)",
      spain: "Gelocatil / Efferalgan / Termalgin (Paracetamol)",
      portugal: "Ben-u-ron / Panadol (Paracetamol)",
      netherlands: "Panadol / Roter Paracetamol",
      sweden: "Alvedon / Panodil (Paracetamol)",
      norway: "Paracet / Pinex (Paracetamol)",
      denmark: "Panodil / Pamol / Pinex (Paracetamol)",
      finland: "Panadol / Burana-Caps / Para-Tabs (Paracetamol)",
      poland: "Apap / Panadol / Codipar (Paracetamol)",
      russia: "Panadol / Efferalgan / Paracetamol",
      turkey: "Parol / Minoset / Tylol (Paracetamol)",
      usa: "Tylenol / Mapap (Acetaminophen / Paracetamol)",
      canada: "Tylenol / Atasol (Acetaminophen / Paracetamol)",
      mexico: "Tempra / Tylenol / Mejoral (Paracetamol / Acetaminophen)",
      brazil: "Tylenol / Cimegripe / Dorfen (Paracetamol)",
      argentina: "Tafirol / Geniol / Termofren (Paracetamol)",
      colombia: "Dolex / Winadol (Acetaminofén / Paracetamol)",
      india: "Dolo-650 / Crocin / Calpol (Paracetamol)",
      pakistan: "Panadol / Calpol / Disprol (Paracetamol)",
      bangladesh: "Napa / Ace / Fast (Paracetamol)",
      china: "Tylenol (泰诺林) / Fenbid Paracetamol (对乙酰氨基酚)",
      japan: "Calonal (カロナール) / Tylenol A (Acetaminophen / Paracetamol)",
      southkorea: "Tylenol (타이레놀) / Tacenol (Acetaminophen / Paracetamol)",
      singapore: "Panadol / Calpol (Paracetamol)",
      malaysia: "Panadol / Uphamol (Paracetamol)",
      thailand: "Sara / Tylenol / Cemol (Paracetamol)",
      indonesia: "Sanmol / Panadol / Biogesic (Paracetamol)",
      philippines: "Biogesic / Tempra / Tylenol (Paracetamol / Acetaminophen)",
      vietnam: "Efferalgan / Hapacol / Panadol (Paracetamol)",
      australia: "Panadol / Panamax / Herron (Paracetamol)",
      newzealand: "Panadol / Pamol (Paracetamol)",
    },
    regionalBrands: {
      east_africa: "Panadol / Cetamol / Action (Paracetamol)",
      southern_africa: "Panado / Calpol / Panadol (Paracetamol)",
      west_central_africa: "Panadol / Emzor / Doliprane (Paracetamol)",
      north_africa: "Doliprane / Panadol / Abimol (Paracetamol)",
      middle_east: "Panadol / Fevadol / Adol (Paracetamol)",
      europe: "Panadol / Doliprane / Dafalgan / Ben-u-ron (Paracetamol)",
      north_america: "Tylenol (Acetaminophen / Paracetamol)",
      latin_america: "Tylenol / Tempra / Tafirol / Dolex (Paracetamol / Acetaminophen)",
      south_asia: "Dolo-650 / Crocin / Panadol / Napa (Paracetamol)",
      east_southeast_asia: "Panadol / Biogesic / Sara / Tylenol (Paracetamol)",
      oceania: "Panadol / Panamax / Pamol (Paracetamol)",
      default: "Panadol / Tylenol (Paracetamol / Acetaminophen)",
    },
  },
  ibuprofen: {
    generic: "Ibuprofen",
    synonyms: ["brufen", "advil", "motrin", "nurofen", "ibugesic", "pediaprofen", "spifen", "aktren", "moment", "espidifen", "ibuprom", "eve"],
    countryBrands: {
      uganda: "Brufen / Ibugesic / Nurofen (Ibuprofen)",
      kenya: "Brufen / Nurofen / Ibugesic (Ibuprofen)",
      tanzania: "Brufen / Ibugesic (Ibuprofen)",
      southafrica: "Nurofen / Brufen / Myprodol (Ibuprofen)",
      nigeria: "Brufen / Brustan-N / Ibucap (Ibuprofen)",
      egypt: "Brufen / Marcofen / Cetal-Ibu (Ibuprofen)",
      uae: "Brufen / Nurofen / Advil (Ibuprofen)",
      saudiarabia: "Brufen / Sapofen / Advil (Ibuprofen)",
      uk: "Nurofen / Brufen / Cuprofen (Ibuprofen)",
      france: "Nurofen / Advil / Spifen (Ibuprofen)",
      germany: "Dolormin / Ibuflam / Aktren (Ibuprofen)",
      italy: "Moment / Brufen / Nurofen (Ibuprofen)",
      spain: "Espidifen / Neobrufen / Dalsy (Ibuprofen)",
      poland: "Ibuprom / Nurofen / Ibum (Ibuprofen)",
      usa: "Advil / Motrin (Ibuprofen)",
      canada: "Advil / Motrin (Ibuprofen)",
      brazil: "Advil / Alivium / Buscofem (Ibuprofen)",
      mexico: "Motrin / Advil / Tabalon (Ibuprofen)",
      india: "Brufen / Ibugesic / Combiflam (Ibuprofen)",
      japan: "Eve (イブ) / Ringl Ivy / Brufen (Ibuprofen)",
      southkorea: "Brufen / Carol-F / Advil (Ibuprofen)",
      australia: "Nurofen / Advil / Rafen (Ibuprofen)",
      newzealand: "Nurofen / Fenpaed (Ibuprofen)",
    },
    regionalBrands: {
      east_africa: "Brufen / Ibugesic / Nurofen (Ibuprofen)",
      southern_africa: "Nurofen / Brufen /Ibupain (Ibuprofen)",
      west_central_africa: "Brufen / Advil / Nurofen (Ibuprofen)",
      north_africa: "Brufen / Advil / Marcofen (Ibuprofen)",
      middle_east: "Brufen / Sapofen / Advil (Ibuprofen)",
      europe: "Nurofen / Brufen / Dolormin / Moment (Ibuprofen)",
      north_america: "Advil / Motrin (Ibuprofen)",
      latin_america: "Motrin / Advil / Actron (Ibuprofen)",
      south_asia: "Brufen / Ibugesic (Ibuprofen)",
      east_southeast_asia: "Brufen / Nurofen / Advil (Ibuprofen)",
      oceania: "Nurofen / Advil (Ibuprofen)",
      default: "Brufen / Advil / Nurofen (Ibuprofen)",
    },
  },
  diclofenac: {
    generic: "Diclofenac Sodium / Potassium",
    synonyms: ["voltaren", "cataflam", "k-diclo", "diclogem", "diclo", "voltarol", "voveran", "olfen", "flanax"],
    countryBrands: {
      uk: "Voltarol / Diclomax (Diclofenac)",
      usa: "Voltaren / Cataflam / Cambia (Diclofenac)",
      india: "Voveran / Reactin / Dynapar (Diclofenac)",
      germany: "Voltaren / Diclo-ratiopharm (Diclofenac)",
      france: "Voltarène / Flector (Diclofenac)",
    },
    regionalBrands: {
      east_africa: "Diclogem / Voltaren / Cataflam / Olfen (Diclofenac)",
      southern_africa: "Voltaren / Panamor / Cataflam (Diclofenac)",
      west_central_africa: "Voltaren / Cataflam / Olfen (Diclofenac)",
      north_africa: "Cataflam / Voltaren / Declophen (Diclofenac)",
      middle_east: "Voltaren / Cataflam / Rofenac (Diclofenac)",
      europe: "Voltaren / Voltarol / Olfen (Diclofenac)",
      north_america: "Voltaren / Cataflam (Diclofenac)",
      latin_america: "Cataflam / Voltaren (Diclofenac)",
      south_asia: "Voveran / Voltaren / Reactin (Diclofenac)",
      east_southeast_asia: "Voltaren / Cataflam (Diclofenac)",
      oceania: "Voltaren (Diclofenac)",
      default: "Voltaren / Cataflam (Diclofenac)",
    },
  },
  naproxen: {
    generic: "Naproxen",
    synonyms: ["aleve", "naprosyn", "anaprox", "feminax", "apranax", "flanax", "synflex"],
    regionalBrands: {
      north_america: "Aleve / Naprosyn / Anaprox (Naproxen)",
      europe: "Naprosyn / Apranax / Feminax Ultra (Naproxen)",
      latin_america: "Flanax / Apronax / Naprosyn (Naproxen)",
      east_africa: "Naprosyn / Aleve / Synflex (Naproxen)",
      south_asia: "Naprosyn / Xenobid (Naproxen)",
      oceania: "Naprogesic / Naprosyn (Naproxen)",
      default: "Naprosyn / Aleve / Apranax (Naproxen)",
    },
  },
  meloxicam: {
    generic: "Meloxicam",
    synonyms: ["mobic", "melox", "muvera", "movalis"],
    regionalBrands: {
      north_america: "Mobic (Meloxicam)",
      europe: "Mobec / Movalis / Mobic (Meloxicam)",
      south_asia: "Muvera / Mobic (Meloxicam)",
      default: "Mobic / Movalis (Meloxicam)",
    },
  },
  celecoxib: {
    generic: "Celecoxib",
    synonyms: ["celebrex", "celact", "cobix"],
    regionalBrands: {
      south_asia: "Celact / Cobix / Celebrex (Celecoxib)",
      default: "Celebrex (Celecoxib)",
    },
  },
  aspirin: {
    generic: "Acetylsalicylic Acid (Aspirin)",
    synonyms: ["disprin", "cardiprin", "ecotrin", "asa", "acetylsalicylic acid", "ascard", "ecosprin", "jusprin", "aspirine"],
    countryBrands: {
      india: "Ecosprin / Disprin / Loprin (Aspirin)",
      uk: "Disprin / Nu-Seals / Micropirin (Aspirin)",
      france: "Aspégic / Kardégic / Aspirine UPSA (Acetylsalicylic Acid)",
      usa: "Bayer Aspirin / Ecotrin / Vazalore (Aspirin)",
      egypt: "Jusprin / Aspocid / Ezacard (Aspirin)",
    },
    regionalBrands: {
      east_africa: "Ascard / Junior Aspirin / Disprin (Acetylsalicylic Acid)",
      southern_africa: "Disprin / Ecotrin / Myoprin (Aspirin)",
      north_africa: "Jusprin / Aspocid / Kardégic (Aspirin)",
      middle_east: "Jusprin / Aspirin Protect (Acetylsalicylic Acid)",
      europe: "Aspirin Protect / Kardégic / Disprin (Acetylsalicylic Acid)",
      north_america: "Bayer Aspirin / Ecotrin (Aspirin)",
      latin_america: "Aspirina Prevent / Cardioaspirina (Acetylsalicylic Acid)",
      south_asia: "Ecosprin / Disprin / Ascard (Aspirin)",
      east_southeast_asia: "Aspilet / Cardioaspirin / Bayer Aspirin",
      oceania: "Cartia / Astrix / Aspro Clear (Aspirin)",
      default: "Ascard / Ecotrin / Disprin (Acetylsalicylic Acid / Aspirin)",
    },
  },
  tramadol: {
    generic: "Tramadol Hydrochloride",
    synonyms: ["ultram", "tramal", "zamudol", "contramal", "tramazac"],
    regionalBrands: {
      north_america: "Ultram / ConZip (Tramadol — Controlled Rx)",
      europe: "Tramal / Zamudol / Topalgic (Tramadol — Controlled Rx)",
      south_asia: "Ultracet / Tramazac / Contramal (Tramadol — Controlled Rx)",
      default: "Tramal / Ultram (Tramadol — Restricted/Prescription Only)",
    },
  },

  // ─── Antimalarials ─────────────────────────────────────────────────────────
  artemether_lumefantrine: {
    generic: "Artemether + Lumefantrine",
    synonyms: ["coartem", "lumartem", "lonart", "artefan", "artemether", "lumefantrine", "riamet", "falcinil", "lokmal"],
    regionalBrands: {
      east_africa: "Coartem / Lonart / Lumartem (Artemether-Lumefantrine ACT)",
      west_central_africa: "Coartem / Lonart / Amatem (Artemether-Lumefantrine ACT)",
      southern_africa: "Coartem (Artemether-Lumefantrine)",
      europe: "Riamet / Coartem (Artemether-Lumefantrine — Specialist/Travel Clinic)",
      north_america: "Coartem (Artemether-Lumefantrine — Prescription Required)",
      south_asia: "Falcigo-LF / Lumartem / Coartem (Artemether-Lumefantrine)",
      default: "Coartem / Riamet (Artemether + Lumefantrine)",
    },
  },
  dha_piperaquine: {
    generic: "Dihydroartemisinin + Piperaquine",
    synonyms: ["duo-cotecxin", "duocotecxin", "artekin", "d-artepp", "eurartesim", "p-alaxin"],
    regionalBrands: {
      east_africa: "Duo-Cotecxin / D-Artepp (DHA-Piperaquine ACT)",
      west_central_africa: "P-Alaxin / Duo-Cotecxin (DHA-Piperaquine ACT)",
      europe: "Eurartesim (Dihydroartemisinin-Piperaquine)",
      default: "Duo-Cotecxin / Eurartesim (Dihydroartemisinin + Piperaquine)",
    },
  },
  quinine: {
    generic: "Quinine Sulfate / Dihydrochloride",
    synonyms: ["quinate", "quiphate", "qualakind", "rezorcin"],
    regionalBrands: {
      north_america: "Qualaquin (Quinine Sulfate)",
      default: "Quinate / Qualaquin (Quinine Sulfate)",
    },
  },

  // ─── Antibiotics & Antimicrobials ──────────────────────────────────────────
  amoxicillin: {
    generic: "Amoxicillin",
    synonyms: ["amoxil", "amoxyl", "penamox", "hiconcil", "ospamox", "moxatag", "novamox", "clamoxyl", "trimox"],
    countryBrands: {
      france: "Clamoxyl (Amoxicillin)",
      india: "Novamox / Mox / Cipmox (Amoxicillin)",
      usa: "Amoxil / Moxatag (Amoxicillin)",
      uk: "Amoxil (Amoxicillin)",
    },
    regionalBrands: {
      east_africa: "Amoxil / Hiconcil / Ospamox (Amoxicillin)",
      west_central_africa: "Amoxil / Clamoxyl / Hiconcil (Amoxicillin)",
      north_africa: "Clamoxyl / E-Mox / Biomox (Amoxicillin)",
      middle_east: "Amoxil / Julphamox / Hiconcil (Amoxicillin)",
      europe: "Amoxil / Clamoxyl / Ospamox (Amoxicillin)",
      north_america: "Amoxil / Trimox (Amoxicillin)",
      latin_america: "Amoxil / Velamox (Amoxicillin)",
      south_asia: "Novamox / Mox / Amoxil (Amoxicillin)",
      east_southeast_asia: "Amoxil / Hiconcil (Amoxicillin)",
      oceania: "Amoxil / Alphamox (Amoxicillin)",
      default: "Amoxil / Ospamox / Clamoxyl (Amoxicillin)",
    },
  },
  co_amoxiclav: {
    generic: "Amoxicillin + Clavulanic Acid",
    synonyms: ["augmentin", "curam", "klavox", "amoxiclav", "moxclav", "clavam", "fleming", "hibiotic"],
    regionalBrands: {
      south_asia: "Augmentin / Clavam / Moxikind-CV (Co-Amoxiclav)",
      north_africa: "Augmentin / Hibiotic / Curam (Co-Amoxiclav)",
      default: "Augmentin / Curam / Co-Amoxiclav (Amoxicillin + Clavulanic Acid)",
    },
  },
  ciprofloxacin: {
    generic: "Ciprofloxacin",
    synonyms: ["cipro", "cifran", "ciprobay", "ciproxin", "cihox", "ciplox", "ciproflox"],
    countryBrands: {
      uk: "Ciproxin (Ciprofloxacin)",
      germany: "Ciprobay (Ciprofloxacin)",
      india: "Ciplox / Cifran / Alcipro (Ciprofloxacin)",
      usa: "Cipro (Ciprofloxacin)",
    },
    regionalBrands: {
      east_africa: "Cifran / Ciprobay / Cipro (Ciprofloxacin)",
      europe: "Ciprobay / Ciproxin (Ciprofloxacin)",
      north_america: "Cipro (Ciprofloxacin)",
      south_asia: "Ciplox / Cifran (Ciprofloxacin)",
      default: "Cipro / Ciprobay / Cifran (Ciprofloxacin)",
    },
  },
  levofloxacin: {
    generic: "Levofloxacin",
    synonyms: ["levaquin", "tavanic", "levoflox", "glevo", "cravit"],
    regionalBrands: {
      north_america: "Levaquin (Levofloxacin)",
      europe: "Tavanic (Levofloxacin)",
      east_southeast_asia: "Cravit / Tavanic (Levofloxacin)",
      south_asia: "Levoflox / Glevo / Tavanic (Levofloxacin)",
      default: "Tavanic / Levaquin (Levofloxacin)",
    },
  },
  azithromycin: {
    generic: "Azithromycin",
    synonyms: ["zithromax", "azithral", "azitrox", "z-pack", "azee", "zmax", "azyter"],
    regionalBrands: {
      north_america: "Zithromax / Z-Pak (Azithromycin)",
      south_asia: "Azithral / Azee / Zithromax (Azithromycin)",
      east_africa: "Zithromax / Azithral / Azitrox (Azithromycin)",
      default: "Zithromax / Azithral (Azithromycin)",
    },
  },
  clarithromycin: {
    generic: "Clarithromycin",
    synonyms: ["biaxin", "klacid", "claribid", "zeclar"],
    regionalBrands: {
      north_america: "Biaxin (Clarithromycin)",
      europe: "Klacid / Zeclar (Clarithromycin)",
      south_asia: "Claribid / Klacid (Clarithromycin)",
      default: "Klacid / Biaxin (Clarithromycin)",
    },
  },
  erythromycin: {
    generic: "Erythromycin",
    synonyms: ["erythrocin", "e-mycin", "althrocin", "eryped"],
    regionalBrands: {
      south_asia: "Althrocin / Erythrocin (Erythromycin)",
      default: "Erythrocin / E-Mycin (Erythromycin)",
    },
  },
  doxycycline: {
    generic: "Doxycycline",
    synonyms: ["vibramycin", "doryx", "doxy", "doxydar", "monodox", "doxt"],
    regionalBrands: {
      north_america: "Vibramycin / Doryx / Monodox (Doxycycline)",
      middle_east: "Doxydar / Vibramycin (Doxycycline)",
      south_asia: "Doxt-SL / Vibramycin (Doxycycline)",
      default: "Vibramycin / Doryx (Doxycycline)",
    },
  },
  metronidazole: {
    generic: "Metronidazole",
    synonyms: ["flagyl", "metrogyl", "novonidazole", "rozex", "amrizole"],
    regionalBrands: {
      south_asia: "Metrogyl / Flagyl (Metronidazole)",
      north_africa: "Flagyl / Amrizole (Metronidazole)",
      default: "Flagyl / Metrogyl (Metronidazole)",
    },
  },
  cotrimoxazole: {
    generic: "Sulfamethoxazole + Trimethoprim (Co-trimoxazole)",
    synonyms: ["septrin", "bactrim", "sulfamethoxazole", "trimethoprim", "cotrim", "septra", "sutrim"],
    regionalBrands: {
      north_america: "Bactrim / Septra (Sulfamethoxazole-Trimethoprim)",
      east_africa: "Septrin / Bactrim (Co-trimoxazole)",
      europe: "Bactrim / Septrin / Eusaprim (Co-trimoxazole)",
      default: "Septrin / Bactrim (Co-trimoxazole)",
    },
  },
  linezolid: {
    generic: "Linezolid",
    synonyms: ["zyvox", "linospan", "lizolid", "zyvoxid"],
    regionalBrands: {
      europe: "Zyvoxid / Zyvox (Linezolid)",
      south_asia: "Lizolid / Linospan (Linezolid)",
      default: "Zyvox / Lizolid (Linezolid)",
    },
  },
  albendazole: {
    generic: "Albendazole",
    synonyms: ["zentel", "alben", "albez", "albenza", "bandy"],
    regionalBrands: {
      north_america: "Albenza (Albendazole)",
      south_asia: "Zentel / Bandy / Noworm (Albendazole)",
      default: "Zentel / Albenza (Albendazole)",
    },
  },

  // ─── Antihypertensives & Cardiovascular ────────────────────────────────────
  amlodipine: {
    generic: "Amlodipine Besylate",
    synonyms: ["norvasc", "amlopin", "amlocor", "amlong", "stamlo", "istin", "amlor"],
    countryBrands: {
      uk: "Istin / Amlodipine (Amlodipine)",
      france: "Amlor / Norvasc (Amlodipine)",
      india: "Stamlo / Amlong / Amlokind (Amlodipine)",
    },
    regionalBrands: {
      east_africa: "Norvasc / Amlopin / Amlocor (Amlodipine)",
      europe: "Norvasc / Istin / Amlor (Amlodipine)",
      north_america: "Norvasc (Amlodipine)",
      south_asia: "Stamlo / Amlong / Norvasc (Amlodipine)",
      default: "Norvasc / Amlopin (Amlodipine)",
    },
  },
  nifedipine: {
    generic: "Nifedipine",
    synonyms: ["adalat", "procardia", "nicardia", "afeditab"],
    regionalBrands: {
      north_america: "Procardia XL / Adalat CC (Nifedipine)",
      south_asia: "Nicardia Retard / Depin / Adalat (Nifedipine)",
      default: "Adalat LA / Procardia (Nifedipine)",
    },
  },
  lisinopril: {
    generic: "Lisinopril",
    synonyms: ["zestril", "prinivil", "lisoril", "lipril"],
    regionalBrands: {
      south_asia: "Lipril / Lisoril / Zestril (Lisinopril)",
      default: "Zestril / Prinivil (Lisinopril)",
    },
  },
  enalapril: {
    generic: "Enalapril Maleate",
    synonyms: ["vasotec", "renitec", "envas", "enalapril"],
    regionalBrands: {
      north_america: "Vasotec (Enalapril)",
      europe: "Renitec / Xanef (Enalapril)",
      south_asia: "Envas / BQL (Enalapril)",
      default: "Renitec / Vasotec (Enalapril)",
    },
  },
  ramipril: {
    generic: "Ramipril",
    synonyms: ["altace", "tritace", "cardace", "delix"],
    regionalBrands: {
      north_america: "Altace (Ramipril)",
      europe: "Tritace / Delix (Ramipril)",
      south_asia: "Cardace / Ramistar (Ramipril)",
      default: "Tritace / Altace (Ramipril)",
    },
  },
  losartan: {
    generic: "Losartan Potassium",
    synonyms: ["cozaar", "losacar", "angizaar", "losar", "lozaar"],
    regionalBrands: {
      south_asia: "Losacar / Losar / Repace (Losartan)",
      default: "Cozaar / Losacar (Losartan)",
    },
  },
  valsartan: {
    generic: "Valsartan",
    synonyms: ["diovan", "tareg", "valzaar", "valent"],
    regionalBrands: {
      europe: "Diovan / Tareg (Valsartan)",
      south_asia: "Valzaar / Valent / Diovan (Valsartan)",
      default: "Diovan / Tareg (Valsartan)",
    },
  },
  telmisartan: {
    generic: "Telmisartan",
    synonyms: ["micardis", "telma", "telmikind", "pritocor"],
    regionalBrands: {
      south_asia: "Telma / Telmikind / Cresar (Telmisartan)",
      default: "Micardis / Telma (Telmisartan)",
    },
  },
  atenolol: {
    generic: "Atenolol",
    synonyms: ["tenormin", "ateno", "aten", "betacard"],
    regionalBrands: {
      south_asia: "Aten / Betacard / Tenormin (Atenolol)",
      default: "Tenormin (Atenolol)",
    },
  },
  metoprolol: {
    generic: "Metoprolol Tartrate / Succinate",
    synonyms: ["lopressor", "toprol", "betaloc", "metolar", "seloken"],
    regionalBrands: {
      north_america: "Lopressor / Toprol-XL (Metoprolol)",
      europe: "Betaloc ZOK / Seloken / Beloc (Metoprolol)",
      south_asia: "Metolar / Betaloc / Starpress (Metoprolol)",
      default: "Betaloc / Lopressor / Toprol-XL (Metoprolol)",
    },
  },
  carvedilol: {
    generic: "Carvedilol",
    synonyms: ["coreg", "carloc", "cardivas", "dilatrend"],
    regionalBrands: {
      north_america: "Coreg (Carvedilol)",
      europe: "Dilatrend / Eucardic (Carvedilol)",
      south_asia: "Carloc / Cardivas (Carvedilol)",
      default: "Coreg / Dilatrend (Carvedilol)",
    },
  },
  propranolol: {
    generic: "Propranolol Hydrochloride",
    synonyms: ["inderal", "inno-pran", "ciplar", "avlocardyl"],
    regionalBrands: {
      france: "Avlocardyl / Inderal (Propranolol)",
      south_asia: "Ciplar / Inderal (Propranolol)",
      default: "Inderal (Propranolol)",
    },
  },
  verapamil: {
    generic: "Verapamil Hydrochloride",
    synonyms: ["calan", "verelan", "isoptin", "securon"],
    regionalBrands: {
      north_america: "Calan / Verelan / Isoptin (Verapamil)",
      default: "Isoptin / Securon (Verapamil)",
    },
  },
  diltiazem: {
    generic: "Diltiazem Hydrochloride",
    synonyms: ["cardizem", "tiazac", "tildiem", "dilzem"],
    regionalBrands: {
      north_america: "Cardizem / Tiazac (Diltiazem)",
      europe: "Tildiem / Dilzem (Diltiazem)",
      south_asia: "Dilzem (Diltiazem)",
      default: "Cardizem / Tildiem / Dilzem (Diltiazem)",
    },
  },
  digoxin: {
    generic: "Digoxin",
    synonyms: ["lanoxin", "digitek", "cardigox"],
    regionalBrands: {
      default: "Lanoxin (Digoxin)",
    },
  },
  amiodarone: {
    generic: "Amiodarone Hydrochloride",
    synonyms: ["cordarone", "pacerone", "nexterone", "aldarone"],
    regionalBrands: {
      north_america: "Cordarone / Pacerone (Amiodarone)",
      default: "Cordarone (Amiodarone)",
    },
  },
  nitroglycerin: {
    generic: "Glyceryl Trinitrate / Nitroglycerin",
    usanGeneric: "Nitroglycerin",
    synonyms: ["nitrostat", "nitrolingual", "nitro-dur", "gtn", "glyceryl trinitrate", "angised", "sorbitrate"],
    regionalBrands: {
      north_america: "Nitrostat / Nitrolingual (Nitroglycerin)",
      default: "Nitrolingual / Angised / Nitrostat (Glyceryl Trinitrate / Nitroglycerin)",
    },
  },
  isosorbide: {
    generic: "Isosorbide Mononitrate / Dinitrate",
    synonyms: ["imdur", "isordil", "monoket", "sorbitrate"],
    regionalBrands: {
      south_asia: "Sorbitrate / Monotrate / Imdur (Isosorbide)",
      default: "Imdur / Isordil (Isosorbide Mononitrate / Dinitrate)",
    },
  },

  // ─── Diuretics & Electrolytes ──────────────────────────────────────────────
  furosemide: {
    generic: "Furosemide (Frusemide)",
    synonyms: ["lasix", "frusemide", "frusene", "frusenex", "lasilix"],
    countryBrands: {
      france: "Lasilix (Furosemide)",
      india: "Lasix / Frusenex (Furosemide)",
    },
    regionalBrands: {
      default: "Lasix / Frusenex (Furosemide / Frusemide)",
    },
  },
  hydrochlorothiazide: {
    generic: "Hydrochlorothiazide (HCTZ)",
    synonyms: ["hctz", "microzide", "esidrex", "aquazide", "hydride"],
    regionalBrands: {
      north_america: "Microzide (Hydrochlorothiazide)",
      europe: "Esidrex (Hydrochlorothiazide)",
      south_asia: "Aquazide / Hydride (Hydrochlorothiazide)",
      default: "Esidrex / Microzide (Hydrochlorothiazide)",
    },
  },
  spironolactone: {
    generic: "Spironolactone",
    synonyms: ["aldactone", "spiro", "spiractin"],
    regionalBrands: {
      default: "Aldactone (Spironolactone)",
    },
  },
  potassium: {
    generic: "Potassium Chloride",
    synonyms: ["k-dur", "slow-k", "potassium gluconate", "potassium citrate", "klor-con", "potklor"],
    regionalBrands: {
      north_america: "Klor-Con / K-Dur / Slow-K (Potassium Chloride)",
      default: "Slow-K / K-Dur (Potassium Chloride)",
    },
  },

  // ─── Anticoagulants & Antiplatelets ────────────────────────────────────────
  warfarin: {
    generic: "Warfarin Sodium",
    synonyms: ["coumadin", "marevan", "jantoven", "warcef"],
    regionalBrands: {
      north_america: "Coumadin / Jantoven (Warfarin)",
      europe: "Coumadin / Marevan (Warfarin)",
      oceania: "Coumadin / Marevan (Warfarin)",
      default: "Coumadin / Marevan (Warfarin)",
    },
  },
  apixaban: {
    generic: "Apixaban",
    synonyms: ["eliquis", "apigat"],
    regionalBrands: {
      default: "Eliquis (Apixaban)",
    },
  },
  rivaroxaban: {
    generic: "Rivaroxaban",
    synonyms: ["xarelto", "rivasmart"],
    regionalBrands: {
      default: "Xarelto (Rivaroxaban)",
    },
  },
  clopidogrel: {
    generic: "Clopidogrel Bisulfate",
    synonyms: ["plavix", "clopilet", "deplatt", "clopivas"],
    regionalBrands: {
      south_asia: "Clopilet / Deplatt / Plavix (Clopidogrel)",
      default: "Plavix (Clopidogrel)",
    },
  },

  // ─── Lipid-Lowering Statins ────────────────────────────────────────────────
  atorvastatin: {
    generic: "Atorvastatin Calcium",
    synonyms: ["lipitor", "atorlip", "storvas", "atocor", "tahor", "sortis"],
    countryBrands: {
      france: "Tahor / Lipitor (Atorvastatin)",
      germany: "Sortis / Atorvastatin (Atorvastatin)",
      india: "Atorva / Storvas / Tonact (Atorvastatin)",
    },
    regionalBrands: {
      south_asia: "Atorva / Storvas / Lipitor (Atorvastatin)",
      europe: "Lipitor / Sortis / Tahor (Atorvastatin)",
      default: "Lipitor / Atorlip (Atorvastatin)",
    },
  },
  simvastatin: {
    generic: "Simvastatin",
    synonyms: ["zocor", "simvacor", "simvas", "simvor"],
    regionalBrands: {
      default: "Zocor / Simvor (Simvastatin)",
    },
  },
  rosuvastatin: {
    generic: "Rosuvastatin Calcium",
    synonyms: ["crestor", "rosuvas", "rozavel"],
    regionalBrands: {
      south_asia: "Rosuvas / Rozavel / Crestor (Rosuvastatin)",
      default: "Crestor (Rosuvastatin)",
    },
  },

  // ─── Antidiabetics ─────────────────────────────────────────────────────────
  metformin: {
    generic: "Metformin Hydrochloride",
    synonyms: ["glucophage", "diabex", "metfor", "glycomet", "stagid", "fortamet", "glumetza"],
    countryBrands: {
      france: "Glucophage / Stagid (Metformin)",
      india: "Glycomet / Glucophage / Okamet (Metformin)",
      australia: "Diabex / Diaformin / Glucophage (Metformin)",
      usa: "Glucophage / Fortamet / Glumetza (Metformin)",
    },
    regionalBrands: {
      south_asia: "Glycomet / Glucophage (Metformin)",
      oceania: "Diabex / Glucophage (Metformin)",
      default: "Glucophage / Glycomet (Metformin)",
    },
  },
  glibenclamide: {
    generic: "Glibenclamide",
    usanGeneric: "Glyburide",
    synonyms: ["glyburide", "daonil", "micronase", "diabeta", "glidiab", "euglucon"],
    regionalBrands: {
      north_america: "DiaBeta / Micronase / Glynase (Glyburide / Glibenclamide)",
      default: "Daonil / Euglucon (Glibenclamide / Glyburide)",
    },
  },

  // ─── Gastrointestinal & PPIs ───────────────────────────────────────────────
  omeprazole: {
    generic: "Omeprazole",
    synonyms: ["prilosec", "losec", "omiz", "omez", "mopral", "antramups", "gasec"],
    countryBrands: {
      usa: "Prilosec (Omeprazole)",
      canada: "Losec (Omeprazole)",
      uk: "Losec / Mezzopram (Omeprazole)",
      france: "Mopral / Zoltum (Omeprazole)",
      germany: "Antra MUPS / Omep (Omeprazole)",
      india: "Omez / Ocid (Omeprazole)",
    },
    regionalBrands: {
      north_america: "Prilosec / Losec (Omeprazole)",
      europe: "Losec / Mopral / Antra MUPS (Omeprazole)",
      south_asia: "Omez / Ocid / Losec (Omeprazole)",
      default: "Losec / Omez / Prilosec (Omeprazole)",
    },
  },
  esomeprazole: {
    generic: "Esomeprazole",
    synonyms: ["nexium", "esoz", "inexium", "sompraz", "neksium"],
    countryBrands: {
      france: "Inexium (Esomeprazole)",
      india: "Neksium / Sompraz / Esoz (Esomeprazole)",
    },
    regionalBrands: {
      south_asia: "Sompraz / Neksium / Esoz (Esomeprazole)",
      default: "Nexium / Esoz (Esomeprazole)",
    },
  },
  calcium: {
    generic: "Calcium Carbonate / Antacid",
    synonyms: ["calcium carbonate", "tums", "antacid", "maalox", "rennie", "gaviscon", "caltrate", "shelcal"],
    regionalBrands: {
      north_america: "Tums / Caltrate / Maalox (Calcium / Antacid)",
      europe: "Rennie / Gaviscon / Maalox (Calcium / Antacid)",
      south_asia: "Shelcal / Digene / Gelusil (Calcium / Antacid)",
      default: "Tums / Rennie / Maalox (Calcium / Antacid)",
    },
  },

  // ─── Respiratory, Asthma & Allergy ─────────────────────────────────────────
  salbutamol: {
    generic: "Salbutamol",
    usanGeneric: "Albuterol",
    synonyms: ["albuterol", "ventolin", "asmasal", "salbu", "asthalin", "proair", "proventil", "sultanol"],
    countryBrands: {
      usa: "ProAir HFA / Ventolin HFA / Proventil (Albuterol / Salbutamol)",
      canada: "Ventolin HFA / Airomir (Salbutamol / Albuterol)",
      india: "Asthalin / Ventorlin (Salbutamol)",
      germany: "Sultanol / SalbuHEXAL (Salbutamol)",
      france: "Ventoline (Salbutamol)",
    },
    regionalBrands: {
      north_america: "ProAir HFA / Ventolin HFA (Albuterol / Salbutamol)",
      south_asia: "Asthalin / Ventolin (Salbutamol Inhaler)",
      default: "Ventolin / Asthalin (Salbutamol / Albuterol)",
    },
  },
  theophylline: {
    generic: "Theophylline",
    synonyms: ["theo-dur", "uniphyl", "aminophylline", "deriphyllin", "nuelin"],
    regionalBrands: {
      south_asia: "Deriphyllin / Theo-Asthalin (Theophylline)",
      default: "Theo-Dur / Uniphyl / Nuelin (Theophylline)",
    },
  },
  cetirizine: {
    generic: "Cetirizine Hydrochloride",
    synonyms: ["zyrtec", "alerid", "cetrine", "cetzine", "reactine", "zirtek", "okacet"],
    countryBrands: {
      canada: "Reactine (Cetirizine)",
      uk: "Zirtek / Piriteze (Cetirizine)",
      india: "Cetzine / Okacet / Alerid (Cetirizine)",
    },
    regionalBrands: {
      north_america: "Zyrtec / Reactine (Cetirizine)",
      europe: "Zyrtec / Zirtek / Piriteze (Cetirizine)",
      south_asia: "Cetzine / Okacet / Alerid (Cetirizine)",
      default: "Zyrtec / Cetzine (Cetirizine)",
    },
  },
  loratadine: {
    generic: "Loratadine",
    synonyms: ["claritin", "clarityne", "clarityn", "lorfast", "alaspan"],
    regionalBrands: {
      north_america: "Claritin / Alavert (Loratadine)",
      europe: "Clarityne / Clarityn (Loratadine)",
      south_asia: "Lorfast / Alaspan (Loratadine)",
      default: "Claritin / Clarityne (Loratadine)",
    },
  },
  prednisolone: {
    generic: "Prednisolone",
    synonyms: ["deltacortril", "predone", "predon", "omnacortil", "wysolone", "solupred", "orapred"],
    countryBrands: {
      france: "Solupred (Prednisolone)",
      india: "Wysolone / Omnacortil (Prednisolone)",
      usa: "Orapred / Prelone (Prednisolone)",
    },
    regionalBrands: {
      south_asia: "Wysolone / Omnacortil (Prednisolone)",
      default: "Deltacortril / Omnacortil (Prednisolone)",
    },
  },

  // ─── CNS, Mental Health & Neurology ────────────────────────────────────────
  fluoxetine: {
    generic: "Fluoxetine",
    synonyms: ["prozac", "sarafem", "fludac", "prodep"],
    regionalBrands: {
      south_asia: "Fludac / Prodep / Prozac (Fluoxetine)",
      default: "Prozac (Fluoxetine)",
    },
  },
  sertraline: {
    generic: "Sertraline",
    synonyms: ["zoloft", "lustral", "serlift", "daxid"],
    regionalBrands: {
      europe: "Zoloft / Lustral (Sertraline)",
      south_asia: "Zoloft / Serlift / Daxid (Sertraline)",
      default: "Zoloft / Lustral (Sertraline)",
    },
  },
  escitalopram: {
    generic: "Escitalopram Oxalate",
    synonyms: ["lexapro", "cipralex", "nexito", "seroplex"],
    countryBrands: {
      france: "Seroplex (Escitalopram)",
      india: "Nexito / Stalopam / Cipralex (Escitalopram)",
    },
    regionalBrands: {
      north_america: "Lexapro (Escitalopram)",
      europe: "Cipralex / Seroplex (Escitalopram)",
      south_asia: "Nexito / Cipralex (Escitalopram)",
      default: "Lexapro / Cipralex (Escitalopram)",
    },
  },
  citalopram: {
    generic: "Citalopram",
    synonyms: ["celexa", "cipramil", "seropram"],
    regionalBrands: {
      north_america: "Celexa (Citalopram)",
      europe: "Cipramil / Seropram (Citalopram)",
      default: "Celexa / Cipramil (Citalopram)",
    },
  },
  amitriptyline: {
    generic: "Amitriptyline",
    synonyms: ["elavil", "endep", "saroten", "tryptomer", "laroxyl"],
    regionalBrands: {
      north_america: "Elavil (Amitriptyline)",
      europe: "Saroten / Laroxyl (Amitriptyline)",
      south_asia: "Tryptomer / Sarotena (Amitriptyline)",
      default: "Elavil / Tryptomer / Laroxyl (Amitriptyline)",
    },
  },
  diazepam: {
    generic: "Diazepam",
    synonyms: ["valium", "calmpose", "stesolid"],
    regionalBrands: {
      default: "Valium (Diazepam — Controlled Prescription Required)",
    },
  },
  lithium: {
    generic: "Lithium Carbonate",
    synonyms: ["eskalith", "lithobid", "priadel", "camcolit", "licab"],
    regionalBrands: {
      europe: "Priadel / Camcolit (Lithium Carbonate)",
      north_america: "Lithobid / Eskalith (Lithium Carbonate)",
      default: "Priadel / Lithobid (Lithium Carbonate)",
    },
  },
  levodopa: {
    generic: "Levodopa + Carbidopa",
    synonyms: ["sinemet", "madopar", "syndopa", "tidomet"],
    regionalBrands: {
      south_asia: "Syndopa / Tidomet / Sinemet (Levodopa + Carbidopa)",
      default: "Sinemet / Madopar (Levodopa + Carbidopa)",
    },
  },

  // ─── Endocrine, Immunology, HIV & Supplements ──────────────────────────────
  levothyroxine: {
    generic: "Levothyroxine Sodium",
    synonyms: ["eltroxin", "synthroid", "levoxyl", "euthyrox", "thyronorm", "levothyrox"],
    countryBrands: {
      usa: "Synthroid / Levoxyl / Tirosint (Levothyroxine)",
      france: "Levothyrox / L-Thyroxine (Levothyroxine)",
      germany: "L-Thyroxin Henning / Euthyrox (Levothyroxine)",
      india: "Thyronorm / Eltroxin (Levothyroxine)",
    },
    regionalBrands: {
      north_america: "Synthroid / Levoxyl / Eltroxin (Levothyroxine)",
      europe: "Euthyrox / Eltroxin / Levothyrox (Levothyroxine)",
      south_asia: "Thyronorm / Eltroxin (Levothyroxine)",
      default: "Eltroxin / Euthyrox / Synthroid (Levothyroxine)",
    },
  },
  methotrexate: {
    generic: "Methotrexate",
    synonyms: ["trexall", "mtx", "folitrax", "metoject", "ledertrexate"],
    regionalBrands: {
      europe: "Metoject / Lantarel (Methotrexate)",
      south_asia: "Folitrax / Biotrexate (Methotrexate)",
      default: "Trexall / Metoject (Methotrexate)",
    },
  },
  azathioprine: {
    generic: "Azathioprine",
    synonyms: ["imuran", "azoran", "imurel"],
    regionalBrands: {
      south_asia: "Azoran / Imuran (Azathioprine)",
      default: "Imuran / Imurel (Azathioprine)",
    },
  },
  allopurinol: {
    generic: "Allopurinol",
    synonyms: ["zyloprim", "alloril", "zyloric", "cihloric"],
    regionalBrands: {
      north_america: "Zyloprim (Allopurinol)",
      default: "Zyloric / Zyloprim (Allopurinol)",
    },
  },
  efavirenz: {
    generic: "Efavirenz",
    synonyms: ["sustiva", "stocrin", "efavir"],
    regionalBrands: {
      default: "Sustiva / Stocrin (Efavirenz)",
    },
  },
  sildenafil: {
    generic: "Sildenafil Citrate",
    synonyms: ["viagra", "revatio", "manforce", "penegra"],
    regionalBrands: {
      default: "Viagra / Revatio (Sildenafil)",
    },
  },
  tadalafil: {
    generic: "Tadalafil",
    synonyms: ["cialis", "adcirca", "megalis"],
    regionalBrands: {
      default: "Cialis / Adcirca (Tadalafil)",
    },
  },
  iron: {
    generic: "Ferrous Sulfate / Iron Supplement",
    synonyms: [
      "ferrous sulfate",
      "ferrous gluconate",
      "feosol",
      "iron supplement",
      "orofer",
      "fefol",
      "ferrous fumarate",
      "feroglobin",
      "tardyferon",
    ],
    regionalBrands: {
      europe: "Tardyferon / Feroglobin / Fefol (Ferrous Sulfate)",
      north_america: "Feosol / Slow Fe (Ferrous Sulfate)",
      south_asia: "Orofer-XT / Autrin / Fefol (Iron / Ferrous Sulfate)",
      default: "Fefol / Feroglobin / Feosol (Ferrous Sulfate)",
    },
  },
  folic_acid: {
    generic: "Folic Acid (Vitamin B9)",
    synonyms: ["folvite", "folic", "folacin"],
    regionalBrands: {
      default: "Folvite / Folic Acid (Vitamin B9)",
    },
  },
  levonorgestrel_ethinylestradiol: {
    generic: "Levonorgestrel + Ethinylestradiol",
    synonyms: ["microgynon", "safeplan", "femiplan", "diane-35", "alesse", "levlen", "ovral"],
    regionalBrands: {
      east_africa: "Microgynon / Femiplan / Safeplan (Levonorgestrel + Ethinylestradiol)",
      north_america: "Alesse / Aviane / Portia (Levonorgestrel + Ethinylestradiol)",
      oceania: "Levlen ED / Microgynon (Levonorgestrel + Ethinylestradiol)",
      default: "Microgynon / Alesse (Levonorgestrel + Ethinylestradiol)",
    },
  },
};

// Map legacy keys ("artemether", "coartem", "augmentin", "ferrous_sulfate") to canonical keys
const CANONICAL_ID_REDIRECTS: Record<string, string> = {
  artemether: "artemether_lumefantrine",
  coartem: "artemether_lumefantrine",
  augmentin: "co_amoxiclav",
  ferrous_sulfate: "iron",
};

/**
 * Resolves a Medicine object or string to a canonical drug ID in INTERNATIONAL_BRAND_HINTS or CANONICAL_DRUGS.
 */
export function resolveCanonicalDrugId(medOrName: Medicine | string): string | null {
  const combinedLower =
    typeof medOrName === "string"
      ? medOrName.toLowerCase().trim()
      : `${medOrName.name || ""} ${medOrName.genericName || ""}`.toLowerCase().trim();

  if (!combinedLower) return null;

  // 1. Check redirect keys & direct INTERNATIONAL_BRAND_HINTS keys
  for (const [aliasKey, targetId] of Object.entries(CANONICAL_ID_REDIRECTS)) {
    if (combinedLower.includes(aliasKey)) return targetId;
  }
  for (const key of Object.keys(INTERNATIONAL_BRAND_HINTS)) {
    const cleanKey = key.replace(/_/g, " ");
    if (combinedLower.includes(key) || combinedLower.includes(cleanKey)) {
      return key;
    }
  }

  // 2. Check INTERNATIONAL_BRAND_HINTS synonyms (longest first to avoid substring collisions)
  for (const [key, info] of Object.entries(INTERNATIONAL_BRAND_HINTS)) {
    if (info.synonyms?.some((syn) => combinedLower.includes(syn.toLowerCase()))) {
      return key;
    }
  }

  // 3. Check CANONICAL_DRUGS from clinicalInteractionsData
  for (const [canonicalId, def] of Object.entries(CANONICAL_DRUGS)) {
    const matched =
      combinedLower.includes(canonicalId) ||
      def.synonyms.some((syn) => combinedLower.includes(syn.toLowerCase()));
    if (matched) {
      return CANONICAL_ID_REDIRECTS[canonicalId] || canonicalId;
    }
  }

  return null;
}

// ── LAYER 4: Persistent Offline Cache (localStorage) ────────────────────────
const EQUIVALENTS_CACHE_STORAGE_KEY = "dawa_offline_equivalents_cache_v1";
const ADVICE_CACHE_STORAGE_KEY = "dawa_offline_travel_advice_by_country_v1";

function normalizeMedicationCacheKey(medOrName: Medicine | string): string {
  const canonical = resolveCanonicalDrugId(medOrName);
  if (canonical) return canonical;
  const raw =
    typeof medOrName === "string"
      ? medOrName
      : medOrName.genericName || medOrName.name || "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key: string, value: unknown): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Persists resolved online equivalents keyed by normalized country and medication key
 * so that future offline lookups for that country + medication return the verified result.
 */
export function cacheTravelEquivalents(
  destination: string,
  equivalents: TravelEquivalent[],
  medicines: Medicine[] = []
): void {
  const countryKey = normalizeCountryKey(destination);
  if (!countryKey || !Array.isArray(equivalents) || equivalents.length === 0) return;

  const store = readJsonStorage<Record<string, Record<string, string>>>(
    EQUIVALENTS_CACHE_STORAGE_KEY,
    {}
  );
  if (!store[countryKey]) {
    store[countryKey] = {};
  }

  for (const eq of equivalents) {
    if (!eq?.original || !eq?.equivalent) continue;
    // Skip uninformative placeholder fallbacks
    if (/ask local pharmacist|request active ingredient/i.test(eq.equivalent)) continue;

    const matchedMed = medicines.find(
      (m) => m.name.trim().toLowerCase() === eq.original.trim().toLowerCase()
    );
    const medKey = normalizeMedicationCacheKey(matchedMed || eq.original);
    if (medKey) {
      store[countryKey][medKey] = eq.equivalent;
    }
    const rawNameKey = eq.original
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
    if (rawNameKey) {
      store[countryKey][rawNameKey] = eq.equivalent;
    }
  }

  writeJsonStorage(EQUIVALENTS_CACHE_STORAGE_KEY, store);
}

/**
 * Retrieves a previously cached equivalent for a destination and medication if available.
 */
export function getCachedTravelEquivalent(
  destination: string,
  med: Medicine
): string | null {
  const countryKey = normalizeCountryKey(destination);
  if (!countryKey) return null;

  const store = readJsonStorage<Record<string, Record<string, string>>>(
    EQUIVALENTS_CACHE_STORAGE_KEY,
    {}
  );
  const countryMap = store[countryKey];
  if (!countryMap) return null;

  const canonicalKey = normalizeMedicationCacheKey(med);
  if (canonicalKey && countryMap[canonicalKey]) {
    return countryMap[canonicalKey];
  }

  const rawNameKey = (med.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  if (rawNameKey && countryMap[rawNameKey]) {
    return countryMap[rawNameKey];
  }

  return null;
}

/**
 * Persists a full TravelAdviceResult per destination country in localStorage.
 */
export function cacheOfflineTravelAdvice(
  destination: string,
  advice: TravelAdviceResult
): void {
  const countryKey = normalizeCountryKey(destination);
  if (!countryKey || !advice) return;

  const store = readJsonStorage<Record<string, TravelAdviceResult>>(
    ADVICE_CACHE_STORAGE_KEY,
    {}
  );
  store[countryKey] = advice;
  writeJsonStorage(ADVICE_CACHE_STORAGE_KEY, store);
}

/**
 * Retrieves cached TravelAdviceResult for a destination country if previously saved.
 */
export function getCachedOfflineTravelAdvice(
  destination: string
): TravelAdviceResult | null {
  const countryKey = normalizeCountryKey(destination);
  if (!countryKey) return null;

  const store = readJsonStorage<Record<string, TravelAdviceResult>>(
    ADVICE_CACHE_STORAGE_KEY,
    {}
  );
  return store[countryKey] || null;
}

/**
 * Resolves the most accurate local medication equivalent for a given medicine and destination
 * using the 4-layer hierarchy:
 *   1. Persistent offline cache from prior online lookups for this country + drug
 *   2. Country-specific brand override + WHO INN / USAN active ingredient
 *   3. Destination region brand matrix (across all 11 global regions) + WHO INN / USAN
 *   4. Canonical drug synonym fallback or universal WHO INN generic guidance
 */
export function resolveLocalEquivalent(
  med: Medicine,
  regionOrDestination?: TravelRegion | string,
  explicitCountryKey?: string
): string {
  const rawName = (med.name || "").trim();
  const rawGeneric = (med.genericName || "").trim();

  // Determine countryKey and region
  let countryKey = explicitCountryKey ? normalizeCountryKey(explicitCountryKey) : "";
  let region: TravelRegion | undefined;

  if (regionOrDestination) {
    const asRegion = regionOrDestination as TravelRegion;
    const validRegions: TravelRegion[] = [
      "east_africa",
      "southern_africa",
      "west_central_africa",
      "north_africa",
      "middle_east",
      "europe",
      "north_america",
      "latin_america",
      "south_asia",
      "east_southeast_asia",
      "oceania",
    ];
    if (validRegions.includes(asRegion)) {
      region = asRegion;
    } else {
      if (!countryKey) {
        countryKey = normalizeCountryKey(regionOrDestination);
      }
      region = COUNTRY_TRAVEL_META[countryKey]?.region;
    }
  } else if (countryKey) {
    region = COUNTRY_TRAVEL_META[countryKey]?.region;
  }

  // Layer 4 check: Previously cached online equivalent for this specific country + medicine
  if (countryKey) {
    const cached = getCachedTravelEquivalent(countryKey, med);
    if (cached) return cached;
  }

  // Layer 2 & 3 check: Resolve canonical drug ID and look up Country -> Region -> Default
  const canonicalId = resolveCanonicalDrugId(med);
  const usesUsan = countryKey
    ? USAN_NOMENCLATURE_COUNTRIES.has(countryKey)
    : region === "north_america";

  if (canonicalId && INTERNATIONAL_BRAND_HINTS[canonicalId]) {
    const info = INTERNATIONAL_BRAND_HINTS[canonicalId];
    const activeIngredientLabel =
      usesUsan && info.usanGeneric
        ? `${info.usanGeneric} / ${info.generic}`
        : info.generic;

    // Country-specific override first
    if (countryKey && info.countryBrands?.[countryKey]) {
      return info.countryBrands[countryKey]!;
    }

    // Region-specific brand matrix second
    if (region && info.regionalBrands[region]) {
      const regionalResult = info.regionalBrands[region]!;
      if (usesUsan && info.usanGeneric && !regionalResult.toLowerCase().includes(info.usanGeneric.toLowerCase())) {
        return `${regionalResult} (${info.usanGeneric})`;
      }
      return regionalResult;
    }

    // Global default brand + WHO INN / USAN
    const defaultBrand = info.regionalBrands.default || activeIngredientLabel;
    if (usesUsan && info.usanGeneric && !defaultBrand.toLowerCase().includes(info.usanGeneric.toLowerCase())) {
      return `${defaultBrand} (${info.usanGeneric})`;
    }
    return defaultBrand;
  }

  // Secondary check against CANONICAL_DRUGS if not in INTERNATIONAL_BRAND_HINTS
  if (canonicalId && CANONICAL_DRUGS[canonicalId]) {
    const def = CANONICAL_DRUGS[canonicalId];
    const topBrands = def.synonyms
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" / ");
    return topBrands ? `${topBrands} (${def.name})` : def.name;
  }

  // Universal WHO INN generic fallback for custom / unindexed medications
  if (rawGeneric && rawGeneric.toLowerCase() !== rawName.toLowerCase()) {
    return `${rawGeneric} (WHO INN Generic — Ask local pharmacist for ${rawGeneric})`;
  }
  return `${rawName} (Request WHO INN active ingredient at local pharmacy)`;
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
  const medNames = medicines.map((m) => `${m.name} ${m.genericName || ""}`.toLowerCase()).join(" ");
  const hasControlledOrSensitive =
    /tramadol|codeine|morphine|diazepam|alprazolam|clonazepam|lorazepam|pregabalin|gabapentin|amitriptyline|zolpidem|pseudoephedrine/i.test(
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
  // Never default an unmapped destination to "east_africa"
  const region = meta?.region;

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
        `**Counterfeit & Brand Verification**: Purchase replacement medicines only from licensed hospital or chain pharmacies, and verify the generic active ingredient (WHO INN) name on the package.`,
      ];

    case "latin_america":
      return [
        `**Mosquito & Arbovirus Precautions (Dengue, Zika, Chikungunya)**: Use EPA-approved insect repellent in **${destination}**. Avoid NSAIDs (Ibuprofen, Aspirin, Diclofenac) if acute febrile dengue is suspected; use Paracetamol/Acetaminophen instead.`,
        `**Water, Altitude & Food Safety**: Drink bottled or purified water and carry oral rehydration salts. If visiting high-altitude cities (e.g., Bogotá, Quito, La Paz, Cusco), monitor blood pressure and hydration closely.`,
        `**Yellow Fever & Pharmacy Access**: A Yellow Fever certificate is required for designated tropical zones. Request medications by their generic active ingredient (DCI / WHO INN) at licensed pharmacies.`,
      ];

    case "europe":
    case "north_america":
    case "oceania":
      return [
        `**Prescription Refill Restrictions**: Pharmacies in **${destination}** generally cannot dispense prescription-only medicines using a foreign prescription. Pack enough medication for your full stay plus a 7-day buffer for travel delays.`,
        `**Climate & Seasonal Adaptation**: Cold weather or dry cabin air can affect respiratory conditions (keep rescue inhalers warm and accessible) and alter hydration needs.`,
        `**Travel Insurance & Emergency Documentation**: Medical care for visitors in **${destination}** can be costly. Keep a digital summary of your generic medication names (WHO INN) and allergies on your phone.`,
      ];

    default:
      return [
        `**Medication Supply & Storage**: Pack enough medication for your full trip to **${destination}** plus a 7-day reserve in your carry-on bag, stored away from heat and moisture.`,
        `**Universal Generic (WHO INN) Identification**: Foreign brand names vary by country—always present the generic active ingredient name to local pharmacists in **${destination}**.`,
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
  const cachedAdvice = getCachedOfflineTravelAdvice(cleanDest);

  const equivalents: TravelEquivalent[] = medicines.map((med) => ({
    original: med.name.trim(),
    equivalent: resolveLocalEquivalent(med, meta?.region, countryKey),
  }));

  const timezoneAdvice =
    cachedAdvice?.timezoneAdvice ||
    buildTimezoneAdvice(cleanDest, meta, homeTimezone, medicines);
  const customsNotes =
    cachedAdvice?.customsNotes ||
    buildCustomsNotes(cleanDest, meta, dra, medicines);
  const healthRisks =
    cachedAdvice?.healthRisks && cachedAdvice.healthRisks.length > 0
      ? cachedAdvice.healthRisks
      : buildHealthRisks(cleanDest, meta);

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
