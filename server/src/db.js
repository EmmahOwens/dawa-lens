import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config();

// The user has supplied standard FIREBASE_ variables in the .env file
// Instead of cert, we could construct a credential object or use default.
// Let's create a credential from env variables.
let credential;
if (process.env.FIREBASE_PRIVATE_KEY) {
  credential = cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace literal '\n' characters with actual newlines
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
} else {
  // If credential object is incomplete, rely on standard methods (e.g., GOOGLE_APPLICATION_CREDENTIALS)
  credential = undefined; 
}

const app = initializeApp({
  credential
});

export const db = getFirestore(app);
export const authAdmin = getAuth(app);
