/**
 * NativeNavigation — Native Android System UI, Warm Backgrounding, Hardware Tier & Intent Bridge.
 */
import { registerPlugin } from "@capacitor/core";

export interface DevicePerformanceProfile {
  refreshRateHz: number;
  isLowRamDevice: boolean;
  memoryClassMb: number;
  sdkInt: number;
  animatorDurationScale: number;
  reducedMotion: boolean;
}

export interface NativeNavigationPlugin {
  pushPage(options?: { title?: string; haptic?: boolean }): Promise<void>;
  setSystemBarsStyle(options: {
    isDark: boolean;
    statusBarColor?: string;
    navigationBarColor?: string;
  }): Promise<void>;
  moveToBackground(): Promise<{ moved: boolean }>;
  getDevicePerformanceProfile(): Promise<DevicePerformanceProfile>;
  openNativeMaps(options: {
    lat: number;
    lng: number;
    label?: string;
    mode?: "driving" | "walking" | "boda_boda";
    fallbackUrl?: string;
  }): Promise<{ opened: boolean; target?: string }>;
}

const NativeNavigation = registerPlugin<NativeNavigationPlugin>("NativeNavigation");
export { NativeNavigation };
