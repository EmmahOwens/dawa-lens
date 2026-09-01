import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC6oGg9qudi-L6umqGd9hoX-0OPvmTQHhU",
    authDomain: "dawalens.web.app",
    projectId: "medicine-d3ba2",
    storageBucket: "medicine-d3ba2.firebasestorage.app",
    messagingSenderId: "78961271210",
    appId: "1:78961271210:web:f3932e37f45259fbd28bd3",
    measurementId: "G-L0T2D56Y57"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analyticsInstance: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analyticsInstance = getAnalytics(app);
      }
    })
    .catch((err) => {
      console.warn("[Firebase] Analytics is not supported in this environment:", err);
    });
}

export const analytics = analyticsInstance;
export const auth = getAuth(app);

// Audit Recommendation: Default web clients to in-memory Firestore cache to prevent
// indefinite unencrypted health data persistence in shared browsers.
// Native apps (sandboxed per-user) and explicitly confirmed trusted devices use persistent cache.
const isNative = Capacitor.isNativePlatform();
const isTrustedWebDevice = typeof window !== "undefined" && localStorage.getItem("dawa_trusted_device") === "true";

export const db = initializeFirestore(app, {
  localCache: (isNative || isTrustedWebDevice)
    ? persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      })
    : memoryLocalCache(),
});