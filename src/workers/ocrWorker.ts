/**
 * OCR Web Worker — runs Tesseract entirely off the main thread.
 *
 * The main thread never imports tesseract.js; instead it communicates via
 * tellWorker/askWorker from workerBridge.ts. This keeps the main-thread bundle
 * lean and first paint fast.
 *
 * Message protocol:
 *   IN  { topic: 'preload' }
 *   IN  { topic: 'recognize', id: string, payload: string }  // payload = imageUrl
 *   OUT { topic: 'ready' }
 *   OUT { topic: 'result',    id: string, text: string }
 *   OUT { topic: 'error',     id: string, error: string }
 */
import { createWorker } from 'tesseract.js';

type InMsg =
  | { topic: 'preload' }
  | { topic: 'recognize'; id: string; payload: string };

type OutMsg =
  | { topic: 'ready' }
  | { topic: 'result'; id: string; text: string }
  | { topic: 'error'; id: string; error: string };

let tesseractWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
let initPromise: Promise<void> | null = null;

function ensureWorker(): Promise<void> {
  if (tesseractWorker) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = createWorker('eng', 1, {
    // Silence logging in the worker context to avoid noise
    logger: () => undefined,
  })
    .then(w => {
      tesseractWorker = w;
    })
    .catch(e => {
      // Allow retry on next call
      initPromise = null;
      throw e;
    });

  return initPromise;
}

function post(msg: OutMsg): void {
  (self as any).postMessage(msg);
}

(self as any).addEventListener(
  'message',
  async (evt: MessageEvent<InMsg>) => {
    const msg = evt.data;

    if (msg.topic === 'preload') {
      try {
        await ensureWorker();
        post({ topic: 'ready' });
      } catch (e) {
        // Preload failure is non-fatal — recognize() will retry
        console.error('[ocrWorker] preload failed:', e);
      }
      return;
    }

    if (msg.topic === 'recognize') {
      try {
        await ensureWorker();
        if (!tesseractWorker) throw new Error('OCR worker failed to initialize');
        const { data: { text } } = await tesseractWorker.recognize(msg.payload);
        post({ topic: 'result', id: msg.id, text: text.trim() });
      } catch (e) {
        post({ topic: 'error', id: msg.id, error: String(e) });
      }
    }
  }
);
