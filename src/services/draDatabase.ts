/**
 * Drug Regulatory Authority (DRA) & National Emergency / Ambulance database.
 * Covers official national medicine/pharmaceutical regulatory bodies,
 * verified contact numbers/hotlines, official websites, and official
 * ambulance or national emergency dispatch numbers for ~100+ countries.
 *
 * Structure: { [countryKey]: DRAEntry }
 * countryKey is the lowercase country name (spaces removed, simplified).
 */
export interface DRAEntry {
  authority: string;
  number: string;
  website?: string;
  ambulance: string;
  ambulanceService?: string;
}

export const DRA_DATABASE: Record<string, DRAEntry> = {
  // ── AFRICA ──────────────────────────────────────────────────────────────────
  uganda: {
    authority: 'National Drug Authority (NDA)',
    number: '0800 101 622',
    website: 'https://www.nda.or.ug',
    ambulance: '112 / 999',
    ambulanceService: 'National Emergency & Ambulance Service',
  },
  kenya: {
    authority: 'Pharmacy & Poisons Board (PPB)',
    number: '+254 709 770 100',
    website: 'https://pharmacyboardkenya.org',
    ambulance: '999 / 112',
    ambulanceService: 'National Emergency / Red Cross Eplus (1199)',
  },
  tanzania: {
    authority: 'Tanzania Medicines & Medical Devices Authority (TMDA)',
    number: '0800 110 084',
    website: 'https://www.tmda.go.tz',
    ambulance: '114 / 115',
    ambulanceService: 'Emergency Medical Services (EMS)',
  },
  rwanda: {
    authority: 'Rwanda Food & Drugs Authority (Rwanda FDA)',
    number: '9707',
    website: 'https://www.rwandafda.gov.rw',
    ambulance: '912',
    ambulanceService: 'SAMU Rwanda Medical Emergency',
  },
  ethiopia: {
    authority: 'Ethiopian Food & Drug Authority (EFDA)',
    number: '8482',
    website: 'https://www.efda.gov.et',
    ambulance: '907 / 911',
    ambulanceService: 'Ethiopian Red Cross Ambulance',
  },
  nigeria: {
    authority: 'National Agency for Food & Drug Administration (NAFDAC)',
    number: '0700 162 3322',
    website: 'https://www.nafdac.gov.ng',
    ambulance: '112',
    ambulanceService: 'National Emergency Medical Service (NEMSAS)',
  },
  ghana: {
    authority: 'Food & Drugs Authority Ghana (FDA)',
    number: '0800 151 000',
    website: 'https://fdaghana.gov.gh',
    ambulance: '193 / 112',
    ambulanceService: 'National Ambulance Service (NAS)',
  },
  southafrica: {
    authority: 'South African Health Products Regulatory Authority (SAHPRA)',
    number: '+27 12 501 0300',
    website: 'https://www.sahpra.org.za',
    ambulance: '10177 / 112',
    ambulanceService: 'National Emergency Medical Services',
  },
  egypt: {
    authority: 'Egyptian Drug Authority (EDA)',
    number: '15301',
    website: 'https://www.edaegypt.gov.eg',
    ambulance: '123',
    ambulanceService: 'Egyptian Ambulance Organization (EAO)',
  },
  morocco: {
    authority: 'Agence Marocaine du Médicament et des Produits de Santé (AMMPS)',
    number: '+212 537 682 289',
    website: 'https://ammps.sante.gov.ma',
    ambulance: '150 / 15',
    ambulanceService: 'SAMU / Protection Civile',
  },
  algeria: {
    authority: 'Agence Nationale des Produits Pharmaceutiques (ANPP)',
    number: '+213 23 36 75 22',
    website: 'https://anpp.dz',
    ambulance: '14 / 112',
    ambulanceService: 'Protection Civile Ambulance',
  },
  senegal: {
    authority: 'Agence Sénégalaise de Réglementation Pharmaceutique (ARP)',
    number: '+221 33 868 11 27',
    website: 'https://www.arp.sn',
    ambulance: '1515',
    ambulanceService: 'SAMU National Sénégal',
  },
  cameroon: {
    authority: 'Direction de la Pharmacie, du Médicament et des Laboratoires (DPML)',
    number: '+237 222 21 92 81',
    website: 'https://dpml.cm',
    ambulance: '119 / 112',
    ambulanceService: 'SAMU Cameroun',
  },
  zimbabwe: {
    authority: 'Medicines Control Authority of Zimbabwe (MCAZ)',
    number: '08080641',
    website: 'https://www.mcaz.co.zw',
    ambulance: '994 / 999',
    ambulanceService: 'Emergency Medical Services / MARS Rescue',
  },
  zambia: {
    authority: 'Zambia Medicines Regulatory Authority (ZAMRA)',
    number: '+260 211 432 350',
    website: 'https://www.zamra.co.zm',
    ambulance: '992 / 112',
    ambulanceService: 'National Ambulance Emergency Service',
  },
  malawi: {
    authority: 'Pharmacy and Medicines Regulatory Authority (PMRA)',
    number: '+265 212 755 165',
    website: 'https://www.pmra.mw',
    ambulance: '998 / 118',
    ambulanceService: 'Emergency Medical Services',
  },
  mozambique: {
    authority: 'Autoridade Nacional Reguladora de Medicamentos (ANARME)',
    number: '+258 82 303 5409',
    website: 'https://anarme.gov.mz',
    ambulance: '117 / 112',
    ambulanceService: 'Serviço de Emergência Médica',
  },
  botswana: {
    authority: 'Botswana Medicines Regulatory Authority (BoMRA)',
    number: '+267 373 1720',
    website: 'https://www.bomra.co.bw',
    ambulance: '997',
    ambulanceService: 'Emergency Medical Services (EMS Botswana)',
  },
  namibia: {
    authority: 'Namibia Medicines Regulatory Council (NMRC)',
    number: '+264 61 203 2400',
    website: 'https://nmrc.gov.na',
    ambulance: '10177 / 112',
    ambulanceService: 'State Ambulance / E-Med Rescue (924)',
  },
  angola: {
    authority: 'Agência Reguladora de Medicamentos e Tecnologias de Saúde (ARMED)',
    number: '+244 945 817 227',
    website: 'https://www.armed.gov.ao',
    ambulance: '112',
    ambulanceService: 'Instituto Nacional de Emergências Médicas (INEMA)',
  },
  madagascar: {
    authority: 'Agence du Médicament de Madagascar (AMM)',
    number: '+261 20 22 365 22',
    website: 'http://www.agmed.mg',
    ambulance: '124 / 117',
    ambulanceService: 'Urgences Médicales SAMU',
  },
  burundi: {
    authority: 'Autorité Burundaise de Régulation des Médicaments et Aliments (ABREMA)',
    number: '+257 22 24 97 39',
    website: 'https://abrema.gov.bi',
    ambulance: '112 / 118',
    ambulanceService: "Secours Médicaux d'Urgence",
  },
  drcongo: {
    authority: 'Autorité Congolaise de Réglementation Pharmaceutique (ACOREP)',
    number: '+243 840 456 525',
    website: 'https://acorep.gouv.cd',
    ambulance: '112',
    ambulanceService: "Services d'Urgences Médicales",
  },
  cotedivoire: {
    authority: 'Autorité Ivoirienne de Régulation Pharmaceutique (AIRP)',
    number: '+225 27 20 22 59 00',
    website: 'https://www.airp.ci',
    ambulance: '185',
    ambulanceService: "SAMU Côte d'Ivoire",
  },
  mauritius: {
    authority: 'Pharmacy Board – Ministry of Health & Wellness',
    number: '+230 201 2175',
    website: 'https://health.govmu.org',
    ambulance: '114 / 999',
    ambulanceService: 'SAMU Mauritius Emergency Ambulance',
  },
  seychelles: {
    authority: 'Public Health Authority – Ministry of Health',
    number: '+248 438 8000',
    website: 'https://www.health.gov.sc',
    ambulance: '151 / 999',
    ambulanceService: 'Emergency Ambulance Seychelles',
  },
  libya: {
    authority: 'Food & Drug Control Centre (FDCC / NCDC)',
    number: '+218 21 360 0900',
    website: 'https://fdcc.gov.ly',
    ambulance: '193 / 1515',
    ambulanceService: 'Red Crescent Emergency Ambulance',
  },
  tunisia: {
    authority: 'Direction de la Pharmacie et du Médicament (DPM / ANMPS)',
    number: '+216 71 783 195',
    website: 'http://www.dpm.tn',
    ambulance: '190 / 198',
    ambulanceService: 'SAMU Tunisie',
  },
  sudan: {
    authority: 'National Medicines & Poisons Board (NMPB)',
    number: '+249 183 773 551',
    website: 'https://nmpb.gov.sd',
    ambulance: '777 / 999',
    ambulanceService: 'Red Crescent Emergency Medical Services',
  },

  // ── EUROPE ────────────────────────────────────────────────────────────────
  uk: {
    authority: 'Medicines & Healthcare products Regulatory Agency (MHRA)',
    number: '+44 20 3080 6000',
    website: 'https://www.gov.uk/mhra',
    ambulance: '999 / 112',
    ambulanceService: 'NHS Emergency Ambulance',
  },
  france: {
    authority: 'Agence Nationale de Sécurité du Médicament (ANSM)',
    number: '+33 1 55 87 30 00',
    website: 'https://ansm.sante.fr',
    ambulance: '15 / 112',
    ambulanceService: "SAMU (Service d'Aide Médicale Urgente)",
  },
  germany: {
    authority: 'Federal Institute for Drugs & Medical Devices (BfArM)',
    number: '+49 228 99307 0',
    website: 'https://www.bfarm.de',
    ambulance: '112',
    ambulanceService: 'Rettungsdienst / Notarzt',
  },
  italy: {
    authority: 'Agenzia Italiana del Farmaco (AIFA)',
    number: '800 571661',
    website: 'https://www.aifa.gov.it',
    ambulance: '118 / 112',
    ambulanceService: 'Pronto Soccorso Sanitario (SSN)',
  },
  spain: {
    authority: 'Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)',
    number: '+34 918 225 000',
    website: 'https://www.aemps.gob.es',
    ambulance: '112 / 061',
    ambulanceService: 'SAMUR / Urgencias Médicas',
  },
  portugal: {
    authority: 'Infarmed – Autoridade Nacional do Medicamento',
    number: '+351 21 798 7100',
    website: 'https://www.infarmed.pt',
    ambulance: '112',
    ambulanceService: 'INEM (Instituto Nacional de Emergência Médica)',
  },
  netherlands: {
    authority: 'Medicines Evaluation Board (MEB / CBG)',
    number: '+31 88 224 6000',
    website: 'https://www.cbg-meb.nl',
    ambulance: '112',
    ambulanceService: 'Ambulancezorg Nederland',
  },
  belgium: {
    authority: 'Federal Agency for Medicines & Health Products (FAMHP / AFMPS)',
    number: '+32 2 528 40 00',
    website: 'https://www.famhp.be',
    ambulance: '112 / 100',
    ambulanceService: 'Aide Médicale Urgente (AMU)',
  },
  switzerland: {
    authority: 'Swissmedic',
    number: '+41 58 462 02 11',
    website: 'https://www.swissmedic.ch',
    ambulance: '144 / 112',
    ambulanceService: 'Sanitätsnotruf (Ambulance)',
  },
  austria: {
    authority: 'Federal Office for Safety in Health Care (BASG / AGES)',
    number: '+43 50 555 36111',
    website: 'https://www.basg.gv.at',
    ambulance: '144 / 112',
    ambulanceService: 'Rettungsdienst / Rotes Kreuz',
  },
  sweden: {
    authority: 'Medical Products Agency (Läkemedelsverket)',
    number: '+46 18 17 46 00',
    website: 'https://www.lakemedelsverket.se',
    ambulance: '112',
    ambulanceService: 'Ambulanssjukvården (SOS Alarm)',
  },
  norway: {
    authority: 'Norwegian Medical Products Agency (DMP)',
    number: '+47 22 89 77 00',
    website: 'https://www.dmp.no',
    ambulance: '113 / 112',
    ambulanceService: 'Medisinsk Nødhjelp (Ambulanse)',
  },
  denmark: {
    authority: 'Danish Medicines Agency (Lægemiddelstyrelsen)',
    number: '+45 44 88 95 95',
    website: 'https://laegemiddelstyrelsen.dk',
    ambulance: '112',
    ambulanceService: 'Akut Ambulance',
  },
  finland: {
    authority: 'Finnish Medicines Agency (Fimea)',
    number: '+358 29 522 3341',
    website: 'https://www.fimea.fi',
    ambulance: '112',
    ambulanceService: 'Ensihoitopalvelu (Ambulance)',
  },
  poland: {
    authority: 'Office for Registration of Medicinal Products (URPL)',
    number: '+48 22 492 11 00',
    website: 'https://www.urpl.gov.pl',
    ambulance: '999 / 112',
    ambulanceService: 'Pogotowie Ratunkowe',
  },
  czechia: {
    authority: 'State Institute for Drug Control (SÚKL)',
    number: '+420 272 185 111',
    website: 'https://www.sukl.cz',
    ambulance: '155 / 112',
    ambulanceService: 'Zdravotnická záchranná služba (ZZS)',
  },
  hungary: {
    authority: 'National Centre for Public Health & Pharmacy (NNGYK)',
    number: '+36 1 886 9300',
    website: 'https://nngyk.gov.hu',
    ambulance: '104 / 112',
    ambulanceService: 'Országos Mentőszolgálat (OMSZ)',
  },
  romania: {
    authority: 'National Agency for Medicines & Medical Devices (ANMDMR)',
    number: '+40 21 317 1100',
    website: 'https://www.anm.ro',
    ambulance: '112',
    ambulanceService: 'Serviciul de Ambulanță / SMURD',
  },
  greece: {
    authority: 'National Organization for Medicines (EOF)',
    number: '+30 213 2040000',
    website: 'https://www.eof.gr',
    ambulance: '166 / 112',
    ambulanceService: 'EKAB Emergency Medical Service',
  },
  croatia: {
    authority: 'Agency for Medicinal Products and Medical Devices (HALMED)',
    number: '+385 1 4884 100',
    website: 'https://www.halmed.hr',
    ambulance: '194 / 112',
    ambulanceService: 'Hitna Medicinska Pomoć',
  },
  iceland: {
    authority: 'Icelandic Medicines Agency (Lyfjastofnun)',
    number: '+354 520 2100',
    website: 'https://www.lyfjastofnun.is',
    ambulance: '112',
    ambulanceService: 'Neyðarlínan Emergency Ambulance',
  },
  ukraine: {
    authority: 'State Expert Center of Ministry of Health of Ukraine (SEC MoH)',
    number: '+380 44 200 0980',
    website: 'https://www.dec.gov.ua',
    ambulance: '103 / 112',
    ambulanceService: 'Emergency Medical Care (Швидка допомога)',
  },
  russia: {
    authority: 'Federal Service for Surveillance in Healthcare (Roszdravnadzor)',
    number: '8 800 550 99 03',
    website: 'https://roszdravnadzor.gov.ru',
    ambulance: '103 / 112',
    ambulanceService: 'Skoraya Pomoshch (Скорая помощь)',
  },
  turkey: {
    authority: 'Turkish Medicines & Medical Devices Agency (TİTCK)',
    number: '444 4 680',
    website: 'https://www.titck.gov.tr',
    ambulance: '112',
    ambulanceService: '112 Acil Sağlık Hizmetleri',
  },
  ireland: {
    authority: 'Health Products Regulatory Authority (HPRA)',
    number: '+353 1 676 4971',
    website: 'https://www.hpra.ie',
    ambulance: '999 / 112',
    ambulanceService: 'National Ambulance Service (NAS)',
  },

  // ── MIDDLE EAST ───────────────────────────────────────────────────────────
  uae: {
    authority: 'Ministry of Health & Prevention (MOHAP)',
    number: '800 111 11',
    website: 'https://mohap.gov.ae',
    ambulance: '998 / 112',
    ambulanceService: 'National Ambulance / DCAS',
  },
  saudiarabia: {
    authority: 'Saudi Food & Drug Authority (SFDA)',
    number: '19999',
    website: 'https://www.sfda.gov.sa',
    ambulance: '997 / 911',
    ambulanceService: 'Saudi Red Crescent Authority (SRCA)',
  },
  jordan: {
    authority: 'Jordan Food & Drug Administration (JFDA)',
    number: '+962 6 562 5272',
    website: 'https://www.jfda.jo',
    ambulance: '911',
    ambulanceService: 'Civil Defense Ambulance Service',
  },
  israel: {
    authority: 'Ministry of Health – Pharmaceutical Division',
    number: '*5400',
    website: 'https://www.gov.il/en/departments/ministry_of_health',
    ambulance: '101',
    ambulanceService: 'Magen David Adom (MDA)',
  },
  iran: {
    authority: 'Food & Drug Administration of Iran (IFDA)',
    number: '190 / +98 21 6461 4000',
    website: 'https://fda.gov.ir',
    ambulance: '115',
    ambulanceService: 'Emergency Medical Services (EMS 115)',
  },
  iraq: {
    authority: 'Iraqi Pharmacovigilance Center (IPVC) – MoH',
    number: '+964 1 416 3000',
    ambulance: '122',
    ambulanceService: 'Medical Emergency Services (Ambulance 122)',
  },
  qatar: {
    authority: 'Ministry of Public Health (MOPH) – Pharmacy & Drug Control',
    number: '16000',
    website: 'https://www.moph.gov.qa',
    ambulance: '999',
    ambulanceService: 'Hamad Medical Corporation Ambulance Service',
  },
  kuwait: {
    authority: 'Kuwait Drug & Food Control Administration (KDFCA)',
    number: '176',
    website: 'https://www.moh.gov.kw',
    ambulance: '112',
    ambulanceService: 'MoH Medical Emergency Ambulance',
  },
  bahrain: {
    authority: 'National Health Regulatory Authority (NHRA)',
    number: '+973 17 290 700',
    website: 'https://www.nhra.bh',
    ambulance: '999',
    ambulanceService: 'National Ambulance Service Bahrain',
  },
  oman: {
    authority: 'Directorate General of Pharmaceutical Affairs & Drug Control (DGPA&DC)',
    number: '+968 2235 7111',
    website: 'https://www.moh.gov.om',
    ambulance: '9999 / 112',
    ambulanceService: 'Royal Oman Police Ambulance',
  },
  lebanon: {
    authority: 'Ministry of Public Health (MOPH) – Pharmacy Division',
    number: '1214',
    website: 'https://www.moph.gov.lb',
    ambulance: '140',
    ambulanceService: 'Lebanese Red Cross Emergency Medical Services',
  },

  // ── ASIA ─────────────────────────────────────────────────────────────────
  india: {
    authority: 'Central Drugs Standard Control Organisation (CDSCO)',
    number: '1800 11 1454',
    website: 'https://cdsco.gov.in',
    ambulance: '108 / 102 / 112',
    ambulanceService: 'National Ambulance Service (108 / 102)',
  },
  china: {
    authority: 'National Medical Products Administration (NMPA)',
    number: '12315',
    website: 'https://www.nmpa.gov.cn',
    ambulance: '120 / 999',
    ambulanceService: 'National Emergency Medical Center (120)',
  },
  japan: {
    authority: 'Pharmaceuticals & Medical Devices Agency (PMDA)',
    number: '+81 3 3506 9457',
    website: 'https://www.pmda.go.jp',
    ambulance: '119',
    ambulanceService: 'Kyūkyū Emergency Medical Service',
  },
  southkorea: {
    authority: 'Ministry of Food & Drug Safety (MFDS)',
    number: '1577-1255 / 1399',
    website: 'https://www.mfds.go.kr',
    ambulance: '119',
    ambulanceService: '119 Emergency Medical Services',
  },
  singapore: {
    authority: 'Health Sciences Authority (HSA)',
    number: '+65 6866 3400',
    website: 'https://www.hsa.gov.sg',
    ambulance: '995',
    ambulanceService: 'SCDF Emergency Medical Services',
  },
  malaysia: {
    authority: 'National Pharmaceutical Regulatory Agency (NPRA)',
    number: '+60 3 7883 5400',
    website: 'https://www.npra.gov.my',
    ambulance: '999 / 112',
    ambulanceService: 'Malaysian Emergency Medical Services (MERS 999)',
  },
  thailand: {
    authority: 'Food & Drug Administration Thailand (FDA-TH)',
    number: '1556',
    website: 'https://www.fda.moph.go.th',
    ambulance: '1669',
    ambulanceService: 'National Institute for Emergency Medicine (NIEM 1669)',
  },
  indonesia: {
    authority: 'National Agency of Drug & Food Control (BPOM)',
    number: '1500533',
    website: 'https://www.pom.go.id',
    ambulance: '118 / 119',
    ambulanceService: 'Public Safety Center (PSC 119) / PMI',
  },
  vietnam: {
    authority: 'Drug Administration of Vietnam (DAV)',
    number: '+84 24 3846 2534',
    website: 'https://dav.gov.vn',
    ambulance: '115',
    ambulanceService: 'Emergency Ambulance Service (Cấp cứu 115)',
  },
  philippines: {
    authority: 'Food & Drug Administration Philippines (FDA-PH)',
    number: '1-800-1-332-2273',
    website: 'https://www.fda.gov.ph',
    ambulance: '911 / 143',
    ambulanceService: 'National Emergency 911 / Red Cross 143',
  },
  pakistan: {
    authority: 'Drug Regulatory Authority of Pakistan (DRAP)',
    number: '0800 00372',
    website: 'https://www.dra.gov.pk',
    ambulance: '1122 / 115',
    ambulanceService: 'Rescue 1122 / Edhi Ambulance Service',
  },
  bangladesh: {
    authority: 'Directorate General of Drug Administration (DGDA)',
    number: '+880 2 9559813',
    website: 'https://dgda.gov.bd',
    ambulance: '999',
    ambulanceService: 'National Emergency Service (999)',
  },
  srilanka: {
    authority: 'National Medicines Regulatory Authority (NMRA)',
    number: '+94 11 2694 782',
    website: 'https://www.nmra.gov.lk',
    ambulance: '1990',
    ambulanceService: '1990 Suwa Seriya Free Emergency Ambulance',
  },
  nepal: {
    authority: 'Department of Drug Administration (DDA)',
    number: '+977 1 4262 380',
    website: 'https://www.dda.gov.np',
    ambulance: '102',
    ambulanceService: 'Nepal Red Cross Society Ambulance (102)',
  },
  myanmar: {
    authority: 'Food & Drug Administration Myanmar (FDA-MM)',
    number: '+95 1 251 046',
    website: 'https://www.fda.gov.mm',
    ambulance: '192',
    ambulanceService: 'Emergency Ambulance Service (192)',
  },
  cambodia: {
    authority: 'Department of Drugs & Food (DDF / DDMD)',
    number: '+855 23 722 870',
    website: 'http://ddfcambodia.gov.kh',
    ambulance: '119',
    ambulanceService: 'SAMU Cambodia (119)',
  },
  laos: {
    authority: 'Food & Drug Department (FDD-Laos)',
    number: '+856 21 214 003',
    website: 'https://fdd.gov.la',
    ambulance: '1623 / 1195',
    ambulanceService: 'Vientiane Rescue 1623 / 1195',
  },
  taiwan: {
    authority: 'Food & Drug Administration Taiwan (TFDA)',
    number: '0800-285-000',
    website: 'https://www.fda.gov.tw',
    ambulance: '119',
    ambulanceService: 'Fire Department Emergency Ambulance (119)',
  },
  hongkong: {
    authority: 'Department of Health – Drug Office',
    number: '+852 2961 8989',
    website: 'https://www.drugoffice.gov.hk',
    ambulance: '999',
    ambulanceService: 'Fire Services Department Ambulance / St. John',
  },
  mongolia: {
    authority: 'Ministry of Health – Pharmaceutical Division (GASI)',
    number: '+976 11 320 840',
    website: 'https://moh.gov.mn',
    ambulance: '103',
    ambulanceService: 'Emergency Medical Centre (103)',
  },

  // ── AMERICAS ─────────────────────────────────────────────────────────────
  usa: {
    authority: 'U.S. Food & Drug Administration (FDA)',
    number: '1-888-INFO-FDA (1-888-463-6332)',
    website: 'https://www.fda.gov',
    ambulance: '911',
    ambulanceService: 'Emergency Medical Services (911 EMS)',
  },
  canada: {
    authority: 'Health Canada – Marketed Health Products Directorate',
    number: '1-866-225-0709',
    website: 'https://www.canada.ca/en/health-canada.html',
    ambulance: '911',
    ambulanceService: 'Paramedic / Emergency Medical Services (911)',
  },
  mexico: {
    authority: 'Comisión Federal para la Protección contra Riesgos Sanitarios (COFEPRIS)',
    number: '800 033 50 50',
    website: 'https://www.gob.mx/cofepris',
    ambulance: '911',
    ambulanceService: 'Cruz Roja Mexicana / Urgencias 911',
  },
  brazil: {
    authority: 'National Health Surveillance Agency (ANVISA)',
    number: '0800 642 9782',
    website: 'https://www.gov.br/anvisa/pt-br',
    ambulance: '192',
    ambulanceService: 'SAMU 192 (Serviço de Atendimento Móvel de Urgência)',
  },
  argentina: {
    authority: 'Administración Nacional de Medicamentos (ANMAT)',
    number: '0800 333 1234 / 0800 222 6682',
    website: 'https://www.argentina.gob.ar/anmat',
    ambulance: '107 / 911',
    ambulanceService: 'SAME (Sistema de Atención Médica de Emergencias)',
  },
  colombia: {
    authority: 'Instituto Nacional de Vigilancia de Medicamentos (INVIMA)',
    number: '018000 115966 / +57 601 742 2121',
    website: 'https://www.invima.gov.co',
    ambulance: '123 / 125',
    ambulanceService: 'Línea de Emergencias 123 / CRUE 125',
  },
  chile: {
    authority: 'Instituto de Salud Pública de Chile (ISP)',
    number: '+56 2 2575 5000',
    website: 'https://www.ispch.gob.cl',
    ambulance: '131',
    ambulanceService: 'SAMU Chile (131)',
  },
  peru: {
    authority: 'Dirección General de Medicamentos, Insumos y Drogas (DIGEMID)',
    number: '0800 1 1515 / +51 1 631 4300',
    website: 'https://www.digemid.minsa.gob.pe',
    ambulance: '106 / 116',
    ambulanceService: 'SAMU Perú (106) / Bomberos (116)',
  },
  venezuela: {
    authority: 'Instituto Nacional de Higiene Rafael Rangel (INHRR)',
    number: '+58 212 606 6011',
    website: 'http://www.inhrr.gob.ve',
    ambulance: '911 / 171',
    ambulanceService: 'Servicio de Emergencias 911',
  },
  ecuador: {
    authority: 'Agencia Nacional de Regulación, Control y Vigilancia Sanitaria (ARCSA)',
    number: '1800 002727',
    website: 'https://www.controlsanitario.gob.ec',
    ambulance: '911',
    ambulanceService: 'Servicio Integrado de Seguridad ECU 911',
  },
  bolivia: {
    authority: 'Agencia Estatal de Medicamentos y Tecnologías en Salud (AGEMED)',
    number: '+591 2 244 0404',
    website: 'https://agemed.minsalud.gob.bo',
    ambulance: '118 / 911',
    ambulanceService: 'Servicio de Ambulancias 118',
  },
  paraguay: {
    authority: 'Dirección Nacional de Vigilancia Sanitaria (DINAVISA)',
    number: '+595 21 237 4000',
    website: 'https://www.dinavisa.gov.py',
    ambulance: '141 / 911',
    ambulanceService: 'SEME (Emergencias Médicas 141)',
  },
  uruguay: {
    authority: 'Ministerio de Salud Pública – Departamento de Medicamentos',
    number: '1934',
    website: 'https://www.gub.uy/ministerio-salud-publica',
    ambulance: '105 / 911',
    ambulanceService: 'SAME 105 (Urgencias Médicas)',
  },
  costarica: {
    authority: 'Ministerio de Salud – Registros y Controles',
    number: '+506 2233 0233',
    website: 'https://www.ministeriodesalud.go.cr',
    ambulance: '911',
    ambulanceService: 'Cruz Roja Costarricense (911)',
  },
  cuba: {
    authority: 'Centro para el Control Estatal de Medicamentos (CECMED)',
    number: '+53 7 832 0268',
    website: 'https://www.cecmed.cu',
    ambulance: '104',
    ambulanceService: 'SIUM (Urgencias Médicas 104)',
  },

  // ── OCEANIA ───────────────────────────────────────────────────────────────
  australia: {
    authority: 'Therapeutic Goods Administration (TGA)',
    number: '1800 020 653',
    website: 'https://www.tga.gov.au',
    ambulance: '000 / 112',
    ambulanceService: 'Emergency Ambulance (Triple Zero 000)',
  },
  newzealand: {
    authority: 'Medsafe – New Zealand Medicines & Medical Devices Safety Authority',
    number: '0800 625 1011',
    website: 'https://www.medsafe.govt.nz',
    ambulance: '111',
    ambulanceService: 'St John Ambulance / Wellington Free Ambulance',
  },
  papuanewguinea: {
    authority: 'PNG Pharmacy Board / Pharmaceutical Services',
    number: '+675 301 3714',
    website: 'https://www.health.gov.pg',
    ambulance: '111',
    ambulanceService: 'St John Ambulance PNG (111)',
  },
  fiji: {
    authority: 'Fiji Pharmacy Profession Board',
    number: '+679 330 5111',
    website: 'https://www.health.gov.fj',
    ambulance: '911 / 910',
    ambulanceService: 'St John Ambulance Fiji / NFA (911)',
  },
};

/**
 * Common destination aliases mapped to primary database keys.
 */
const DESTINATION_ALIASES: Record<string, string> = {
  // United States
  unitedstates: 'usa',
  unitedstatesofamerica: 'usa',
  america: 'usa',
  us: 'usa',
  usa: 'usa',

  // United Kingdom
  unitedkingdom: 'uk',
  uk: 'uk',
  greatbritain: 'uk',
  britain: 'uk',
  england: 'uk',
  scotland: 'uk',
  wales: 'uk',
  northernireland: 'uk',

  // United Arab Emirates
  unitedarabemirates: 'uae',
  uae: 'uae',
  emirates: 'uae',
  dubai: 'uae',
  abudhabi: 'uae',

  // Congo DRC
  drc: 'drcongo',
  drcongo: 'drcongo',
  democraticrepublicofthecongo: 'drcongo',
  democraticrepubliccongo: 'drcongo',
  congodrc: 'drcongo',
  congokinshasa: 'drcongo',

  // Korea
  korea: 'southkorea',
  southkorea: 'southkorea',
  republicofkorea: 'southkorea',

  // Czechia
  czechia: 'czechia',
  czechrepublic: 'czechia',

  // Côte d'Ivoire / Ivory Coast
  ivorycoast: 'cotedivoire',
  cotedivoire: 'cotedivoire',
  cotedivoireci: 'cotedivoire',

  // Russia
  russia: 'russia',
  russianfederation: 'russia',

  // Tanzania
  tanzania: 'tanzania',
  unitedrepublicoftanzania: 'tanzania',
};

/**
 * Look up the Drug Regulatory Authority and Emergency Ambulance entry for a given destination string.
 * Returns null if no match found.
 */
export function lookupDRA(destination: string): DRAEntry | null {
  if (!destination) return null;
  const normalized = destination
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z]/g, ''); // strip non-alphabetical characters

  if (!normalized) return null;

  // 1. Direct key match
  if (DRA_DATABASE[normalized]) return DRA_DATABASE[normalized];

  // 2. Direct alias match
  const aliasKey = DESTINATION_ALIASES[normalized];
  if (aliasKey && DRA_DATABASE[aliasKey]) return DRA_DATABASE[aliasKey];

  // 3. Alias substring match (checking longer alias keys first)
  const sortedAliases = Object.keys(DESTINATION_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (alias.length >= 3 && (normalized.includes(alias) || alias.includes(normalized))) {
      const target = DESTINATION_ALIASES[alias];
      if (DRA_DATABASE[target]) return DRA_DATABASE[target];
    }
  }

  // 4. Collision-safe partial key match: sort keys by length descending to prevent
  // short keys (e.g. 'uk') from matching longer strings like 'ukraine'
  const sortedKeys = Object.keys(DRA_DATABASE).sort((a, b) => b.length - a.length);
  for (const k of sortedKeys) {
    // Only match substrings if key is at least 4 characters to avoid false positive short collisions
    if (k.length >= 4 && (normalized.includes(k) || k.includes(normalized))) {
      return DRA_DATABASE[k];
    }
  }

  return null;
}
