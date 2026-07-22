import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config();


// The user has supplied standard FIREBASE_ variables in the .env file
// Instead of cert, we could construct a credential object or use default.
// Let's create a credential from env variables.
let credential;
if (process.env.FIREBASE_PRIVATE_KEY) {
  console.log('🔐 Firebase Admin: Initializing with service account credentials from environment variables.');
  credential = cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace literal '\n' characters with actual newlines
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('🔐 Firebase Admin: Initializing using GOOGLE_APPLICATION_CREDENTIALS file.');
  credential = undefined; // Will use ADC automatically
} else {
  // Warn clearly in logs so 500 errors have a traceable cause
  console.warn('⚠️  Firebase Admin: No FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS found. Attempting Application Default Credentials (ADC). This may fail outside of Google Cloud environments.');
  credential = undefined;
}

let app;
try {
  const options = {};
  if (credential) {
    options.credential = credential;
  }
  app = initializeApp(options);
  console.log('✅ Firebase Admin SDK initialized successfully.');
} catch (err) {
  console.error('❌ Firebase Admin SDK failed to initialize:', err.message);
  throw err;
}

export const db = getFirestore(app);
export const authAdmin = getAuth(app);
export const messaging = getMessaging(app);

