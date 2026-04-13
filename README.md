# 💊 Dawa Lens

**Dawa Lens** is a full-stack medication management and safety web app built for users in Uganda and East Africa. It lets users scan or photograph pills for AI-powered identification, manage medication reminders, track dose history, check drug interactions, monitor wellness, and chat with a built-in medical AI assistant — all behind Firebase Authentication.

---

## ✨ Features

### 🔍 AI Pill Identification
Snap or upload a photo of a medication and Dawa Lens sends it to a **Gemini 2.0 Flash** vision model that returns up to 5 ranked matches with names, generic names, imprints, confidence scores, and age-specific dosage recommendations.

### 💬 Dawa-GPT (Conversational Medical AI)
A floating AI assistant powered by Gemini that is context-aware of the user's active medications and recent dose logs. Responds with suggested follow-up prompts and cites its source.

### ⏰ Medication Reminders & Dose Logging
Users can add medications, set reminders, and log every dose taken. Missed and completed doses are tracked over time.

### 📊 Adherence Coach
An AI coach (Gemini) analyzes dose logs, identifies missed-dose patterns, and delivers warm, culturally appropriate adherence advice with an adherence score.

### 🔗 Drug Interactions Checker
Check interactions between multiple medications stored in the user's profile.

### 🌿 Holistic Safety Engine
Checks medications against lifestyle factors (alcohol, caffeine, grapefruit, dairy, etc.) and categorises risk as High, Medium, or Low with actionable advice.

### 🍽️ Instant Meal Safety Check
Describe a meal and Dawa Lens checks whether it is safe to eat with the user's current medications.

### ✈️ Travel Companion
Enter a destination and Dawa Lens finds equivalent brand names in that country, advises on timezone-based schedule shifts, and flags customs restrictions.

### 📈 Wellness Insights
Correlates dose adherence with user-logged wellness data (mood, side effects) and surfaces 3 actionable insights with a correlation score.

### 👨‍👩‍👧 Family Hub
Manage medication profiles for multiple family members or patients (caregiver mode).

### 📋 Health Report
Generates a downloadable summary of the user's medication history and adherence.

### 🌐 Internationalisation
Multi-language support via `i18next` with automatic browser language detection.

### 🌙 Dark / Light / System Theme
Full theme support powered by `next-themes`.

---

## 🏗 Architecture

Dawa Lens is a **monorepo** containing two independently runnable packages:

```
dawa-lens/
├── src/          # React 18 frontend (Vite)
└── server/       # Express.js backend API (Node.js)
```

### Frontend — `src/`
| Technology | Role |
|---|---|
| React 18 + Vite | UI framework & build tool |
| TypeScript | Static typing |
| Tailwind CSS + shadcn/ui | Styling & component primitives |
| Radix UI | Accessible headless components |
| Framer Motion | Animations |
| TanStack Query | Server state & data fetching |
| React Router v6 | Client-side routing |
| Firebase JS SDK | Auth & Firestore |
| Tesseract.js | In-browser OCR (text extraction from pill images) |
| html5-qrcode | QR / barcode scanning |
| Recharts | Wellness & adherence charts |
| Vitest + Playwright | Unit & E2E testing |

### Backend — `server/`
| Technology | Role |
|---|---|
| Express.js | REST API server |
| Firebase Admin SDK | Firestore + Auth token verification |
| Gemini 2.0 Flash | Pill identification, AI coaching, chat |
| Helmet + express-rate-limit | Security hardening & rate limiting |
| Zod | Request validation |
| Morgan | HTTP request logging |

### API Routes (`/api/v1/`)
| Route | Description |
|---|---|
| `POST /vision/pill-id` | Identify a pill from a base64 image |
| `POST /ai/coach` | AI adherence coaching |
| `POST /ai/holistic-safety` | Lifestyle + medication safety check |
| `POST /ai/travel` | Travel companion advice |
| `POST /ai/wellness-insight` | Wellness pattern analysis |
| `POST /ai/meal-check` | Food–drug interaction check |
| `POST /ai/chat` | Dawa-GPT conversational assistant |
| `GET/POST /medicines` | CRUD for user medications |
| `GET/POST /reminders` | CRUD for dose reminders |
| `GET/POST /doselogs` | Dose log management |
| `GET/POST /patients` | Family / patient profiles |
| `GET/POST /wellness` | Wellness log management |
| `GET/POST /users` | User profile management |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- A Firebase project (Firestore + Authentication enabled)
- A Gemini API key

### 1. Clone the repository
```bash
git clone https://github.com/EmmahOwens/dawa-lens.git
cd dawa-lens
```

### 2. Install frontend dependencies
```bash
npm install
```

### 3. Configure the frontend
Create a `.env` file in the project root:
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Install server dependencies
```bash
cd server
npm install
```

### 5. Configure the server
Create `server/.env`:
```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=your_gemini_api_key
PORT=5000
```

### 6. Run both services

In one terminal (frontend):
```bash
npm run dev
```

In another terminal (backend):
```bash
cd server
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🧪 Testing

```bash
# Unit tests (Vitest)
npm run test

# Watch mode
npm run test:watch

# End-to-end tests (Playwright)
npx playwright test
```

---

## 🚢 Deployment

The frontend is deployed to **Firebase Hosting** and **Vercel**. The backend is a standalone Express server deployable to any Node.js host.

```bash
# Build frontend for production
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 📄 Pages

| Route | Page |
|---|---|
| `/welcome` | Onboarding splash screen |
| `/auth` | Sign in / Sign up |
| `/onboarding` | First-time user setup |
| `/` | Dashboard (overview, quick actions) |
| `/scan` | Camera / upload pill scanner |
| `/results` | Pill identification results |
| `/medicine/:name` | Detailed medicine info |
| `/reminders/new` | Add a medication reminder |
| `/history` | Dose history log |
| `/interactions` | Drug interaction checker |
| `/family` | Family Hub (multi-patient) |
| `/travel` | Travel Companion |
| `/wellness` | Wellness tracking & insights |
| `/report` | Health & adherence report |
| `/settings` | App settings & preferences |
