import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC6oGg9qudi-L6umqGd9hoX-0OPvmTQHhU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dawalens.web.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "medicine-d3ba2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "medicine-d3ba2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "78961271210",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:78961271210:web:f3932e37f45259fbd28bd3",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
