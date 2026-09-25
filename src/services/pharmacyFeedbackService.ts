import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PharmacyFeedbackSubmission {
  pharmacyId: string;
  pharmacyName: string;
  currentLat: number;
  currentLng: number;
  verifiedLat?: number;
  verifiedLng?: number;
  gpsAccuracyMeters?: number;
  feedbackType: "confirm_location" | "wrong_location" | "permanently_closed" | "update_contact";
  isOpen?: boolean;
  suggestedPhone?: string;
  notes?: string;
  userId?: string;
}

export interface StoredPharmacyFeedback extends PharmacyFeedbackSubmission {
  id: string;
  submittedAt: string;
  synced: boolean;
}

const LOCAL_STORAGE_KEY = "dawa_pharmacy_feedback_queue";

/**
 * Loads pending local feedback from localStorage.
 */
export function getQueuedFeedback(): StoredPharmacyFeedback[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves queued feedback list to localStorage.
 */
function saveQueuedFeedback(queue: StoredPharmacyFeedback[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("[pharmacyFeedbackService] Failed saving local queue:", err);
  }
}

/**
 * Submits pharmacy verification / ground-truthing feedback.
 * Tries direct Firestore submission; if offline or fails, enqueues locally.
 */
export async function submitPharmacyFeedback(
  data: PharmacyFeedbackSubmission
): Promise<{ success: boolean; queued: boolean }> {
  const item: StoredPharmacyFeedback = {
    ...data,
    id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    submittedAt: new Date().toISOString(),
    synced: false,
  };

  try {
    if (navigator.onLine && db) {
      await addDoc(collection(db, "pharmacy_feedback"), {
        ...item,
        synced: true,
      });
      return { success: true, queued: false };
    }
  } catch (err) {
    console.warn("[pharmacyFeedbackService] Failed direct Firestore push, enqueuing offline:", err);
  }

  // Queue locally
  const currentQueue = getQueuedFeedback();
  currentQueue.push(item);
  saveQueuedFeedback(currentQueue);

  return { success: true, queued: true };
}

/**
 * Flushes pending feedback submissions when online.
 */
export async function flushPendingFeedback(): Promise<number> {
  if (!navigator.onLine || !db) return 0;

  const queue = getQueuedFeedback();
  if (queue.length === 0) return 0;

  const remaining: StoredPharmacyFeedback[] = [];
  let flushedCount = 0;

  for (const item of queue) {
    try {
      await addDoc(collection(db, "pharmacy_feedback"), {
        ...item,
        synced: true,
      });
      flushedCount++;
    } catch {
      remaining.push(item);
    }
  }

  saveQueuedFeedback(remaining);
  return flushedCount;
}

// Auto flush when online event fires
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushPendingFeedback().catch(() => {});
  });
}
