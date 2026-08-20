import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { getRxCUI } from "../services/interactionChecker";

import { auth, db } from "../lib/firebase";
import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { localPersistence } from "../services/localPersistence";
import { scheduleReminders, computeShiftOffset, scheduleAdjustmentNotification } from "../services/reminderService";
import { schedulePostDoseEncouragementNotification } from "../services/quotesService";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { toast } from "../hooks/use-toast";
import { calculateRefillStatus } from "../services/refillService";
import { useTranslation } from "react-i18next";
import { storage } from "../lib/storage";
import { toDate } from "../lib/utils";
import {
  parseReminderTimes,
  findSlotIndexForTime,
  calculateDynamicSchedule,
} from "../lib/dynamicSchedule";
import { RiveMoji } from "../components/rive/RiveMoji";
import {
  enqueueOp,
  flushQueue,
  clearQueue,
  getPendingCount,
  getPendingOps,
  type OfflineOp,
} from "../services/offlineQueue";
import { onNetworkChange, hasNetwork, onForeground } from "../lib/appLifecycle";
import { notify } from "../lib/notifications";

/**
 * Helper to check if proposed reminder times conflict with any other medication reminder
 * for the same patient (difference < 10 minutes with midnight wrap protection).
 */
export function hasOverlapConflict(
  proposedTimes: string[],
  reminderId: string,
  patientId: string | null | undefined,
  allReminders: Reminder[]
): boolean {
  const parseTimeToMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const proposedMinsList = proposedTimes.map(parseTimeToMins);

  const otherReminders = allReminders.filter(
    (r) =>
      r.enabled &&
      r.id !== reminderId &&
      (r.patientId ?? null) === (patientId ?? null)
  );

  for (const other of otherReminders) {
    const otherMinsList = other.time.split(",").map((t) => parseTimeToMins(t.trim()));
    for (const pMins of proposedMinsList) {
      for (const oMins of otherMinsList) {
        let diff = Math.abs(pMins - oMins);
        // Handle midnight wrap (e.g. 23:55 and 00:02 is 7 mins difference)
        if (diff > 12 * 60) {
          diff = 24 * 60 - diff;
        }
        if (diff < 10) {
          console.warn(`[ConflictCheck] Conflict: proposed slot ${pMins} overlaps with ${other.medicineName} slot ${oMins} (diff: ${diff}m)`);
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Helper to check if shifting subsequent doses would schedule them in the past (before now).
 *
 * Uses interval-preservation logic: each subsequent slot's new time is computed as
 * actualTakeTime + (cumulative interval between slots), not a raw time-shift.
 * This correctly handles BOTH early-dose (negative offset) and late-dose (positive offset)
 * scenarios for any number of subsequent slots.
 *
 * @param reminder      - The reminder whose slots are being validated
 * @param slotIndex     - Index of the dose that was just taken
 * @param actualTakeTime - The real clock time at which the dose was taken
 * @param now           - Current time (used as the "past" boundary)
 */
export function isShiftIntoPast(
  reminder: Reminder,
  slotIndex: number,
  actualTakeTime: Date,
  now: Date
): boolean {
  const times = reminder.time
    .split(",")
    .map((t) => t.trim())
    .filter((t) => {
      const parts = t.split(":");
      if (parts.length !== 2) return false;
      const [h, m] = parts.map(Number);
      return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
    });

  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  // We only check subsequent doses (i > slotIndex)
  for (let i = slotIndex + 1; i < times.length; i++) {
    // Compute the cumulative interval (in minutes) between the taken slot and slot i,
    // wrapping midnight naturally.
    let cumulativeInterval = 0;
    for (let s = slotIndex; s < i; s++) {
      let diff = toMins(times[s + 1]) - toMins(times[s]);
      if (diff <= 0) diff += 24 * 60; // wrap midnight
      cumulativeInterval += diff;
    }

    // The new candidate time for slot i = actualTakeTime + cumulative interval
    const candidate = new Date(actualTakeTime.getTime() + cumulativeInterval * 60 * 1000);

    if (candidate.getTime() < now.getTime()) {
      console.warn(
        `[ShiftValidation] Invalid shift: slot ${times[i]} would land at ` +
        `${candidate.toISOString()} which is in the past (now: ${now.toISOString()})`
      );
      return true;
    }
  }
  return false;
}

import { getDay, startOfDay, isSameDay } from "date-fns";

/**
 * Auto-healing: removes phantom "missed" dose logs that were created on days
 * when the reminder was not scheduled to repeat (e.g. weekly / custom off-days, or once-off subsequent days).
 */
export function filterInvalidMissedLogs(
  logs: DoseLog[],
  allReminders: Reminder[]
): { validLogs: DoseLog[]; invalidLogIds: string[] } {
  const invalidLogIds: string[] = [];
  const validLogs = logs.filter((log) => {
    if (log.action !== "missed") return true;
    const reminder = allReminders.find((r) => r.id === log.reminderId);
    if (!reminder) return true;

    const logDate = toDate(log.scheduledTime || log.actionTime);
    const scheduledDay = getDay(logDate);

    // Custom repeat days
    if (reminder.repeatSchedule === "custom" && reminder.repeatDays && reminder.repeatDays.length > 0) {
      if (!reminder.repeatDays.includes(scheduledDay)) {
        invalidLogIds.push(log.id);
        return false;
      }
    }

    // Weekly repeat
    if (reminder.repeatSchedule === "weekly") {
      if (reminder.repeatDays && reminder.repeatDays.length > 0) {
        if (!reminder.repeatDays.includes(scheduledDay)) {
          invalidLogIds.push(log.id);
          return false;
        }
      } else if (reminder.createdAt) {
        const createdDay = getDay(toDate(reminder.createdAt));
        if (scheduledDay !== createdDay) {
          invalidLogIds.push(log.id);
          return false;
        }
      }
    }

    // Once repeat
    if (reminder.repeatSchedule === "once" && reminder.createdAt) {
      const createdDate = toDate(reminder.createdAt);
      if (!isSameDay(logDate, createdDate)) {
        invalidLogIds.push(log.id);
        return false;
      }
    }

    return true;
  });

  return { validLogs, invalidLogIds };
}

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const CLOUD_CACHE_REMS_KEY = "dawa_cloud_cache_reminders";
const CLOUD_CACHE_MEDS_KEY = "dawa_cloud_cache_medicines";
const CLOUD_CACHE_LOGS_KEY = "dawa_cloud_cache_doselogs";
const CLOUD_CACHE_AUDIT_KEY = "dawa_cloud_cache_schedule_audit";
const CLOUD_CACHE_PATIENTS_KEY = "dawa_cloud_cache_patients";
const CLOUD_CACHE_PROFILE_KEY = "dawa_cloud_cache_profile";
const CLOUD_CACHE_WELLNESS_KEY = "dawa_cloud_cache_wellness";

export type Medicine = {
  id: string; // maps to Firestore doc.id
  name: string;
  genericName?: string;
  dosage: string; // e.g. "500mg"
  totalQuantity?: number; // Starting amount
  currentQuantity?: number; // What's left
  dosagePerDose?: number; // e.g. 1
  unit?: string; // "tablets", "ml", etc.
  imageUrl?: string;
  notes?: string;
  rxcui?: string;
  addedAt: string;
  updatedAt?: string;
  isConflict?: boolean;
  color?: string;
  icon?: string;
  patientId?: string | null;
  userId?: string;
};

export type Reminder = {
  id: string;
  medicineId?: string;
  medicineName: string;
  dose: string;
  time: string;
  repeatSchedule: "daily" | "weekly" | "custom" | "once";
  repeatDays?: number[];
  notes?: string;
  enabled: boolean;
  createdAt: string;
  color?: string;
  icon?: string;
  /** null = account owner; string = family member / client patient id */
  patientId?: string | null;
  /** Display name of the patient, stored at creation time for easy labelling */
  patientName?: string | null;
};

export type DoseLog = {
  id: string;
  reminderId: string;
  medicineName: string;
  dose: string;
  scheduledTime: string;
  actionTime: string;
  action: "taken" | "skipped" | "snoozed" | "missed";
  isSnoozed?: boolean;
  snoozeUntil?: string;
  patientId?: string | null;
  userId?: string;
};

export type WellnessLog = {
  id: string;
  type: "food" | "symptom";
  timestamp: string;
  data: Record<string, unknown>; // e.g., { meal: "...", risk: "..." } or { mood: 4, symptoms: [] }
  userId: string;
  patientId?: string | null;
};

export type ScheduleAuditLog = {
  id: string;
  reminderId: string;
  medicineName: string;
  originalTime: string;
  adjustedTime: string;
  actionTime: string;
  triggerEvent: "early-dose" | "late-dose";
  timeOffsetMinutes: number;
  userId: string;
  patientId?: string | null;
};

export type UserProfile = {
  id: string;
  name: string;
  email?: string | null;
  dateOfBirth: string | null;
  gender: "male" | "female" | null;
  isProfessional?: boolean; // CHW Mode
  language?: string;
};

/** Distinguishes a family member from a professional client */
export type PatientType = "family" | "client";

export type Patient = {
  id: string;
  name: string;
  /** Raw age (years). Prefer dateOfBirth for accuracy. */
  age?: number;
  /** ISO date string — used to compute exact age and for clinical reports */
  dateOfBirth?: string;
  gender?: "male" | "female";
  /** e.g. "Mother", "Client", "Father" */
  relation?: string;
  /** "family" | "client" — drives report template & notification channel */
  type?: PatientType;
  /** Chronic conditions fed to AI reports and drug interaction checks */
  conditions?: string[];
  /** Drug/food allergies fed to AI reports */
  allergies?: string[];
  /** For clinical / CHW mode */
  bloodType?: string;
  /** Visual accent color key: "blue"|"rose"|"amber"|"emerald"|"violet"|"slate" */
  color?: string;
  /** Caregiver notes */
  notes?: string;
  managedBy: string;
  createdAt: string;
};

type AppContextType = {
  medicines: Medicine[];
  reminders: Reminder[];
  doseLogs: DoseLog[];
  patients: Patient[];
  wellnessLogs: WellnessLog[];
  scheduleAuditLogs: ScheduleAuditLog[];
  userProfile: UserProfile | null;
  storageMode: "local" | "cloud";
  isLoggedIn: boolean;
  needsOnboarding: boolean;
  hasSeenWelcome: boolean;
  currentUserId: string | null;
  selectedPatientId: string | null; // null = self
  isProfessionalMode: boolean;
  /** Whether the device currently has a network connection. */
  isOnline: boolean;
  /** Number of reminder/dose operations pending sync to Firestore. */
  pendingOfflineOps: number;

  addMedicine: (
    med: Omit<Medicine, "id" | "addedAt">,
    patientId?: string | null
  ) => Promise<Medicine>;
  updateMedicine: (id: string, updates: Partial<Medicine>) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  addReminder: (rem: Omit<Reminder, "id" | "createdAt">) => Promise<void>;
  updateReminder: (id: string, rem: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  logDose: (log: Omit<DoseLog, "id" | "actionTime">) => Promise<void>;
  deleteDoseLog: (id: string) => Promise<void>;
  addWellnessLog: (
    log: Omit<WellnessLog, "id" | "timestamp" | "userId">
  ) => Promise<void>;
  deleteWellnessLog: (id: string) => Promise<void>;
  addScheduleAuditLog: (
    log: Omit<ScheduleAuditLog, "id">
  ) => Promise<void>;

  addPatient: (
    patient: Omit<Patient, "id" | "createdAt" | "managedBy">
  ) => Promise<void>;
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  setSelectedPatientId: (id: string | null) => void;
  setIsProfessionalMode: (v: boolean) => void;

  setStorageMode: (v: "local" | "cloud") => void;
  setIsLoggedIn: (v: boolean) => void;
  setNeedsOnboarding: (v: boolean) => void;
  setHasSeenWelcome: (v: boolean) => void;
  completeOnboarding: (profile: Omit<UserProfile, "id">) => Promise<void>;
  loginUser: (userId: string, email: string) => void;
  logoutUser: () => void;
  clearAllData: () => Promise<void>;
  syncLocalToCloud: () => Promise<void>;
  isInitializing: boolean;
  isDawaGPTOpen: boolean;
  setIsDawaGPTOpen: (v: boolean) => void;
  isIntelligenceCollapsed: boolean;
  setIsIntelligenceCollapsed: (v: boolean) => void;
  lastSyncTimestamp: string | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  rememberMe: boolean;
  setRememberMe: (v: boolean) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Migrates data from localStorage to IndexedDB.
 * Returns true if migration was performed.
 */
async function migrateLocalStorage() {
  const keys = [
    "med_professional_mode",
    "med_has_seen_welcome",
    "med_storage_mode",
    "med_loggedin",
    "med_userId",
    "med_intelligence_collapsed",
    "med_last_sync",
    "med_remember_me",
    "dawa_cloud_cache_reminders",
    "dawa_cloud_cache_medicines",
    "dawa_cloud_cache_doselogs",
    "dawa_local_medicines",
    "dawa_local_reminders",
    "dawa_local_doselogs",
  ];

  let migrated = false;
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      try {
        await storage.setItem(key, JSON.parse(value));
        // We keep localStorage for now as a fallback,
        // but mark that we've migrated.
        migrated = true;
      } catch (e) {
        console.error(`Migration failed for ${key}:`, e);
      }
    }
  }
  return migrated;
}

/** Remove undefined fields so Firestore doesn't throw an error. */
function sanitizeFirestoreData(data: Record<string, unknown>) {
  const sanitized = { ...data };
  Object.keys(sanitized).forEach((key) => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });
  return sanitized;
}


function applyPendingOps<T extends { id: string }>(
  data: T[],
  collectionName: string,
  pendingOps: OfflineOp[]
): T[] {
  let result = [...data];
  const ops = pendingOps.filter((op) => op.collection === collectionName);

  for (const op of ops) {
    if (op.type.startsWith("add-")) {
      const idx = result.findIndex((item) => item.id === op.docId);
      if (idx === -1 && op.data) {
        result.push({ id: op.docId, ...op.data } as unknown as T);
      }
    } else if (op.type.startsWith("update-")) {
      result = result.map((item) => {
        if (item.id === op.docId && op.data) {
          return { ...item, ...op.data };
        }
        return item;
      });
    } else if (op.type.startsWith("delete-")) {
      result = result.filter((item) => item.id !== op.docId);
    }
  }

  return result;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(() => hasNetwork());
  const [pendingOfflineOps, setPendingOfflineOps] = useState(() =>
    getPendingCount()
  );
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<WellnessLog[]>([]);
  const [scheduleAuditLogs, setScheduleAuditLogs] = useState<ScheduleAuditLog[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    () => loadLocal("med_selected_patient_id", null)
  );


  useEffect(() => {
    if (selectedPatientId === null) {
      localStorage.removeItem("med_selected_patient_id");
    } else {
      localStorage.setItem(
        "med_selected_patient_id",
        JSON.stringify(selectedPatientId)
      );
    }
  }, [selectedPatientId]);
  const [isProfessionalMode, setIsProfessionalModeState] = useState(() =>
    loadLocal("med_professional_mode", false)
  );
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() =>
    loadLocal("med_has_seen_welcome", false)
  );

  const [storageMode, setStorageMode] = useState<"local" | "cloud">(() =>
    loadLocal("med_storage_mode", "cloud")
  );
  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    loadLocal("med_loggedin", false)
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    loadLocal("med_userId", null)
  );
  const [isDawaGPTOpen, setIsDawaGPTOpen] = useState(false);
  const [isIntelligenceCollapsed, setIntelligenceCollapsedState] = useState(
    () => loadLocal("med_intelligence_collapsed", false)
  );
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(
    () => loadLocal("med_last_sync", null)
  );
  const [rememberMe, setRememberMeState] = useState(() =>
    loadLocal("med_remember_me", true)
  );
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Initialize persistence on load
  useEffect(() => {
    const mode = rememberMe
      ? browserLocalPersistence
      : browserSessionPersistence;
    setPersistence(auth, mode).catch((err) =>
      console.error("Initial persistence error:", err)
    );
  }, []);

  const setIsProfessionalMode = useCallback(
    async (v: boolean) => {
      setIsProfessionalModeState(v);
      storage.setItem("med_professional_mode", v);
      localStorage.setItem("med_professional_mode", JSON.stringify(v));

      // Sync to cloud if logged in
      if (storageMode === "cloud" && currentUserId) {
        try {
          const docRef = doc(db, "users", currentUserId);
          await setDoc(docRef, { isProfessional: v }, { merge: true });
          setUserProfile((p) => (p ? { ...p, isProfessional: v } : null));
        } catch (err) {
          console.error("Failed to sync professional mode to cloud:", err);
        }
      }
    },
    [currentUserId, storageMode]
  );

  const setIsIntelligenceCollapsed = useCallback((v: boolean) => {
    setIntelligenceCollapsedState(v);
    storage.setItem("med_intelligence_collapsed", v);
    localStorage.setItem("med_intelligence_collapsed", JSON.stringify(v));
  }, []);

  const setRememberMe = useCallback((v: boolean) => {
    setRememberMeState(v);
    storage.setItem("med_remember_me", v);
    localStorage.setItem("med_remember_me", JSON.stringify(v));

    // Apply persistence to Firebase
    const mode = v ? browserLocalPersistence : browserSessionPersistence;
    setPersistence(auth, mode).catch((err) =>
      console.error("Failed to set auth persistence:", err)
    );
  }, []);

  const updateUserProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!currentUserId) return;

      // Optimistic update
      setUserProfile((p) => (p ? { ...p, ...updates } : null));

      if (storageMode === "cloud") {
        try {
          const docRef = doc(db, "users", currentUserId);
          await setDoc(docRef, updates, { merge: true });
        } catch (err) {
          console.error("Failed to update user profile:", err);
        }
      }
    },
    [currentUserId, storageMode]
  );

  // Persist simple flags to localStorage (no sensitive data, just UI state)
  useEffect(() => {
    storage.setItem("med_storage_mode", storageMode);
  }, [storageMode]);

  useEffect(() => {
    if (rememberMe && isLoggedIn) {
      storage.setItem("med_loggedin", true);
    } else if (!isLoggedIn) {
      storage.removeItem("med_loggedin");
    }
  }, [isLoggedIn, rememberMe]);

  useEffect(() => {
    if (rememberMe && currentUserId) {
      storage.setItem("med_userId", currentUserId);
    } else if (!currentUserId) {
      storage.removeItem("med_userId");
    }
  }, [currentUserId, rememberMe]);

  useEffect(() => {
    storage.setItem("med_has_seen_welcome", hasSeenWelcome);
  }, [hasSeenWelcome]);
  // Note: med_professional_mode handled by setter now

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        setCurrentUserId(user.uid);
        setIsLoggedIn(true);
      } else if (!hasNetwork() && rememberMe && loadLocal("med_userId", null)) {
        // Device is offline: retain cached authenticated user ID so offline reminders remain accessible
        const cachedUid = loadLocal("med_userId", null);
        if (cachedUid) {
          setCurrentUserId(cachedUid);
          setIsLoggedIn(true);
        }
      } else {
        setCurrentUserId(null);
        setIsLoggedIn(false);
        setUserProfile(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [rememberMe]);

  // ─── Post-flush state refresh ─────────────────────────────────────────────
  // After flushQueue(), the onSnapshot listener *should* re-emit with the
  // freshly-written Firestore data, but the timing is non-deterministic and
  // applyPendingOps() inside each snapshot callback may re-apply ops that were
  // already flushed (race condition). To guarantee correctness and zero UI lag,
  // we do a one-shot getDocs re-read immediately after a successful flush and
  // set state directly — bypassing the snapshot/applyPendingOps path entirely.
  const refreshFromFirestore = useCallback(async () => {
    if (!currentUserId || storageMode !== "cloud") return;
    try {
      const remainingOps = getPendingOps();

      const [remsSnap, logsSnap, medsSnap] = await Promise.all([
        getDocs(query(collection(db, "reminders"), where("userId", "==", currentUserId))),
        getDocs(query(collection(db, "doseLogs"), where("userId", "==", currentUserId))),
        getDocs(query(collection(db, "medicines"), where("userId", "==", currentUserId))),
      ]);

      const freshRems = remsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Reminder));
      const freshLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DoseLog));
      const freshMeds = medsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine));

      // Only apply ops that are still pending (failed to flush)
      const mergedRems = applyPendingOps(freshRems, "reminders", remainingOps);
      const mergedLogs = applyPendingOps(freshLogs, "doseLogs", remainingOps);
      const mergedMeds = applyPendingOps(freshMeds, "medicines", remainingOps);

      setReminders(mergedRems);
      setDoseLogs(mergedLogs);
      setMedicines(mergedMeds);

      storage.setItem(CLOUD_CACHE_REMS_KEY, mergedRems);
      storage.setItem(CLOUD_CACHE_LOGS_KEY, mergedLogs);
      storage.setItem(CLOUD_CACHE_MEDS_KEY, mergedMeds);

      setPendingOfflineOps(getPendingCount());
      console.log("[AppContext] refreshFromFirestore: state updated with fresh Firestore data.");
    } catch (err) {
      // Non-fatal — onSnapshot will catch up on its own eventually
      console.warn("[AppContext] refreshFromFirestore failed (non-fatal):", err);
      setPendingOfflineOps(getPendingCount());
    }
  }, [currentUserId, storageMode]);

  // ─── Network status + offline queue flush ──────────────────────────────────
  // Listen for connectivity changes. When the device comes back online, flush
  // any reminder/dose ops that were queued while offline, then immediately
  // re-read Firestore state so the UI reflects the changes without delay.
  useEffect(() => {
    const unsub = onNetworkChange(async (connected: boolean) => {
      setIsOnline(connected);
      if (connected && currentUserId && storageMode === "cloud") {
        console.log("[AppContext] Connectivity restored — flushing offline queue…");
        try {
          const flushed = await flushQueue(db);
          // Immediately re-read Firestore so the UI reflects the flushed data
          // without waiting for onSnapshot to re-emit (which has non-deterministic timing).
          await refreshFromFirestore();
          if (flushed > 0) {
            toast({
              title: "Synced!",
              description: `${flushed} offline change${flushed !== 1 ? "s" : ""} saved to the cloud.`,
            });
          }
        } catch (err) {
          console.warn("[AppContext] Queue flush error:", err);
          setPendingOfflineOps(getPendingCount());
        }
      }
    });
    return unsub;
  }, [currentUserId, storageMode, refreshFromFirestore]);

  // Initial check & flush on mount/login
  useEffect(() => {
    if (currentUserId && storageMode === "cloud" && hasNetwork()) {
      console.log("[AppContext] Initial network sync — flushing offline queue…");
      flushQueue(db)
        .then(async (flushed) => {
          // Always re-read Firestore after flush to ensure state is consistent
          // regardless of whether onSnapshot re-emits in time.
          await refreshFromFirestore();
          if (flushed > 0) {
            toast({
              title: "Synced!",
              description: `${flushed} offline change${flushed !== 1 ? "s" : ""} saved to the cloud.`,
            });
          }
        })
        .catch((err) => {
          console.warn("[AppContext] Initial queue flush failed:", err);
        });
    }
  }, [currentUserId, storageMode, refreshFromFirestore]);

  // ─── Foreground-resume flush ──────────────────────────────────────────────
  // If the user made offline edits, backgrounded the app, then came back online,
  // the network-change event may have fired in the background without triggering
  // a UI update. Re-check for pending ops whenever the app returns to foreground.
  useEffect(() => {
    if (!currentUserId || storageMode !== "cloud") return;
    const unsub = onForeground(async () => {
      if (hasNetwork() && getPendingCount() > 0) {
        console.log("[AppContext] App foregrounded with pending ops — flushing…");
        try {
          const flushed = await flushQueue(db);
          await refreshFromFirestore();
          if (flushed > 0) {
            toast({
              title: "Synced!",
              description: `${flushed} offline change${flushed !== 1 ? "s" : ""} saved to the cloud.`,
            });
          }
        } catch (err) {
          console.warn("[AppContext] Foreground flush failed:", err);
          setPendingOfflineOps(getPendingCount());
        }
      }
    });
    return unsub;
  }, [currentUserId, storageMode, refreshFromFirestore]);

  const loginUser = useCallback((userId: string, email: string) => {
    setCurrentUserId(userId);
    setIsLoggedIn(true);
    // Flush any ops that were queued while logged out / offline
    if (hasNetwork()) {
      flushQueue(db)
        .then((n) => { if (n > 0) setPendingOfflineOps(getPendingCount()); })
        .catch(console.warn);
    }
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
    // Clear the offline queue on logout — pending ops belong to this user
    clearQueue();
    setPendingOfflineOps(0);
    setCurrentUserId(null);
    setIsLoggedIn(false);
    setUserProfile(null);
    setSelectedPatientId(null);
    setMedicines([]);
    setReminders([]);
    setDoseLogs([]);
    setPatients([]);
    setWellnessLogs([]);
  }, []);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [minSplashTimePassed, setMinSplashTimePassed] = useState(false);

  useEffect(() => {
    // Enforce a minimum display time for the splash screen so the typing animation can finish
    const timer = setTimeout(() => setMinSplashTimePassed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const isInitializing = isDataLoading || isAuthLoading || !minSplashTimePassed;

  // Initialize settings from async storage on mount
  useEffect(() => {
    const initSettings = async () => {
      await migrateLocalStorage();

      const [profMode, welcome, sMode, intelCol, sync, remember] =
        await Promise.all([
          storage.getItem("med_professional_mode", false),
          storage.getItem("med_has_seen_welcome", false),
          storage.getItem("med_storage_mode", "cloud" as const),
          storage.getItem("med_intelligence_collapsed", false),
          storage.getItem("med_last_sync", null as string | null),
          storage.getItem("med_remember_me", true),
        ]);

      setIsProfessionalModeState(profMode);
      setHasSeenWelcome(welcome);
      setStorageMode(sMode);
      setIntelligenceCollapsedState(intelCol);
      setLastSyncTimestamp(sync);
      setRememberMeState(remember);
    };
    initSettings();
  }, []);

  // Fetch / subscribe to data based on storageMode
  useEffect(() => {
    if (isAuthLoading) return;

    // --- Local mode: one-shot load from IndexedDB ---
    if (storageMode === "local") {
      const loadLocal = async () => {
        const [pMeds, pRems, pLogs, pPatients, pWell, pAudit] = await Promise.all([
          localPersistence.medicines.getAll(),
          localPersistence.reminders.getAll(),
          localPersistence.doseLogs.getAll(),
          localPersistence.patients.getAll(),
          localPersistence.wellnessLogs.getAll(),
          localPersistence.scheduleAuditLogs.getAll(),
        ]);
        setMedicines(pMeds);
        setReminders(pRems);
        setDoseLogs(pLogs);
        setPatients(pPatients);
        setWellnessLogs(
          [...pWell].sort(
            (a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime()
          )
        );
        setScheduleAuditLogs(pAudit);
        setIsDataLoading(false);
      };
      loadLocal();
      return;
    }

    // --- Cloud mode: need a userId ---
    if (!currentUserId) {
      setIsDataLoading(false);
      return;
    }

    // 1. Load user profile (loads from local cache first for instant offline access)
    const loadProfile = async () => {
      try {
        const cachedProf = await storage.getItem<UserProfile | null>(
          CLOUD_CACHE_PROFILE_KEY,
          null
        );
        if (cachedProf) {
          setUserProfile(cachedProf);
          setIsProfessionalModeState(Boolean(cachedProf.isProfessional));
        }
      } catch (err) {
        console.warn("[AppContext] Failed to load cached profile:", err);
      }

      if (!hasNetwork()) return;

      try {
        const docRef = doc(db, "users", currentUserId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const prof = docSnap.data() as Record<string, unknown>;
          const isProfessional = (prof.isProfessional as boolean) || false;

          const resolvedProf: UserProfile = {
            ...prof,
            id: currentUserId,
            isProfessional,
          } as unknown as UserProfile;

          if (!prof.dateOfBirth || !prof.gender) {
            setNeedsOnboarding(true);
          } else {
            setNeedsOnboarding(false);
            setIsProfessionalMode(isProfessional);
          }
          setUserProfile(resolvedProf);
          await storage.setItem(CLOUD_CACHE_PROFILE_KEY, resolvedProf);
        } else {
          setNeedsOnboarding(true);
        }
      } catch (err) {
        console.error("Firestore error fetching profile:", err);
      }
    };

    // 2. Load cached data for instant display before listeners fire
    const loadCache = async () => {
      const [
        cachedMeds,
        cachedRems,
        cachedLogs,
        cachedAudit,
        cachedPatients,
        cachedWell,
      ] = await Promise.all([
        storage.getItem<Medicine[]>(CLOUD_CACHE_MEDS_KEY, []),
        storage.getItem<Reminder[]>(CLOUD_CACHE_REMS_KEY, []),
        storage.getItem<DoseLog[]>(CLOUD_CACHE_LOGS_KEY, []),
        storage.getItem<ScheduleAuditLog[]>(CLOUD_CACHE_AUDIT_KEY, []),
        storage.getItem<Patient[]>(CLOUD_CACHE_PATIENTS_KEY, []),
        storage.getItem<WellnessLog[]>(CLOUD_CACHE_WELLNESS_KEY, []),
      ]);

      let finalRems = cachedRems;
      if (finalRems.length === 0) {
        try {
          const localRems = await localPersistence.reminders.getAll();
          if (localRems.length > 0) {
            finalRems = localRems;
            storage.setItem(CLOUD_CACHE_REMS_KEY, localRems);
          }
        } catch (e) {
          console.warn("[AppContext] Failed to read local persistence reminders:", e);
        }
      }

      let finalMeds = cachedMeds;
      if (finalMeds.length === 0) {
        try {
          const localMeds = await localPersistence.medicines.getAll();
          if (localMeds.length > 0) {
            finalMeds = localMeds;
            storage.setItem(CLOUD_CACHE_MEDS_KEY, localMeds);
          }
        } catch (e) {
          console.warn("[AppContext] Failed to read local persistence medicines:", e);
        }
      }

      if (finalMeds.length > 0) setMedicines(finalMeds);
      if (finalRems.length > 0) setReminders(finalRems);
      if (cachedLogs.length > 0) setDoseLogs(cachedLogs);
      if (cachedAudit.length > 0) setScheduleAuditLogs(cachedAudit);
      if (cachedPatients.length > 0) setPatients(cachedPatients);
      if (cachedWell.length > 0) setWellnessLogs(cachedWell);
    };

    loadProfile();
    loadCache();

    // 3. Set up real-time Firestore listeners — these auto-sync across web + Capacitor
    const medsQuery = query(
      collection(db, "medicines"),
      where("userId", "==", currentUserId)
    );
    const remsQuery = query(
      collection(db, "reminders"),
      where("userId", "==", currentUserId)
    );
    const logsQuery = query(
      collection(db, "doseLogs"),
      where("userId", "==", currentUserId)
    );
    const patsQuery = query(
      collection(db, "patients"),
      where("managedBy", "==", currentUserId)
    );
    const wellQuery = query(
      collection(db, "wellnessLogs"),
      where("userId", "==", currentUserId)
    );
    const auditQuery = query(
      collection(db, "scheduleAuditLogs"),
      where("userId", "==", currentUserId)
    );

    const unsubMeds = onSnapshot(
      medsQuery,
      (snap) => {
        if (snap.empty && (snap.metadata.fromCache || !hasNetwork())) return;
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Medicine)
        );
        const merged = applyPendingOps(data, "medicines", getPendingOps());
        setMedicines(merged);
        storage.setItem(CLOUD_CACHE_MEDS_KEY, merged);
      },
      (err) => console.error("Medicines listener error:", err)
    );

    const unsubRems = onSnapshot(
      remsQuery,
      (snap) => {
        if (snap.empty && (snap.metadata.fromCache || !hasNetwork())) return;
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Reminder)
        );
        const merged = applyPendingOps(data, "reminders", getPendingOps());
        setReminders(merged);
        storage.setItem(CLOUD_CACHE_REMS_KEY, merged);
      },
      (err) => console.error("Reminders listener error:", err)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        if (snap.empty && (snap.metadata.fromCache || !hasNetwork())) return;
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as DoseLog)
        );
        const merged = applyPendingOps(data, "doseLogs", getPendingOps());
        setDoseLogs(merged);
        storage.setItem(CLOUD_CACHE_LOGS_KEY, merged);
      },
      (err) => console.error("DoseLogs listener error:", err)
    );

    const unsubPats = onSnapshot(
      patsQuery,
      (snap) => {
        if (snap.empty && (snap.metadata.fromCache || !hasNetwork())) return;
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Patient)
        );
        setPatients(data);
        storage.setItem(CLOUD_CACHE_PATIENTS_KEY, data);
      },
      (err) => console.error("Patients listener error:", err)
    );

    const unsubWell = onSnapshot(
      wellQuery,
      (snap) => {
        if (snap.empty && (snap.metadata.fromCache || !hasNetwork())) return;
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as WellnessLog)
        );
        data.sort(
          (a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime()
        );
        setWellnessLogs(data);
        storage.setItem(CLOUD_CACHE_WELLNESS_KEY, data);
      },
      (err) => console.error("WellnessLogs listener error:", err)
    );

    const unsubAudit = onSnapshot(
      auditQuery,
      (snap) => {
        if (snap.empty && (snap.metadata.fromCache || !hasNetwork())) return;
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as ScheduleAuditLog)
        );
        setScheduleAuditLogs(data);
        storage.setItem(CLOUD_CACHE_AUDIT_KEY, data);
      },
      (err) => console.error("ScheduleAuditLogs listener error:", err)
    );

    setIsDataLoading(false);

    // Cleanup listeners on unmount or dependency change
    return () => {
      unsubMeds();
      unsubRems();
      unsubLogs();
      unsubPats();
      unsubWell();
      unsubAudit();
    };
  }, [currentUserId, storageMode, isAuthLoading]);

  // Auto-heal: prune historical invalid "missed" dose logs created on non-scheduled days
  useEffect(() => {
    if (reminders.length === 0 || doseLogs.length === 0 || isInitializing) return;
    const { validLogs, invalidLogIds } = filterInvalidMissedLogs(doseLogs, reminders);
    if (invalidLogIds.length > 0) {
      console.log(`[AppContext] Auto-healing: Purging ${invalidLogIds.length} phantom missed logs.`);
      setDoseLogs(validLogs);
      storage.setItem(CLOUD_CACHE_LOGS_KEY, validLogs);
      invalidLogIds.forEach((id) => {
        deleteDoseLog(id).catch((e) => console.warn("[AppContext] Auto-heal log delete failed:", e));
      });
    }
  }, [reminders, doseLogs, isInitializing]);

  const completeOnboarding = async (profile: Omit<UserProfile, "id">) => {
    if (!currentUserId) throw new Error("Not logged in");
    const docRef = doc(db, "users", currentUserId);
    await setDoc(docRef, profile, { merge: true });
    setUserProfile({ ...profile, id: currentUserId } as UserProfile);
    setNeedsOnboarding(false);
  };

  // --- CRUD Operations ---

  const addMedicine = async (
    med: Omit<Medicine, "id" | "addedAt">,
    explicitPatientId?: string | null
  ): Promise<Medicine> => {
    let newMed: Medicine;
    const effectivePatientId =
      explicitPatientId !== undefined ? explicitPatientId : selectedPatientId;

    if (storageMode === "local") {
      newMed = await localPersistence.medicines.create({
        ...med,
        patientId: effectivePatientId || null,
        userId: "local",
      });
      setMedicines((p) => [...p, newMed]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");

      // Use a client-generated ID so the medicine is stable across offline → online
      // transitions. addDoc would only work when online; setDoc with a local ID works
      // both online and as an offline-queue replay target.
      const localMedId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const medData = sanitizeFirestoreData({
        ...med,
        userId: currentUserId,
        patientId: effectivePatientId || null,
        addedAt: new Date().toISOString(),
      });
      newMed = { ...medData, id: localMedId } as Medicine;

      // 1. Save locally instantly
      try {
        await localPersistence.medicines.create({ ...(medData as Omit<Medicine, "id" | "addedAt"> & { addedAt?: string }), id: localMedId });
      } catch (e) {
        console.warn("[AppContext] Failed to save medicine locally:", e);
      }

      // 2. Optimistic UI update & cache sync
      setMedicines((p) => {
        const next = [...p.filter((m) => m.id !== localMedId), newMed];
        storage.setItem(CLOUD_CACHE_MEDS_KEY, next);
        return next;
      });

      // 3. Sync to Firestore in background
      if (isOnline) {
        try {
          const docRef = doc(db, "medicines", localMedId);
          await setDoc(docRef, medData);
        } catch (err) {
          console.warn("[AppContext] Failed to sync new medicine, enqueuing:", err);
          enqueueOp({
            type: "add-medicine",
            collection: "medicines",
            docId: localMedId,
            data: medData,
            userId: currentUserId,
          });
          setPendingOfflineOps(getPendingCount());
        }
      } else {
        enqueueOp({
          type: "add-medicine",
          collection: "medicines",
          docId: localMedId,
          data: medData,
          userId: currentUserId,
        });
        setPendingOfflineOps(getPendingCount());
      }
    }

    // Fetch RxCUI in background
    if (!newMed.rxcui) {
      getRxCUI(newMed.name)
        .then(async (rxcui) => {
          if (rxcui) {
            if (storageMode === "local") {
              await localPersistence.medicines.update(newMed.id, { rxcui });
              setMedicines((p) =>
                p.map((m) => (m.id === newMed.id ? { ...m, rxcui } : m))
              );
            } else {
              const docRef = doc(db, "medicines", newMed.id);
              await updateDoc(docRef, { rxcui });
              // onSnapshot listener will auto-update state
            }
          }
        })
        .catch((err) => console.error("Failed to fetch RxCUI:", err));
    }

    return newMed;
  };

  const updateMedicine = async (id: string, updates: Partial<Medicine>) => {
    if (storageMode === "local") {
      await localPersistence.medicines.update(id, updates);
      setMedicines((p) =>
        p.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );
      return;
    }

    // 1. Save locally instantly
    try {
      await localPersistence.medicines.update(id, updates);
    } catch (e) {
      console.warn("[AppContext] Failed to update medicine locally:", e);
    }

    // 2. Optimistic UI update & cache sync
    setMedicines((p) => {
      const next = p.map((m) => (m.id === id ? { ...m, ...updates } : m));
      storage.setItem(CLOUD_CACHE_MEDS_KEY, next);
      return next;
    });

    // 3. Sync update to Firestore in background
    if (isOnline) {
      try {
        const docRef = doc(db, "medicines", id);
        await updateDoc(docRef, sanitizeFirestoreData(updates));
      } catch (err) {
        console.warn("[AppContext] Failed to sync medicine update, enqueuing:", err);
        if (currentUserId) {
          enqueueOp({
            type: "update-medicine",
            collection: "medicines",
            docId: id,
            data: sanitizeFirestoreData(updates),
            userId: currentUserId,
          });
          setPendingOfflineOps(getPendingCount());
        }
      }
    } else {
      if (currentUserId) {
        enqueueOp({
          type: "update-medicine",
          collection: "medicines",
          docId: id,
          data: sanitizeFirestoreData(updates),
          userId: currentUserId,
        });
        setPendingOfflineOps(getPendingCount());
      }
    }
  };

  const deleteMedicine = async (id: string) => {
    // 0. Cascade delete associated reminders so they don't linger as phantom alarms
    const associatedReminders = reminders.filter((r) => r.medicineId === id);
    for (const rem of associatedReminders) {
      await deleteReminder(rem.id);
    }

    if (storageMode === "local") {
      await localPersistence.medicines.remove(id);
      setMedicines((p) => p.filter((m) => m.id !== id));
      return;
    }

    // --- Cloud mode ---

    // 1. Remove locally instantly
    try {
      await localPersistence.medicines.remove(id);
    } catch (e) {
      console.warn("[AppContext] Failed to remove medicine locally:", e);
    }

    // 2. Optimistic UI update & cache sync
    setMedicines((p) => {
      const next = p.filter((m) => m.id !== id);
      storage.setItem(CLOUD_CACHE_MEDS_KEY, next);
      return next;
    });

    // 3. Sync delete to Firestore in background
    if (isOnline) {
      try {
        const docRef = doc(db, "medicines", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("[AppContext] Failed to sync medicine delete, enqueuing:", err);
        if (currentUserId) {
          enqueueOp({
            type: "delete-medicine",
            collection: "medicines",
            docId: id,
            userId: currentUserId,
          });
          setPendingOfflineOps(getPendingCount());
        }
      }
    } else {
      if (currentUserId) {
        enqueueOp({
          type: "delete-medicine",
          collection: "medicines",
          docId: id,
          userId: currentUserId,
        });
        setPendingOfflineOps(getPendingCount());
      }
    }
  };

  const addReminder = async (rem: Omit<Reminder, "id" | "createdAt">) => {
    const rawPatientId =
      rem.patientId !== undefined ? rem.patientId : selectedPatientId;
    const effectivePatientId =
      !rawPatientId || rawPatientId === "null" || rawPatientId === "undefined"
        ? null
        : rawPatientId;
    const createdAt = new Date().toISOString();
    const localId = `lrem-${Date.now()}`;

    const newReminder = {
      ...rem,
      id: localId,
      medicineId: rem.medicineId || null,
      patientId: effectivePatientId,
      createdAt,
    } as Reminder;

    // 1. Save locally instantly
    await localPersistence.reminders.create(newReminder);

    // 2. Optimistic UI update & cache sync
    setReminders((p) => {
      const next = [...p.filter((r) => r.id !== localId), newReminder];
      storage.setItem(CLOUD_CACHE_REMS_KEY, next);
      return next;
    });

    if (storageMode === "local") {
      return;
    }

    // --- Cloud mode only ---
    if (!currentUserId) throw new Error("Not logged in");

    const remData = sanitizeFirestoreData({
      ...newReminder,
      userId: currentUserId,
    });

    // 3. Sync to Firestore in background
    if (isOnline) {
      try {
        const docRef = doc(db, "reminders", localId);
        await setDoc(docRef, remData);
      } catch (err) {
        console.warn("[AppContext] Failed to sync new reminder, enqueuing:", err);
        enqueueOp({
          type: "add-reminder",
          collection: "reminders",
          docId: localId,
          data: remData,
          userId: currentUserId,
        });
        setPendingOfflineOps(getPendingCount());
      }
    } else {
      enqueueOp({
        type: "add-reminder",
        collection: "reminders",
        docId: localId,
        data: remData,
        userId: currentUserId,
      });
      setPendingOfflineOps(getPendingCount());
    }
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    const current = reminders.find((r) => r.id === id);
    if (!current) return;

    const finalUpdates = { ...updates };
    if ("patientId" in finalUpdates) {
      const p = finalUpdates.patientId;
      finalUpdates.patientId =
        !p || p === "null" || p === "undefined" ? null : p;
    }

    // 1. Save locally instantly
    try {
      await localPersistence.reminders.update(id, finalUpdates);
    } catch (e) {
      console.warn("[AppContext] Failed to update reminder locally:", e);
    }

    // 2. Optimistic UI update & cache sync
    setReminders((p) => {
      const next = p.map((r) => (r.id === id ? { ...r, ...finalUpdates } : r));
      storage.setItem(CLOUD_CACHE_REMS_KEY, next);
      return next;
    });

    if (storageMode === "local") {
      return;
    }

    // --- Cloud mode only ---
    const updated = { ...current, ...finalUpdates };

    // 3. Sync update to Firestore in background.
    const fullUpdatedPayload = sanitizeFirestoreData({
      ...updated,
      userId: currentUserId,
    });
    const sanitizedUpdates = sanitizeFirestoreData(finalUpdates);
    if (isOnline) {
      try {
        const docRef = doc(db, "reminders", id);
        await updateDoc(docRef, sanitizedUpdates);
      } catch (err) {
        console.warn("[AppContext] Failed to sync reminder update, enqueuing:", err);
        if (currentUserId) {
          enqueueOp({
            type: "update-reminder",
            collection: "reminders",
            docId: id,
            data: fullUpdatedPayload,
            userId: currentUserId,
          });
          setPendingOfflineOps(getPendingCount());
        }
      }
    } else {
      if (currentUserId) {
        enqueueOp({
          type: "update-reminder",
          collection: "reminders",
          docId: id,
          data: fullUpdatedPayload,
          userId: currentUserId,
        });
        setPendingOfflineOps(getPendingCount());
      }
    }
  };

  const deleteReminder = async (id: string) => {
    const current = reminders.find((r) => r.id === id);
    if (!current) return;

    // 1. Save locally instantly (SQLite row removed before any notification logic)
    try {
      await localPersistence.reminders.remove(id);
    } catch (e) {
      console.warn("[AppContext] Failed to remove reminder locally:", e);
    }

    // 2. Eagerly cancel & reschedule OS-level notifications so pending alarms
    //    for this reminder are cleared immediately — before the useEffect has a
    //    chance to fire on the next render cycle.
    if (Capacitor.isNativePlatform()) {
      const updatedReminders = reminders.filter((r) => r.id !== id);
      scheduleReminders(updatedReminders, doseLogs, medicines).catch((err) =>
        console.warn("[AppContext] Failed to reschedule notifications after delete:", err)
      );
    }

    // 3. Optimistic UI update & cache sync
    setReminders((p) => {
      const next = p.filter((r) => r.id !== id);
      storage.setItem(CLOUD_CACHE_REMS_KEY, next);
      return next;
    });

    if (storageMode === "local") {
      return;
    }

    // 4. Sync delete to Firestore in background
    if (isOnline) {
      try {
        const docRef = doc(db, "reminders", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("[AppContext] Failed to sync reminder delete, enqueuing:", err);
        if (currentUserId) {
          enqueueOp({
            type: "delete-reminder",
            collection: "reminders",
            docId: id,
            userId: currentUserId,
          });
          setPendingOfflineOps(getPendingCount());
        }
      }
    } else {
      if (currentUserId) {
        enqueueOp({
          type: "delete-reminder",
          collection: "reminders",
          docId: id,
          userId: currentUserId,
        });
        setPendingOfflineOps(getPendingCount());
      }
    }
  };

  const logDose = async (log: Omit<DoseLog, "id" | "actionTime">) => {
    let newLog: DoseLog;
    const reminder = reminders.find((r) => r.id === log.reminderId);
    const effectivePatientId =
      log.patientId ?? reminder?.patientId ?? selectedPatientId ?? null;

    if (storageMode === "local") {
      newLog = await localPersistence.doseLogs.create({
        ...log,
        patientId: effectivePatientId,
        userId: "local",
      });
      setDoseLogs((p) => [...p, newLog]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      const actionTime = new Date().toISOString();
      const localId = `llog-${Date.now()}`;

      const logData = sanitizeFirestoreData({
        ...log,
        userId: currentUserId,
        patientId: effectivePatientId,
        actionTime,
      });
      newLog = { ...logData, id: localId } as DoseLog;

      // 1. Save locally instantly
      await localPersistence.doseLogs.create({
        ...log,
        id: localId,
        actionTime,
        patientId: effectivePatientId,
        userId: currentUserId,
      });

      // 2. Optimistic UI update & cache sync
      setDoseLogs((p) => {
        const next = [...p.filter((l) => l.id !== localId), newLog];
        storage.setItem(CLOUD_CACHE_LOGS_KEY, next);
        return next;
      });

      // 3. Sync log to Firestore in background
      if (isOnline) {
        try {
          const docRef = doc(db, "doseLogs", localId);
          await setDoc(docRef, logData);
        } catch (err) {
          console.warn("[AppContext] Failed to sync dose log, enqueuing:", err);
          enqueueOp({
            type: "add-dose-log",
            collection: "doseLogs",
            docId: localId,
            data: logData,
            userId: currentUserId,
          });
          setPendingOfflineOps(getPendingCount());
        }
      } else {
        enqueueOp({
          type: "add-dose-log",
          collection: "doseLogs",
          docId: localId,
          data: logData,
          userId: currentUserId,
        });
        setPendingOfflineOps(getPendingCount());
      }
    }

    // 1. Update Medicine Inventory if taken
    let freshMeds = medicines;
    if (log.action === "taken") {
      // Primary: resolve medicine via reminder.medicineId
      // Fallback: match by medicine name (handles reminders without medicineId,
      //           deleted reminders, or logs imported from CSV / AI actions)
      let medicine: Medicine | undefined;

      if (reminder?.medicineId) {
        medicine = medicines.find((m) => m.id === reminder.medicineId);
      }

      // Name-based fallback — only if we haven't already resolved via ID
      if (!medicine && log.medicineName) {
        medicine = medicines.find(
          (m) => m.name.toLowerCase() === log.medicineName.toLowerCase()
        );
      }

      if (medicine && medicine.currentQuantity !== undefined) {
        // Default to 1 unit per dose when dosagePerDose is unset
        const doseAmount = medicine.dosagePerDose || 1;
        const newQuantity = Math.max(0, medicine.currentQuantity - doseAmount);
        await updateMedicine(medicine.id, { currentQuantity: newQuantity });

        freshMeds = medicines.map((m) =>
          m.id === medicine!.id ? { ...m, currentQuantity: newQuantity } : m
        );

        // Check refill status accurately derived from daily dosage and remaining stock
        const updatedMed = { ...medicine, currentQuantity: newQuantity };
        const status = calculateRefillStatus(updatedMed, reminders);
        if (status) {
          if (status.isOutOfStock) {
            toast({
              title: `⛔ Out of Stock — ${medicine.name}`,
              description: `0 ${medicine.unit || "units"} remaining. Open Med Vault to refill now.`,
              variant: "destructive",
            });
          } else if (status.isLow) {
            toast({
              title: `🚨 Refill Immediately — ${medicine.name}`,
              description: `Only ~${status.daysRemaining} day${status.daysRemaining !== 1 ? "s" : ""} left (${newQuantity} ${medicine.unit || "units"}). Open Med Vault to refill.`,
              variant: "destructive",
            });
          } else if (status.isWarning) {
            toast({
              title: `⚠️ Refill Soon — ${medicine.name}`,
              description: `Only ~${status.daysRemaining} day${status.daysRemaining !== 1 ? "s" : ""} left (${newQuantity} ${medicine.unit || "units"}). Open Med Vault to refill.`,
            });
          }
        }
      }

      // Fire a motivational encouragement notification 3s after the dose is logged
      // (uses NativeAlarm so it works even when the app is immediately backgrounded)
      schedulePostDoseEncouragementNotification(log.medicineName).catch(() => {/* non-fatal */});
    }

    // 1.5. Dynamic Schedule Adjustment
    // If a dose is taken early/late, automatically update the base reminder times
    // to maintain equal intervals starting from the new actual take time.
    // Applies seamlessly whether online or offline.
    if (
      log.action === "taken" &&
      reminder &&
      reminder.repeatSchedule !== "once"
    ) {
      const scheduledDate = toDate(log.scheduledTime);
      const actualDate = new Date();
      const diffMinutes = Math.round(
        (actualDate.getTime() - scheduledDate.getTime()) / (1000 * 60)
      );

      // Trigger recalculation for any deviation taken outside originally scheduled time
      if (Math.abs(diffMinutes) >= 1) {
        const times = parseReminderTimes(reminder.time);
        const slotIndex = findSlotIndexForTime(times, scheduledDate);

        if (slotIndex !== -1 && times.length > 0) {
          const { newTimes, newTimeStr, hasChanges } = calculateDynamicSchedule(
            times,
            slotIndex,
            actualDate
          );

          if (hasChanges) {
            const originalTime = reminder.time;
            const direction = diffMinutes < 0 ? "earlier" : "later";
            const absDiff = Math.abs(diffMinutes);
            const adjustedTimesLabel = newTimes.slice(slotIndex + 1).join(", ");

            console.log(
              `[DynamicSchedule] Shifting ${reminder.medicineName} from ${originalTime} to ${newTimeStr} (${absDiff}m ${direction})`
            );

            // 1. Update the reminder itself (persists locally to SQLite/IDB and queues if offline)
            await updateReminder(reminder.id, { time: newTimeStr });
            reminder.time = newTimeStr;

            // 2. Update the log's scheduledTime to match the new schedule
            const newScheduledISO = new Date(actualDate);
            newScheduledISO.setSeconds(0, 0);
            newScheduledISO.setMilliseconds(0);
            const newScheduledTime = newScheduledISO.toISOString();

            // Always save update locally instantly
            try {
              await localPersistence.doseLogs.update(newLog.id, {
                scheduledTime: newScheduledTime,
              });
            } catch (e) {
              console.warn("[AppContext] Failed to update dose log locally:", e);
            }

            if (storageMode === "cloud") {
              if (isOnline) {
                try {
                  const logDocRef = doc(db, "doseLogs", newLog.id);
                  await updateDoc(logDocRef, { scheduledTime: newScheduledTime });
                } catch (err) {
                  console.warn("[AppContext] Failed to sync dose log schedule shift, enqueuing:", err);
                  if (currentUserId) {
                    enqueueOp({
                      type: "update-dose-log",
                      collection: "doseLogs",
                      docId: newLog.id,
                      data: { scheduledTime: newScheduledTime },
                      userId: currentUserId,
                    });
                    setPendingOfflineOps(getPendingCount());
                  }
                }
              } else {
                if (currentUserId) {
                  enqueueOp({
                    type: "update-dose-log",
                    collection: "doseLogs",
                    docId: newLog.id,
                    data: { scheduledTime: newScheduledTime },
                    userId: currentUserId,
                  });
                  setPendingOfflineOps(getPendingCount());
                }
              }
            }

            // Update local references for immediate UI consistency
            newLog.scheduledTime = newScheduledTime;
            setDoseLogs((prev) => {
              const next = prev.map((l) =>
                l.id === newLog.id ? { ...l, scheduledTime: newScheduledTime } : l
              );
              storage.setItem(CLOUD_CACHE_LOGS_KEY, next);
              return next;
            });

            // 3. Write Schedule Audit Log (works fully offline)
            await addScheduleAuditLog({
              reminderId: reminder.id,
              medicineName: reminder.medicineName,
              originalTime,
              adjustedTime: newTimeStr,
              actionTime: actualDate.toISOString(),
              triggerEvent: diffMinutes < 0 ? "early-dose" : "late-dose",
              timeOffsetMinutes: diffMinutes,
              userId: storageMode === "local" ? "local" : currentUserId || "local",
              patientId: reminder.patientId ?? null,
            });

            // 4. Schedule a reliable "Schedule Adjusted" notification via the
            // same mechanism as regular reminders (allowWhileIdle + NativeAlarm),
            // so it fires even when the app is backgrounded, killed, or offline.
            await scheduleAdjustmentNotification({
              reminderId: reminder.id,
              medicineName: reminder.medicineName,
              patientId: reminder.patientId,
              patientName: reminder.patientName,
              adjustedTimesLabel: adjustedTimesLabel || newTimes[slotIndex],
              absDiff,
              direction,
              hasSubsequentSlots: newTimes.length > slotIndex + 1,
            });

            // 5. In-app toast with explicit adjusted times
            const toastBody = newTimes.length > slotIndex + 1
              ? reminder.patientName
                ? `${reminder.patientName} took ${reminder.medicineName} ${absDiff}m ${direction}. ` +
                  `Next dose${newTimes.length - slotIndex - 1 > 1 ? "s" : ""} adjusted to: ${adjustedTimesLabel}.`
                : `Taken ${absDiff}m ${direction}. ` +
                  `Next dose${newTimes.length - slotIndex - 1 > 1 ? "s" : ""} adjusted to: ${adjustedTimesLabel}.`
              : `${reminder.medicineName} schedule updated (${absDiff}m ${direction}).`;
            notify.info("⏰ Schedule Adjusted", toastBody);
          }
        }
      }
    }

    // 2. Reschedule notifications immediately so remaining slots fire at the shifted time.
    // IMPORTANT: Build the updatedReminders list here — if updateReminder was called above,
    // reminder.time was mutated in place, but the `reminders` closure still has the old list
    // from the previous render cycle. We manually merge to ensure scheduleReminders fires
    // notifications at the NEW times, not the old ones.
    if (log.action === "taken" && reminder) {
      const freshLogs =
        storageMode === "local"
          ? await localPersistence.doseLogs.getAll()
          : [...doseLogs, newLog];
      const updatedReminders = reminders.map((r) =>
        r.id === reminder.id ? { ...r, time: reminder.time } : r
      );
      scheduleReminders(updatedReminders, freshLogs, freshMeds);

      // 3. Smart Suggest: after 3 consecutive same-direction deviations, suggest updating the time
      const allTakenLogs = freshLogs
        .filter((l) => l.reminderId === reminder.id && l.action === "taken")
        .sort(
          (a, b) =>
            toDate(b.actionTime).getTime() - toDate(a.actionTime).getTime()
        )
        .slice(0, 3);

      if (allTakenLogs.length >= 3) {
        const offsets = allTakenLogs.map((l) =>
          Math.round(
            (toDate(l.actionTime).getTime() -
              toDate(l.scheduledTime).getTime()) /
              (1000 * 60)
          )
        );
        const allLate = offsets.every((o) => o > 5);
        const allEarly = offsets.every((o) => o < -5);

        if (allLate || allEarly) {
          const avgOffset = Math.round(
            offsets.reduce((a, b) => a + b, 0) / offsets.length
          );
          const suggestedTimes = reminder.time
            .split(",")
            .map((t) => t.trim())
            .filter((t) => {
              const parts = t.split(":");
              if (parts.length !== 2) return false;
              const [h, m] = parts.map(Number);
              return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
            })
            .map((t) => {
              const [h, m] = t.split(":").map(Number);
            const total =
              (((h * 60 + m + avgOffset) % (24 * 60)) + 24 * 60) % (24 * 60);
            return `${Math.floor(total / 60)
              .toString()
              .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
          });
          const direction = allLate ? "late" : "early";
          toast({
            title: (
              <span className="flex items-center gap-2">
                <RiveMoji emoji="💡" size={16} /> Smart Schedule Suggestion
              </span>
            ),
            description: reminder.patientName
              ? `${reminder.patientName} has taken ${
                  reminder.medicineName
                } ~${Math.abs(
                  avgOffset
                )}m ${direction} 3 times in a row. Consider updating their reminder to ${suggestedTimes.join(
                  ", "
                )} in the Reminders tab.`
              : `You've taken ${reminder.medicineName} ~${Math.abs(
                  avgOffset
                )}m ${direction} 3 times in a row. Consider updating the reminder to ${suggestedTimes.join(
                  ", "
                )} in the Reminders tab.`,
          });
        }
      }
    }

    // 4. If it's a "once" reminder, auto-delete it after logging
    if (
      reminder &&
      reminder.repeatSchedule === "once" &&
      (log.action === "taken" ||
        log.action === "skipped" ||
        log.action === "missed")
    ) {
      console.log(`Auto-deleting one-time reminder: ${reminder.medicineName}`);
      await deleteReminder(reminder.id);
    }
  };

  const deleteDoseLog = async (id: string) => {
    if (storageMode === "local") {
      await localPersistence.doseLogs.remove(id);
      setDoseLogs((p) => p.filter((l) => l.id !== id));
    } else {
      const docRef = doc(db, "doseLogs", id);
      await deleteDoc(docRef);
      // onSnapshot listener will auto-update state
    }
  };

  const addWellnessLog = async (
    log: Omit<WellnessLog, "id" | "timestamp" | "userId">
  ) => {
    const localId = `lwell-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const effectivePatientId = log.patientId ?? selectedPatientId ?? null;
    const effectiveUserId = storageMode === "local" ? "local" : currentUserId || "local";

    const newLog: WellnessLog = {
      ...log,
      id: localId,
      timestamp,
      userId: effectiveUserId,
      patientId: effectivePatientId,
    };

    // 1. Save locally instantly
    try {
      await localPersistence.wellnessLogs.create(newLog);
    } catch (e) {
      console.warn("[AppContext] Failed to save wellness log locally:", e);
    }

    // 2. Optimistic UI update & cache sync
    setWellnessLogs((p) => {
      const next = [newLog, ...p.filter((l) => l.id !== localId)].sort(
        (a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime()
      );
      storage.setItem(CLOUD_CACHE_WELLNESS_KEY, next);
      return next;
    });

    if (storageMode === "local") return;

    if (currentUserId) {
      const logData = sanitizeFirestoreData({
        ...log,
        userId: currentUserId,
        patientId: effectivePatientId,
        timestamp,
      });
      if (isOnline) {
        try {
          const docRef = doc(db, "wellnessLogs", localId);
          await setDoc(docRef, logData);
        } catch (err) {
          console.warn("[AppContext] Failed to sync wellness log (non-fatal):", err);
        }
      }
    }
  };

  const deleteWellnessLog = async (id: string) => {
    if (storageMode === "local") {
      await localPersistence.wellnessLogs.remove(id);
      setWellnessLogs((p) => p.filter((l) => l.id !== id));
    } else {
      const docRef = doc(db, "wellnessLogs", id);
      await deleteDoc(docRef);
      // onSnapshot listener will auto-update state
    }
  };

  const addScheduleAuditLog = async (
    log: Omit<ScheduleAuditLog, "id">
  ) => {
    const localId = `laudit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newLog: ScheduleAuditLog = { ...log, id: localId };

    // 1. Save locally instantly
    try {
      await localPersistence.scheduleAuditLogs.create(newLog);
    } catch (e) {
      console.warn("[AppContext] Failed to save schedule audit log locally:", e);
    }

    // 2. Optimistic UI update & cache sync
    setScheduleAuditLogs((p) => {
      const next = [newLog, ...p.filter((l) => l.id !== localId)];
      storage.setItem(CLOUD_CACHE_AUDIT_KEY, next);
      return next;
    });

    if (storageMode === "local") return;

    if (currentUserId) {
      const logData = sanitizeFirestoreData({
        ...log,
        userId: currentUserId,
      });
      if (isOnline) {
        try {
          const docRef = doc(db, "scheduleAuditLogs", localId);
          await setDoc(docRef, logData);
        } catch (err) {
          console.warn("[AppContext] Failed to sync schedule audit log (non-fatal):", err);
        }
      }
    }
  };

  const syncLocalToCloud = useCallback(async () => {
    if (!currentUserId || storageMode === "local") return;

    const [localMeds, localRems, localLogs, localPatients, localWell] = await Promise.all([
      localPersistence.medicines.getAll(),
      localPersistence.reminders.getAll(),
      localPersistence.doseLogs.getAll(),
      localPersistence.patients.getAll(),
      localPersistence.wellnessLogs.getAll(),
    ]);

    if (
      localMeds.length === 0 &&
      localRems.length === 0 &&
      localLogs.length === 0 &&
      localPatients.length === 0 &&
      localWell.length === 0
    )
      return;

    try {
      // 0. Sync Patients to Firestore and map local IDs to Firestore IDs
      const patientIdMap: Record<string, string> = {};
      for (const pat of localPatients) {
        const { id, createdAt, managedBy, ...data } = pat;
        const patientData = sanitizeFirestoreData({
          ...data,
          managedBy: currentUserId,
          createdAt: createdAt || new Date().toISOString(),
        });
        const docRef = await addDoc(collection(db, "patients"), patientData);
        patientIdMap[id] = docRef.id;
      }

      // 1. Sync Medicines to Firestore
      const syncedMedNames = new Set(
        medicines.map((m) => m.name.toLowerCase())
      );
      for (const med of localMeds) {
        if (syncedMedNames.has(med.name.toLowerCase())) {
          setMedicines((p) =>
            p.map((m) =>
              m.name.toLowerCase() === med.name.toLowerCase()
                ? { ...m, isConflict: true }
                : m
            )
          );
          continue;
        }
        syncedMedNames.add(med.name.toLowerCase());
        const { id, addedAt, ...data } = med;
        const mappedPatientId = data.patientId
          ? patientIdMap[data.patientId] || data.patientId
          : null;
        const medData = sanitizeFirestoreData({
          ...data,
          patientId: mappedPatientId,
          userId: currentUserId,
          addedAt: addedAt || new Date().toISOString(),
        });
        await addDoc(collection(db, "medicines"), medData);
      }

      // 2. Sync Reminders to Firestore
      for (const rem of localRems) {
        const { id, createdAt, ...data } = rem;
        const mappedPatientId = data.patientId
          ? patientIdMap[data.patientId] || data.patientId
          : null;
        const remData = sanitizeFirestoreData({
          ...data,
          patientId: mappedPatientId,
          userId: currentUserId,
          createdAt: createdAt || new Date().toISOString(),
        });
        await addDoc(collection(db, "reminders"), remData);
      }

      // 3. Sync Logs to Firestore
      for (const log of localLogs) {
        const { id, actionTime, ...data } = log;
        const mappedPatientId = data.patientId
          ? patientIdMap[data.patientId] || data.patientId
          : null;
        const logData = sanitizeFirestoreData({
          ...data,
          patientId: mappedPatientId,
          userId: currentUserId,
          actionTime: actionTime || new Date().toISOString(),
        });
        await addDoc(collection(db, "doseLogs"), logData);
      }

      // 4. Sync Wellness Logs to Firestore
      for (const well of localWell) {
        const { id, timestamp, ...data } = well;
        const mappedPatientId = data.patientId
          ? patientIdMap[data.patientId] || data.patientId
          : null;
        const wellData = sanitizeFirestoreData({
          ...data,
          patientId: mappedPatientId,
          userId: currentUserId,
          timestamp: timestamp || new Date().toISOString(),
        });
        await addDoc(collection(db, "wellnessLogs"), wellData);
      }

      // Clear local persistence after successful sync
      await Promise.all([
        storage.removeItem("dawa_local_medicines"),
        storage.removeItem("dawa_local_reminders"),
        storage.removeItem("dawa_local_doselogs"),
        storage.removeItem("dawa_local_patients"),
        storage.removeItem("dawa_local_wellness"),
      ]);

      if (selectedPatientId && patientIdMap[selectedPatientId]) {
        setSelectedPatientId(patientIdMap[selectedPatientId]);
      }

      // onSnapshot listeners will auto-update state with the newly synced data

      toast({
        title: t("settings.sync_complete"),
        description: "Your local data is now backed up to your cloud profile.",
      });

      const now = new Date().toISOString();
      setLastSyncTimestamp(now);
      storage.setItem("med_last_sync", now);
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [
    currentUserId,
    storageMode,
    medicines,
    reminders,
    doseLogs,
    selectedPatientId,
    t,
    toast,
  ]);

  const addPatient = async (
    patient: Omit<Patient, "id" | "createdAt" | "managedBy">
  ) => {
    if (storageMode === "local") {
      const newPatient = await localPersistence.patients.create(patient);
      setPatients((prev) => [...prev, newPatient]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");

      const docRef = doc(collection(db, "patients"));
      const docId = docRef.id;
      const patientData = sanitizeFirestoreData({
        ...patient,
        managedBy: currentUserId,
        createdAt: new Date().toISOString(),
      });
      const newPatient = { ...patientData, id: docId } as Patient;

      // Optimistic update
      setPatients((prev) => [...prev, newPatient]);

      try {
        await setDoc(docRef, patientData);
      } catch (error) {
        // Rollback optimistic update
        setPatients((prev) => prev.filter((p) => p.id !== docId));
        throw error;
      }
    }
  };

  const updatePatient = async (id: string, updates: Partial<Patient>) => {
    if (storageMode === "local") {
      await localPersistence.patients.update(id, updates);
      setPatients((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    } else {
      if (!currentUserId) throw new Error("Not logged in");

      let previousPatient: Patient | undefined;
      setPatients((prev) => {
        return prev.map((p) => {
          if (p.id === id) {
            previousPatient = p;
            return { ...p, ...updates };
          }
          return p;
        });
      });

      try {
        const docRef = doc(db, "patients", id);
        await updateDoc(docRef, sanitizeFirestoreData(updates));
      } catch (error) {
        if (previousPatient) {
          const backup = previousPatient;
          setPatients((prev) =>
            prev.map((p) => (p.id === id ? backup : p))
          );
        }
        throw error;
      }
    }
  };

  const deletePatient = async (id: string) => {
    if (!currentUserId && storageMode !== "local") throw new Error("Not logged in");

    // Backup current state for rollback
    const backupPatients = [...patients];
    const backupMedicines = [...medicines];
    const backupReminders = [...reminders];
    const backupDoseLogs = [...doseLogs];
    const backupWellnessLogs = [...wellnessLogs];

    const relatedMeds = medicines.filter((m) => m.patientId === id);
    const relatedRems = reminders.filter((r) => r.patientId === id);
    const relatedLogs = doseLogs.filter((l) => l.patientId === id);

    // Optimistic local update
    setMedicines((prev) => prev.filter((m) => m.patientId !== id));
    setReminders((prev) => prev.filter((r) => r.patientId !== id));
    setDoseLogs((prev) => prev.filter((l) => l.patientId !== id));
    setWellnessLogs((prev) => prev.filter((w) => w.patientId !== id));
    setPatients((prev) => prev.filter((p) => p.id !== id));

    try {
      // Cascade delete associated items
      for (const med of relatedMeds) {
        await deleteMedicine(med.id);
      }
      for (const rem of relatedRems) {
        await deleteReminder(rem.id);
      }
      for (const l of relatedLogs) {
        await deleteDoseLog(l.id);
      }

      if (storageMode === "local") {
        await localPersistence.patients.remove(id);
      } else {
        // Delete wellness logs from cloud
        try {
          const wQuery = query(
            collection(db, "wellnessLogs"),
            where("patientId", "==", id),
            where("userId", "==", currentUserId)
          );
          const snapshot = await getDocs(wQuery);
          for (const docSnap of snapshot.docs) {
            await deleteDoc(doc(db, "wellnessLogs", docSnap.id));
          }
        } catch (e) {
          console.error("Failed to cascade delete wellness logs:", e);
        }

        const docRef = doc(db, "patients", id);
        await deleteDoc(docRef);
      }

      if (selectedPatientId === id) setSelectedPatientId(null);
    } catch (error) {
      // Rollback all updates on error
      setPatients(backupPatients);
      setMedicines(backupMedicines);
      setReminders(backupReminders);
      setDoseLogs(backupDoseLogs);
      setWellnessLogs(backupWellnessLogs);
      throw error;
    }
  };

  const clearAllData = useCallback(async () => {
    // 0. Sign out from Firebase if logged in
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out during clear all data failed:", e);
    }

    // 1. Wipe State
    setMedicines([]);
    setReminders([]);
    setDoseLogs([]);
    setPatients([]);
    setWellnessLogs([]);
    setSelectedPatientId(null);

    // 2. Wipe IndexedDB local persistence data
    storage.removeItem("dawa_local_medicines");
    storage.removeItem("dawa_local_reminders");
    storage.removeItem("dawa_local_doselogs");
    storage.removeItem("dawa_local_patients");
    storage.removeItem("dawa_local_wellness");
    storage.removeItem(CLOUD_CACHE_PATIENTS_KEY);

    // 3. Reset UI flags and metadata
    storage.removeItem("med_selected_patient_id");
    storage.removeItem("med_professional_mode");
    storage.removeItem("med_has_seen_welcome");
    storage.removeItem("med_intelligence_collapsed");
    storage.removeItem("med_last_sync");
    storage.removeItem("med_loggedin");
    storage.removeItem("med_userId");
    
    localStorage.removeItem("med_selected_patient_id");
    localStorage.removeItem("med_professional_mode");
    localStorage.removeItem("med_has_seen_welcome");
    localStorage.removeItem("med_intelligence_collapsed");
    localStorage.removeItem("med_last_sync");
    localStorage.removeItem("med_loggedin");
    localStorage.removeItem("med_userId");

    setIsProfessionalMode(false);
    setHasSeenWelcome(false);
    setIntelligenceCollapsedState(false);
    setLastSyncTimestamp(null);
    setIsLoggedIn(false);
    setCurrentUserId(null);


    // Clear offline queue — all pending ops belong to the cleared user
    clearQueue();
    setPendingOfflineOps(0);
  }, [setIsProfessionalMode]);

  return (
    <AppContext.Provider
      value={{
        medicines,
        reminders,
        doseLogs,
        patients,
        wellnessLogs,
        scheduleAuditLogs,
        userProfile,
        storageMode,
        isLoggedIn,
        needsOnboarding,
        hasSeenWelcome,
        currentUserId,
        selectedPatientId,
        isProfessionalMode,
        isOnline,
        pendingOfflineOps,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        addReminder,
        updateReminder,
        deleteReminder,
        logDose,
        deleteDoseLog,
        addPatient,
        updatePatient,
        deletePatient,
        addWellnessLog,
        deleteWellnessLog,
        addScheduleAuditLog,
        setSelectedPatientId,
        setIsProfessionalMode,
        setStorageMode,
        setIsLoggedIn,
        setNeedsOnboarding,
        setHasSeenWelcome,
        completeOnboarding,
        loginUser,
        logoutUser,
        clearAllData,
        syncLocalToCloud,
        isInitializing,
        isDawaGPTOpen,
        setIsDawaGPTOpen,
        isIntelligenceCollapsed,
        setIsIntelligenceCollapsed,
        lastSyncTimestamp,
        updateUserProfile,
        rememberMe,
        setRememberMe,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
