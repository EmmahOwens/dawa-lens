/**
 * Granular Zustand State Store for High-Frequency Clinical & Adherence Slices.
 *
 * Prevents whole-tree React re-renders during dose logging, reminder updates, and
 * background reconciliation so Android WebView maintains 60/120 FPS frame pacing,
 * while remaining 100% synchronized with `AppContext` (`useApp()`).
 */

import { create } from "zustand";
import type {
  DoseLog,
  Medicine,
  Patient,
  Reminder,
  ScheduleAuditLog,
  WellnessLog,
} from "@/contexts/AppContext";

type StateUpdater<T> = T | ((prev: T) => T);

export interface AppDataStoreState {
  medicines: Medicine[];
  reminders: Reminder[];
  doseLogs: DoseLog[];
  patients: Patient[];
  wellnessLogs: WellnessLog[];
  scheduleAuditLogs: ScheduleAuditLog[];
  isOnline: boolean;
  pendingOfflineOps: number;
  selectedPatientId: string | null;

  setMedicines: (updater: StateUpdater<Medicine[]>) => void;
  setReminders: (updater: StateUpdater<Reminder[]>) => void;
  setDoseLogs: (updater: StateUpdater<DoseLog[]>) => void;
  setPatients: (updater: StateUpdater<Patient[]>) => void;
  setWellnessLogs: (updater: StateUpdater<WellnessLog[]>) => void;
  setScheduleAuditLogs: (updater: StateUpdater<ScheduleAuditLog[]>) => void;
  setIsOnline: (updater: StateUpdater<boolean>) => void;
  setPendingOfflineOps: (updater: StateUpdater<number>) => void;
  setSelectedPatientId: (updater: StateUpdater<string | null>) => void;
}

function resolveUpdater<T>(prev: T, updater: StateUpdater<T>): T {
  return typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
}

export const useAppDataStore = create<AppDataStoreState>((set) => ({
  medicines: [],
  reminders: [],
  doseLogs: [],
  patients: [],
  wellnessLogs: [],
  scheduleAuditLogs: [],
  isOnline: true,
  pendingOfflineOps: 0,
  selectedPatientId: null,

  setMedicines: (updater) =>
    set((state) => ({ medicines: resolveUpdater(state.medicines, updater) })),
  setReminders: (updater) =>
    set((state) => ({ reminders: resolveUpdater(state.reminders, updater) })),
  setDoseLogs: (updater) =>
    set((state) => ({ doseLogs: resolveUpdater(state.doseLogs, updater) })),
  setPatients: (updater) =>
    set((state) => ({ patients: resolveUpdater(state.patients, updater) })),
  setWellnessLogs: (updater) =>
    set((state) => ({ wellnessLogs: resolveUpdater(state.wellnessLogs, updater) })),
  setScheduleAuditLogs: (updater) =>
    set((state) => ({
      scheduleAuditLogs: resolveUpdater(state.scheduleAuditLogs, updater),
    })),
  setIsOnline: (updater) =>
    set((state) => ({ isOnline: resolveUpdater(state.isOnline, updater) })),
  setPendingOfflineOps: (updater) =>
    set((state) => ({
      pendingOfflineOps: resolveUpdater(state.pendingOfflineOps, updater),
    })),
  setSelectedPatientId: (updater) =>
    set((state) => ({
      selectedPatientId: resolveUpdater(state.selectedPatientId, updater),
    })),
}));

// Granular selector hooks for zero-cascade component subscriptions
export const useMedicinesSlice = () => useAppDataStore((s) => s.medicines);
export const useRemindersSlice = () => useAppDataStore((s) => s.reminders);
export const useDoseLogsSlice = () => useAppDataStore((s) => s.doseLogs);
export const usePatientsSlice = () => useAppDataStore((s) => s.patients);
export const useWellnessLogsSlice = () => useAppDataStore((s) => s.wellnessLogs);
export const useScheduleAuditLogsSlice = () =>
  useAppDataStore((s) => s.scheduleAuditLogs);
