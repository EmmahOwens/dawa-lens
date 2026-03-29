import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getRxCUI } from "../services/interactionChecker";

export type Medicine = {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  imageUrl?: string;
  notes?: string;
  rxcui?: string;
  addedAt: string;
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

type AppContextType = {
  medicines: Medicine[];
  reminders: Reminder[];
  doseLogs: DoseLog[];
  privacyMode: boolean;
  isLoggedIn: boolean;
  addMedicine: (med: Omit<Medicine, "id" | "addedAt">) => Medicine;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  addReminder: (rem: Omit<Reminder, "id" | "createdAt">) => void;
  updateReminder: (id: string, rem: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  logDose: (log: Omit<DoseLog, "id" | "actionTime">) => void;
  setPrivacyMode: (v: boolean) => void;
  setIsLoggedIn: (v: boolean) => void;
  clearAllData: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>(() => load("med_medicines", []));
  const [reminders, setReminders] = useState<Reminder[]>(() => load("med_reminders", []));
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>(() => load("med_doselogs", []));
  const [privacyMode, setPrivacyMode] = useState(() => load("med_privacy", false));
  const [isLoggedIn, setIsLoggedIn] = useState(() => load("med_loggedin", false));

  useEffect(() => { localStorage.setItem("med_medicines", JSON.stringify(medicines)); }, [medicines]);
  useEffect(() => { localStorage.setItem("med_reminders", JSON.stringify(reminders)); }, [reminders]);
  useEffect(() => { localStorage.setItem("med_doselogs", JSON.stringify(doseLogs)); }, [doseLogs]);
  useEffect(() => { localStorage.setItem("med_privacy", JSON.stringify(privacyMode)); }, [privacyMode]);
  useEffect(() => { localStorage.setItem("med_loggedin", JSON.stringify(isLoggedIn)); }, [isLoggedIn]);

  const addMedicine = (med: Omit<Medicine, "id" | "addedAt">) => {
    const newId = crypto.randomUUID();
    const newMed: Medicine = { ...med, id: newId, addedAt: new Date().toISOString() };
    setMedicines((p) => [...p, newMed]);
    
    if (!newMed.rxcui) {
      getRxCUI(newMed.name).then(rxcui => {
        if (rxcui) {
          setMedicines((p) => p.map((m) => (m.id === newId ? { ...m, rxcui } : m)));
        }
      });
    }

    return newMed;
  };

  const updateMedicine = (id: string, updates: Partial<Medicine>) => {
    setMedicines((p) => p.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const addReminder = (rem: Omit<Reminder, "id" | "createdAt">) => {
    setReminders((p) => [...p, { ...rem, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  };

  const updateReminder = (id: string, updates: Partial<Reminder>) => {
    setReminders((p) => p.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteReminder = (id: string) => {
    setReminders((p) => p.filter((r) => r.id !== id));
  };

  const logDose = (log: Omit<DoseLog, "id" | "actionTime">) => {
    setDoseLogs((p) => [...p, { ...log, id: crypto.randomUUID(), actionTime: new Date().toISOString() }]);
  };

  const clearAllData = () => {
    setMedicines([]);
    setReminders([]);
    setDoseLogs([]);
  };

  return (
    <AppContext.Provider
      value={{ medicines, reminders, doseLogs, privacyMode, isLoggedIn, addMedicine, updateMedicine, addReminder, updateReminder, deleteReminder, logDose, setPrivacyMode, setIsLoggedIn, clearAllData }}
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
