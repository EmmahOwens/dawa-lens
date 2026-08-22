# 💊 Dawa Lens — Intelligence-Driven Medication Safety & Care Ecosystem

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.14-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](LICENSE)

> **Empowering patients, families, and healthcare providers across East Africa and beyond with instant computer vision medication recognition, real-time drug interaction safeguards, context-aware AI clinical support, and synchronized family caregiving.**

---

## 📖 Table of Contents

- [The Story & Mission](#-the-story--mission)
- [Why Dawa Lens?](#-why-dawa-lens)
- [Core Capabilities](#-core-capabilities)
  - [1. Visual Pill & Prescription Scanner](#1-visual-pill--prescription-scanner)
  - [2. DawaGPT — Context-Aware Clinical AI](#2-dawagpt--context-aware-clinical-ai)
  - [3. Drug & Food Interaction Guard](#3-drug--food-interaction-guard)
  - [4. Family Hub & Caregiver Network](#4-family-hub--caregiver-network)
  - [5. Intelligent Reminders & Travel Companion](#5-intelligent-reminders--travel-companion)
  - [6. Holistic Wellness Journal & Adherence Analytics](#6-holistic-wellness-journal--adherence-analytics)
  - [7. Doctor-Ready Clinical Reports](#7-doctor-ready-clinical-reports)
  - [8. Offline-First Resilience & Live Updates](#8-offline-first-resilience--live-updates)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Database & Data Architecture](#-database--data-architecture)
- [Getting Started & Local Development](#-getting-started--local-development)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Available Scripts](#-available-scripts)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Deployment & Distribution](#-deployment--distribution)
- [Security, Privacy & Data Protection](#-security-privacy--data-protection)
- [Contributing & Code Standards](#-contributing--code-standards)
- [License & Acknowledgments](#-license--acknowledgments)

---

## 🌍 The Story & Mission

In East Africa and many healthcare systems worldwide, managing multiple prescriptions is fraught with preventable risks. Unlabelled generic packages, faded prescription slips, missed doses during hectic routines, and dangerous drug-drug or drug-food interactions frequently lead to avoidable complications and hospital readmissions.

**Dawa Lens** was conceived to solve these challenges at their root. By bridging high-performance mobile engineering with modern multimodal artificial intelligence, Dawa Lens transforms any everyday smartphone into a vigilant, empathetic personal pharmacist. Whether you are managing your own chronic condition, caring for an aging parent, or coordinating treatments for your children, Dawa Lens brings clarity, confidence, and peace of mind to every single dose.

---

## 💡 Why Dawa Lens?

Traditional medication apps are often little more than rigid alarm clocks. They fail to understand what medication is actually in your hand, ignore how different drugs interact, and break down when network connectivity drops or when traveling across timezones.

Dawa Lens takes a fundamentally holistic approach:

* **It Sees:** State-of-the-art on-device OCR and vision AI analyze pill shapes, colors, markings, and blister packs in seconds.
* **It Understands:** Built-in intelligence doesn't just check a box—it cross-references your complete regimen with clinical databases and FDA interaction catalogs.
* **It Protects:** Proactive warnings flag adverse drug combinations, duplicate therapies, and food contraindications before ingestion.
* **It Connects:** Caregivers and family members share synchronized visibility into adherence, ensuring vulnerable loved ones never miss critical treatments.
* **It Adapts:** Timezone-shifting algorithms and battery-optimization-resilient alerts guarantee notifications trigger accurately whether you're at home, offline, or flying abroad.

---

## ✨ Core Capabilities

### 1. Visual Pill & Prescription Scanner
- **Dual-Engine Recognition**: Combines client-side `Tesseract.js` for ultra-fast text extraction with cloud multimodal LLMs (Llama 3/4 via Groq and Google Gemini 2.0 Flash fallback) to identify medications from packaging, blister foils, or loose pills.
- **Instant Dosage & Direction Parsing**: Automatically extracts medication names, strengths (e.g., `500mg`), dosages, frequencies, and expiry dates directly into your inventory.
- **Barcode & QR Integration**: Supports rapid lookup via standard pharmaceutical codes.

### 2. DawaGPT — Context-Aware Clinical AI
- **Holistic Patient Context**: Unlike generic AI chatbots, DawaGPT has real-time awareness of your active medicine cabinet, recent dose logs, reported symptoms, and wellness history.
- **Plain-Language Explanations**: Translates dense medical jargon and side-effect leaflets into clear, digestible guidance.
- **Multi-Turn Dialogue**: Ask follow-up questions such as *"Can I take this with milk?"*, *"What should I do if I missed my morning dose?"*, or *"Why is my head hurting after taking this new pill?"*.
- **Clinical Safeguards**: Built with strict boundary prompts ensuring critical emergency queries are immediately directed to emergency medical services.

### 3. Drug & Food Interaction Guard
- **Automated Regimen Scanning**: Every time a new medication is added, Dawa Lens runs deep interaction cross-checks against all active medications.
- **Severity Stratification**: Highlights interactions categorized from mild considerations to severe contraindications with actionable recommendations.
- **Dietary & Lifestyle Alerts**: Identifies foods, supplements, alcohol, and caffeine interactions (e.g., avoiding grapefruit with certain statins or calcium with specific antibiotics).
- **FDA & Pharmacopeia Insights**: Direct access to clinical monograph summaries and safety advisories.

### 4. Family Hub & Caregiver Network
- **Multi-Profile Management**: Seamlessly manage dependent profiles (children, elderly parents, chronic care patients) under a single master account or via shared access.
- **Role-Based Isolation**: Secure permission gates distinguish between primary patients, secondary family viewers, and authorized professional caregivers.
- **Remote Adherence Visibility**: Receive instant status updates when a dependent takes or skips a scheduled dose.

### 5. Intelligent Reminders & Travel Companion
- **High-Reliability Alarms**: Utilizes native Capacitor local notifications paired with a custom Battery Optimization Defense to avoid aggressive OS background app-killing.
- **Timezone Drift Compensation**: When traveling across borders, the Travel Companion recalculates interval-based regimens (e.g., every 8 hours) to prevent accidental overdose or missed intervals.
- **Flexible Scheduling**: Supports daily, interval, cyclical (e.g., 21 days on, 7 days off), specific weekdays, and as-needed (PRN) medication schedules.

### 6. Holistic Wellness Journal & Adherence Analytics
- **Symptom & Mood Correlation**: Log daily mood, energy levels, sleep quality, and physical symptoms to uncover how medications correlate with daily wellbeing.
- **Adherence Streaks & Badges**: Positive reinforcement mechanics that reward consistent adherence habits.
- **Interactive Visualizations**: Rich visual trendlines and charts powered by Recharts show adherence rates over 7-day, 30-day, and custom time horizons.

### 7. Doctor-Ready Clinical Reports
- **One-Click PDF Generation**: Export comprehensive, beautifully formatted medical summaries using client-side `jspdf` and backend `pdfkit` pipelines.
- **Consultation Prep**: Summaries include active drug lists, adherence percentages, logged side-effects, and wellness patterns ready to share with physicians or pharmacists.

### 8. Offline-First Resilience & Live Updates
- **Zero-Connectivity Continuity**: Full offline CRUD operations backed by IndexedDB and local Firestore caching.
- **Background Sync**: Automatic conflict resolution and data synchronization as soon as internet connectivity returns.
- **Over-The-Air (OTA) Updates**: Integrated with Capgo to deliver critical updates and bug fixes directly to users without waiting for app store review cycles.

---

## 🏛 System Architecture

```text
                                  +------------------------+
                                  |     User Interface     |
                                  |  (React 18 + Radix UI) |
                                  +-----------+------------+
                                              |
                   +--------------------------+--------------------------+
                   |                                                     |
                   v                                                     v
      +-------------------------+                           +-------------------------+
      |  Web / PWA Application  |                           |  Native Android Bridge  |
      |   (Vite + Tailwind CSS) |                           |      (Capacitor 8)      |
      +------------+------------+                           +------------+------------+
                   |                                                     |
                   +--------------------------+--------------------------+
                                              |
                                              v
                                 +-------------------------+
                                 |  State & Offline Layer  |
                                 | (TanStack Query, Zustand|
                                 |   IndexedDB, Firestore) |
                                 +------------+------------+
                                              |
                         +--------------------+--------------------+
                         |                                         |
                         v                                         v
            +-------------------------+               +-------------------------+
            |  Firebase Cloud Backend |               | Node.js / Express API   |
            |  * Firestore Database   |               |  * Groq Llama 3/4 Vision|
            |  * Firebase Auth (JWT)  | <-----------> |  * Google Gemini Fallback|
            |  * Security Rules Guard |               |  * FDA Drug Interaction |
            |  * Firebase Hosting     |               |  * PDF Report Generator |
            +-------------------------+               +-------------------------+
```

### Directory Structure Overview

```text
dawa-lens/
├── src/                          # Frontend Application Root (React 18 + Vite)
│   ├── components/               # Modular UI Components (Radix Primitives & Custom)
│   │   ├── dashboard/            # Home dashboard cards, metrics, and adherence banners
│   │   ├── fda/                  # Drug safety & interaction search components
│   │   ├── intelligence/         # AI analysis cards and insight panels
│   │   ├── travel/               # Timezone adjusters and trip medication planners
│   │   ├── ui/                   # Reusable atomic UI elements (buttons, dialogs, inputs)
│   │   ├── wellness/             # Mood, sleep, and symptom logging widgets
│   │   ├── DawaGPT.tsx           # Context-aware conversational AI interface
│   │   └── BatteryOptimizationGate.tsx # Mobile notification reliability guard
│   ├── contexts/                 # Global React Contexts (Auth, Patient, Theme)
│   ├── hooks/                    # Custom hooks for network, sensors, and database queries
│   ├── lib/                      # External client setups (Firebase client, i18n, utils)
│   ├── pages/                    # Route Views (Dashboard, Scan, Medications, Family, etc.)
│   ├── services/                 # API client services, offline sync, and notification managers
│   ├── types/                    # Comprehensive TypeScript type definitions
│   └── index.css                 # Tailwind CSS design system and theme variables
├── server/                       # Backend API Engine (Node.js + Express)
│   ├── src/
│   │   ├── middleware/           # Auth verification, rate limiting, and error guards
│   │   ├── routes/               # Modular REST endpoints (AI, Vision, FDA, Patients, Logs)
│   │   ├── db.js                 # Firebase Admin SDK initialization
│   │   └── index.js              # Express server entry point and CORS configuration
│   └── package.json              # Server dependencies and scripts
├── android/                      # Native Android Project (Capacitor bindings & manifests)
├── firestore.rules               # Enterprise-grade Firestore security and access policies
├── capacitor.config.ts           # Native runtime configuration (App ID, splash, plugins)
├── vite.config.ts                # Vite bundler, PWA config, and path aliases
└── vitest.config.ts              # Unit and integration test runner configuration
```

---

## 💻 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [React 18.3](https://react.dev/) with [TypeScript 5.8](https://www.typescriptlang.org/) |
| **Build & Tooling** | [Vite 8](https://vitejs.dev/) with SWC React plugin |
| **Styling & Design** | [Tailwind CSS 3.4](https://tailwindcss.com/), [Radix UI Primitives](https://www.radix-ui.com/), [Framer Motion](https://www.framer.com/motion/) |
| **State & Data Fetching** | [TanStack Query v5](https://tanstack.com/query), [Zustand](https://github.com/pmndrs/zustand), React Context |
| **Mobile & Native Bridge**| [Capacitor 8](https://capacitorjs.com/) (Camera, Notifications, Haptics, Preferences, Network, Geolocation) |
| **Backend Runtime** | [Node.js 24](https://nodejs.org/) & [Express 4.21](https://expressjs.com/) |
| **Database & Auth** | [Firebase Firestore](https://firebase.google.com/docs/firestore) & [Firebase Authentication](https://firebase.google.com/docs/auth) |
| **Artificial Intelligence**| [Groq Cloud](https://groq.com/) (Llama 3/4 Vision & Chat) + [Google Gemini 2.0 Flash](https://ai.google.dev/) fallback |
| **Computer Vision / OCR** | [Tesseract.js 7.0](https://tesseract.projectnaptha.com/) + Multimodal Vision LLMs |
| **Data Visualization** | [Recharts](https://recharts.org/) |
| **Document Generation** | [PDFKit](https://pdfkit.org/) & [jsPDF](https://github.com/parallax/jsPDF) |
| **Testing Suite** | [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/), [Playwright](https://playwright.dev/) |

---

## 🗄 Database & Data Architecture

Data in Dawa Lens is structured in Cloud Firestore with strict user and caregiver isolation:

```
firestore-root/
│
├── users/{userId}
│   ├── profile: { name, email, phone, timezone, preferences, isCaregiver }
│   └── settings: { notificationSound, hapticsEnabled, theme, language }
│
├── medicines/{medicineId}
│   ├── userId: string (Owner)
│   ├── patientId: string (Target individual)
│   ├── name: string, genericName: string, strength: string
│   ├── instructions: string, foodRequirements: string
│   ├── totalStock: number, remainingStock: number, refillThreshold: number
│   └── interactions: Array<{ drug: string, severity: string, description: string }>
│
├── reminders/{reminderId}
│   ├── userId: string, medicineId: string, patientId: string
│   ├── timeSlots: Array<string> (e.g. ["08:00", "20:00"])
│   ├── daysOfWeek: Array<number>
│   ├── dosage: string
│   └── isActive: boolean
│
├── doseLogs/{logId}
│   ├── userId: string, reminderId: string, medicineId: string
│   ├── scheduledTime: Timestamp, loggedTime: Timestamp
│   ├── status: "taken" | "skipped" | "delayed"
│   └── notes: string
│
├── wellnessLogs/{logId}
│   ├── userId: string, patientId: string, date: string
│   ├── mood: number (1-5), energy: number (1-5), sleepHours: number
│   ├── symptoms: Array<string>
│   └── notes: string
│
└── patients/{patientId}
    ├── caregiverId: string (Managing user)
    ├── name: string, relationship: string, dateOfBirth: string
    └── emergencyContact: { name: string, phone: string }
```

---

## 🚀 Getting Started & Local Development

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v24.14.1` or higher
- **npm** or **bun** package manager
- **Firebase CLI**: `npm install -g firebase-tools`
- **Android Studio** (Optional, for Android mobile builds)
- **Java JDK**: Version 17+ (for Android builds)

---

### Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/EmmahOwens/dawa-lens.git
   cd dawa-lens
   ```

2. **Install Frontend & Root Dependencies:**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   cd ..
   ```

---

### Environment Configuration

Create the necessary environment variable files for both frontend and backend:

#### Frontend (`.env` in the root directory):
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:5000/api
```

#### Backend (`server/.env` in the server directory):
```env
PORT=5000
NODE_ENV=development
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

---

### Running the Application

1. **Start the Express API Server:**
   ```bash
   cd server
   npm run dev
   ```
   *The backend will boot on `http://localhost:5000` with active request logging and rate limiting.*

2. **Start the Vite Frontend Development Server:**
   ```bash
   npm run dev
   ```
   *Open your browser and navigate to `http://localhost:8080` (or `http://localhost:5173`).*

3. **Run on Native Android:**
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```
   *Android Studio will open the pre-configured project ready for deployment to an emulator or physical device.*

---

## 📜 Available Scripts

| Command | Working Directory | Description |
| :--- | :--- | :--- |
| `npm run dev` | `/` (Root) | Launch Vite frontend development server with HMR |
| `npm run build` | `/` (Root) | Compile production-ready web assets into `dist/` |
| `npm run build:dev` | `/` (Root) | Build bundle with source maps enabled for debugging |
| `npm run preview` | `/` (Root) | Preview the production build locally |
| `npm run lint` | `/` (Root) | Run ESLint across TypeScript and React components |
| `npm run test` | `/` (Root) | Execute Vitest unit and integration test suite |
| `npm run test:watch` | `/` (Root) | Run Vitest in interactive watch mode |
| `npm run cap:sync` | `/` (Root) | Build web assets and synchronize them to Capacitor Android |
| `npm run deploy:web` | `/` (Root) | Compile bundle and deploy directly to Firebase Hosting |
| `npm run dev` | `/server` | Start Express backend with Nodemon hot-reloading |
| `npm start` | `/server` | Start Express backend in production mode |

---

## 🧪 Testing & Quality Assurance

Dawa Lens maintains a high standard of software reliability with end-to-end and component test coverage:

```bash
# Run unit and integration tests
npm run test

# Run tests in continuous watch mode during development
npm run test:watch

# Execute Playwright end-to-end browser tests
npx playwright test

# Check code cleanliness and linting rules
npm run lint
```

---

## 🚢 Deployment & Distribution

### Web Hosting
- **Firebase Hosting**: Primary production web deployment with global CDN caching and automatic SSL.
- **Vercel**: Continuous integration preview and staging deployment at [`https://dawalens256.vercel.app`](https://dawalens256.vercel.app).

### Android Native Release
1. Build the production web bundle: `npm run build`
2. Sync assets with native Android: `npx cap sync android`
3. Generate signed Android App Bundle (`.aab`) in Android Studio
4. Upload to Google Play Console for production or internal track distribution

### Over-The-Air (OTA) Updates
- Configured with **Capgo** for instantaneous frontend updates, hotfixes, and translation bundle refreshes without requiring full App Store re-reviews.

---

## 🔒 Security, Privacy & Data Protection

Because Dawa Lens handles sensitive health data, security is engineered into every tier:

* **Strict Firestore Security Rules**: Granular security rules enforce that users can strictly read and write their own medication records and explicitly shared dependent files.
* **PII Sanitization in AI Workflows**: Prompts dispatched to LLM providers are scrubbed of identifying personal data (such as user full names, national IDs, or exact contact info).
* **Network & API Hardening**:
  - Helmet.js security headers (CSP, HSTS, X-Frame-Options, XSS protection).
  - Rate limiting on public and AI-computation endpoints to prevent abuse.
  - Strict CORS origin whitelisting.
* **Encrypted Storage**: Sensitive persistent settings and local caches are stored using encrypted device preferences and HTTPS-only transport.

---

## 🤝 Contributing & Code Standards

Dawa Lens follows strict software craftsmanship principles:

1. **Modular Architecture**: Separate UI presentation from business logic using custom hooks and centralized services.
2. **Type Safety**: Strictly typed TypeScript with zero unvalidated `any` types.
3. **Branching Strategy**:
   - `main`: Production-ready release branch.
   - `feature/*`: Specific feature additions.
   - `fix/*`: Bug fixes and hotfixes.
4. **Pull Requests**: Ensure all tests pass (`npm run test`) and linter checks succeed (`npm run lint`) prior to submitting PRs.

---

## 📄 License & Acknowledgments

© 2026 **Dawa Lens Team**. All rights reserved.

*Built with passion to elevate medication safety, health literacy, and coordinated care across East Africa and the globe.*

For inquiries, support, or partnership opportunities, visit [dawalens.web.app](https://dawalens.web.app).

