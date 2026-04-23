import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { Device } from '@capacitor/device';
import { Dialog } from '@capacitor/dialog';
import { Capacitor } from '@capacitor/core';

/**
 * Unified service to handle native device features with safety checks
 * for web/browser compatibility.
 */
export const NativeService = {
  /**
   * Haptic feedback
   */
  haptics: {
    impact: async (style: ImpactStyle = ImpactStyle.Medium) => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style });
      }
    },
    notification: async (type: NotificationType) => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type });
      }
    },
    vibrate: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.vibrate();
      }
    },
    selectionStart: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.selectionStart();
      }
    },
    selectionChanged: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.selectionChanged();
      }
    },
    selectionEnd: async () => {
      if (Capacitor.isNativePlatform()) {
        await Haptics.selectionEnd();
      }
    }
  },

  /**
   * Native storage
   */
  preferences: {
    set: async (key: string, value: any) => {
      await Preferences.set({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value)
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
    }
  },

  /**
   * Device info
   */
  device: {
    getInfo: () => Device.getInfo(),
    getBatteryInfo: () => Device.getBatteryInfo(),
    getLanguageCode: () => Device.getLanguageCode()
  },

  /**
   * Native dialogs
   */
  dialog: {
    alert: (title: string, message: string) => 
      Dialog.alert({ title, message }),
    confirm: (title: string, message: string) => 
      Dialog.confirm({ title, message }),
    prompt: (title: string, message: string) => 
      Dialog.prompt({ title, message })
  }
};
