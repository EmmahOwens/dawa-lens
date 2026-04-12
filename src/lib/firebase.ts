import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC6oGg9qudi-L6umqGd9hoX-0OPvmTQHhU",
    authDomain: "dawalens.firebase.app",
    projectId: "medicine-d3ba2",
    storageBucket: "medicine-d3ba2.firebasestorage.app",
    messagingSenderId: "78961271210",
    appId: "1:78961271210:web:f3932e37f45259fbd28bd3",
    measurementId: "G-L0T2D56Y57"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);