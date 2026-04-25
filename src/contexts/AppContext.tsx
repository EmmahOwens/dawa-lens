import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getRxCUI } from "../services/interactionChecker";
import { medicinesApi, remindersApi, doseLogsApi, usersApi, patientsApi, wellnessApi } from "../services/api";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { localPersistence } from "../services/localPersistence";
import { scheduleReminders } from "../services/reminderService";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { toast } from "../hooks/use-toast";
import { useTranslation } from "react-i18next";
import { storage } from "../lib/storage";

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const CLOUD_CACHE_REMS_KEY = "dawa_cloud_cache_reminders";
const CLOUD_CACHE_MEDS_KEY = "dawa_cloud_cache_medicines";
const CLOUD_CACHE_LOGS_KEY = "dawa_cloud_cache_doselogs";

export type Medicine = {
  id: string;           // maps to Firestore doc.id
  name: string;
  genericName?: string;
  dosage: string;       // e.g. "500mg"
  totalQuantity?: number; // Starting amount
  currentQuantity?: number; // What's left
  dosagePerDose?: number; // e.g. 1 
  unit?: string;         // "tablets", "ml", etc.
  imageUrl?: string;
  notes?: string;
  rxcui?: string;
  addedAt: string;
  updatedAt?: string;
  isConflict?: boolean;
  color?: string;
  icon?: string;
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
};

export type DoseLog = {
  id: string;
  reminderId: string;
  medicineName: string;
  dose: string;
  scheduledTime: string;
  actionTime: string;
  action: "taken" | "skipped" | "snoozed" | "missed";
};

export type WellnessLog = {
  id: string;
  type: "food" | "symptom";
  timestamp: string;
  data: any; // e.g., { meal: "...", risk: "..." } or { mood: 4, symptoms: [] }
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

export type Patient = {
  id: string;
  name: string;
  age?: number;
  gender?: "male" | "female" | "other";
  relation?: string; // e.g. "Mother", "Client"
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
  
  addMedicine: (med: Omit<Medicine, "id" | "addedAt">) => Promise<Medicine>;
  updateMedicine: (id: string, updates: Partial<Medicine>) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  addReminder: (rem: Omit<Reminder, "id" | "createdAt">) => Promise<void>;
  updateReminder: (id: string, rem: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  logDose: (log: Omit<DoseLog, "id" | "actionTime">) => Promise<void>;
  deleteDoseLog: (id: string) => Promise<void>;
  addWellnessLog: (log: Omit<WellnessLog, "id" | "timestamp" | "userId">) => Promise<void>;
  
  addPatient: (patient: Omit<Patient, "id" | "createdAt" | "managedBy">) => Promise<void>;
  setSelectedPatientId: (id: string | null) => void;
  setIsProfessionalMode: (v: boolean) => void;

  setStorageMode: (v: "local" | "cloud") => void;
  setIsLoggedIn: (v: boolean) => void;
  setNeedsOnboarding: (v: boolean) => void;
  setHasSeenWelcome: (v: boolean) => void;
  completeOnboarding: (profile: Omit<UserProfile, "id">) => Promise<void>;
  loginUser: (userId: string, email: string) => void;
  logoutUser: () => void;
  clearAllData: () => void;
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
    "dawa_local_doselogs"
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

/** Normalize a MongoDB doc's _id → id for the frontend. */
function normalize<T extends { _id?: string; id?: string }>(doc: T): T & { id: string } {
  const id = doc._id || doc.id || "";
  const { _id, ...rest } = doc as any;
  return { ...rest, id };
}

/** Remove undefined fields so Firestore doesn't throw an error. */
function sanitizeFirestoreData(data: any) {
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
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
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isProfessionalMode, setIsProfessionalModeState] = useState(() => loadLocal("med_professional_mode", false));
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => loadLocal("med_has_seen_welcome", false));
  
  const [storageMode, setStorageMode] = useState<"local" | "cloud">(() => loadLocal("med_storage_mode", "cloud"));
  const [isLoggedIn, setIsLoggedIn] = useState(() => loadLocal("med_loggedin", false));
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => loadLocal("med_userId", null));
  const [isDawaGPTOpen, setIsDawaGPTOpen] = useState(false);
  const [isIntelligenceCollapsed, setIntelligenceCollapsedState] = useState(() => loadLocal("med_intelligence_collapsed", false));
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(() => loadLocal("med_last_sync", null));
  const [rememberMe, setRememberMeState] = useState(() => loadLocal("med_remember_me", true));
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Initialize persistence on load
  useEffect(() => {
    const mode = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    setPersistence(auth, mode).catch(err => console.error("Initial persistence error:", err));
  }, []);

  const setIsProfessionalMode = useCallback(async (v: boolean) => {
    setIsProfessionalModeState(v);
    storage.setItem("med_professional_mode", v);
    localStorage.setItem("med_professional_mode", JSON.stringify(v));
    
    // Sync to cloud if logged in
    if (storageMode === "cloud" && currentUserId) {
      try {
        const docRef = doc(db, "users", currentUserId);
        await setDoc(docRef, { isProfessional: v }, { merge: true });
        setUserProfile(p => p ? { ...p, isProfessional: v } : null);
      } catch (err) {
        console.error("Failed to sync professional mode to cloud:", err);
      }
    }
  }, [currentUserId, storageMode]);
  
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
    setPersistence(auth, mode).catch(err => console.error("Failed to set auth persistence:", err));
  }, []);

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!currentUserId) return;
    
    // Optimistic update
    setUserProfile(p => p ? { ...p, ...updates } : null);
    
    if (storageMode === "cloud") {
      try {
        const docRef = doc(db, "users", currentUserId);
        await setDoc(docRef, updates, { merge: true });
        // Also sync to MongoDB via API if needed, but for now Firestore is primary for profile
        await usersApi.upsertProfile({ uid: currentUserId, ...updates });
      } catch (err) {
        console.error("Failed to update user profile:", err);
      }
    }
  }, [currentUserId, storageMode]);


  // Persist simple flags to localStorage (no sensitive data, just UI state)
  useEffect(() => { storage.setItem("med_storage_mode", storageMode); }, [storageMode]);
  
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

  useEffect(() => { storage.setItem("med_has_seen_welcome", hasSeenWelcome); }, [hasSeenWelcome]);
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
  const isInitializing = isDataLoading || isAuthLoading;

  // Fetch all data based on storageMode
  useEffect(() => {
    const fetchAll = async () => {
      // Step 0: Migrate from localStorage if needed (first run after update)
      const wasMigrated = await migrateLocalStorage();
      
      // Step 1: Load essential settings from async storage
      if (wasMigrated || true) {
        const [profMode, welcome, sMode, loggedIn, uId, intelCol, sync, remember] = await Promise.all([
          storage.getItem("med_professional_mode", false),
          storage.getItem("med_has_seen_welcome", false),
          storage.getItem("med_storage_mode", "cloud" as const),
          storage.getItem("med_loggedin", false),
          storage.getItem("med_userId", null as string | null),
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
      }

      if (storageMode === "local") {
        const [pMeds, pRems, pLogs] = await Promise.all([
          localPersistence.medicines.getAll(),
          localPersistence.reminders.getAll(),
          localPersistence.doseLogs.getAll(),
        ]);
        setMedicines(pMeds);
        setReminders(pRems);
        setDoseLogs(pLogs);
        setIsDataLoading(false);
        return;
      }

      if (!currentUserId && !isAuthLoading) {
        setIsDataLoading(false);
        return;
      }

      if (!currentUserId) return;

      try {
        // Evaluate profile via Firestore directly
        let prof: any = null;
        try {
          const docRef = doc(db, "users", currentUserId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            prof = docSnap.data();
          }
        } catch (profileErr: any) {
          console.error("Firestore error fetching profile — skipping onboarding check:", profileErr);
        }

        if (prof) {
          if (!prof.dateOfBirth || !prof.gender) {
            setNeedsOnboarding(true);
            setUserProfile({ ...prof, id: currentUserId } as UserProfile);
          } else {
            setNeedsOnboarding(false);
            setUserProfile({ ...prof, id: currentUserId } as UserProfile);
            setIsProfessionalMode(prof.isProfessional || false);
          }
        } else {
          console.warn("User profile not found — prompting onboarding.");
          setNeedsOnboarding(true);
        }

        // Load from cache first for instant retrieval (Async from IndexedDB)
        const [cachedRems, cachedMeds, cachedLogs] = await Promise.all([
          storage.getItem<Reminder[]>(CLOUD_CACHE_REMS_KEY, []),
          storage.getItem<Medicine[]>(CLOUD_CACHE_MEDS_KEY, []),
          storage.getItem<DoseLog[]>(CLOUD_CACHE_LOGS_KEY, []),
        ]);
        
        if (cachedRems.length > 0 && reminders.length === 0) setReminders(cachedRems);
        if (cachedMeds.length > 0 && medicines.length === 0) setMedicines(cachedMeds);
        if (cachedLogs.length > 0 && doseLogs.length === 0) setDoseLogs(cachedLogs);

        const [meds, rems, logs, pats, wells] = await Promise.all([
          medicinesApi.getAll(currentUserId, selectedPatientId || undefined).catch(err => { console.error(err); return null; }),
          remindersApi.getAll(currentUserId, selectedPatientId || undefined).catch(err => { console.error(err); return null; }),
          doseLogsApi.getAll(currentUserId, selectedPatientId || undefined).catch(err => { console.error(err); return null; }),
          patientsApi.getAll(currentUserId).catch(err => { console.error(err); return null; }),
          wellnessApi.getAll(currentUserId, selectedPatientId || undefined).catch(err => { console.error(err); return null; }),
        ]);
        
        if (meds) {
          const normalizedMeds = meds.map(normalize);
          setMedicines(normalizedMeds);
          storage.setItem(CLOUD_CACHE_MEDS_KEY, normalizedMeds);
        }
        if (rems) {
          const normalizedRems = rems.map(normalize);
          setReminders(normalizedRems);
          storage.setItem(CLOUD_CACHE_REMS_KEY, normalizedRems);
        }
        if (logs) {
          const normalizedLogs = logs.map(normalize);
          setDoseLogs(normalizedLogs);
          storage.setItem(CLOUD_CACHE_LOGS_KEY, normalizedLogs);
        }
        if (pats) setPatients(pats.map(normalize));
        if (wells) setWellnessLogs(wells.map(normalize));
      } catch (err) {
        console.error("Failed to load data from backend:", err);
      } finally {
        setIsDataLoading(false);
      }
    };

    if (!isAuthLoading) {
      fetchAll();
    }
  }, [currentUserId, storageMode, selectedPatientId, isAuthLoading]);

  const completeOnboarding = async (profile: Omit<UserProfile, "id">) => {
    if (!currentUserId) throw new Error("Not logged in");
    const docRef = doc(db, "users", currentUserId);
    await setDoc(docRef, profile, { merge: true });
    setUserProfile({ ...profile, id: currentUserId } as UserProfile);
    setNeedsOnboarding(false);
  };

  // --- CRUD Operations ---

  const addMedicine = async (med: Omit<Medicine, "id" | "addedAt">): Promise<Medicine> => {
    let newMed: Medicine;
    
    if (storageMode === "local") {
      newMed = await localPersistence.medicines.create(med);
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      
      const medData = sanitizeFirestoreData({
        ...med,
        userId: currentUserId,
        patientId: selectedPatientId || null,
        addedAt: new Date().toISOString()
      });

      // Use Firestore for ID and persistence
      const docRef = await addDoc(collection(db, "medicines"), medData);
      newMed = { ...medData, id: docRef.id } as Medicine;

      // Also sync to MongoDB via API (fire and forget)
      medicinesApi.create({ ...medData, _id: docRef.id }).catch(err => console.error("API Sync failed:", err));
    }
    
    const updated = [...medicines, newMed];
    setMedicines(updated);
    if (storageMode === "cloud") {
      localStorage.setItem(CLOUD_CACHE_MEDS_KEY, JSON.stringify(updated));
    }

    // Fetch RxCUI in background
    if (!newMed.rxcui) {
      getRxCUI(newMed.name).then(async (rxcui) => {
        if (rxcui) {
          if (storageMode === "local") {
            await localPersistence.medicines.update(newMed.id, { rxcui });
          } else {
            await medicinesApi.update(newMed.id, { rxcui });
          }
          
          setMedicines((p) => {
            const next = p.map((m) => (m.id === newMed.id ? { ...m, rxcui } : m));
            if (storageMode === "cloud") {
              localStorage.setItem(CLOUD_CACHE_MEDS_KEY, JSON.stringify(next));
            }
            return next;
          });
        }
      }).catch(err => console.error("Failed to fetch RxCUI:", err));
    }

    return newMed;
  };

  const updateMedicine = async (id: string, updates: Partial<Medicine>) => {
    if (storageMode === "local") {
      await localPersistence.medicines.update(id, updates);
    } else {
      const docRef = doc(db, "medicines", id);
      const sanitizedUpdates = sanitizeFirestoreData(updates);
      await updateDoc(docRef, sanitizedUpdates);
      await medicinesApi.update(id, sanitizedUpdates);
    }
    
    const updated = medicines.map((m) => (m.id === id ? { ...m, ...updates } : m));
    setMedicines(updated);
    if (storageMode === "cloud") {
      localStorage.setItem(CLOUD_CACHE_MEDS_KEY, JSON.stringify(updated));
    }
  };

  const deleteMedicine = async (id: string) => {
    if (storageMode === "local") {
      await localPersistence.medicines.remove(id);
    } else {
      const docRef = doc(db, "medicines", id);
      await deleteDoc(docRef);
      await medicinesApi.remove(id);
    }
    
    const updated = medicines.filter((m) => m.id !== id);
    setMedicines(updated);
    if (storageMode === "cloud") {
      localStorage.setItem(CLOUD_CACHE_MEDS_KEY, JSON.stringify(updated));
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
      const remData = sanitizeFirestoreData({
        ...rem,
        medicineId: rem.medicineId || null,
        userId: currentUserId,
        patientId: selectedPatientId || null,
        createdAt: new Date().toISOString()
      });

      const docRef = await addDoc(collection(db, "reminders"), remData);
      newReminder = { ...remData, id: docRef.id } as Reminder;

      // Also sync to MongoDB via API (fire and forget)
      remindersApi.create({ ...remData, _id: docRef.id }).catch(err => console.error("API Sync failed:", err));

      const updated = [...reminders, newReminder];
      setReminders(updated);
      localStorage.setItem(CLOUD_CACHE_REMS_KEY, JSON.stringify(updated));
    }
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    if (storageMode === "local") {
      await localPersistence.reminders.update(id, updates);
    } else {
      // Update Firestore
      const docRef = doc(db, "reminders", id);
      const sanitizedUpdates = sanitizeFirestoreData(updates);
      await updateDoc(docRef, sanitizedUpdates);

      // Update API
      await remindersApi.update(id, sanitizedUpdates);
    }
    
    const updated = reminders.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setReminders(updated);
    if (storageMode === "cloud") {
      localStorage.setItem(CLOUD_CACHE_REMS_KEY, JSON.stringify(updated));
    }
  };

  const deleteReminder = async (id: string) => {
    if (storageMode === "local") {
      await localPersistence.reminders.remove(id);
    } else {
      // Delete from Firestore
      const docRef = doc(db, "reminders", id);
      await deleteDoc(docRef);

      // Delete from API
      await remindersApi.remove(id);
    }
    
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);
    if (storageMode === "cloud") {
      localStorage.setItem(CLOUD_CACHE_REMS_KEY, JSON.stringify(updated));
    }
  };

  const logDose = async (log: Omit<DoseLog, "id" | "actionTime">) => {
    let newLog: DoseLog;
    if (storageMode === "local") {
      newLog = await localPersistence.doseLogs.create(log);
      setDoseLogs((p) => [...p, newLog]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      const created = await doseLogsApi.create({ ...log, userId: currentUserId, patientId: selectedPatientId });
      newLog = normalize(created) as DoseLog;
      
      const updated = [...doseLogs, newLog];
      setDoseLogs(updated);
      localStorage.setItem(CLOUD_CACHE_LOGS_KEY, JSON.stringify(updated));
    }

    // 1. Update Medicine Inventory if taken
    const reminder = reminders.find(r => r.id === log.reminderId);
    if (reminder && reminder.medicineId && log.action === "taken") {
      const medicine = medicines.find(m => m.id === reminder.medicineId);
      if (medicine && medicine.currentQuantity !== undefined && medicine.dosagePerDose) {
        const newQuantity = Math.max(0, medicine.currentQuantity - medicine.dosagePerDose);
        await updateMedicine(medicine.id, { currentQuantity: newQuantity });

        // Optional: Trigger refill toast if low
        if (newQuantity <= (medicine.dosagePerDose * 5)) {
          toast({
            title: t("reminders.low_stock_warning"),
            description: `${medicine.name}: ${newQuantity} ${medicine.unit || 'units'} remaining.`,
            variant: "destructive"
          });
        }
      }
    }

    // 2. If it's a "once" reminder, auto-delete it after logging (taken, skipped, or missed)
    if (reminder && reminder.repeatSchedule === "once" && (log.action === "taken" || log.action === "skipped" || log.action === "missed")) {
      console.log(`Auto-deleting one-time reminder: ${reminder.medicineName}`);
      await deleteReminder(reminder.id);
    }
  };

  const deleteDoseLog = async (id: string) => {
    if (storageMode === "local") {
      await localPersistence.doseLogs.remove(id);
    } else {
      await doseLogsApi.remove(id);
    }
    const updated = doseLogs.filter((l) => l.id !== id);
    setDoseLogs(updated);
    if (storageMode === "cloud") {
      localStorage.setItem(CLOUD_CACHE_LOGS_KEY, JSON.stringify(updated));
    }
  };

  const addWellnessLog = async (log: Omit<WellnessLog, "id" | "timestamp" | "userId">) => {
    if (storageMode === "local") {
       // Simple local save for wellness (optional, mainly cloud focused for AI)
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      const created = await wellnessApi.log({ ...log, userId: currentUserId, patientId: selectedPatientId });
      setWellnessLogs((p) => [normalize(created) as WellnessLog, ...p]);
    }
  };

  const syncLocalToCloud = useCallback(async () => {
    if (!currentUserId || storageMode === "local") return;

    const [localMeds, localRems, localLogs] = await Promise.all([
      localPersistence.medicines.getAll(),
      localPersistence.reminders.getAll(),
      localPersistence.doseLogs.getAll(),
    ]);

    if (localMeds.length === 0 && localRems.length === 0 && localLogs.length === 0) return;

    try {
      // 1. Sync Medicines
      const syncedMedNames = new Set(medicines.map(m => m.name.toLowerCase()));
      for (const med of localMeds) {
        // Conflict check: same name in state OR already synced this loop
        if (syncedMedNames.has(med.name.toLowerCase())) {
          // Mark as conflict but don't stop
          setMedicines(p => p.map(m => m.name.toLowerCase() === med.name.toLowerCase() ? { ...m, isConflict: true } : m));
          continue;
        }

        syncedMedNames.add(med.name.toLowerCase());
        const { id, addedAt, ...data } = med;
        const created = await medicinesApi.create({ ...data, userId: currentUserId });
        setMedicines(p => [...p, normalize(created)]);
      }

      // 2. Sync Reminders
      for (const rem of localRems) {
        const { id, createdAt, ...data } = rem;
        const created = await remindersApi.create({ ...data, userId: currentUserId });
        setReminders(p => [...p, normalize(created)]);
      }

      // 3. Sync Logs
      for (const log of localLogs) {
        const { id, actionTime, ...data } = log;
        const created = await doseLogsApi.create({ ...data, userId: currentUserId });
        setDoseLogs(p => [...p, normalize(created)]);
      }

      // Clear local storage after successful sync
      localStorage.removeItem(LOCAL_MEDS_KEY);
      localStorage.removeItem("dawa_local_reminders");
      localStorage.removeItem("dawa_local_doselogs");

      // Update cloud cache with merged results
      localStorage.setItem(CLOUD_CACHE_MEDS_KEY, JSON.stringify(medicines));
      localStorage.setItem(CLOUD_CACHE_REMS_KEY, JSON.stringify(reminders));
      localStorage.setItem(CLOUD_CACHE_LOGS_KEY, JSON.stringify(doseLogs));

      toast({
        title: t("settings.sync_complete"),
        description: "Your local data is now backed up to your cloud profile.",
      });

      const now = new Date().toISOString();
      setLastSyncTimestamp(now);
      localStorage.setItem("med_last_sync", JSON.stringify(now));

    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [currentUserId, storageMode, medicines]);

  const addPatient = async (patient: Omit<Patient, "id" | "createdAt" | "managedBy">) => {
    if (!currentUserId) throw new Error("Not logged in");
    const created = await patientsApi.create({ ...patient, managedBy: currentUserId });
    setPatients((p) => [...p, normalize(created) as Patient]);
  };

  const clearAllData = useCallback(() => {
    // 1. Wipe State
    setMedicines([]);
    setReminders([]);
    setDoseLogs([]);
    setPatients([]);
    setWellnessLogs([]);
    setSelectedPatientId(null);

    // 2. Wipe Local Storage (Personal Data)
    localStorage.removeItem("dawa_local_medicines");
    localStorage.removeItem("dawa_local_reminders");
    localStorage.removeItem("dawa_local_doselogs");
    
    // 3. Reset Professional Settings if any
    setIsProfessionalMode(false);
  }, [setIsProfessionalMode]);

  return (
    <AppContext.Provider
      value={{
        medicines, reminders, doseLogs, patients, wellnessLogs, userProfile, storageMode, isLoggedIn, needsOnboarding, hasSeenWelcome, currentUserId, selectedPatientId, isProfessionalMode,
        addMedicine, updateMedicine, deleteMedicine, addReminder, updateReminder, deleteReminder,
        logDose, deleteDoseLog, addPatient, addWellnessLog, setSelectedPatientId, setIsProfessionalMode, setStorageMode, setIsLoggedIn, setNeedsOnboarding, setHasSeenWelcome, completeOnboarding, loginUser, logoutUser, clearAllData, syncLocalToCloud, isInitializing,
        isDawaGPTOpen, setIsDawaGPTOpen, isIntelligenceCollapsed, setIsIntelligenceCollapsed,
        lastSyncTimestamp, updateUserProfile, rememberMe, setRememberMe
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
