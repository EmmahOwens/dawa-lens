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
import { scheduleReminders } from "../services/reminderService";
import { computeShiftOffset } from "../services/reminderService";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { toast } from "../hooks/use-toast";
import { useTranslation } from "react-i18next";
import { storage } from "../lib/storage";
import { toDate } from "../lib/utils";

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const CLOUD_CACHE_REMS_KEY = "dawa_cloud_cache_reminders";
const CLOUD_CACHE_MEDS_KEY = "dawa_cloud_cache_medicines";
const CLOUD_CACHE_LOGS_KEY = "dawa_cloud_cache_doselogs";

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

export type UserProfile = {
  id: string;
  name: string;
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
  gender?: "male" | "female" | "other";
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
  userProfile: UserProfile | null;
  storageMode: "local" | "cloud";
  isLoggedIn: boolean;
  needsOnboarding: boolean;
  hasSeenWelcome: boolean;
  currentUserId: string | null;
  selectedPatientId: string | null; // null = self
  isProfessionalMode: boolean;

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

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<WellnessLog[]>([]);
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
      } else {
        setCurrentUserId(null);
        setIsLoggedIn(false);
        setUserProfile(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync notifications when reminders change
  useEffect(() => {
    scheduleReminders(reminders, doseLogs, medicines);
  }, [reminders, doseLogs, medicines]);

  const loginUser = useCallback((userId: string, email: string) => {
    setCurrentUserId(userId);
    setIsLoggedIn(true);
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
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
        const [pMeds, pRems, pLogs, pPatients, pWell] = await Promise.all([
          localPersistence.medicines.getAll(),
          localPersistence.reminders.getAll(),
          localPersistence.doseLogs.getAll(),
          localPersistence.patients.getAll(),
          localPersistence.wellnessLogs.getAll(),
        ]);
        setMedicines(pMeds);
        setReminders(pRems);
        setDoseLogs(pLogs);
        setPatients(pPatients);
        setWellnessLogs(pWell);
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

    // 1. Load user profile (one-shot — profile rarely changes across devices)
    const loadProfile = async () => {
      try {
        const docRef = doc(db, "users", currentUserId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const prof = docSnap.data() as Record<string, unknown>;
          
          const isProfessional = (prof.isProfessional as boolean) || false;

          if (!prof.dateOfBirth || !prof.gender) {
            setNeedsOnboarding(true);
            setUserProfile({
              ...prof,
              id: currentUserId,
              isProfessional
            } as unknown as UserProfile);
          } else {
            setNeedsOnboarding(false);
            setUserProfile({
              ...prof,
              id: currentUserId,
              isProfessional
            } as unknown as UserProfile);
            setIsProfessionalMode(isProfessional);
          }
        } else {
          setNeedsOnboarding(true);
        }
      } catch (err) {
        console.error("Firestore error fetching profile:", err);
      }
    };

    // 2. Load cached data for instant display before listeners fire
    const loadCache = async () => {
      const [cachedMeds, cachedRems, cachedLogs] = await Promise.all([
        storage.getItem<Medicine[]>(CLOUD_CACHE_MEDS_KEY, []),
        storage.getItem<Reminder[]>(CLOUD_CACHE_REMS_KEY, []),
        storage.getItem<DoseLog[]>(CLOUD_CACHE_LOGS_KEY, []),
      ]);
      if (cachedMeds.length > 0) setMedicines(cachedMeds);
      if (cachedRems.length > 0) setReminders(cachedRems);
      if (cachedLogs.length > 0) setDoseLogs(cachedLogs);
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

    const unsubMeds = onSnapshot(
      medsQuery,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Medicine)
        );
        setMedicines(data);
        storage.setItem(CLOUD_CACHE_MEDS_KEY, data);
      },
      (err) => console.error("Medicines listener error:", err)
    );

    const unsubRems = onSnapshot(
      remsQuery,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Reminder)
        );
        setReminders(data);
        storage.setItem(CLOUD_CACHE_REMS_KEY, data);
      },
      (err) => console.error("Reminders listener error:", err)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as DoseLog)
        );
        setDoseLogs(data);
        storage.setItem(CLOUD_CACHE_LOGS_KEY, data);
      },
      (err) => console.error("DoseLogs listener error:", err)
    );

    const unsubPats = onSnapshot(
      patsQuery,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Patient)
        );
        setPatients(data);
      },
      (err) => console.error("Patients listener error:", err)
    );

    const unsubWell = onSnapshot(
      wellQuery,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as WellnessLog)
        );
        setWellnessLogs(data);
      },
      (err) => console.error("WellnessLogs listener error:", err)
    );

    setIsDataLoading(false);

    // Cleanup listeners on unmount or dependency change
    return () => {
      unsubMeds();
      unsubRems();
      unsubLogs();
      unsubPats();
      unsubWell();
    };
  }, [currentUserId, storageMode, isAuthLoading]);

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

      const medData = sanitizeFirestoreData({
        ...med,
        userId: currentUserId,
        patientId: effectivePatientId || null,
        addedAt: new Date().toISOString(),
      });

      const docRef = await addDoc(collection(db, "medicines"), medData);
      newMed = { ...medData, id: docRef.id } as Medicine;
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
    } else {
      const docRef = doc(db, "medicines", id);
      await updateDoc(docRef, sanitizeFirestoreData(updates));
    }
  };

  const deleteMedicine = async (id: string) => {
    if (storageMode === "local") {
      await localPersistence.medicines.remove(id);
      setMedicines((p) => p.filter((m) => m.id !== id));
    } else {
      const docRef = doc(db, "medicines", id);
      await deleteDoc(docRef);
    }
  };

  const addReminder = async (rem: Omit<Reminder, "id" | "createdAt">) => {
    let newReminder: Reminder;

    if (storageMode === "local") {
      newReminder = await localPersistence.reminders.create(rem);
      setReminders((p) => [...p, newReminder]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");

      // Use Firestore directly for unique ID and persistence
      // Use the explicit patientId from the caller if provided (e.g. from AddReminderPage),
      // otherwise fall back to the global selectedPatientId context.
      const effectivePatientId =
        rem.patientId !== undefined ? rem.patientId : selectedPatientId;
      const remData = sanitizeFirestoreData({
        ...rem,
        medicineId: rem.medicineId || null,
        userId: currentUserId,
        patientId: effectivePatientId || null,
        createdAt: new Date().toISOString(),
      });

      const docRef = await addDoc(collection(db, "reminders"), remData);
      newReminder = { ...remData, id: docRef.id } as Reminder;
    }
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    if (storageMode === "local") {
      await localPersistence.reminders.update(id, updates);
      setReminders((p) =>
        p.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    } else {
      const docRef = doc(db, "reminders", id);
      await updateDoc(docRef, sanitizeFirestoreData(updates));
    }
  };

  const deleteReminder = async (id: string) => {
    if (storageMode === "local") {
      await localPersistence.reminders.remove(id);
      setReminders((p) => p.filter((r) => r.id !== id));
    } else {
      const docRef = doc(db, "reminders", id);
      await deleteDoc(docRef);
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
      // Derive patientId from the reminder's own patientId field (not selectedPatientId)
      // so family member dose logs are always scoped correctly regardless of the
      // currently viewed profile.
      const logData = sanitizeFirestoreData({
        ...log,
        userId: currentUserId,
        patientId: effectivePatientId,
        actionTime: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "doseLogs"), logData);
      newLog = { ...logData, id: docRef.id } as DoseLog;
    }

    // 1. Update Medicine Inventory if taken
    let freshMeds = medicines;
    if (reminder && reminder.medicineId && log.action === "taken") {
      const medicine = medicines.find((m) => m.id === reminder.medicineId);
      if (
        medicine &&
        medicine.currentQuantity !== undefined &&
        medicine.dosagePerDose
      ) {
        const newQuantity = Math.max(
          0,
          medicine.currentQuantity - medicine.dosagePerDose
        );
        await updateMedicine(medicine.id, { currentQuantity: newQuantity });

        freshMeds = medicines.map((m) =>
          m.id === medicine.id ? { ...m, currentQuantity: newQuantity } : m
        );

        // Optional: Trigger refill toast if low
        if (newQuantity <= medicine.dosagePerDose * 5) {
          toast({
            title: t("reminders.low_stock_warning"),
            description: `${medicine.name}: ${newQuantity} ${
              medicine.unit || "units"
            } remaining.`,
            variant: "destructive",
          });
        }
      }
    }

    // 1.5. Dynamic Schedule Adjustment
    // If a dose is taken early/late, automatically update the base reminder times
    // to maintain equal intervals starting from the new actual take time.
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

      // Only shift if deviation is between 1 minute and 4 hours
      if (Math.abs(diffMinutes) >= 1 && Math.abs(diffMinutes) <= 240) {
        const times = reminder.time.split(",").map((t) => t.trim());
        const freq = times.length;

        // Find which slot index this log corresponds to
        const schHHmm = `${scheduledDate
          .getHours()
          .toString()
          .padStart(2, "0")}:${scheduledDate
          .getMinutes()
          .toString()
          .padStart(2, "0")}`;
        let slotIndex = times.indexOf(schHHmm);

        if (slotIndex === -1) {
          const schMins =
            scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
          let minDiff = Infinity;
          times.forEach((t, i) => {
            const [h, m] = t.split(":").map(Number);
            const diff = Math.abs(h * 60 + m - schMins);
            if (diff < minDiff) {
              minDiff = diff;
              slotIndex = i;
            }
          });
        }

        if (slotIndex !== -1) {
          const intervalMinutes = (24 * 60) / freq;
          const actH = actualDate.getHours();
          const actM = actualDate.getMinutes();

          const newTimes = times.map((_, i) => {
            const distance = i - slotIndex;
            const totalMinutes =
              (((actH * 60 + actM + distance * intervalMinutes) % (24 * 60)) +
                24 * 60) %
              (24 * 60);
            const h = Math.floor(totalMinutes / 60);
            const m = Math.floor(totalMinutes % 60);
            return `${h.toString().padStart(2, "0")}:${m
              .toString()
              .padStart(2, "0")}`;
          });

          const newTimeStr = newTimes.join(",");
          if (newTimeStr !== reminder.time) {
            console.log(
              `[DynamicSchedule] Shifting ${reminder.medicineName} from ${reminder.time} to ${newTimeStr}`
            );

            // 1. Update the reminder itself
            await updateReminder(reminder.id, { time: newTimeStr });
            reminder.time = newTimeStr;

            // 2. Update the log's scheduledTime to match the new schedule
            // This prevents "double-shifting" in the UI (virtual shift + permanent shift)
            const newScheduledISO = new Date(scheduledDate);
            newScheduledISO.setHours(actH, actM, 0, 0);
            const newScheduledTime = newScheduledISO.toISOString();

            if (storageMode === "local") {
              await localPersistence.doseLogs.update(newLog.id, {
                scheduledTime: newScheduledTime,
              });
            } else {
              const logDocRef = doc(db, "doseLogs", newLog.id);
              await updateDoc(logDocRef, { scheduledTime: newScheduledTime });
            }

            // Update local references for immediate UI consistency
            newLog.scheduledTime = newScheduledTime;
            setDoseLogs((prev) =>
              prev.map((l) =>
                l.id === newLog.id ? { ...l, scheduledTime: newScheduledTime } : l
              )
            );

            if (Math.abs(diffMinutes) >= 5) {
              const direction = diffMinutes > 0 ? "later" : "earlier";
              toast({
                title: "Schedule Adjusted",
                description: `Shifted ${
                  reminder.medicineName
                } ${Math.abs(
                  diffMinutes
                )}m ${direction} to maintain your dose intervals.`,
              });
            }
          }
        }
      }
    }

    // 2. Reschedule notifications immediately so remaining slots fire at the shifted time
    if (log.action === "taken" && reminder) {
      const freshLogs =
        storageMode === "local"
          ? await localPersistence.doseLogs.getAll()
          : [...doseLogs, newLog];
      scheduleReminders(reminders, freshLogs, freshMeds);

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
          const suggestedTimes = reminder.time.split(",").map((t) => {
            const [h, m] = t.trim().split(":").map(Number);
            const total =
              (((h * 60 + m + avgOffset) % (24 * 60)) + 24 * 60) % (24 * 60);
            return `${Math.floor(total / 60)
              .toString()
              .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
          });
          const direction = allLate ? "late" : "early";
          toast({
            title: "💡 Smart Schedule Suggestion",
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
    if (storageMode === "local") {
      const newLog = await localPersistence.wellnessLogs.create({
        ...log,
        patientId: selectedPatientId || null,
      });
      setWellnessLogs((p) => [newLog, ...p]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      const logData = sanitizeFirestoreData({
        ...log,
        userId: currentUserId,
        patientId: selectedPatientId || null,
        timestamp: new Date().toISOString(),
      });
      await addDoc(collection(db, "wellnessLogs"), logData);
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
      const patientData = sanitizeFirestoreData({
        ...patient,
        managedBy: currentUserId,
        createdAt: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "patients"), patientData);
      setPatients((prev) => [
        ...prev,
        { ...patientData, id: docRef.id } as Patient,
      ]);
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
      const docRef = doc(db, "patients", id);
      await updateDoc(docRef, sanitizeFirestoreData(updates));
      setPatients((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    }
  };

  const deletePatient = async (id: string) => {
    // Cascade delete associated items
    const relatedMeds = medicines.filter((m) => m.patientId === id);
    for (const med of relatedMeds) {
      await deleteMedicine(med.id);
    }

    const relatedRems = reminders.filter((r) => r.patientId === id);
    for (const rem of relatedRems) {
      await deleteReminder(rem.id);
    }

    const relatedLogs = doseLogs.filter((l) => l.patientId === id);
    for (const l of relatedLogs) {
      await deleteDoseLog(l.id);
    }

    // Optimistic local update for wellness logs
    setWellnessLogs((prev) => prev.filter((w) => w.patientId !== id));

    if (storageMode === "local") {
      await localPersistence.patients.remove(id);
      setPatients((prev) => prev.filter((p) => p.id !== id));
    } else {
      if (!currentUserId) throw new Error("Not logged in");

      // Delete wellness logs from cloud
      try {
        const wQuery = query(
          collection(db, "wellnessLogs"),
          where("patientId", "==", id),
          where("userId", "==", currentUserId)
        );
        const snapshot = await getDocs(wQuery);
        snapshot.forEach((docSnap) => {
          deleteDoc(doc(db, "wellnessLogs", docSnap.id)).catch(console.error);
        });
      } catch (e) {
        console.error("Failed to cascade delete wellness logs:", e);
      }

      const docRef = doc(db, "patients", id);
      await deleteDoc(docRef);
      setPatients((prev) => prev.filter((p) => p.id !== id));
    }

    if (selectedPatientId === id) setSelectedPatientId(null);
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
  }, [setIsProfessionalMode]);

  return (
    <AppContext.Provider
      value={{
        medicines,
        reminders,
        doseLogs,
        patients,
        wellnessLogs,
        userProfile,
        storageMode,
        isLoggedIn,
        needsOnboarding,
        hasSeenWelcome,
        currentUserId,
        selectedPatientId,
        isProfessionalMode,
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
