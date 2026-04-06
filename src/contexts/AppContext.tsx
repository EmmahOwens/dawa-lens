import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getRxCUI } from "../services/interactionChecker";
import { medicinesApi, remindersApi, doseLogsApi, usersApi } from "../services/api";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { localPersistence } from "../services/localPersistence";

export type Medicine = {
  id: string;           // maps to MongoDB _id
  name: string;
  genericName?: string;
  dosage: string;
  imageUrl?: string;
  notes?: string;
  rxcui?: string;
  addedAt: string;
  isConflict?: boolean;
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
};

export type DoseLog = {
  id: string;
  reminderId: string;
  medicineName: string;
  dose: string;
  scheduledTime: string;
  actionTime: string;
  action: "taken" | "skipped" | "snoozed";
};

export type UserProfile = {
  id: string;
  name: string;
  dateOfBirth: string | null;
  gender: "male" | "female" | null;
};

type AppContextType = {
  medicines: Medicine[];
  reminders: Reminder[];
  doseLogs: DoseLog[];
  userProfile: UserProfile | null;
  storageMode: "local" | "cloud";
  isLoggedIn: boolean;
  needsOnboarding: boolean;
  currentUserId: string | null;
  addMedicine: (med: Omit<Medicine, "id" | "addedAt">) => Promise<Medicine>;
  updateMedicine: (id: string, updates: Partial<Medicine>) => Promise<void>;
  addReminder: (rem: Omit<Reminder, "id" | "createdAt">) => Promise<void>;
  updateReminder: (id: string, rem: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  logDose: (log: Omit<DoseLog, "id" | "actionTime">) => Promise<void>;
  setStorageMode: (v: "local" | "cloud") => void;
  setIsLoggedIn: (v: boolean) => void;
  setNeedsOnboarding: (v: boolean) => void;
  completeOnboarding: (profile: Omit<UserProfile, "id">) => Promise<void>;
  loginUser: (userId: string, email: string) => void;
  logoutUser: () => void;
  clearAllData: () => void;
  syncLocalToCloud: () => Promise<void>;
  isInitializing: boolean;
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

/** Normalize a MongoDB doc's _id → id for the frontend. */
function normalize<T extends { _id?: string; id?: string }>(doc: T): T & { id: string } {
  const id = doc._id || doc.id || "";
  const { _id, ...rest } = doc as any;
  return { ...rest, id };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  
  const [storageMode, setStorageMode] = useState<"local" | "cloud">(() => loadLocal("med_storage_mode", "cloud"));
  const [isLoggedIn, setIsLoggedIn] = useState(() => loadLocal("med_loggedin", false));
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => loadLocal("med_userId", null));

  // Persist simple flags to localStorage (no sensitive data, just UI state)
  useEffect(() => { localStorage.setItem("med_storage_mode", JSON.stringify(storageMode)); }, [storageMode]);
  useEffect(() => { localStorage.setItem("med_loggedin", JSON.stringify(isLoggedIn)); }, [isLoggedIn]);
  useEffect(() => { localStorage.setItem("med_userId", JSON.stringify(currentUserId)); }, [currentUserId]);

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
    });
    return () => unsubscribe();
  }, []);

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
    setMedicines([]);
    setReminders([]);
    setDoseLogs([]);
  }, []);

  const [isInitializing, setIsInitializing] = useState(true);

  // Fetch all data based on storageMode
  useEffect(() => {
    const fetchAll = async () => {
      if (storageMode === "local") {
        setMedicines(localPersistence.medicines.getAll());
        setReminders(localPersistence.reminders.getAll());
        setDoseLogs(localPersistence.doseLogs.getAll());
        setIsInitializing(false);
        return;
      }

      if (!currentUserId) {
        setIsInitializing(false);
        return;
      }

      try {
        // Evaluate profile first
        const prof = await usersApi.getProfile(currentUserId).catch(() => null);
        if (!prof || !prof.dateOfBirth || !prof.gender) {
          setNeedsOnboarding(true);
          setUserProfile(prof ? { ...prof, id: currentUserId } : null);
        } else {
          setNeedsOnboarding(false);
          setUserProfile({ ...prof, id: currentUserId });
        }

        const [meds, rems, logs] = await Promise.all([
          medicinesApi.getAll(currentUserId).catch(() => []),
          remindersApi.getAll(currentUserId).catch(() => []),
          doseLogsApi.getAll(currentUserId).catch(() => []),
        ]);
        setMedicines(meds.map(normalize));
        setReminders(rems.map(normalize));
        setDoseLogs(logs.map(normalize));
      } catch (err) {
        console.error("Failed to load data from backend:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    fetchAll();
  }, [currentUserId, storageMode]);

  const completeOnboarding = async (profile: Omit<UserProfile, "id">) => {
    if (!currentUserId) throw new Error("Not logged in");
    const updated = await usersApi.upsertProfile({ uid: currentUserId, ...profile });
    setUserProfile({ ...updated, id: currentUserId });
    setNeedsOnboarding(false);
  };

  // --- CRUD Operations ---

  const addMedicine = async (med: Omit<Medicine, "id" | "addedAt">): Promise<Medicine> => {
    let newMed: Medicine;
    
    if (storageMode === "local") {
      newMed = localPersistence.medicines.create(med);
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      const created = await medicinesApi.create({ ...med, userId: currentUserId });
      newMed = normalize(created) as Medicine;
    }
    
    setMedicines((p) => [...p, newMed]);

    // Fetch RxCUI in background
    if (!newMed.rxcui) {
      getRxCUI(newMed.name).then(async (rxcui) => {
        if (rxcui) {
          if (storageMode === "local") {
             localPersistence.medicines.update(newMed.id, { rxcui });
          } else {
             await medicinesApi.update(newMed.id, { rxcui });
          }
          setMedicines((p) => p.map((m) => (m.id === newMed.id ? { ...m, rxcui } : m)));
        }
      });
    }

    return newMed;
  };

  const updateMedicine = async (id: string, updates: Partial<Medicine>) => {
    if (storageMode === "local") {
      localPersistence.medicines.update(id, updates);
    } else {
      await medicinesApi.update(id, updates);
    }
    setMedicines((p) => p.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const addReminder = async (rem: Omit<Reminder, "id" | "createdAt">) => {
    if (storageMode === "local") {
      const created = localPersistence.reminders.create(rem);
      setReminders((p) => [...p, created]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      const created = await remindersApi.create({ ...rem, userId: currentUserId });
      setReminders((p) => [...p, normalize(created) as Reminder]);
    }
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    if (storageMode === "local") {
      localPersistence.reminders.update(id, updates);
    } else {
      await remindersApi.update(id, updates);
    }
    setReminders((p) => p.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteReminder = async (id: string) => {
    if (storageMode === "local") {
      localPersistence.reminders.remove(id);
    } else {
      await remindersApi.remove(id);
    }
    setReminders((p) => p.filter((r) => r.id !== id));
  };

  const logDose = async (log: Omit<DoseLog, "id" | "actionTime">) => {
    if (storageMode === "local") {
      const created = localPersistence.doseLogs.create(log);
      setDoseLogs((p) => [...p, created]);
    } else {
      if (!currentUserId) throw new Error("Not logged in");
      const created = await doseLogsApi.create({ ...log, userId: currentUserId });
      setDoseLogs((p) => [...p, normalize(created) as DoseLog]);
    }
  };

  const syncLocalToCloud = useCallback(async () => {
    if (!currentUserId || storageMode === "local") return;

    const localMeds = localPersistence.medicines.getAll();
    const localRems = localPersistence.reminders.getAll();
    const localLogs = localPersistence.doseLogs.getAll();

    if (localMeds.length === 0 && localRems.length === 0 && localLogs.length === 0) return;

    try {
      // 1. Sync Medicines
      for (const med of localMeds) {
        // Simple conflict check: same name
        const exists = medicines.some(m => m.name.toLowerCase() === med.name.toLowerCase());
        if (exists) {
          // Mark as conflict but don't stop
          setMedicines(p => p.map(m => m.name.toLowerCase() === med.name.toLowerCase() ? { ...m, isConflict: true } : m));
          continue;
        }

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
      localStorage.removeItem("dawa_local_medicines");
      localStorage.removeItem("dawa_local_reminders");
      localStorage.removeItem("dawa_local_doselogs");

    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [currentUserId, storageMode, medicines]);

  const clearAllData = () => {
    setMedicines([]);
    setReminders([]);
    setDoseLogs([]);
  };

  return (
    <AppContext.Provider
      value={{
        medicines, reminders, doseLogs, userProfile, storageMode, isLoggedIn, needsOnboarding, currentUserId,
        addMedicine, updateMedicine, addReminder, updateReminder, deleteReminder,
        logDose, setStorageMode, setIsLoggedIn, setNeedsOnboarding, completeOnboarding, loginUser, logoutUser, clearAllData, syncLocalToCloud, isInitializing
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
