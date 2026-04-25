# 💊 Dawa Lens: Intelligence-Driven Medication Safety

**Dawa Lens** is a premium, cross-platform medication management ecosystem designed to eliminate medication errors and improve health outcomes in Uganda and East Africa. By combining state-of-the-art AI vision models, intelligent reminders, and holistic wellness tracking, Dawa Lens empowers users to take control of their medication adherence and health outcomes.

---

## 🌟 Core Features

### 🧠 AI-Powered Medication Intelligence
- **Pill Identification**: Computer vision-powered medication recognition using Tesseract.js OCR and Gemini API integration for high-accuracy pill identification from photos.
- **Dawa-GPT**: Context-aware conversational AI assistant that understands your active medications, dose history, and wellness patterns.
- **Drug Interaction Detection**: Real-time analysis of potential drug-drug interactions and food-medication interactions.
- **Medication Search**: Comprehensive medication database lookup with detailed information about dosages, side effects, and usage patterns.

### 📱 Cross-Platform Native Experience
- **Unified Codebase**: Single React 18 codebase deployed across Android, iOS, and Web via Capacitor 6.
- **Native Capabilities**: Full integration with device hardware including camera access, local notifications, haptic feedback, and device storage.
- **Offline-First Architecture**: Works seamlessly offline with local data synchronization via Firebase Firestore.
- **Live Updates**: Capgo live update system enables instant app updates without App Store releases.

### 👨‍👩‍👧 Family & Caregiver Management
- **Family Hub**: Unified interface for managing medications for dependents and family members.
- **Caregiver Support**: Professional healthcare providers can manage multiple patient records with secure data isolation.
- **Shared Access**: Secure permission-based access for family members and healthcare professionals.

### 📊 Wellness & Adherence Tracking
- **Dose Logging**: Manual and automated reminders for medication adherence tracking.
- **Wellness Correlations**: Track how medications affect mood, energy, sleep quality, and side effects.
- **Health Dashboard**: Visual analytics and trends showing medication adherence patterns and wellness metrics.
- **Travel Companion**: Timezone-aware reminder adjustments for international travel.

---

## 🏗 Technical Architecture

Dawa Lens is built as a modern, scalable monorepo:

```text
dawa-lens/
├── src/                      # React 18 Frontend (Vite)
│   ├── components/          # Reusable UI components (Radix UI)
│   ├── pages/              # Full-page components
│   ├── services/           # API and business logic
│   ├── contexts/           # React context state management
│   └── utils/              # Helper utilities
├── server/                  # Node.js + Express Backend API
│   ├── src/
│   │   ├── routes/         # API endpoint handlers
│   │   ├── middleware/     # Express middleware (auth, rate limiting)
│   │   ├── db.js          # Firebase Admin SDK initialization
│   │   └── index.js       # Express server setup
│   └── package.json
├── android/                 # Capacitor Android Project
├── ios/                    # Capacitor iOS Project
├── firestore.rules         # Secure database access patterns
├── capacitor.config.ts     # Native platform configuration
└── vite.config.ts         # Frontend build configuration
``` 

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5 with SWC transpilation
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **State Management**: React Query (TanStack Query) + React Context
- **Animation**: Framer Motion for page transitions
- **Styling**: Tailwind CSS v3 with custom theme
- **Charts**: Recharts for health data visualization
- **Internationalization**: i18next for multi-language support
- **Icons**: Lucide React icon library
- **Notifications**: Sonner for toast notifications

### Backend Stack
- **Runtime**: Node.js with ES modules
- **Framework**: Express.js with TypeScript
- **Database**: Firebase Firestore (real-time, NoSQL)
- **Authentication**: Firebase Authentication with JWT flows
- **AI/ML**: Google Gemini 2.0 Flash API for vision and text
- **Security**: Helmet.js for security headers, Express Rate Limiter
- **Logging**: Morgan for HTTP request logging
- **Validation**: Zod for schema validation
- **HTTP Client**: Axios for API calls

### Native Integration
- **Platform Runtime**: Capacitor 6 for cross-platform bridge
- **Camera**: Capacitor Camera plugin for pill scanning
- **Notifications**: Local notifications for medication reminders
- **Storage**: Capacitor Preferences for persistent app settings
- **Device**: Device info and capabilities detection
- **Haptics**: Vibration feedback for critical alerts
- **Network**: Offline detection and status management
- **Keyboard**: Optimized keyboard handling

### Database Schema (Firestore)
```
users/{userId}              # User profiles and settings
medicines/{medicineId}      # User's medication inventory
reminders/{reminderId}      # Medication schedules and reminders
doseLogs/{logId}           # History of doses taken/skipped
wellnessLogs/{logId}       # Wellness journal entries
patients/{patientId}       # Family members and managed patients
```

---

## 🛠 Development Setup

### Prerequisites
- Node.js **v20+**
- npm or bun package manager
- Firebase CLI (for local emulation and deployment)
- Android Studio (for Android development)
- Xcode (for iOS development)
- Java 17+ (Android)
- CocoaPods (iOS)

### Installation
```bash
# Install root workspace dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..

# Set up environment variables
cp .env.example .env
cp server/.env.example server/.env
# Fill in Firebase credentials and API keys
```

### Local Development

**Start the frontend dev server:**
```bash
npm run dev
```
Vite server runs on `http://localhost:8080` with HMR enabled.

**Start the backend API (in another terminal):**
```bash
cd server && npm run dev
```
Express server runs on `http://localhost:5000`.

**Open in native platforms:**
```bash
# Android
npx cap open android

# iOS
npx cap open ios
```

### Building for Production

**Web:**
```bash
npm run build
npm run deploy:web  # Deploy to Firebase Hosting
```

**Native (after web build):**
```bash
npm run cap:sync  # Sync web assets to native projects
# Then use Android Studio / Xcode to build and deploy
```

---

## 🧪 Quality Assurance

### Testing
- **Unit & Integration**: `npm run test` (Vitest runner)
- **Watch Mode**: `npm run test:watch` for continuous testing
- **E2E Testing**: `npx playwright test` (Playwright)
- **Manual Testing**: Emulator/simulator testing for native platforms

### Code Quality
- **Linting**: `npm run lint` (ESLint)
- **Type Checking**: TypeScript strict mode
- **Format**: Automatic formatting with Prettier

---

## 🚀 Deployment

### Web Deployment
- **Firebase Hosting**: Primary web hosting with automatic HTTPS
- **Vercel**: Secondary deployment at https://dawalens256.vercel.app
- **CI/CD**: Automated builds and deployments on push to main

### Mobile Deployment
- **Android**: Google Play Console via .aab builds
- **iOS**: Apple App Store via TestFlight
- **Live Updates**: Capgo OTA updates for instant patches without app store review

### Allowed Origins (CORS)
```
http://localhost:5173
http://localhost:3000
http://localhost:8080
https://dawalens256.vercel.app
https://dawalens.web.app
https://medicine-d3ba2.web.app
```

---

## 🔐 Security & Privacy

### Data Protection
- **End-to-End**: All data encrypted in transit (HTTPS)
- **At Rest**: Firebase Firestore encryption at rest
- **User Isolation**: Firestore security rules enforce strict user data boundaries
- **HIPAA Compliance**: Follows healthcare data protection patterns

### Firestore Security Rules
```
✅ Users can only read/write their own data
✅ Caregivers have controlled access to managed patients
✅ All mutations validated server-side
✅ PII sanitized in AI prompts
```

### API Security
- **Rate Limiting**: Global limits + stricter limits on AI endpoints
- **CORS**: Whitelist of allowed origins
- **Helmet**: Security headers (CSP, HSTS, X-Frame-Options)
- **Input Validation**: Zod schema validation on all endpoints

---

## 📦 Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (port 8080) |
| `npm run build` | Production build |
| `npm run build:dev` | Dev build with source maps |
| `npm run test` | Run tests once |
| `npm run test:watch` | Watch mode for tests |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |
| `npm run cap:sync` | Sync web assets to native projects |
| `npm run deploy:web` | Build and deploy to Firebase Hosting |

---

## 🌍 Localization

Dawa Lens supports multiple languages via i18next:
- English (default)
- Swahili (East African markets)
- Additional languages configurable in i18n config

---

## 🔄 Development Workflow

1. Create feature branch from `main`
2. Make changes following project conventions
3. Run tests: `npm run test`
4. Run linting: `npm run lint`
5. Sync native changes: `npm run cap:sync`
6. Submit PR with clear description
7. CI/CD pipeline validates and deploys

---

## 📊 Performance Metrics

- **Bundle Size**: ~500KB (gzipped) for web
- **Core Web Vitals**: Optimized for mobile-first
- **Lighthouse Score**: Target 90+
- **OCR Model**: Lazy-loaded (~20MB Tesseract worker)
- **Code Splitting**: Automatic per-page splitting via Vite

---

## 🤝 Contributing

This is a private repository. Access is restricted to authorized contributors.

When contributing:
- Follow the existing code structure and patterns
- Write clean, maintainable TypeScript
- Add tests for new features
- Update documentation as needed
- Use conventional commit messages

---

## 📄 License

© 2026 Dawa Lens Team. All rights reserved. Proprietary and Confidential.

---

## 🔗 Links

- **Live Web App**: https://dawalens.web.app
- **Vercel Staging**: https://dawalens256.vercel.app
- **Backend API**: https://api.dawalens.com (production)
