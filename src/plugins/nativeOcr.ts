/**
 * NativeOcr — Capacitor plugin bridge for on-device text recognition.
 *
 * Android: Google ML Kit Text Recognition (uses shared Play Services binaries)
 * iOS:     Apple Vision Framework VNRecognizeTextRequest (uses Apple Neural Engine)
 * Web:     Not supported natively — callers should fall back to tesseract.js
 */
import { registerPlugin } from '@capacitor/core';

export interface NativeOcrPlugin {
  /** Extracts text from a base64-encoded image (data URI or raw base64). */
  recognizeText(options: { imageData: string }): Promise<{ text: string }>;
}

const NativeOcr = registerPlugin<NativeOcrPlugin>('NativeOcr');

export { NativeOcr };
