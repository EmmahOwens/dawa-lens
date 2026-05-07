/**
 * Drug Regulatory Authority (DRA) database.
 * Covers official national medicine/pharmaceutical regulatory bodies
 * and their hotlines/helplines for ~130+ countries.
 *
 * Structure: { [countryKey]: { authority: string; number: string; website?: string } }
 * countryKey is the lowercase country name (spaces removed, simplified).
 */
export interface DRAEntry {
  authority: string;
  number: string;
  website?: string;
}

export const DRA_DATABASE: Record<string, DRAEntry> = {
  // ── AFRICA ──────────────────────────────────────────────────────────────────
  uganda: {
    authority: 'National Drug Authority (NDA)',
    number: '+256 414 255 665',
    website: 'https://www.nda.or.ug',
  },
  kenya: {
    authority: 'Pharmacy & Poisons Board (PPB)',
    number: '+254 20 2725991',
    website: 'https://www.pharmacyboardkenya.org',
  },
  tanzania: {
    authority: 'Tanzania Medicines & Medical Devices Authority (TMDA)',
    number: '+255 22 212 0620',
    website: 'https://www.tmda.go.tz',
  },
  rwanda: {
    authority: 'Rwanda Food & Drugs Authority (FDA)',
    number: '+250 252 571 730',
    website: 'https://www.rda.gov.rw',
  },
  ethiopia: {
    authority: 'Ethiopian Food & Drug Authority (EFDA)',
    number: '+251 11 552 4322',
    website: 'https://www.efda.gov.et',
  },
  nigeria: {
    authority: 'National Agency for Food & Drug Administration (NAFDAC)',
    number: '0800 333 0004',
    website: 'https://www.nafdac.gov.ng',
  },
  ghana: {
    authority: 'Food & Drugs Authority Ghana (FDA)',
    number: '+233 302 233200',
    website: 'https://www.fdaghana.gov.gh',
  },
  southafrica: {
    authority: 'South African Health Products Regulatory Authority (SAHPRA)',
    number: '+27 12 501 0400',
    website: 'https://www.sahpra.org.za',
  },
  egypt: {
    authority: 'Egyptian Drug Authority (EDA)',
    number: '16928',
    website: 'https://www.eda.gov.eg',
  },
  morocco: {
    authority: "Direction du Médicament et de la Pharmacie (DMP)",
    number: '+212 537 687 190',
  },
  algeria: {
    authority: 'Agence Nationale des Produits Pharmaceutiques (ANPP)',
    number: '+213 23 500 500',
  },
  senegal: {
    authority: 'Direction de la Pharmacie et du Médicament (DPM)',
    number: '+221 33 889 1800',
  },
  cameroon: {
    authority: 'Lanacome – Laboratoire National de Contrôle des Médicaments',
    number: '+237 222 221 764',
  },
  zimbabwe: {
    authority: 'Medicines Control Authority of Zimbabwe (MCAZ)',
    number: '+263 4 736420',
    website: 'https://www.mcaz.co.zw',
  },
  zambia: {
    authority: 'Zambia Medicines Regulatory Authority (ZAMRA)',
    number: '+260 211 233976',
    website: 'https://www.zamra.co.zm',
  },
  malawi: {
    authority: 'Pharmacy Medicines & Poisons Board (PMPB)',
    number: '+265 1 788 455',
  },
  mozambique: {
    authority: 'Instituto Nacional de Controlo de Qualidade em Saúde (INCQS)',
    number: '+258 21 327 039',
  },
  botswana: {
    authority: 'Botswana Medicines Regulatory Authority (BOMRA)',
    number: '+267 395 0078',
  },
  namibia: {
    authority: 'Namibia Medicines Regulatory Council (NMRC)',
    number: '+264 61 203 2913',
  },
  angola: {
    authority: 'Instituto Regulador dos Medicamentos e Tecnologias de Saúde (IRMEDS)',
    number: '+244 222 309 250',
  },
  madagascar: {
    authority: 'Autorité Sanitaire Focale (ASF) – DGS',
    number: '+261 20 22 295 53',
  },

  // ── EAST AFRICA (extras) ──────────────────────────────────────────────────
  burundi: {
    authority: 'Agence Burundaise de Régulation des Médicaments et Aliments (ABREMA)',
    number: '+257 22 252 714',
  },
  drcongo: {
    authority: 'Direction de la Pharmacie et du Médicament (DPM-DRC)',
    number: '+243 81 500 0000',
  },

  // ── NORTH AFRICA ──────────────────────────────────────────────────────────
  libya: {
    authority: 'National Center for Disease Control (NCDC-Libya)',
    number: '+218 21 360 0900',
  },
  tunisia: {
    authority: 'Agence Nationale du Médicament (DSSB)',
    number: '+216 71 561 111',
  },
  sudan: {
    authority: 'National Medicines & Poisons Board (NMPB)',
    number: '+249 183 773 551',
  },

  // ── EUROPE ────────────────────────────────────────────────────────────────
  uk: {
    authority: 'Medicines & Healthcare products Regulatory Agency (MHRA)',
    number: '+44 20 3080 6000',
    website: 'https://www.gov.uk/mhra',
  },
  france: {
    authority: "Agence Nationale de Sécurité du Médicament (ANSM)",
    number: '+33 1 55 87 30 00',
    website: 'https://www.ansm.sante.fr',
  },
  germany: {
    authority: 'Federal Institute for Drugs & Medical Devices (BfArM)',
    number: '+49 228 99307 0',
    website: 'https://www.bfarm.de',
  },
  italy: {
    authority: 'Agenzia Italiana del Farmaco (AIFA)',
    number: '+39 06 5978 4400',
    website: 'https://www.aifa.gov.it',
  },
  spain: {
    authority: 'Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)',
    number: '+34 918 225 000',
    website: 'https://www.aemps.gob.es',
  },
  portugal: {
    authority: 'Infarmed – Autoridade Nacional do Medicamento',
    number: '+351 21 798 7100',
    website: 'https://www.infarmed.pt',
  },
  netherlands: {
    authority: 'Medicines Evaluation Board (MEB / CBG)',
    number: '+31 70 340 7900',
    website: 'https://www.cbg-meb.nl',
  },
  belgium: {
    authority: 'Federal Agency for Medicines & Health Products (FAMHP)',
    number: '+32 2 524 80 00',
    website: 'https://www.famhp.be',
  },
  switzerland: {
    authority: 'Swissmedic',
    number: '+41 58 462 02 11',
    website: 'https://www.swissmedic.ch',
  },
  austria: {
    authority: 'Austrian Agency for Health & Food Safety (AGES-MEA)',
    number: '+43 50 555 36111',
    website: 'https://www.ages.at',
  },
  sweden: {
    authority: 'Medical Products Agency (MPA / Läkemedelsverket)',
    number: '+46 18 17 46 00',
    website: 'https://www.lakemedelsverket.se',
  },
  norway: {
    authority: 'Norwegian Medicines Agency (NOMA)',
    number: '+47 22 89 77 00',
    website: 'https://www.noma.no',
  },
  denmark: {
    authority: 'Danish Medicines Agency (DKMA)',
    number: '+45 44 88 95 95',
    website: 'https://www.dkma.dk',
  },
  finland: {
    authority: 'Finnish Medicines Agency (Fimea)',
    number: '+358 29 522 3341',
    website: 'https://www.fimea.fi',
  },
  poland: {
    authority: 'Office for Registration of Medicinal Products (URPL)',
    number: '+48 22 492 11 00',
    website: 'https://www.urpl.gov.pl',
  },
  czechia: {
    authority: 'State Institute for Drug Control (SÚKL)',
    number: '+420 272 185 111',
    website: 'https://www.sukl.cz',
  },
  hungary: {
    authority: 'National Institute of Pharmacy & Nutrition (OGYÉI)',
    number: '+36 1 886 9300',
    website: 'https://www.ogyei.gov.hu',
  },
  romania: {
    authority: 'National Medicines Agency (ANM)',
    number: '+40 21 317 1100',
    website: 'https://www.anm.ro',
  },
  greece: {
    authority: 'National Organization for Medicines (EOF)',
    number: '+30 213 2040000',
    website: 'https://www.eof.gr',
  },
  ukraine: {
    authority: 'State Expert Center of Ministry of Health of Ukraine',
    number: '+380 44 200 0980',
  },
  russia: {
    authority: 'Ministry of Health — Department of State Regulation of Medicines',
    number: '8 800 200-1979',
    website: 'https://minzdrav.gov.ru',
  },
  turkey: {
    authority: 'Turkish Medicines & Medical Devices Agency (TITCK)',
    number: '+90 312 218 30 00',
    website: 'https://www.titck.gov.tr',
  },
  ireland: {
    authority: 'Health Products Regulatory Authority (HPRA)',
    number: '+353 1 676 4971',
    website: 'https://www.hpra.ie',
  },

  // ── MIDDLE EAST ───────────────────────────────────────────────────────────
  uae: {
    authority: 'Dubai Health Authority – Pharmaceutical Division',
    number: '800 4006',
    website: 'https://www.dha.gov.ae',
  },
  saudiarabia: {
    authority: 'Saudi Food & Drug Authority (SFDA)',
    number: '19999',
    website: 'https://www.sfda.gov.sa',
  },
  jordan: {
    authority: 'Jordan Food & Drug Administration (JFDA)',
    number: '+962 6 562 5272',
    website: 'https://www.jfda.jo',
  },
  israel: {
    authority: 'Israeli Pharmaceutical Administration (MOH)',
    number: '*5400',
    website: 'https://www.gov.il/en/departments/ministry_of_health',
  },
  iran: {
    authority: 'Food & Drug Administration of Iran (IFDA)',
    number: '+98 21 6461 4000',
  },
  iraq: {
    authority: 'Iraqi Pharmacovigilance Center (IPVC)',
    number: '+964 1 416 3000',
  },
  qatar: {
    authority: 'Ministry of Public Health – Pharmacy Department',
    number: '16000',
    website: 'https://www.moph.gov.qa',
  },
  kuwait: {
    authority: 'Kuwait Drug & Food Control Authority (KDFCA)',
    number: '176',
  },
  bahrain: {
    authority: 'National Health Regulatory Authority (NHRA)',
    number: '+973 17 290 700',
    website: 'https://www.nhra.bh',
  },
  oman: {
    authority: 'Directorate of Pharmaceutical Affairs (DPA)',
    number: '+968 2468 3000',
  },
  lebanon: {
    authority: 'Lebanese Ministry of Public Health – Pharmacy Division',
    number: '1214',
  },

  // ── ASIA ─────────────────────────────────────────────────────────────────
  india: {
    authority: 'Central Drugs Standard Control Organisation (CDSCO)',
    number: '1800 180 4444',
    website: 'https://www.cdsco.gov.in',
  },
  china: {
    authority: 'National Medical Products Administration (NMPA)',
    number: '12331',
    website: 'https://www.nmpa.gov.cn',
  },
  japan: {
    authority: 'Pharmaceuticals & Medical Devices Agency (PMDA)',
    number: '+81 3 3506 9541',
    website: 'https://www.pmda.go.jp',
  },
  southkorea: {
    authority: 'Ministry of Food & Drug Safety (MFDS)',
    number: '1399',
    website: 'https://www.mfds.go.kr',
  },
  singapore: {
    authority: 'Health Sciences Authority (HSA)',
    number: '+65 6866 3538',
    website: 'https://www.hsa.gov.sg',
  },
  malaysia: {
    authority: 'National Pharmaceutical Regulatory Agency (NPRA)',
    number: '+60 3 7883 5400',
    website: 'https://www.npra.gov.my',
  },
  thailand: {
    authority: 'Food & Drug Administration Thailand (FDA-TH)',
    number: '1556',
    website: 'https://www.fda.moph.go.th',
  },
  indonesia: {
    authority: 'National Agency of Drug & Food Control (BPOM)',
    number: '1500533',
    website: 'https://www.pom.go.id',
  },
  vietnam: {
    authority: 'Drug Administration of Vietnam (DAV)',
    number: '+84 24 3846 2534',
    website: 'https://www.dav.gov.vn',
  },
  philippines: {
    authority: 'Food & Drug Administration Philippines (FDA-PH)',
    number: '1-800-1-FDA-CARE (1-800-1-332-2273)',
    website: 'https://www.fda.gov.ph',
  },
  pakistan: {
    authority: 'Drug Regulatory Authority of Pakistan (DRAP)',
    number: '0800 00372',
    website: 'https://www.dra.gov.pk',
  },
  bangladesh: {
    authority: 'Directorate General of Drug Administration (DGDA)',
    number: '+880 2 9559813',
    website: 'https://www.dgda.gov.bd',
  },
  srilanka: {
    authority: 'National Medicines Regulatory Authority (NMRA)',
    number: '+94 11 2694 782',
    website: 'https://www.nmra.gov.lk',
  },
  nepal: {
    authority: 'Department of Drug Administration (DDA)',
    number: '+977 1 4262 380',
    website: 'https://www.dda.gov.np',
  },
  myanmar: {
    authority: 'Food & Drug Administration Myanmar (FDA-MM)',
    number: '+95 1 251 046',
  },
  cambodia: {
    authority: 'Department of Drugs & Food (DDF)',
    number: '+855 23 722 870',
  },
  laos: {
    authority: 'Food & Drug Department (FDD-Laos)',
    number: '+856 21 214 003',
  },
  taiwan: {
    authority: 'Food & Drug Administration Taiwan (TFDA)',
    number: '0800-024-099',
    website: 'https://www.fda.gov.tw',
  },
  hongkong: {
    authority: 'Department of Health – Pharmacy Division',
    number: '+852 2961 8989',
    website: 'https://www.drugoffice.gov.hk',
  },
  mongolia: {
    authority: 'Medical Devices & Pharmaceutical Division (MDPD)',
    number: '+976 11 320 840',
  },

  // ── AMERICAS ─────────────────────────────────────────────────────────────
  usa: {
    authority: 'U.S. Food & Drug Administration (FDA)',
    number: '1-800-FDA-1088 (1-800-332-1088)',
    website: 'https://www.fda.gov',
  },
  canada: {
    authority: 'Health Canada – Marketed Health Products Directorate',
    number: '1-866-234-2345',
    website: 'https://www.canada.ca/en/health-canada.html',
  },
  mexico: {
    authority: 'Federal Commission for the Protection from Sanitary Risk (COFEPRIS)',
    number: '800 033 50 50',
    website: 'https://www.gob.mx/cofepris',
  },
  brazil: {
    authority: 'National Health Surveillance Agency (ANVISA)',
    number: '0800 642 9782',
    website: 'https://www.gov.br/anvisa',
  },
  argentina: {
    authority: 'Administración Nacional de Medicamentos (ANMAT)',
    number: '0800 222 6682',
    website: 'https://www.argentina.gob.ar/anmat',
  },
  colombia: {
    authority: 'Instituto Nacional de Vigilancia de Medicamentos (INVIMA)',
    number: '018000 420003',
    website: 'https://www.invima.gov.co',
  },
  chile: {
    authority: 'Instituto de Salud Pública de Chile (ISP)',
    number: '+56 2 2575 5000',
    website: 'https://www.ispch.cl',
  },
  peru: {
    authority: 'Dirección General de Medicamentos, Insumos y Drogas (DIGEMID)',
    number: '0800-1-1515',
    website: 'https://www.digemid.minsa.gob.pe',
  },
  venezuela: {
    authority: 'Instituto Nacional de Higiene Rafael Rangel (INHRR)',
    number: '+58 212 606 6011',
  },
  ecuador: {
    authority: 'Agencia Nacional de Regulación, Control y Vigilancia Sanitaria (ARCSA)',
    number: '1800 002727',
    website: 'https://www.controlsanitario.gob.ec',
  },
  bolivia: {
    authority: 'Agencia Estatal de Medicamentos y Tecnologías en Salud (AGEMED)',
    number: '+591 2 290 0777',
  },
  paraguay: {
    authority: 'Dirección Nacional de Vigilancia Sanitaria (DNVS)',
    number: '+595 21 290 611',
  },
  uruguay: {
    authority: 'División Farmacología y Farmacia del MSP',
    number: '1934',
  },
  costarica: {
    authority: 'Ministerio de Salud – Dirección de Registros y Controles',
    number: '+506 2233-0233',
  },
  cuba: {
    authority: 'Centro para el Control Estatal de Medicamentos (CECMED)',
    number: '+53 7 832 0268',
    website: 'https://www.cecmed.cu',
  },

  // ── OCEANIA ───────────────────────────────────────────────────────────────
  australia: {
    authority: 'Therapeutic Goods Administration (TGA)',
    number: '1800 020 653',
    website: 'https://www.tga.gov.au',
  },
  newzealand: {
    authority: 'Medsafe – New Zealand Medicines & Medical Devices Safety Authority',
    number: '0800 625 1011',
    website: 'https://www.medsafe.govt.nz',
  },
  papuanewguinea: {
    authority: 'PNG Pharmacy Board',
    number: '+675 301 3714',
  },
  fiji: {
    authority: 'Fiji Pharmacy Practitioners Board',
    number: '+679 330 5111',
  },
};

/**
 * Look up the Drug Regulatory Authority entry for a given destination string.
 * Returns null if no match found.
 */
export function lookupDRA(destination: string): DRAEntry | null {
  if (!destination) return null;
  const key = destination
    .toLowerCase()
    .replace(/[^a-z]/g, ''); // strip spaces, punctuation

  // Direct key match
  if (DRA_DATABASE[key]) return DRA_DATABASE[key];

  // Partial match: destination contains a known key, or key contains destination
  for (const [k, v] of Object.entries(DRA_DATABASE)) {
    if (key.includes(k) || k.includes(key)) return v;
  }

  return null;
}
