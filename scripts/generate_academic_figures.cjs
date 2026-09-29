const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const figuresDir = path.join(__dirname, '../report/figures');

// -------------------------------------------------------------
// 1. DAWA LENS TIERED SYSTEM ARCHITECTURE (ACADEMIC BLOCK DIAGRAM)
// -------------------------------------------------------------
function generateSystemArchitectureSvg() {
  const width = 1180;
  const height = 760;

  const defs = `
  <defs>
    <marker id="sa-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#000000" />
    </marker>
    <marker id="sa-arrow-rev" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#000000" />
    </marker>
    <style>
      text {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        color: #000000;
      }
      .diag-title {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 15px;
        font-weight: bold;
      }
      .diag-sub {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 11.5px;
        font-style: italic;
      }
      .tier-header {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 12.5px;
        font-weight: bold;
      }
      .card-title {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 11.5px;
        font-weight: bold;
      }
      .bullet-text {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 9.8px;
      }
      .boundary-text {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 9.5px;
        font-weight: bold;
      }
    </style>
  </defs>
  `;

  const marginX = 25;
  const contentWidth = width - 2 * marginX; // 1130

  let svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${defs}
    <rect width="${width}" height="${height}" fill="#ffffff" />

    <!-- Overall Architecture Title Box -->
    <rect x="${marginX}" y="20" width="${contentWidth}" height="42" fill="#f5f5f5" stroke="#000000" stroke-width="1.2" />
    <text x="${width / 2}" y="38" text-anchor="middle" class="diag-title">DAWA LENS: PROPOSED MULTI-TIER SYSTEM ARCHITECTURE</text>
    <text x="${width / 2}" y="53" text-anchor="middle" class="diag-sub">Offline-First Edge-Native Mobile Presentation, Vision Pipeline, Local Relational Store, and Cloud Synchronization</text>
  `;

  // ----------------- ON-DEVICE EDGE CLIENT BOUNDARY (TIERS 1, 2, 3) -----------------
  const edgeTop = 72;
  const edgeHeight = 478;

  svg += `
    <!-- On-Device Edge Container -->
    <rect x="${marginX}" y="${edgeTop}" width="${contentWidth}" height="${edgeHeight}" fill="#fafafa" stroke="#000000" stroke-width="1.2" />
    
    <!-- Boundary Label Banner -->
    <rect x="${marginX}" y="${edgeTop}" width="${contentWidth}" height="22" fill="#eaeaea" stroke="#000000" stroke-width="0.8" />
    <text x="${width / 2}" y="${edgeTop + 15}" text-anchor="middle" class="boundary-text">
      ON-DEVICE EDGE CLIENT SUBSYSTEM (OFFLINE-FIRST EXECUTION BOUNDARY — ZERO MANDATORY CLOUD DEPENDENCY)
    </text>
  `;

  // --- TIER 1: CLIENT PRESENTATION TIER ---
  const t1Top = edgeTop + 30;
  const t1Height = 118;
  const cardY1 = t1Top + 24;
  const cardH1 = 86;
  const numCards1 = 4;
  const cardW1 = 265;
  const gap1 = (contentWidth - 24 - (numCards1 * cardW1)) / (numCards1 - 1);

  const t1Cards = [
    {
      title: "Core Mobile App (Capacitor)",
      bullets: [
        "React 18 & Vite 8 SPA Client Shell",
        "Touch-Optimized Accessible UI",
        "Deterministic Audio-Visual Dose Reminders",
        "Native Android Plugin Runtime Bridge"
      ]
    },
    {
      title: "Web Clinical Extension (PWA)",
      bullets: [
        "Responsive Tablet / Desktop Dashboard",
        "Clinical Assessment & Adherence Summary",
        "Doctor-Ready Clinical PDF Exporter",
        "Accessible Browser-Based Health View"
      ]
    },
    {
      title: "Family Hub Collaboration",
      bullets: [
        "Multi-Profile Dependent Monitoring",
        "Caregiver Remote Adherence Telemetry",
        "Real-Time Missed Dose Push Alerts",
        "Validated Dose Logging by Guardians"
      ]
    },
    {
      title: "NDA Pharmacy Refill Locator",
      bullets: [
        "Interactive Offline Map Tile Interface",
        "Verified Premises Registry Search",
        "Proactive Refill Depletion Warning",
        "Geographic Radius Proximity Query"
      ]
    }
  ];

  svg += `
    <!-- Tier 1 Container -->
    <rect x="${marginX + 10}" y="${t1Top}" width="${contentWidth - 20}" height="${t1Height}" fill="#ffffff" stroke="#000000" stroke-width="1.0" />
    <text x="${width / 2}" y="${t1Top + 16}" text-anchor="middle" class="tier-header">Tier 1: Client Presentation Tier (Android Mobile Application &amp; Clinical Web Extension)</text>
  `;

  t1Cards.forEach((c, i) => {
    const cx = marginX + 12 + i * (cardW1 + gap1);
    svg += `
      <rect x="${cx}" y="${cardY1}" width="${cardW1}" height="${cardH1}" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
      <text x="${cx + cardW1 / 2}" y="${cardY1 + 17}" text-anchor="middle" class="card-title">${c.title}</text>
      <line x1="${cx}" y1="${cardY1 + 22}" x2="${cx + cardW1}" y2="${cardY1 + 22}" stroke="#cccccc" stroke-width="0.6" />
    `;
    c.bullets.forEach((b, bi) => {
      svg += `<text x="${cx + 10}" y="${cardY1 + 36 + bi * 13}" class="bullet-text">• ${b}</text>`;
    });
  });

  // Vertical Arrow Tier 1 -> Tier 2
  svg += `
    <line x1="${width / 2}" y1="${t1Top + t1Height}" x2="${width / 2}" y2="${t1Top + t1Height + 16}" stroke="#000000" stroke-width="1.2" marker-end="url(#sa-arrow)" />
  `;

  // --- TIER 2: OFFLINE-FIRST PERSISTENCE & SCHEDULING ---
  const t2Top = t1Top + t1Height + 16;
  const t2Height = 120;
  const cardY2 = t2Top + 24;
  const cardH2 = 88;
  const numCards2 = 3;
  const cardW2 = 356;
  const gap2 = (contentWidth - 24 - (numCards2 * cardW2)) / (numCards2 - 1);

  const t2Cards = [
    {
      title: "IndexedDB Local Relational Store",
      bullets: [
        "Dexie.js Client-Side Single Source of Truth",
        "Medication Profiles, Regimens & Historical Dose Logs",
        "Patient Longitudinal Vitals & Refill Balances",
        "Zero Latency Instantaneous Sub-Second Launch"
      ]
    },
    {
      title: "Deterministic Reminder Scheduler",
      bullets: [
        "Capacitor Local Notifications Subsystem",
        "Native Android AlarmManager Exact RTC Alarms",
        "Meal-Aligned Schedule Parsing (Before / With / After)",
        "Deep Sleep & Doze Mode Wakelock Mitigation"
      ]
    },
    {
      title: "Transactional Offline Mutation Queue",
      bullets: [
        "Persistent FIFO Queue for Outbound State Changes",
        "Guaranteed Zero Data Loss on Connectivity Outages",
        "Automatic Network Online / Offline State Listener",
        "Exponential Backoff Reconnection & Sync Protocol"
      ]
    }
  ];

  svg += `
    <!-- Tier 2 Container -->
    <rect x="${marginX + 10}" y="${t2Top}" width="${contentWidth - 20}" height="${t2Height}" fill="#ffffff" stroke="#000000" stroke-width="1.0" />
    <text x="${width / 2}" y="${t2Top + 16}" text-anchor="middle" class="tier-header">Tier 2: Offline-First Persistence &amp; Deterministic Scheduling Tier</text>
  `;

  t2Cards.forEach((c, i) => {
    const cx = marginX + 12 + i * (cardW2 + gap2);
    svg += `
      <rect x="${cx}" y="${cardY2}" width="${cardW2}" height="${cardH2}" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
      <text x="${cx + cardW2 / 2}" y="${cardY2 + 17}" text-anchor="middle" class="card-title">${c.title}</text>
      <line x1="${cx}" y1="${cardY2 + 22}" x2="${cx + cardW2}" y2="${cardY2 + 22}" stroke="#cccccc" stroke-width="0.6" />
    `;
    c.bullets.forEach((b, bi) => {
      svg += `<text x="${cx + 12}" y="${cardY2 + 37 + bi * 13}" class="bullet-text">• ${b}</text>`;
    });
  });

  // Vertical Arrow Tier 2 -> Tier 3
  svg += `
    <line x1="${width / 2}" y1="${t2Top + t2Height}" x2="${width / 2}" y2="${t2Top + t2Height + 16}" stroke="#000000" stroke-width="1.2" marker-end="url(#sa-arrow)" />
  `;

  // --- TIER 3: CLINICAL PHARMACOLOGY & VISION PIPELINE ---
  const t3Top = t2Top + t2Height + 16;
  const t3Height = 120;
  const cardY3 = t3Top + 24;
  const cardH3 = 88;

  const t3Cards = [
    {
      title: "On-Device OCR & Vision Pipeline",
      bullets: [
        "Tesseract.js WebAssembly (Wasm) Engine",
        "Asynchronous Multi-Threaded Web Worker Thread",
        "Blister Strip & Unlabelled Packaging Text Ingestion",
        "Pill Physical Form Verification (Color, Score, Shape)"
      ]
    },
    {
      title: "Drug-Drug & Duplication Checker",
      bullets: [
        "Standardized NLM RxNorm Clinical Rule Engine",
        "Generic Active Ingredient Matching (ATC Level 5)",
        "Therapeutic Duplication & Toxicity Detection",
        "Multi-Tiered Severity Classification (Level 1–3)"
      ]
    },
    {
      title: "Indigenous Food-Drug Interaction Guard",
      bullets: [
        "Matooke High-Potassium & ACE-Inhibitor Hyperkalemia Rule",
        "Mukene (Silver Fish) Calcium Chelation Rule (Cipro/Doxy)",
        "Groundnut (G-Nut) Sauce Gastric Absorption Delay Warning",
        "Culturally Tailored Dietary Spacing Recommendations"
      ]
    }
  ];

  svg += `
    <!-- Tier 3 Container -->
    <rect x="${marginX + 10}" y="${t3Top}" width="${contentWidth - 20}" height="${t3Height}" fill="#ffffff" stroke="#000000" stroke-width="1.0" />
    <text x="${width / 2}" y="${t3Top + 16}" text-anchor="middle" class="tier-header">Tier 3: Clinical Pharmacology, Vision &amp; Local Decision Support Pipeline</text>
  `;

  t3Cards.forEach((c, i) => {
    const cx = marginX + 12 + i * (cardW2 + gap2);
    svg += `
      <rect x="${cx}" y="${cardY3}" width="${cardW2}" height="${cardH3}" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
      <text x="${cx + cardW2 / 2}" y="${cardY3 + 17}" text-anchor="middle" class="card-title">${c.title}</text>
      <line x1="${cx}" y1="${cardY3 + 22}" x2="${cx + cardW2}" y2="${cardY3 + 22}" stroke="#cccccc" stroke-width="0.6" />
    `;
    c.bullets.forEach((b, bi) => {
      svg += `<text x="${cx + 12}" y="${cardY3 + 37 + bi * 13}" class="bullet-text">• ${b}</text>`;
    });
  });

  // ----------------- SYNC BOUNDARY CONNECTOR (TRANSITION TO CLOUD) -----------------
  const syncY = edgeTop + edgeHeight + 15;
  svg += `
    <!-- Dashed Bidirectional Synchronization Link -->
    <line x1="${width / 2 - 380}" y1="${syncY}" x2="${width / 2 + 380}" y2="${syncY}" stroke="#000000" stroke-width="1.1" stroke-dasharray="6,4" />
    <path d="M ${width / 2 - 380} ${edgeTop + edgeHeight} L ${width / 2 - 380} ${syncY + 15}" fill="none" stroke="#000000" stroke-width="1.1" stroke-dasharray="6,4" marker-end="url(#sa-arrow)" marker-start="url(#sa-arrow-rev)" />
    <path d="M ${width / 2 + 380} ${edgeTop + edgeHeight} L ${width / 2 + 380} ${syncY + 15}" fill="none" stroke="#000000" stroke-width="1.1" stroke-dasharray="6,4" marker-end="url(#sa-arrow)" marker-start="url(#sa-arrow-rev)" />
    <path d="M ${width / 2} ${edgeTop + edgeHeight} L ${width / 2} ${syncY + 15}" fill="none" stroke="#000000" stroke-width="1.2" stroke-dasharray="6,4" marker-end="url(#sa-arrow)" marker-start="url(#sa-arrow-rev)" />
    
    <rect x="${width / 2 - 290}" y="${syncY - 11}" width="580" height="22" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
    <text x="${width / 2}" y="${syncY + 4}" text-anchor="middle" class="boundary-text" fill="#000000">
      TLS 1.3 ASYNCHRONOUS REPLICATION LINK (Wi-Fi / 4G CELLULAR — OPPORTUNISTIC SYNC)
    </text>
  `;

  // ----------------- TIER 4: CLOUD REPOSITORY & REGULATORY GATEWAY -----------------
  const t4Top = syncY + 16;
  const t4Height = 126;
  const cardY4 = t4Top + 26;
  const cardH4 = 92;

  const t4Cards = [
    {
      title: "Firebase Cloud Firestore",
      bullets: [
        "Remote Multi-Tenant User & Family Profiles",
        "Bidirectional Real-Time Caregiver Telemetry Mirroring",
        "Encrypted Cross-Device Schedule Backup",
        "Granular Role-Based Security Rules & Auth Tokens"
      ]
    },
    {
      title: "NDA Uganda Regulatory Registry",
      bullets: [
        "Verified National Drug Authority Licensed Outlets",
        "Physical Premise Addresses & Geo-Coordinates",
        "Licensing Certificate Validation & Anti-Counterfeit Index",
        "Incremental Sync with Local IndexedDB Directory"
      ]
    },
    {
      title: "Clinical AI Assistant (Cloud Fallback)",
      bullets: [
        "Gemini 2.0 Flash Multimodal Inference Gateway",
        "Luganda & English Spoken Audio Explanations",
        "Complex Prescription Advisory Fallback",
        "Bandwidth-Gated Activation (Opportunistic Only)"
      ]
    }
  ];

  svg += `
    <!-- Tier 4 Container -->
    <rect x="${marginX}" y="${t4Top}" width="${contentWidth}" height="${t4Height}" fill="#f5f5f5" stroke="#000000" stroke-width="1.2" />
    <text x="${width / 2}" y="${t4Top + 18}" text-anchor="middle" class="tier-header">Tier 4: Cloud Repository, Regulatory Gateway &amp; Telemetry Hub Tier</text>
  `;

  t4Cards.forEach((c, i) => {
    const cx = marginX + 12 + i * (cardW2 + gap2);
    svg += `
      <rect x="${cx}" y="${cardY4}" width="${cardW2}" height="${cardH4}" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
      <text x="${cx + cardW2 / 2}" y="${cardY4 + 18}" text-anchor="middle" class="card-title">${c.title}</text>
      <line x1="${cx}" y1="${cardY4 + 23}" x2="${cx + cardW2}" y2="${cardY4 + 23}" stroke="#cccccc" stroke-width="0.6" />
    `;
    c.bullets.forEach((b, bi) => {
      svg += `<text x="${cx + 12}" y="${cardY4 + 38 + bi * 13}" class="bullet-text">• ${b}</text>`;
    });
  });

  svg += `</svg>`;
  return svg;
}

// -------------------------------------------------------------
// 2. CONCEPTUAL FRAMEWORK DIAGRAM
// -------------------------------------------------------------
function generateConceptualFrameworkSvg() {
  const width = 1150;
  const height = 545;

  const defs = `
  <defs>
    <marker id="cf-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#000000" />
    </marker>
    <style>
      text {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        color: #000000;
      }
      .col-header {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 13.5px;
        font-weight: bold;
      }
      .col-sub {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 11px;
        font-style: italic;
      }
      .item-title {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 11.5px;
        font-weight: bold;
      }
      .item-desc {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 10px;
      }
    </style>
  </defs>
  `;

  const colY = 25;
  const colHeight = 390;
  const colW = 315;
  const c1X = 35;
  const c2X = 417;
  const c3X = 800;

  const cardH = 55;
  const cardW = 285;
  const cardGap = 10;
  const cardStart = colY + 48;

  const col1Items = [
    { title: "On-Device Wasm OCR Engine", desc: "Tesseract.js packaging & dosage text ingestion" },
    { title: "Offline-First Relational Datastore", desc: "IndexedDB client schema with Dexie.js persistence" },
    { title: "Deterministic Reminder Scheduler", desc: "Native exact alarm APIs (SCHEDULE_EXACT_ALARM)" },
    { title: "Indigenous Food-Drug Guard", desc: "Matooke K+ and Mukene chelation rules" },
    { title: "NDA Directory & Family Hub Sync", desc: "Licensed pharmacy verification & caregiver telemetry" }
  ];

  const col2Items = [
    { title: "Perceived Usability & Offline Access", desc: "Zero network latency & intuitive touch interaction" },
    { title: "Health Literacy & Dosing Confidence", desc: "Visual clarity, dosage confirmation & audio cues" },
    { title: "Dietary Contraindication Awareness", desc: "Proactive prevention of food-drug toxic clashes" },
    { title: "Caregiver Support & Accountability", desc: "Remote family telemetry & missed-dose alerts" },
    { title: "Regulatory Sourcing Security", desc: "Authentication of official NDA licensed dispensaries" }
  ];

  const col3Items = [
    { title: "Significant Adherence Lift (≥ 35%)", desc: "Substantial suppression of missed & delayed doses" },
    { title: "Elimination of Preventable ADRs", desc: "Prevention of drug toxicity, chelation & hyperkalemia" },
    { title: "Timely Prescription Refill Compliance", desc: "Elimination of chronic medication stockouts" },
    { title: "Reduction in Acute Readmissions", desc: "Fewer preventable emergency hospitalizations" },
    { title: "Doctor-Ready Objective Reporting", desc: "Verified longitudinal compliance exports for clinics" }
  ];

  function renderColumn(x, title, subtitle, items, bgFill = "#ffffff") {
    let out = `
      <!-- Column Container -->
      <rect x="${x}" y="${colY}" width="${colW}" height="${colHeight}" fill="${bgFill}" stroke="#000000" stroke-width="1.2" />
      <text x="${x + colW / 2}" y="${colY + 22}" text-anchor="middle" class="col-header">${title}</text>
      <text x="${x + colW / 2}" y="${colY + 36}" text-anchor="middle" class="col-sub">${subtitle}</text>
      <line x1="${x}" y1="${colY + 42}" x2="${x + colW}" y2="${colY + 42}" stroke="#000000" stroke-width="0.8" />
    `;

    items.forEach((it, idx) => {
      const iy = cardStart + idx * (cardH + cardGap);
      const ix = x + (colW - cardW) / 2;
      out += `
        <rect x="${ix}" y="${iy}" width="${cardW}" height="${cardH}" fill="#ffffff" stroke="#000000" stroke-width="0.85" />
        <text x="${ix + cardW / 2}" y="${iy + 22}" text-anchor="middle" class="item-title">${it.title}</text>
        <text x="${ix + cardW / 2}" y="${iy + 39}" text-anchor="middle" class="item-desc">${it.desc}</text>
      `;
    });

    return out;
  }

  const arrowY = colY + colHeight / 2;

  const modY = 442;
  const modH = 88;
  const modW = 1080;
  const modX = 35;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${defs}
    <rect width="${width}" height="${height}" fill="#ffffff" />

    <!-- Three Main Columns -->
    ${renderColumn(c1X, "INDEPENDENT VARIABLES", "(Dawa Lens Engineered Artifacts)", col1Items, "#ffffff")}
    ${renderColumn(c2X, "MEDIATING VARIABLES", "(User &amp; System Interaction Mechanisms)", col2Items, "#f8f8f8")}
    ${renderColumn(c3X, "DEPENDENT VARIABLES", "(Target Clinical &amp; Safety Outcomes)", col3Items, "#ffffff")}

    <!-- Primary Horizontal Connecting Arrows -->
    <line x1="${c1X + colW}" y1="${arrowY}" x2="${c2X}" y2="${arrowY}" stroke="#000000" stroke-width="1.3" marker-end="url(#cf-arrow)" />
    <line x1="${c2X + colW}" y1="${arrowY}" x2="${c3X}" y2="${arrowY}" stroke="#000000" stroke-width="1.3" marker-end="url(#cf-arrow)" />

    <!-- MODERATING FACTORS (Bottom Container) -->
    <rect x="${modX}" y="${modY}" width="${modW}" height="${modH}" fill="#f5f5f5" stroke="#000000" stroke-width="1.2" />
    <text x="${modX + modW / 2}" y="${modY + 20}" text-anchor="middle" class="col-header">MODERATING CONTEXTUAL FACTORS</text>
    <text x="${modX + modW / 2}" y="${modY + 34}" text-anchor="middle" class="col-sub">(Uganda Low-Resource Outpatient Environment)</text>
    <line x1="${modX}" y1="${modY + 39}" x2="${modX + modW}" y2="${modY + 39}" stroke="#000000" stroke-width="0.8" />

    <!-- Moderating sub-factors -->
    <rect x="${modX + 20}" y="${modY + 45}" width="325" height="35" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
    <text x="${modX + 182}" y="${modY + 60}" text-anchor="middle" class="item-title">Infrastructure Volatility</text>
    <text x="${modX + 182}" y="${modY + 73}" text-anchor="middle" class="item-desc">Cellular data &amp; grid power cuts (offline mitigations)</text>

    <rect x="${modX + 377}" y="${modY + 45}" width="325" height="35" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
    <text x="${modX + 539}" y="${modY + 60}" text-anchor="middle" class="item-title">Socio-Economic Realities</text>
    <text x="${modX + 539}" y="${modY + 73}" text-anchor="middle" class="item-desc">Low literacy &amp; unlabelled generic blister strips</text>

    <rect x="${modX + 735}" y="${modY + 45}" width="325" height="35" fill="#ffffff" stroke="#000000" stroke-width="0.8" />
    <text x="${modX + 897}" y="${modY + 60}" text-anchor="middle" class="item-title">Device Heterogeneity</text>
    <text x="${modX + 897}" y="${modY + 73}" text-anchor="middle" class="item-desc">Entry-tier smartphones with limited RAM &amp; CPU</text>

    <!-- Upward Arrow from Moderating Box to mediation column -->
    <line x1="${c2X + colW / 2}" y1="${modY}" x2="${c2X + colW / 2}" y2="${colY + colHeight}" stroke="#000000" stroke-width="1.3" stroke-dasharray="4,3" marker-end="url(#cf-arrow)" />
  </svg>
  `;
}

// -------------------------------------------------------------
// 3. MULTI-ACTOR SYSTEM UML USE CASE DIAGRAM
// -------------------------------------------------------------
function generateUseCaseDiagramSvg() {
  const width = 1180;
  const height = 700;

  const defs = `
  <defs>
    <marker id="uc-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#000000" />
    </marker>
    <style>
      text {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        color: #000000;
      }
      .actor-name {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 12px;
        font-weight: bold;
      }
      .actor-role {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 9.5px;
        font-style: italic;
      }
      .boundary-title {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 13.5px;
        font-weight: bold;
      }
      .uc-text {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 10.5px;
        font-weight: 500;
      }
      .rel-text {
        font-family: 'LMRoman10', 'Latin Modern Roman', 'Times New Roman', 'Nimbus Roman', serif;
        font-size: 8.5px;
        font-style: italic;
      }
    </style>
  </defs>
  `;

  function renderActor(x, y, label, role) {
    return `
      <!-- Stick Figure Actor -->
      <circle cx="${x}" cy="${y - 30}" r="14" fill="#ffffff" stroke="#000000" stroke-width="1.2" />
      <line x1="${x}" y1="${y - 16}" x2="${x}" y2="${y + 16}" stroke="#000000" stroke-width="1.2" />
      <line x1="${x - 20}" y1="${y - 3}" x2="${x + 20}" y2="${y - 3}" stroke="#000000" stroke-width="1.2" />
      <line x1="${x}" y1="${y + 16}" x2="${x - 14}" y2="${y + 42}" stroke="#000000" stroke-width="1.2" />
      <line x1="${x}" y1="${y + 16}" x2="${x + 14}" y2="${y + 42}" stroke="#000000" stroke-width="1.2" />
      <text x="${x}" y="${y + 58}" text-anchor="middle" class="actor-name">${label}</text>
      <text x="${x}" y="${y + 72}" text-anchor="middle" class="actor-role">${role}</text>
    `;
  }

  // System Boundary
  const bX = 170;
  const bY = 25;
  const bW = 840;
  const bH = 665;

  // Use Case Centers
  const col1X = 365;
  const col2X = 815;
  const rx = 135;
  const ry = 19;

  // Actors positions
  const pX = 85;
  const pY = 220;
  const cX = 85;
  const cY = 560;
  const docX = 1095;
  const docY = 210;
  const phX = 1095;
  const phY = 510;

  const ucs = [
    // --- Column 1 Top: Outpatient (Self-Care & Safety) ---
    { id: 'uc1', cx: col1X, cy: 98, text: 'Scan Packaging & Ingest Form (FR1)' },
    { id: 'uc2', cx: col1X, cy: 160, text: 'Extract OCR & RxNorm Guard (FR4)' },
    { id: 'uc3', cx: col1X, cy: 222, text: 'Schedule Exact Dosing Reminders (FR2)' },
    { id: 'uc4', cx: col1X, cy: 284, text: 'Log Dosing Intake & History' },
    { id: 'uc5', cx: col1X, cy: 346, text: 'Screen Indigenous Food Clashes (FR3)' },
    { id: 'uc6', cx: col1X, cy: 408, text: 'Track Vitals & Adverse Symptoms (FR8)' },

    // --- Column 1 Bottom: Family Caregiver Telemetry ---
    { id: 'uc7', cx: col1X, cy: 490, text: 'Monitor Dependent Adherence (FR5)' },
    { id: 'uc8', cx: col1X, cy: 552, text: 'Log Assisted Caregiver Dose Intake' },
    { id: 'uc9', cx: col1X, cy: 614, text: 'Receive Real-Time Missed Dose Alerts' },

    // --- Column 2 Top: Healthcare Clinical Consultation ---
    { id: 'uc10', cx: col2X, cy: 210, text: 'Export Doctor-Ready Clinical PDF (FR7)' },

    // --- Column 2 Bottom: Community Pharmacy & NDA Registry ---
    { id: 'uc11', cx: col2X, cy: 470, text: 'Search Licensed NDA Pharmacies (FR6)' },
    { id: 'uc12', cx: col2X, cy: 545, text: 'Verify Pharmacy Licensing & Premise ID' }
  ];

  let svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${defs}
    <rect width="${width}" height="${height}" fill="#ffffff" />

    <!-- ================= SYSTEM BOUNDARY ================= -->
    <rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" fill="#fafafa" stroke="#000000" stroke-width="1.2" />
    <rect x="${bX}" y="${bY}" width="${bW}" height="32" fill="#f0f0f0" stroke="#000000" stroke-width="0.8" />
    <text x="${bX + bW / 2}" y="${bY + 21}" text-anchor="middle" class="boundary-title">DAWA LENS SYSTEM BOUNDARY (USE CASE SPECIFICATION)</text>

    <!-- Subsystem grouping labels -->
    <rect x="${bX + 1}" y="${bY + 32}" width="${bW / 2 - 1}" height="24" fill="#f7f7f7" />
    <rect x="${bX + bW / 2}" y="${bY + 32}" width="${bW / 2 - 1}" height="24" fill="#f7f7f7" />
    <text x="${col1X}" y="${bY + 48}" text-anchor="middle" font-size="9px" font-weight="bold" fill="#444444" letter-spacing="0.5px">PATIENT &amp; CAREGIVER MOBILE SERVICES</text>
    <text x="${col2X}" y="${bY + 48}" text-anchor="middle" font-size="9px" font-weight="bold" fill="#444444" letter-spacing="0.5px">CLINICAL &amp; PHARMACEUTICAL ECOSYSTEM</text>
    <line x1="${bX}" y1="${bY + 56}" x2="${bX + bW}" y2="${bY + 56}" stroke="#e0e0e0" stroke-width="0.8" />
    <line x1="${bX + bW / 2}" y1="${bY + 32}" x2="${bX + bW / 2}" y2="${bY + bH}" stroke="#dddddd" stroke-width="0.8" stroke-dasharray="4,4" />

    <!-- ================= ACTORS ================= -->
    <!-- Left Actors -->
    ${renderActor(pX, pY, "Outpatient (Patient)", "Primary App User")}
    ${renderActor(cX, cY, "Family Caregiver", "Treatment Guardian")}

    <!-- Right Actors -->
    ${renderActor(docX, docY, "Healthcare Clinician", "Attending Doctor / Nurse")}
    ${renderActor(phX, phY, "Community Pharmacist", "Licensed Dispensary Officer")}

    <!-- ================= USE CASES ================= -->
  `;

  ucs.forEach(u => {
    svg += `
      <ellipse cx="${u.cx}" cy="${u.cy}" rx="${rx}" ry="${ry}" fill="#ffffff" stroke="#000000" stroke-width="1.0" />
      <text x="${u.cx}" y="${u.cy + 4}" text-anchor="middle" class="uc-text">${u.text}</text>
    `;
  });

  // ================= ASSOCIATIONS (SOLID LINES) =================
  svg += `
    <!-- Patient Associations -->
    <line x1="${pX + 22}" y1="${pY - 20}" x2="${col1X - rx}" y2="98" stroke="#000000" stroke-width="1.0" />
    <line x1="${pX + 22}" y1="${pY}" x2="${col1X - rx}" y2="222" stroke="#000000" stroke-width="1.0" />
    <line x1="${pX + 22}" y1="${pY + 12}" x2="${col1X - rx}" y2="284" stroke="#000000" stroke-width="1.0" />
    <line x1="${pX + 22}" y1="${pY + 24}" x2="${col1X - rx}" y2="346" stroke="#000000" stroke-width="1.0" />
    <line x1="${pX + 22}" y1="${pY + 36}" x2="${col1X - rx}" y2="408" stroke="#000000" stroke-width="1.0" />

    <!-- Patient Cross-System Associations -->
    <path d="M ${col1X + rx} 284 C 570 284, 610 215, ${col2X - rx} 210" fill="none" stroke="#000000" stroke-width="0.8" stroke-dasharray="3,2" />
    <path d="M ${col1X + rx} 408 C 560 408, 610 470, ${col2X - rx} 470" fill="none" stroke="#000000" stroke-width="0.8" stroke-dasharray="3,2" />

    <!-- Family Caregiver Associations -->
    <line x1="${cX + 22}" y1="${cY - 25}" x2="${col1X - rx}" y2="490" stroke="#000000" stroke-width="1.0" />
    <line x1="${cX + 22}" y1="${cY}" x2="${col1X - rx}" y2="552" stroke="#000000" stroke-width="1.0" />
    <line x1="${cX + 22}" y1="${cY + 25}" x2="${col1X - rx}" y2="614" stroke="#000000" stroke-width="1.0" />

    <!-- Clinician Association (Receives Doctor-Ready Clinical PDF) -->
    <line x1="${docX - 22}" y1="${docY}" x2="${col2X + rx}" y2="210" stroke="#000000" stroke-width="1.0" />

    <!-- Pharmacist Associations -->
    <line x1="${phX - 22}" y1="${phY - 15}" x2="${col2X + rx}" y2="470" stroke="#000000" stroke-width="1.0" />
    <line x1="${phX - 22}" y1="${phY + 15}" x2="${col2X + rx}" y2="545" stroke="#000000" stroke-width="1.0" />

    <!-- ================= INCLUDE / EXTEND RELATIONSHIPS ================= -->
    <!-- UC1 -> UC2 <<include>> -->
    <line x1="${col1X}" y1="117" x2="${col1X}" y2="141" stroke="#000000" stroke-width="1.0" stroke-dasharray="4,3" marker-end="url(#uc-arrow)" />
    <text x="${col1X + 8}" y="132" class="rel-text">&lt;&lt;include&gt;&gt;</text>

    <!-- UC7 -> UC9 <<include>> -->
    <path d="M ${col1X + rx - 10} 498 C ${col1X + rx + 30} 538, ${col1X + rx + 30} 570, ${col1X + rx - 10} 606" fill="none" stroke="#000000" stroke-width="0.9" stroke-dasharray="4,3" marker-end="url(#uc-arrow)" />
    <text x="${col1X + rx + 34}" y="555" class="rel-text">&lt;&lt;include&gt;&gt;</text>

    <!-- UC11 -> UC12 <<include>> (Searching pharmacies includes premise verification) -->
    <line x1="${col2X}" y1="489" x2="${col2X}" y2="526" stroke="#000000" stroke-width="1.0" stroke-dasharray="4,3" marker-end="url(#uc-arrow)" />
    <text x="${col2X + 8}" y="511" class="rel-text">&lt;&lt;include&gt;&gt;</text>
  `;

  svg += `</svg>`;
  return svg;
}

// -------------------------------------------------------------
// MAIN RENDER RUNNER
// -------------------------------------------------------------
async function run() {
  console.log('Generating accurate Dawa Lens diagrams (Architecture, Framework, Use Case)...');

  const sysArchSvg = generateSystemArchitectureSvg();
  const cfSvg = generateConceptualFrameworkSvg();
  const ucSvg = generateUseCaseDiagramSvg();

  fs.writeFileSync(path.join(figuresDir, 'system_architecture.svg'), sysArchSvg, 'utf8');
  fs.writeFileSync(path.join(figuresDir, 'conceptual_framework.svg'), cfSvg, 'utf8');
  fs.writeFileSync(path.join(figuresDir, 'use_case_diagram.svg'), ucSvg, 'utf8');
  console.log('SVGs saved.');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1250, height: 850 },
    deviceScaleFactor: 2.5
  });

  async function renderSvgToPng(svgContent, outPngName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `;
    await page.setContent(html);
    const svgEl = await page.$('svg');
    const outPath = path.join(figuresDir, outPngName);
    await svgEl.screenshot({ path: outPath, omitBackground: false });
    console.log(`Rendered: ${outPngName}`);
  }

  await renderSvgToPng(sysArchSvg, 'system_architecture.png');
  await renderSvgToPng(cfSvg, 'conceptual_framework.png');
  await renderSvgToPng(ucSvg, 'use_case_diagram.png');

  await browser.close();
  console.log('All figures rendered successfully in academic style!');
}

run().catch(err => {
  console.error('Render error:', err);
  process.exit(1);
});
