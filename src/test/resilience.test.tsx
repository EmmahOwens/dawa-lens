import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock idb-keyval with in-memory map for storage testing
const idbStore = new Map<string, any>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, val: any) => {
    idbStore.set(key, val);
  }),
  del: vi.fn(async (key: string) => {
    idbStore.delete(key);
  }),
  clear: vi.fn(async () => {
    idbStore.clear();
  }),
}));

// Mock Capacitor Plugins
const mockHapticsImpact = vi.fn().mockResolvedValue(undefined);
const mockHapticsNotification = vi.fn().mockResolvedValue(undefined);
const mockHapticsSelectionStart = vi.fn().mockResolvedValue(undefined);
const mockHapticsSelectionChanged = vi.fn().mockResolvedValue(undefined);
const mockHapticsSelectionEnd = vi.fn().mockResolvedValue(undefined);
const mockHapticsVibrate = vi.fn().mockResolvedValue(undefined);

vi.mock("@capacitor/haptics", () => ({
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
  Haptics: {
    impact: (...args: any[]) => mockHapticsImpact(...args),
    notification: (...args: any[]) => mockHapticsNotification(...args),
    selectionStart: (...args: any[]) => mockHapticsSelectionStart(...args),
    selectionChanged: (...args: any[]) => mockHapticsSelectionChanged(...args),
    selectionEnd: (...args: any[]) => mockHapticsSelectionEnd(...args),
    vibrate: (...args: any[]) => mockHapticsVibrate(...args),
  },
}));

const mockPrefSet = vi.fn().mockResolvedValue(undefined);
const mockPrefGet = vi.fn().mockResolvedValue({ value: null });
const mockPrefRemove = vi.fn().mockResolvedValue(undefined);
const mockPrefClear = vi.fn().mockResolvedValue(undefined);

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    set: (...args: any[]) => mockPrefSet(...args),
    get: (...args: any[]) => mockPrefGet(...args),
    remove: (...args: any[]) => mockPrefRemove(...args),
    clear: (...args: any[]) => mockPrefClear(...args),
  },
}));

const mockDeviceGetInfo = vi.fn().mockResolvedValue({ platform: "android", operatingSystem: "android" });
const mockDeviceGetBatteryInfo = vi.fn().mockResolvedValue({ batteryLevel: 0.85, isCharging: false });
const mockDeviceGetLanguageCode = vi.fn().mockResolvedValue({ value: "en" });

vi.mock("@capacitor/device", () => ({
  Device: {
    getInfo: () => mockDeviceGetInfo(),
    getBatteryInfo: () => mockDeviceGetBatteryInfo(),
    getLanguageCode: () => mockDeviceGetLanguageCode(),
  },
}));

const mockDialogAlert = vi.fn().mockResolvedValue(undefined);
const mockDialogConfirm = vi.fn().mockResolvedValue({ value: true });
const mockDialogPrompt = vi.fn().mockResolvedValue({ value: "test", cancelled: false });

vi.mock("@capacitor/dialog", () => ({
  Dialog: {
    alert: (...args: any[]) => mockDialogAlert(...args),
    confirm: (...args: any[]) => mockDialogConfirm(...args),
    prompt: (...args: any[]) => mockDialogPrompt(...args),
  },
}));

let mockIsNative = false;
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNative,
    getPlatform: () => (mockIsNative ? "android" : "web"),
  },
  registerPlugin: vi.fn().mockReturnValue({}),
}));

const mockNetworkGetStatus = vi.fn().mockResolvedValue({ connected: true, connectionType: "wifi" });
const mockNetworkAddListener = vi.fn().mockResolvedValue({ remove: vi.fn() });

vi.mock("@capacitor/network", () => ({
  Network: {
    getStatus: () => mockNetworkGetStatus(),
    addListener: (...args: any[]) => mockNetworkAddListener(...args),
  },
}));

// Now import modules under test
import { localPersistence } from "@/services/localPersistence";
import { NativeService } from "@/services/nativeService";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

describe("Offline & Online Resilience Tests", () => {
  beforeEach(() => {
    idbStore.clear();
    localStorage.clear();
    mockIsNative = false;
    vi.clearAllMocks();
  });

  describe("localPersistence resilience", () => {
    it("handles medicines operations without throwing", async () => {
      const med = await localPersistence.medicines.create({
        name: "Amoxicillin",
        dosage: "500mg",
      });
      expect(med).toBeDefined();
      expect(med.name).toBe("Amoxicillin");

      const all = await localPersistence.medicines.getAll();
      expect(all.length).toBeGreaterThan(0);
      expect(all.find((m) => m.id === med.id)).toBeDefined();

      await localPersistence.medicines.update(med.id, { dosage: "1000mg" });
      const updated = await localPersistence.medicines.getAll();
      expect(updated.find((m) => m.id === med.id)?.dosage).toBe("1000mg");

      await localPersistence.medicines.remove(med.id);
      const afterDelete = await localPersistence.medicines.getAll();
      expect(afterDelete.find((m) => m.id === med.id)).toBeUndefined();
    });

    it("handles reminders operations safely", async () => {
      const rem = await localPersistence.reminders.create({
        medicineName: "Paracetamol",
        dose: "500mg",
        time: "08:00",
        repeatSchedule: "daily",
        enabled: true,
      });
      expect(rem.id).toBeDefined();

      const all = await localPersistence.reminders.getAll();
      expect(all.length).toBeGreaterThan(0);

      await localPersistence.reminders.update(rem.id, { time: "09:00" });
      const afterUpdate = await localPersistence.reminders.getAll();
      expect(afterUpdate.find((r) => r.id === rem.id)?.time).toBe("09:00");

      await localPersistence.reminders.remove(rem.id);
      const afterDelete = await localPersistence.reminders.getAll();
      expect(afterDelete.find((r) => r.id === rem.id)).toBeUndefined();
    });

    it("handles doseLogs operations safely", async () => {
      const log = await localPersistence.doseLogs.create({
        reminderId: "rem_1",
        medicineName: "Ibuprofen",
        dose: "400mg",
        scheduledTime: "12:00",
        action: "taken",
        isSnoozed: false,
      });
      expect(log.id).toBeDefined();

      const all = await localPersistence.doseLogs.getAll();
      expect(all.length).toBeGreaterThan(0);

      await localPersistence.doseLogs.update(log.id, { isSnoozed: true });
      const afterUpdate = await localPersistence.doseLogs.getAll();
      expect(afterUpdate.find((l) => l.id === log.id)?.isSnoozed).toBe(true);

      await localPersistence.doseLogs.remove(log.id);
      const afterDelete = await localPersistence.doseLogs.getAll();
      expect(afterDelete.find((l) => l.id === log.id)).toBeUndefined();
    });

    it("handles patients and wellnessLogs operations safely", async () => {
      const patient = await localPersistence.patients.create({
        name: "Jane Doe",
        age: 30,
        gender: "female",
      });
      expect(patient.id).toBeDefined();

      const patients = await localPersistence.patients.getAll();
      expect(patients.length).toBeGreaterThan(0);

      await localPersistence.patients.remove(patient.id);

      const wellness = await localPersistence.wellnessLogs.create({
        type: "symptom",
        data: { mood: "happy" },
      });
      expect(wellness.id).toBeDefined();

      const allWellness = await localPersistence.wellnessLogs.getAll();
      expect(allWellness.length).toBeGreaterThan(0);

      await localPersistence.wellnessLogs.remove(wellness.id);
    });
  });

  describe("NativeService error protection", () => {
    it("safely handles Haptics errors without throwing", async () => {
      mockIsNative = true;
      mockHapticsImpact.mockRejectedValue(new Error("Haptics unavailable"));
      mockHapticsNotification.mockRejectedValue(new Error("Haptics unavailable"));
      mockHapticsSelectionStart.mockRejectedValue(new Error("Haptics unavailable"));
      mockHapticsVibrate.mockRejectedValue(new Error("Haptics unavailable"));

      // All of these should resolve without throwing
      await expect(NativeService.haptics.tap()).resolves.toBeUndefined();
      await expect(NativeService.haptics.impact()).resolves.toBeUndefined();
      await expect(NativeService.haptics.heavy()).resolves.toBeUndefined();
      await expect(NativeService.haptics.success()).resolves.toBeUndefined();
      await expect(NativeService.haptics.warn()).resolves.toBeUndefined();
      await expect(NativeService.haptics.error()).resolves.toBeUndefined();
      await expect(NativeService.haptics.selection()).resolves.toBeUndefined();
      await expect(NativeService.haptics.vibrate()).resolves.toBeUndefined();
    });

    it("safely handles Preferences native failure with fallback to localStorage", async () => {
      mockIsNative = true;
      mockPrefSet.mockRejectedValue(new Error("Preferences DB locked"));
      mockPrefGet.mockRejectedValue(new Error("Preferences DB locked"));

      await NativeService.preferences.set("test_key", { user: "alpha" });
      const val = await NativeService.preferences.get("test_key");
      expect(val).toEqual({ user: "alpha" });

      mockPrefRemove.mockRejectedValue(new Error("Preferences DB locked"));
      await NativeService.preferences.remove("test_key");
      const emptyVal = await NativeService.preferences.get("test_key");
      expect(emptyVal).toBeNull();
    });

    it("safely handles Device and Dialog native errors", async () => {
      mockDeviceGetInfo.mockRejectedValue(new Error("Device info bridge failed"));
      mockDeviceGetBatteryInfo.mockRejectedValue(new Error("Battery info bridge failed"));
      mockDeviceGetLanguageCode.mockRejectedValue(new Error("Language bridge failed"));

      const info = await NativeService.device.getInfo();
      expect(info).toBeDefined();

      const battery = await NativeService.device.getBatteryInfo();
      expect(battery).toBeDefined();

      const lang = await NativeService.device.getLanguageCode();
      expect(lang.value).toBe("en");
    });
  });

  describe("useNetworkStatus Hook Cleanup & Error Resilience", () => {
    it("handles native network listener unmount without throwing", async () => {
      mockIsNative = true;
      const removeMock = vi.fn().mockResolvedValue(undefined);
      mockNetworkGetStatus.mockResolvedValue({ connected: true, connectionType: "wifi" });
      mockNetworkAddListener.mockResolvedValue({ remove: removeMock });

      const { unmount, result } = renderHook(() => useNetworkStatus());
      expect(result.current.isOnline).toBe(true);

      // Unmount immediately
      unmount();
    });

    it("handles native network getStatus/addListener rejection gracefully", async () => {
      mockIsNative = true;
      mockNetworkGetStatus.mockRejectedValue(new Error("Network bridge error"));
      mockNetworkAddListener.mockRejectedValue(new Error("Network bridge error"));

      const { unmount, result } = renderHook(() => useNetworkStatus());
      expect(typeof result.current.isOnline).toBe("boolean");
      unmount();
    });
  });
});
