/**
 * Vision Service — OCR via a dedicated Web Worker.
 *
 * Tesseract.js runs entirely off the main thread inside ocrWorker.ts.
 * The main thread never imports tesseract.js, keeping the critical
 * rendering path lean and first paint fast.
 */
import { tellWorker, askWorker } from "@/lib/workerBridge";

// Lazily instantiate the OCR worker. Vite bundles ocrWorker.ts as a
// separate chunk so it doesn't inflate the main bundle.
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
 * Preloads the OCR model inside the worker thread.
 * Fire-and-forget: the worker initializes Tesseract in the background so
 * that the first real scan doesn't pay the cold-start penalty.
 */
export function preloadOCRModel(): void {
  tellWorker(getOcrWorker(), "preload");
}

/**
 * Extracts text from an image using the off-thread OCR worker.
 * @param imageUrl base64 data URI or object URL
 * @returns trimmed recognized text
 */
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const result = await askWorker<
    string,
    { topic: string; id: string; text: string }
  >(getOcrWorker(), "recognize", imageUrl);
  return result.text;
}
