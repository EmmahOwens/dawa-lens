import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";

// Mock Firebase
vi.mock("../../lib/firebase", () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((callback) => {
      // In firebase-auth package, auth.onAuthStateChanged is called with the observer/callback as the first argument
      if (typeof callback === "function") {
        callback(null);
      } else if (callback && typeof callback.next === "function") {
        callback.next(null);
      }
      return vi.fn(); // return unsubscribe function
    }),
    setPersistence: vi.fn().mockResolvedValue(undefined),
  },
  db: {},
}));

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
    requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
    schedule: vi.fn(),
    cancel: vi.fn(),
    getPending: vi.fn().mockResolvedValue({ notifications: [] }),
    registerActionTypes: vi.fn(),
  },
}));

// Mock localPersistence
const mockLocalMedsGetAll = vi.fn().mockResolvedValue([]);
const mockLocalRemsGetAll = vi.fn().mockResolvedValue([]);
const mockLocalLogsGetAll = vi.fn().mockResolvedValue([]);
const mockLocalPatientsGetAll = vi.fn().mockResolvedValue([]);
const mockLocalWellGetAll = vi.fn().mockResolvedValue([]);
const mockLocalAuditGetAll = vi.fn().mockResolvedValue([]);

const mockLocalLogCreate = vi.fn();
const mockLocalRemUpdate = vi.fn();
const mockLocalLogUpdate = vi.fn();
const mockLocalAuditCreate = vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: "audit-123" }));

vi.mock("../../services/localPersistence", () => ({
  localPersistence: {
    medicines: { getAll: () => mockLocalMedsGetAll(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    reminders: {
      getAll: () => mockLocalRemsGetAll(),
      create: vi.fn(),
      update: (id: string, updates: any) => mockLocalRemUpdate(id, updates),
      remove: vi.fn(),
    },
    doseLogs: {
      getAll: () => mockLocalLogsGetAll(),
      create: (data: any) => mockLocalLogCreate(data),
      update: (id: string, updates: any) => mockLocalLogUpdate(id, updates),
      remove: vi.fn(),
    },
    patients: { getAll: () => mockLocalPatientsGetAll(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    wellnessLogs: { getAll: () => mockLocalWellGetAll(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    scheduleAuditLogs: {
      getAll: () => mockLocalAuditGetAll(),
      create: (data: any) => mockLocalAuditCreate(data),
      remove: vi.fn(),
    },
  },
}));

// Mock reminderService
const mockScheduleReminders = vi.fn();
vi.mock("../../services/reminderService", () => ({
  scheduleReminders: (rems: any, logs: any, meds: any) => mockScheduleReminders(rems, logs, meds),
  computeShiftOffset: vi.fn().mockReturnValue(0),
}));

// Mock storage
vi.mock("../../lib/storage", () => ({
  storage: {
    getItem: vi.fn().mockImplementation((key, fallback) => {
      if (key === "med_storage_mode") return Promise.resolve("local");
      return Promise.resolve(fallback);
    }),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock use-toast
vi.mock("../../hooks/use-toast", () => ({
  toast: vi.fn(),
}));

// Mock other dependencies
vi.mock("../../services/interactionChecker", () => ({
  getRxCUI: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../components/rive/RiveMoji", () => ({
  RiveMoji: () => null,
}));

vi.mock("../../services/offlineQueue", () => ({
  enqueueOp: vi.fn(),
  flushQueue: vi.fn(),
  clearQueue: vi.fn(),
  getPendingCount: vi.fn().mockReturnValue(0),
}));

vi.mock("../../lib/appLifecycle", () => ({
  onNetworkChange: vi.fn(() => vi.fn()),
  hasNetwork: vi.fn().mockReturnValue(true),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { AppProvider, useApp, Reminder } from "../AppContext";

const OriginalDate = global.Date;

describe("AppContext - logDose dynamic reminder time shifting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("med_storage_mode", JSON.stringify("local"));
  });

  it("should shift reminder times when a dose is taken early", async () => {
    const testReminder: Reminder = {
      id: "rem-123",
      medicineName: "Test Med",
      dose: "1 tablet",
      time: "21:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    mockLocalRemsGetAll.mockResolvedValue([testReminder]);
    mockLocalLogCreate.mockImplementation((data) => Promise.resolve({ ...data, id: "log-123", actionTime: new Date().toISOString() }));

    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    // Wait for the initialization effect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify reminder is loaded
    expect(result.current.reminders).toHaveLength(1);
    expect(result.current.reminders[0].id).toBe("rem-123");

    // Mock today's date so we can control scheduledTime difference
    const todayStr = new OriginalDate().toISOString().split("T")[0];
    const scheduledTime = `${todayStr}T21:00:00`;

    // Mock new Date() inside logDose to represent taking early at 20:50
    const mockActualDate = new OriginalDate(`${todayStr}T20:50:00`);
    const dateSpy = vi.spyOn(global, "Date").mockImplementation((...args) => {
      if ((args as any).length === 0) {
        return mockActualDate;
      }
      // @ts-ignore
      return new OriginalDate(...args);
    });

    await act(async () => {
      await result.current.logDose({
        reminderId: "rem-123",
        medicineName: "Test Med",
        dose: "1 tablet",
        scheduledTime,
        action: "taken",
      });
    });

    dateSpy.mockRestore();

    // Verify the reminder time was updated to 20:50
    expect(mockLocalRemUpdate).toHaveBeenCalledWith("rem-123", { time: "20:50" });
  });
});
