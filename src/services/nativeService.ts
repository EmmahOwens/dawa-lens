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
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    },
    // Medium impact for standard interactions
    impact: async (style: ImpactStyle = ImpactStyle.Medium) => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style });
      }
    },
    // Heavy impact for destructive or high-emphasis actions
    heavy: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }
    },
    // Success notification for completed actions (scan result, saved, etc.)
    success: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Success });
      }
    },
    // Warning pattern for cautionary alerts
    warn: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Warning });
      }
    },
    // Error pattern for failures and invalid actions
    error: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Error });
      }
    },
    // Selection feedback for switches, toggles, and pickers
    selection: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
      }
    },
    // Generic notification (kept for backward compatibility)
    notification: async (type: NotificationType) => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type });
      }
    },
    // Generic vibrate (kept for backward compatibility)
    vibrate: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.vibrate();
      }
    },
  },

  /**
   * Native storage
   */
  preferences: {
    set: async (key: string, value: any) => {
      await Preferences.set({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
      });
    },
    get: async (key: string) => {
      const { value } = await Preferences.get({ key });
      try {
        return value ? JSON.parse(value) : null;
      } catch {
        return value;
      }
    },
    remove: async (key: string) => {
      await Preferences.remove({ key });
    },
    clear: async () => {
      await Preferences.clear();
    },
  },

  /**
   * Device info
   */
  device: {
    getInfo: () => Device.getInfo(),
    getBatteryInfo: () => Device.getBatteryInfo(),
    getLanguageCode: () => Device.getLanguageCode(),
  },

  /**
   * Native dialogs
   */
  dialog: {
    alert: (title: string, message: string) => Dialog.alert({ title, message }),
    confirm: (title: string, message: string) =>
      Dialog.confirm({ title, message }),
    prompt: (title: string, message: string) =>
      Dialog.prompt({ title, message }),
  },

  /**
   * Request exemption from battery optimization to ensure alarms are reliable.
   */
  requestBatteryOptimizationExemption: async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    try {
      const { value: confirmed } = await Dialog.confirm({
        title: "Reliable Reminders",
        message: "To ensure you receive medication reminders on time, please exclude Dawa Lens from battery optimization in the next screen.",
        okButtonTitle: "Exempt",
        cancelButtonTitle: "Later",
      });
      if (confirmed) {
        const { NativeAlarm } = await import("@/plugins/nativeAlarm");
        await NativeAlarm.requestIgnoreBatteryOptimization();
      }
    } catch (err) {
      console.error("Failed to request battery optimization exemption:", err);
    }
  },
};
