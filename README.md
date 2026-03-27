# 💊 Pill-Pal

**Pill-Pal** is an intelligent web application designed to help users identify and learn about their medications. It uses a custom Machine Learning model for initial pill recognition, seamlessly backed by an orchestrator that queries extensive, reliable internet APIs (openFDA, RxNorm, DailyMed, and MedlinePlus) to ensure no medicine goes unidentified.

## ✨ Features
- **Intelligent Recognition:** Snap a photo of a pill, and let the custom ML model identify it.
- **Robust Fallback Data Architecture:** If the ML model encounters an unknown drug, Pill-Pal automatically queries highly trusted external databases (openFDA &rarr; RxNorm &rarr; DailyMed &rarr; MedlinePlus).
- **Comprehensive Medicine Info:** View detailed usage, dosage, warnings, and side effects sourced accurately from major medical APIs and the ML model.
- **Modern UI:** Built with an incredibly sleek, responsive interface powered by React, Radix UI primitives, and Tailwind CSS.
- **Test-Driven:** Ensures critical architectural data flows with Vitest, guaranteeing precise data fallback execution.

## 🛠 Tech Stack
- **Frontend Framework:** React 18 / Vite
- **Typing:** TypeScript
- **Styling:** Vanilla CSS & Tailwind CSS (w/ shadcn/ui components)
- **Data Fetching & State:** `@tanstack/react-query`
- **Testing:** Vitest & Playwright

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/EmmahOwens/pill-pal.git
   cd pill-pal
   ```
2. Install project dependencies:
   ```bash
   npm install
   ```

### Running the App
Start the Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application in action.

## 🧪 Testing
Pill-Pal uses **Vitest** for blistering-fast unit testing, especially focused on the complex API orchestration logic.
```bash
# Run all vitest tests
npm run test
```

## 🧠 Machine Learning Model Connect
The ML features expect to hit an endpoint provided via environment variables. Create a `.env` file in the root if you need to point the app to a custom inference endpoint:
```env
VITE_ML_API_URL=http://localhost:5000/api/predict
```
*(If unset, it will default to the localhost endpoint where the ML model's inference API operates).*
