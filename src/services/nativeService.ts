import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { Device } from "@capacitor/device";
import { Dialog } from "@capacitor/dialog";
import { Capacitor } from "@capacitor/core";

/**
 * Unified service to handle native device features with safety checks
 * for web/browser compatibility.
 */
export const NativeService = {
  /**
   * Contextual haptic feedback patterns — adapted from lichobile's 7-pattern system.
   * Each pattern maps to a specific interaction type for a native feel.
   */
  haptics: {
    // Light tap for button presses and list item selections
    tap: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.impact({ style: ImpactStyle.Light });
        } catch (err) {
          console.warn("[NativeService] haptics.tap failed:", err);
        }
      }
    },
    // Medium impact for standard interactions
    impact: async (style: ImpactStyle = ImpactStyle.Medium) => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.impact({ style });
        } catch (err) {
          console.warn("[NativeService] haptics.impact failed:", err);
        }
      }
    },
    // Heavy impact for destructive or high-emphasis actions
    heavy: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (err) {
          console.warn("[NativeService] haptics.heavy failed:", err);
        }
      }
    },
    // Success notification for completed actions (scan result, saved, etc.)
    success: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.notification({ type: NotificationType.Success });
        } catch (err) {
          console.warn("[NativeService] haptics.success failed:", err);
        }
      }
    },
    // Warning pattern for cautionary alerts
    warn: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.notification({ type: NotificationType.Warning });
        } catch (err) {
          console.warn("[NativeService] haptics.warn failed:", err);
        }
      }
    },
    // Error pattern for failures and invalid actions
    error: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.notification({ type: NotificationType.Error });
        } catch (err) {
          console.warn("[NativeService] haptics.error failed:", err);
        }
      }
    },
    // Selection feedback for switches, toggles, and pickers
    selection: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.selectionStart();
          await Haptics.selectionChanged();
          await Haptics.selectionEnd();
        } catch (err) {
          console.warn("[NativeService] haptics.selection failed:", err);
        }
      }
    },
    // Generic notification (kept for backward compatibility)
    notification: async (type: NotificationType) => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.notification({ type });
        } catch (err) {
          console.warn("[NativeService] haptics.notification failed:", err);
        }
      }
    },
    // Generic vibrate (kept for backward compatibility)
    vibrate: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.vibrate();
        } catch (err) {
          console.warn("[NativeService] haptics.vibrate failed:", err);
        }
      }
    },
  },

  /**
   * Native storage
   */
  preferences: {
    set: async (key: string, value: any) => {
      const strVal = typeof value === "string" ? value : JSON.stringify(value);
      if (Capacitor.isNativePlatform()) {
        try {
          await Preferences.set({ key, value: strVal });
          return;
        } catch (err) {
          console.warn("[NativeService] Preferences.set failed, using localStorage:", err);
        }
      }
      try {
        localStorage.setItem(key, strVal);
      } catch (err) {
        console.warn("[NativeService] localStorage.setItem fallback failed:", err);
      }
    },
    get: async (key: string) => {
      if (Capacitor.isNativePlatform()) {
        try {
          const { value } = await Preferences.get({ key });
          if (value !== null && value !== undefined) {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
        } catch (err) {
          console.warn("[NativeService] Preferences.get failed, falling back to localStorage:", err);
        }
      }
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null && raw !== undefined) {
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        }
      } catch (err) {
        console.warn("[NativeService] localStorage.getItem fallback failed:", err);
      }
      return null;
    },
    remove: async (key: string) => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Preferences.remove({ key });
        } catch (err) {
          console.warn("[NativeService] Preferences.remove failed:", err);
        }
      }
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn("[NativeService] localStorage.removeItem failed:", err);
      }
    },
    clear: async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Preferences.clear();
        } catch (err) {
          console.warn("[NativeService] Preferences.clear failed:", err);
        }
      }
      try {
        localStorage.clear();
      } catch (err) {
        console.warn("[NativeService] localStorage.clear failed:", err);
      }
    },
  },

  /**
   * Device info
   */
  device: {
    getInfo: async () => {
      try {
        return await Device.getInfo();
      } catch (err) {
        console.warn("[NativeService] Device.getInfo failed:", err);
        return { platform: "web", operatingSystem: "unknown" } as any;
      }
    },
    getBatteryInfo: async () => {
      try {
        return await Device.getBatteryInfo();
      } catch (err) {
        console.warn("[NativeService] Device.getBatteryInfo failed:", err);
        return { batteryLevel: 1, isCharging: true } as any;
      }
    },
    getLanguageCode: async () => {
      try {
        return await Device.getLanguageCode();
      } catch (err) {
        console.warn("[NativeService] Device.getLanguageCode failed:", err);
        return { value: "en" } as any;
      }
    },
  },

  /**
   * Native dialogs
   */
  dialog: {
    alert: async (title: string, message: string) => {
      try {
        return await Dialog.alert({ title, message });
      } catch (err) {
        console.warn("[NativeService] Dialog.alert failed:", err);
        window.alert(`${title}\n\n${message}`);
      }
    },
    confirm: async (title: string, message: string) => {
      try {
        return await Dialog.confirm({ title, message });
      } catch (err) {
        console.warn("[NativeService] Dialog.confirm failed:", err);
        return { value: window.confirm(`${title}\n\n${message}`) };
      }
    },
    prompt: async (title: string, message: string) => {
      try {
        return await Dialog.prompt({ title, message });
      } catch (err) {
        console.warn("[NativeService] Dialog.prompt failed:", err);
        const res = window.prompt(`${title}\n\n${message}`);
        return { value: res || "", cancelled: res === null };
      }
    },
  },

  /**
   * Request exemption from battery optimization to ensure alarms and background tasks are reliable.
   * If already exempt or if forceOpenSettings is true, opens device battery settings screen directly.
   */
  requestBatteryOptimizationExemption: async (forceOpenSettings = false) => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      console.log("[NativeService] Battery optimization exemption is only applicable on native Android devices.");
      return;
    }
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      if (forceOpenSettings) {
        await NativeAlarm.openBatteryOptimizationSettings();
      } else {
        await NativeAlarm.requestIgnoreBatteryOptimization();
      }
    } catch (err) {
      console.error("Failed to request battery optimization exemption:", err);
    }
  },

  /**
   * Directly open device battery optimization settings / App Info battery settings on Android.
   */
  openBatteryOptimizationSettings: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      console.log("[NativeService] Open battery settings is only available on native Android devices.");
      return false;
    }
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      await NativeAlarm.openBatteryOptimizationSettings();
      return true;
    } catch (err) {
      console.error("Failed to open battery optimization settings:", err);
      return false;
    }
  },

  /**
   * Directly open device Autostart settings screen on OEM devices (Xiaomi, Tecno, Oppo, Vivo, etc.).
   */
  openAutostartSettings: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return false;
    }
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      await NativeAlarm.openAutostartSettings();
      return true;
    } catch (err) {
      console.error("Failed to open autostart settings:", err);
      return false;
    }
  },

  /**
   * Check whether the app is currently exempt from battery optimization.
   */
  isBatteryOptimizationIgnored: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return true;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      const res = await NativeAlarm.isBatteryOptimizationIgnored();
      return res?.ignored ?? false;
    } catch (err) {
      console.error("Failed to check battery optimization exemption status:", err);
      return false;
    }
  },

  /**
   * Check whether exact alarms are permitted by the OS on Android 12+.
   */
  canScheduleExactAlarms: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return true;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      const res = await NativeAlarm.canScheduleExactAlarms();
      return res?.canSchedule ?? true;
    } catch (err) {
      console.error("Failed to check exact alarm capability:", err);
      return true;
    }
  },

  /**
   * Directly open the Exact Alarm system settings screen on Android 12+.
   */
  openExactAlarmSettings: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      await NativeAlarm.openExactAlarmSettings();
      return true;
    } catch (err) {
      console.error("Failed to open exact alarm settings:", err);
      return false;
    }
  },

  /**
   * Check comprehensive permission compliance across battery, exact alarms, and notification status.
   */
  checkAllPermissions: async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return { batteryIgnored: true, exactAlarmCanSchedule: true, notificationsEnabled: true, isFullyCompliant: true };
    }
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      return await NativeAlarm.checkAllPermissions();
    } catch (err) {
      console.error("Failed to check all permissions:", err);
      return { batteryIgnored: false, exactAlarmCanSchedule: false, notificationsEnabled: false, isFullyCompliant: false };
    }
  },

  /**
   * Retrieves manufacturer and OEM brand profiling to tailor background settings instructions.
   */
  getDeviceOemInfo: async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return {
        manufacturer: "generic",
        brand: "generic",
        model: "web",
        isTranssion: false,
        isXiaomi: false,
        isSamsung: false,
        isHuawei: false,
        isOppoRealme: false,
        isOnePlus: false,
        isVivo: false,
        isAsus: false,
      };
    }
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      if (NativeAlarm.getDeviceOemInfo) {
        return await NativeAlarm.getDeviceOemInfo();
      }
      return {
        manufacturer: "android",
        brand: "android",
        model: "device",
        isTranssion: false,
        isXiaomi: false,
        isSamsung: false,
        isHuawei: false,
        isOppoRealme: false,
        isOnePlus: false,
        isVivo: false,
        isAsus: false,
      };
    } catch (err) {
      console.warn("Failed to get device OEM info:", err);
      return {
        manufacturer: "unknown",
        brand: "unknown",
        model: "unknown",
        isTranssion: false,
        isXiaomi: false,
        isSamsung: false,
        isHuawei: false,
        isOppoRealme: false,
        isOnePlus: false,
        isVivo: false,
        isAsus: false,
      };
    }
  },

  /**
   * Starts the persistent adherence guardian foreground service to protect alarms against aggressive LMK killers.
   */
  startGuardianService: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      if (NativeAlarm.startGuardianService) {
        const res = await NativeAlarm.startGuardianService();
        return res?.running ?? false;
      }
      return false;
    } catch (err) {
      console.error("Failed to start guardian service:", err);
      return false;
    }
  },

  /**
   * Stops the persistent adherence guardian foreground service.
   */
  stopGuardianService: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      if (NativeAlarm.stopGuardianService) {
        const res = await NativeAlarm.stopGuardianService();
        return res?.running ?? false;
      }
      return false;
    } catch (err) {
      console.error("Failed to stop guardian service:", err);
      return false;
    }
  },

  /**
   * Checks if the adherence guardian service is currently active.
   */
  isGuardianServiceRunning: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      if (NativeAlarm.isGuardianServiceRunning) {
        const res = await NativeAlarm.isGuardianServiceRunning();
        return res?.running ?? false;
      }
      return false;
    } catch (err) {
      console.error("Failed to check guardian service status:", err);
      return false;
    }
  },

  /**
   * Schedules a test alarm (default: 10 seconds) to verify device wake-lock, sound, and background execution.
   */
  scheduleTestAlarm: async (delaySeconds: number = 10): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      if (NativeAlarm.scheduleTestAlarm) {
        const res = await NativeAlarm.scheduleTestAlarm({ delaySeconds });
        return res?.success ?? false;
      }
      return false;
    } catch (err) {
      console.error("Failed to schedule test alarm:", err);
      return false;
    }
  },

  /**
   * Directly opens the application details settings screen in Android settings.
   */
  openAppInfoSettings: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      if (NativeAlarm.openAppInfoSettings) {
        await NativeAlarm.openAppInfoSettings();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to open app info settings:", err);
      return false;
    }
  },

  /**
   * Opens Android Notification Settings for this app.
   */
  openNotificationSettings: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      await NativeAlarm.openNotificationSettings();
      return true;
    } catch (err) {
      console.error("Failed to open notification settings:", err);
      return false;
    }
  },

  /**
   * Comprehensive readiness check covering notifications, exact alarm permission, and battery exemption.
   */
  checkReadiness: async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return {
        notificationsEnabled: true,
        channelBlocked: false,
        exactAlarmCanSchedule: true,
        batteryIgnored: true,
        status: "ready_exact" as const,
        isFullyCompliant: true,
      };
    }
    try {
      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      return await NativeAlarm.checkReadiness();
    } catch (err) {
      console.error("Failed to check readiness:", err);
      return {
        notificationsEnabled: true,
        channelBlocked: false,
        exactAlarmCanSchedule: true,
        batteryIgnored: true,
        status: "ready_exact" as const,
        isFullyCompliant: true,
      };
    }
  },
};



