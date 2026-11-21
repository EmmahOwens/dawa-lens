/**
 * NativeCamera — Hardware CameraX Scanner Activity bridge (`NativeScanActivity.kt`).
 */
import { registerPlugin } from "@capacitor/core";

export interface NativeCameraPlugin {
  startScan(options?: { mode?: "pill" | "text" }): Promise<{
    imageData: string;
    cancelled: boolean;
  }>;
}

const NativeCamera = registerPlugin<NativeCameraPlugin>("NativeCamera");
export { NativeCamera };
