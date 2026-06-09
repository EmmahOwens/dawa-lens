/**
 * Vision Service — OCR routing layer.
 *
 * On native platforms (Android/iOS) text recognition is handled by the device's
 * dedicated ML hardware:
 *   Android → Google ML Kit (shared Play Services, zero bundle overhead)
 *   iOS     → Apple Vision Framework VNRecognizeTextRequest (Apple Neural Engine)
 *
 * On web the existing Tesseract.js Web Worker is used as a fallback so the
 * browser experience is unchanged.
 */
import { Capacitor } from "@capacitor/core";
import { NativeOcr } from "@/plugins/nativeOcr";
import { tellWorker, askWorker } from "@/lib/workerBridge";

let _ocrWorker: Worker | null = null;

function getOcrWorker(): Worker {
  if (!_ocrWorker) {
    _ocrWorker = new Worker(
      new URL("../workers/ocrWorker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return _ocrWorker;
}

/**
 * Eagerly warms up the OCR engine.
 * On native platforms this is a no-op — the OS handles its own init.
 * On web it preloads the Tesseract model inside the worker thread so the
 * first real scan doesn't pay the cold-start cost.
 */
export function preloadOCRModel(): void {
  if (Capacitor.isNativePlatform()) return;
  tellWorker(getOcrWorker(), "preload");
}

/**
 * Extracts text from an image.
 *
 * @param imageUrl  Base64 data URI or object URL of the image to scan.
 * @returns         Trimmed recognized text string.
 */
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { text } = await NativeOcr.recognizeText({ imageData: imageUrl });
      return text.trim();
    } catch (err) {
      // Native OCR unavailable (e.g. emulator without Play Services) — fall through
      console.warn(
        "[visionService] Native OCR failed, falling back to Tesseract:",
        err
      );
    }
  }

  // Web / fallback path: delegate to the off-thread Tesseract.js worker
  const result = await askWorker<
    string,
    { topic: string; id: string; text: string }
  >(getOcrWorker(), "recognize", imageUrl);
  return result.text.trim();
}
