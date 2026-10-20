<div align="center">

<img src="public/assets/readme/logo-animated.svg" alt="Dawa Lens — Animated Logo & Core Pillars" width="100%" />

<br />

# Dawa Lens

**A personal pharmacist in your pocket, built for patients and families in Uganda.**

[![Version](https://img.shields.io/badge/version-1.8.2-0ea5e9?style=flat-square)](package.json)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Rust](https://img.shields.io/badge/Rust-JNI%20Search-DEA584?style=flat-square&logo=rust&logoColor=black)](rust/README.md)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.14-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Live Web App](https://img.shields.io/badge/Live%20App-dawalens256.vercel.app-10b981?style=flat-square&logo=vercel&logoColor=white)](https://dawalens256.vercel.app)

[Explore the Live App](https://dawalens256.vercel.app) · [What It Does](#-what-dawa-lens-does) · [Under the Hood](#-how-it-works-under-the-hood) · [Quick Start](#-getting-started) · [Rust Offline Engine](rust/README.md)

</div>

---

## Why We Built This

If you have ever cared for an older parent in Uganda or managed a multi-drug prescription yourself, you already know how easily things go wrong. Clinics and pharmacies often dispense loose tablets in small paper envelopes with a few numbers scribbled on the front (`2 x 3`). Two days later, the ink smudges, blister foils get separated from their boxes, and nobody is quite sure which capsule is the antibiotic and which one is for blood pressure.

Most pill reminder apps treat medication safety like an alarm clock problem. They ring a bell at 8:00 AM, assuming you have steady internet, a brand-new phone that never kills background apps, and prescriptions from a Western pharmacy chain.

**Dawa Lens** was built for how people actually live and take medicine across East Africa:

- **Point your camera at a pill or blister strip** to see what it is, what strength it carries, and how to take it.
- **Check interactions with everyday Ugandan meals**—like knowing that calcium-rich *mukene* (silver fish) can block ciprofloxacin absorption, or that potassium-rich *matooke* needs caution alongside certain blood pressure drugs.
- **Keep alarms alive on real Android phones** (including Tecno, Infinix, Xiaomi, or Samsung handsets) using a native Kotlin foreground watchdog that operating system battery savers do not silently kill.
- **Work without mobile data** by running OCR in a background WebWorker, fuzzy-matching drug names in under a millisecond through a compiled Rust library (`libdawa_search.so`), and evaluating clinical rules on the device when the network drops.

<br />

<div align="center">
  <img src="public/assets/readme/vision-scanner-hero.jpg" alt="Scanning a blister pack and capsule with Dawa Lens" width="100%" />
  <p><em>Point your phone at a blister pack or loose capsule to read its imprint and check for interactions in seconds.</em></p>
</div>

---

## ✨ What Dawa Lens Does

### 1. Visual Pill & Prescription Scanner
Instead of typing long chemical names by hand, you can snap a photo of a pill, blister foil, or prescription slip.
- **On-device OCR**: A dedicated `Tesseract.js` WebWorker reads packaging text, strengths (like `500mg`), expiry dates, and NDA/NAFDAC registration numbers without freezing the screen.
- **Cloud Vision Cascade**: When you are online, multimodal models (Llama Vision via Groq and Google Gemini 2.0/2.5 Flash) inspect pill imprints and physical markings. If the connection takes longer than 2.5 seconds, Dawa Lens falls back to its local rule engine so you are never left waiting.
- **Sub-millisecond Rust Fuzzy Search**: Misspelled or partially read OCR strings pass through `dawa-search`, a native Rust library compiled to Android JNI that runs Jaro-Winkler similarity against the Uganda Essential Medicines List (EMLU) and WHO Model List.

---

### 2. Local Diet & Drug Interaction Guard
Taking two incompatible drugs, or pairing the right pill with the wrong meal, can make a treatment fail or cause avoidable side effects. Every time you add a medicine to your cabinet, Dawa Lens cross-checks your active prescriptions against NIH RxNorm, OpenFDA, and a local clinical rule table.

<div align="center">
  <img src="public/assets/readme/uganda-care-ecosystem.jpg" alt="Ugandan dietary interaction checks, caregiver sync, and NDA pharmacy locator" width="100%" />
  <p><em>Culturally grounded food-drug checks, real-time family dose updates, and verified NDA Uganda pharmacies.</em></p>
</div>

What makes this guard practical in Uganda is that it knows local food:
- **Mukene (Silver Fish) & Tetracyclines / Fluoroquinolones**: Flags calcium chelation with drugs like doxycycline and ciprofloxacin so you know to space your dose by two hours.
- **Steamed Matooke & ACE Inhibitors / Potassium-Sparing Diuretics**: Warns patients on lisinopril, enalapril, or spironolactone when high potassium intake could become risky.
- **Groundnut (G-Nut) Sauce & Fat-Sensitive Regimens**: Notes delayed gastric emptying or altered absorption where timing with meals matters.

---

### 3. DawaGPT — An AI Pharmacist That Knows Your Cabinet

<img src="public/dawa-gpt.webp" alt="DawaGPT Assistant" width="130" align="right" />

Asking a general-purpose chatbot about a symptom usually gives you a textbook wall of disclaimers because it has no idea what medicines you are actually taking.

**DawaGPT** reads from your active medicine cabinet and recent dose logs before answering. You can ask plain questions in **English, Luganda, or Swahili**:
- *"Can I take my morning tablet with milk or chai?"*
- *"I forgot my 8:00 AM dose and it is now 1:00 PM—should I take it now or wait?"*
- *"I started feeling dizzy two days after adding this new capsule. Could they be related?"*

Before any question leaves your phone, personal identifiers (names, phone numbers, national IDs) are stripped from the prompt. If a message describes warning signs of a medical emergency, DawaGPT stops speculating and directs you straight to emergency care.

---

### 4. Family Hub & Caregiver Sync
Caregiving is rarely a solo job. One sibling might buy the refills in Kampala while another lives with a parent upcountry.
- **Shared Dependent Profiles**: Manage children, aging parents, or chronic-care patients from one account with separate schedules and stock counters.
- **Live Dose Confirmations**: When a parent taps **Take Dose** on their notification, family caregivers see the confirmation sync through Cloud Firestore.
- **Doctor-Ready PDF Summaries**: Before a clinic visit, export a clean PDF report showing active medications, 30-day adherence rates, and logged side effects.

---

### 5. NDA Uganda Licensed Pharmacy Locator & Travel Map
- **1,800+ Verified NDA Pharmacies**: Scraped and geo-indexed from the official National Drug Authority (NDA) Uganda register. You can sort licensed pharmacies by Haversine distance even when offline and log refills straight into your `MedVault`.
- **Timezone Drift Protection**: Crossing timezones on an 8-hour antibiotic or antiretroviral schedule can cause accidental double-dosing. The `TravelMap` companion (built on `MapLibre GL` and offline `PMTiles`) recalculates dose intervals as you travel.

---

## 🔧 How It Works Under the Hood

<div align="center">
  <img src="public/assets/readme/offline-guardian-flow.svg" alt="Dawa Lens 4-Stage Offline-First Pipeline" width="100%" />
</div>

<br />

Web apps wrapped in Capacitor often fail at medication reminders because mobile operating systems aggressively kill background web views to save battery. Dawa Lens solves this by splitting the workload across four layers:

1. **Native Kotlin Watchdog (`android/`)**:
   - `AdherenceGuardianService.kt` runs as an Android foreground service (`FOREGROUND_SERVICE_TYPE_DATA_SYNC`) that survives Xiaomi MIUI, Samsung OneUI, and Transsion (Tecno/Infinix HiOS) battery killers.
   - `NativeRecurrenceEngine.kt` schedules exact OS-level alarms via `AlarmManager.setExactAndAllowWhileIdle()`.
   - `NativeActionReceiver.kt` handles **Take**, **Snooze (15m)**, and **Skip** taps directly from the notification tray without spinning up the Chromium engine.
2. **Rust JNI Search (`rust/`)**:
   - `libdawa_search.so` compiles for `arm64-v8a`, `armeabi-v7a`, and `x86_64`, matching noisy OCR text against essential medicines in under a millisecond with zero network calls.
3. **Offline-First Client (`src/`)**:
   - React 18, TypeScript 5.8, Zustand, TanStack Query v5, and encrypted IndexedDB storage keep the app usable with zero connectivity and sync deltas to Firestore once a connection returns.
4. **Express API & Multi-Provider AI Gateway (`server/`)**:
   - Shields API keys, enforces token-bucket rate limits and Helmet CSP headers, and routes clinical queries across Groq, Google Gemini, Cerebras, SambaNova, or OpenFDA.

<details>
<summary><strong>📐 View Full System Architecture Diagram (Mermaid)</strong></summary>
<br />

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#1e293b',
    'primaryTextColor': '#f8fafc',
    'primaryBorderColor': '#38bdf8',
    'lineColor': '#64748b',
    'secondaryColor': '#0f172a',
    'tertiaryColor': '#1e1b4b',
    'clusterBkg': '#0b1120',
    'clusterBorder': '#334155',
    'edgeLabelBackground': '#1e293b',
    'fontFamily': 'Inter, system-ui, -apple-system, sans-serif',
    'fontSize': '12px'
  }
}}%%
flowchart TD
    subgraph ClientUI ["📱 Presentation & UI Layer · React 18 + Vite 8"]
        UI_Dash(["<b>📊 Dashboard & Analytics</b><br/><span style='font-size:10px;color:#94a3b8'>Tailwind CSS 3.4 · Radix UI · Framer Motion</span>"]):::client
        UI_Vault["<b>💊 MedVault & Refills</b><br/><span style='font-size:10px;color:#94a3b8'>Uganda NDA Directory · Geo-Locator</span>"]:::client
        UI_Scan["<b>📷 Visual Scanner Studio</b><br/><span style='font-size:10px;color:#94a3b8'>Blister Pack & Pill Capture · WebWorker OCR</span>"]:::focal
        UI_Chat["<b>🧠 DawaGPT Assistant</b><br/><span style='font-size:10px;color:#94a3b8'>Context-Aware · English / Luganda / Swahili</span>"]:::client
        UI_Travel["<b>✈️ TravelMap Companion</b><br/><span style='font-size:10px;color:#94a3b8'>MapLibre GL · Timezone Drift Recomputation</span>"]:::client
        UI_Family["<b>👨‍👩‍👧 Family Hub</b><br/><span style='font-size:10px;color:#94a3b8'>Multi-Dependent · Caregiver Sync</span>"]:::client
    end

    subgraph AndroidLayer ["⚡ Native Android & Rust Core · Capacitor 8 + Kotlin + JNI"]
        K_Guardian[["<b>🛡️ AdherenceGuardianService</b><br/><span style='font-size:10px;color:#c084fc'>Foreground Watchdog · Persistent Notification</span>"]]:::native
        K_Engine[["<b>⏰ NativeRecurrenceEngine</b><br/><span style='font-size:10px;color:#c084fc'>On-Device AlarmManager · Exact Alarms</span>"]]:::native
        K_Receiver[["<b>🎯 NativeActionReceiver</b><br/><span style='font-size:10px;color:#c084fc'>Headless Action: Take / Snooze / Skip</span>"]]:::native
        K_Rust[["<b>🦀 libdawa_search.so (Rust)</b><br/><span style='font-size:10px;color:#c084fc'>Sub-ms Jaro-Winkler EMLU Fuzzy Match</span>"]]:::native
    end

    subgraph OfflineSync ["💾 Client State & Offline Persistence Tier"]
        S_Query[("<b>⚡ State & Query Cache</b><br/><span style='font-size:10px;color:#34d399'>TanStack Query v5 · Zustand Store</span>")]:::offline
        S_Storage[("<b>🗄️ Local Storage</b><br/><span style='font-size:10px;color:#34d399'>IndexedDB · Capacitor Preferences</span>")]:::offline
        S_Fallback{{"<b>🔬 LocalClinicalAssessment</b><br/><span style='font-size:10px;color:#34d399'>Offline Fallback · Diet & Drug Rules</span>"}}:::offlineHighlight
        S_OCR[["<b>📜 Tesseract.js OCR Worker</b><br/><span style='font-size:10px;color:#34d399'>Isolated Background WebWorker Thread</span>"]]:::offline
    end

    subgraph BackendAPI ["🚀 Backend API Gateway · Node.js 24 + Express 4.21"]
        API_Gate[["<b>🛡️ Express API Gateway</b><br/><span style='font-size:10px;color:#fbbf24'>Rate Limiter · Helmet Security Headers</span>"]]:::gateway
        API_Auth["<b>🔑 Firebase Admin JWT Guard</b><br/><span style='font-size:10px;color:#fbbf24'>Token & Scope Verification</span>"]:::gateway
        API_Cascade[["<b>🔀 Multi-Tier AI Cascade</b><br/><span style='font-size:10px;color:#fbbf24'>Groq · Gemini · 2.5s Timeout Fallback</span>"]]:::gateway
    end

    subgraph ExternalServices ["☁️ Cloud Infrastructure & Clinical Registries"]
        C_Firestore[("<b>🔥 Cloud Firestore</b><br/><span style='font-size:10px;color:#818cf8'>Delta Sync · Role-Based Security Rules</span>")]:::cloud
        C_Gemini[["<b>🤖 Groq & Google Gemini Flash</b><br/><span style='font-size:10px;color:#818cf8'>Multimodal Pill & Imprint Detection</span>"]]:::cloud
        C_RxNorm[("<b>🏛️ NIH RxNorm & OpenFDA</b><br/><span style='font-size:10px;color:#818cf8'>Clinical Drug Interaction Matrix</span>")]:::cloud
        C_NDA[("<b>🇺🇬 Uganda NDA Registry</b><br/><span style='font-size:10px;color:#818cf8'>1,800+ Licensed Pharmacies Directory</span>")]:::cloud
    end

    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef focal fill:#1e1b4b,stroke:#ec4899,stroke-width:2px,color:#fdf2f8;
    classDef native fill:#1e1b4b,stroke:#a855f7,stroke-width:1.8px,color:#f8fafc;
    classDef offline fill:#062b21,stroke:#10b981,stroke-width:1.5px,color:#f8fafc;
    classDef offlineHighlight fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ecfdf5;
    classDef gateway fill:#2a1a05,stroke:#f59e0b,stroke-width:1.5px,color:#f8fafc;
    classDef cloud fill:#0d1836,stroke:#60a5fa,stroke-width:1.5px,color:#f8fafc;

    style ClientUI fill:#080d1a,stroke:#0284c7,stroke-width:1.5px,stroke-dasharray: 4 2,color:#38bdf8;
    style AndroidLayer fill:#10091d,stroke:#9333ea,stroke-width:1.5px,stroke-dasharray: 4 2,color:#c084fc;
    style OfflineSync fill:#061410,stroke:#059669,stroke-width:1.5px,stroke-dasharray: 4 2,color:#34d399;
    style BackendAPI fill:#140e04,stroke:#d97706,stroke-width:1.5px,stroke-dasharray: 4 2,color:#fbbf24;
    style ExternalServices fill:#091024,stroke:#4f46e5,stroke-width:1.5px,stroke-dasharray: 4 2,color:#818cf8;

    ClientUI ==>|Capacitor Bridge & JNI| AndroidLayer
    ClientUI -->|Local Queries| OfflineSync
    AndroidLayer -->|Alarm Signals| OfflineSync

    OfflineSync --> S_Storage
    S_Storage <==>|HTTPS Delta Sync| C_Firestore
    OfflineSync -->|Authenticated REST| API_Gate

    API_Gate --> API_Auth
    API_Gate --> API_Cascade

    API_Cascade -->|Multimodal Inference| C_Gemini
    API_Cascade -->|Interaction Lookup| C_RxNorm
    UI_Scan -.->|Fallback <2.5s| S_Fallback
    UI_Scan -->|Background Worker| S_OCR
    UI_Vault -->|Haversine Proximity Query| C_NDA
```

</details>

---

## 🗂️ Project Layout

```text
dawa-lens/
├── src/                          # Frontend application (React 18 + TypeScript + Vite 8)
│   ├── components/               # UI components (Scanner, DawaGPT, FDA search, Travel, Wellness)
│   ├── contexts/                 # Auth, App state, Multilingual (EN/LG/SW), and Theme contexts
│   ├── hooks/                    # Custom hooks for sensors, network state, and data queries
│   ├── pages/                    # Route views (Dashboard, Scan, Medications, Family, Pharmacies)
│   ├── services/                 # Offline clinical assessment, OCR worker, NDA pharmacy locator
│   └── types/                    # Shared TypeScript definitions
├── server/                       # Express API gateway (Node.js >= 24.14)
│   └── src/
│       ├── middleware/           # Firebase JWT verification, rate limiters, error handlers
│       ├── routes/               # REST endpoints (/api/v1/vision, /ai, /fda, /medicines, etc.)
│       └── index.js              # Express entrypoint and security middleware
├── android/                      # Native Android project (Kotlin guardian service & exact alarms)
├── rust/                         # Rust crate (dawa-search) for sub-ms offline Jaro-Winkler search
├── scripts/                      # Python scrapers & data fusion scripts for NDA Uganda pharmacies
├── firestore.rules               # Role-based Firestore security rules
└── capacitor.config.ts           # Capacitor 8 native bridge configuration
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** `>= 24.14.1` and `npm` (or `bun`)
- **Firebase project** with Authentication and Firestore enabled
- **Android Studio + JDK 17+** *(optional, only needed when building the native Android app)*
- **Rust + `cargo-ndk`** *(optional, only needed if recompiling `rust/src/search.rs`)*

### 1. Clone and install dependencies

```bash
git clone https://github.com/EmmahOwens/dawa-lens.git
cd dawa-lens

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the repository root for the Vite frontend:

```env
VITE_FIREBASE_API_KEY="your-firebase-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"

# Backend API URL (defaults to localhost:5000/api/v1 in development)
VITE_API_URL=http://localhost:5000/api/v1
```

Create `server/.env` for the Express gateway:

```env
PORT=5000
NODE_ENV=development
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENFDA_API_KEY=your_optional_openfda_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### 3. Run locally

Open two terminals:

```bash
# Terminal 1 — Start the Express API server (http://localhost:5000)
cd server
npm run dev
```

```bash
# Terminal 2 — Start the Vite frontend (http://localhost:5173)
npm run dev
```

### 4. Build for Android (Optional)

```bash
npm run cap:sync
npx cap open android
```

If you edit the offline drug index in `rust/src/search.rs`, rebuild the JNI shared libraries with:

```bash
cd rust && ./build-android.sh
```

---

## 🛠️ Common Scripts

| Command | Directory | What it does |
| :--- | :--- | :--- |
| `npm run dev` | `/` | Start the Vite development server with hot reload |
| `npm run build` | `/` | Build production web bundle into `dist/` |
| `npm run test` | `/` | Run the Vitest unit and integration test suite |
| `npm run test:watch` | `/` | Run Vitest in interactive watch mode |
| `npm run lint` | `/` | Check TypeScript and React files with ESLint |
| `npm run cap:sync` | `/` | Build web assets and sync them to the Capacitor Android project |
| `npm run scrape:nda` | `/` | Refresh the licensed pharmacy list from the Uganda NDA registry |
| `npm run deploy:web` | `/` | Build and deploy the web app to Firebase Hosting |
| `npm run dev` | `/server` | Run the Express API server with Nodemon |
| `npm start` | `/server` | Run the Express API server in production mode |

---

## 🔒 Privacy, Security & Clinical Boundaries

- **Medical Disclaimer**: Dawa Lens is a clinical support and medication adherence tool, not a replacement for a licensed physician or pharmacist. Emergency symptoms trigger immediate referrals to local emergency services.
- **PII Stripping Before AI Calls**: Personal identifiers are removed before medication or symptom context is sent to cloud LLM providers.
- **Scoped Firestore Rules**: `firestore.rules` enforces strict document ownership so patients and authorized family caregivers can only access permitted records.
- **Hardened Gateway**: The Express API enforces `helmet` security headers, strict CORS origin checks, `zod` schema validation, and route-specific rate limiters (`/vision`, `/ai`, `/fda`, `/users`).

---

<div align="center">

**Built with care for patients and families across Uganda.**  
© 2026 Dawa Lens Team · [Live Web App](https://dawalens256.vercel.app)

</div>
