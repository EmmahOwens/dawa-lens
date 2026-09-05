import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { db } from "@/lib/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { storage } from "@/lib/storage";

const FCM_TOKEN_STORAGE_KEY = "dawa_fcm_token_v1";

let isInitialized = false;

/**
 * Initializes native Android Push Notifications (Firebase Cloud Messaging).
 * Requests permissions, registers with APNs/FCM, and saves the token to Firestore.
 */
export async function initPushNotifications(userId: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // 1. Check current permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== "granted") {
      console.warn("[pushNotificationService] Push notification permission not granted:", permStatus.receive);
      return null;
    }

    // 2. Attach listeners if not already initialized
    if (!isInitialized) {
      isInitialized = true;

      // Token successfully registered
      await PushNotifications.addListener("registration", async (token: Token) => {
        console.log("[pushNotificationService] FCM Token registered:", token.value);
        await saveTokenToFirestore(userId, token.value);
      });

      // Registration error
      await PushNotifications.addListener("registrationError", (error) => {
        console.error("[pushNotificationService] FCM Registration Error:", error);
      });
    }

    // 3. Register with Apple / Google to receive push notifications
    await PushNotifications.register();

    // Check if we already have a cached token
    const cachedToken = await storage.getItem<string | null>(FCM_TOKEN_STORAGE_KEY, null);
    if (cachedToken) {
      await saveTokenToFirestore(userId, cachedToken);
      return cachedToken;
    }

    return null;
  } catch (err) {
    console.warn("[pushNotificationService] Failed to initialize push notifications:", err);
    return null;
  }
}

/**
 * Persists the registered FCM token to the user document in Firestore and local storage.
 */
export async function saveTokenToFirestore(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;

  try {
    await storage.setItem(FCM_TOKEN_STORAGE_KEY, token);

    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      fcmToken: token,
      fcmUpdatedAt: new Date().toISOString(),
    }).catch(async (updateErr) => {
      // If doc doesn't exist yet, merge
      await setDoc(userDocRef, { fcmToken: token, fcmUpdatedAt: new Date().toISOString() }, { merge: true });
    });

    console.log("[pushNotificationService] FCM token saved to Firestore for user:", userId);
  } catch (err) {
    console.warn("[pushNotificationService] Error saving FCM token to Firestore:", err);
  }
}

/**
 * Returns the cached FCM token from local storage.
 */
export async function getStoredFcmToken(): Promise<string | null> {
  return storage.getItem<string | null>(FCM_TOKEN_STORAGE_KEY, null);
}
