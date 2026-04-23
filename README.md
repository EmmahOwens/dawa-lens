# 💊 Dawa Lens: Intelligence-Driven Medication Safety

**Dawa Lens** is a premium, cross-platform medication management ecosystem designed to eliminate medication errors and improve health outcomes in Uganda and East Africa. By combining state-of-the-art **Gemini AI** with a mobile-first native experience, Dawa Lens empowers users to take control of their health journeys with confidence and precision.

---

## 🌟 Core Pillars

### 🧠 Intelligence-First Safety
- **AI Pill Identification**: High-fidelity vision model (Gemini 2.0 Flash) identifies medications from photos, providing ranked matches and localized dosage advice.
- **Dawa-GPT**: A context-aware conversational assistant that understands your active medications, history, and wellness logs.
- **Holistic Engine**: Analyzes interactions between medications and lifestyle factors like diet (alcohol, caffeine, grapefruit) and timezones.

### 📱 Seamless Native Experience
- **Cross-Platform**: Unified codebase delivering high-performance experiences on **Android**, **iOS**, and Web via **Capacitor**.
- **Native Notifications**: Real-time reminders for dose logging and medication adherence.
- **Hardware Integration**: Optimized camera access for pill scanning and haptic feedback for critical alerts.

### 👨‍👩‍👧 Proactive Health Management
- **Adherence Coaching**: AI-driven analysis of dose logs to identify patterns and provide culturally sensitive motivation.
- **Family Hub**: Unified management for dependents and family members, perfect for caregivers.
- **Wellness Correlation**: Tracks how medications affect mood and side effects, surfacing actionable health insights.

---

## 🏗 Technical Architecture

Dawa Lens utilizes a modern, scalable monorepo architecture:

```text
dawa-lens/
├── src/          # React 18 Mobile-First Frontend (Vite)
├── android/      # Native Android Project (Capacitor)
├── ios/          # Native iOS Project (Capacitor)
├── server/       # Node.js + Express.js Backend API
└── firestore.rules # Secure Data Access Patterns
```

### Stack & Technologies

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| **Native** | Capacitor 6, Android Studio, Xcode |
| **Backend** | Node.js, Express.js, Firebase Admin SDK |
| **AI/ML** | Gemini 2.0 Flash (Vision & Text), Tesseract.js (OCR) |
| **Database** | Firebase Firestore (Real-time syncing) |
| **Auth** | Firebase Authentication (Secure JWT-based flows) |
| **Analytics** | Recharts (Interactive Health Data Visualization) |

---

## 🛠 Internal Development

> [!IMPORTANT]
> This is a private repository. Access is restricted to authorized contributors.

### Prerequisites
- Node.js **v20+**
- Firebase CLI installed and authenticated
- Java 17+ (for Android development)
- CocoaPods (for iOS development)

### 1. Project Initialization
Install dependencies for both the workspace and the backend:
```bash
# Root dependencies (Frontend & Mobile)
npm install

# Backend dependencies
cd server && npm install && cd ..
```

### 2. Environment Configuration
Ensure `.env` files are correctly configured in both the root and `server/` directories with valid Firebase and Gemini credentials.

### 3. Local Development
Start the full stack simultaneously:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Launch Vite Dev Server |
| `cd server && npm run dev` | Launch Backend API (Port 5000) |
| `npx cap open android` | Launch Android Studio |
| `npx cap open ios` | Launch Xcode |

### 4. Syncing Native Changes
Whenever web assets are built or Capacitor plugins are updated:
```bash
npm run cap:sync
```

---

## 🧪 Quality Assurance

We maintain high standards through comprehensive testing suites:

- **Unit & Integration**: `npm run test` (Vitest)
- **End-to-End**: `npx playwright test` (Playwright)
- **Mobile Verification**: Manual testing via Android Emulator and iOS Simulator.

---

## 🚢 Deployment Workflow

The application is deployed using a CI/CD pipeline targeting multiple platforms:

- **Web**: Firebase Hosting & Vercel
- **Android**: Google Play Console (via `.aab` builds)
- **iOS**: Apple App Store (via TestFlight)

---

## 🔒 Security & Privacy

Dawa Lens is built with a security-first mindset:
- **HIPAA-Compliant Patterns**: Data is encrypted at rest and in transit.
- **Strict Firestore Rules**: User data isolation at the database level.
- **Sanitized AI Prompts**: Ensuring PII is handled according to best practices.

© 2026 Dawa Lens Team. All rights reserved. Proprietary and Confidential.
