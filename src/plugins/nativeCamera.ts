/**
 * NativeCamera — Capacitor plugin bridge for the native scan experience.
 *
 * Android: Full-screen CameraX activity with hardware-accelerated AR overlays
 *          (scan line, corner brackets), flashlight toggle, and front/back switch.
 * iOS:     AVFoundation-based view controller with CALayer AR overlays.
 *
 * On web the bridge is never called — ScanPage falls back to getUserMedia.
 */
import { registerPlugin } from '@capacitor/core';

export interface NativeCameraOptions {
  /** Scan mode passed to the native activity for hint text. */
  mode?: 'pill' | 'text';
}

export interface NativeCameraResult {
  /** Base64 JPEG data URI of the captured image. Empty string if cancelled. */
  imageData: string;
  /** True if the user dismissed the camera without capturing. */
  cancelled: boolean;
}

export interface NativeCameraPlugin {
  /**
   * Opens a full-screen native camera with scan overlay.
   * Resolves with the captured image once the user taps the shutter,
   * or with `cancelled: true` if they dismiss.
   */
  startScan(options: NativeCameraOptions): Promise<NativeCameraResult>;
}

const NativeCamera = registerPlugin<NativeCameraPlugin>('NativeCamera');

export { NativeCamera };
