import { createWorker, Worker } from 'tesseract.js';

let tesseractWorker: Worker | null = null;
let isInitializing = false;

/**
 * Initializes the Tesseract Web Worker silently in the background
 * This downloads the ~20MB english language model file explicitly.
 */
export async function preloadOCRModel() {
  if (tesseractWorker || isInitializing) return;
  isInitializing = true;
  
  try {
    const worker = await createWorker('eng', 1, {
      logger: m => process.env.NODE_ENV === 'development' ? console.log('Tesseract: ', m) : null
    });
    tesseractWorker = worker;
    console.log("OCR Model preloaded successfully.");
  } catch (error) {
    console.error("Failed to preload OCR worker:", error);
  } finally {
    isInitializing = false;
  }
}

/**
 * Executes OCR on an image URL (data URIs work perfectly).
 * If the worker isn't loaded yet, it will initialize and wait.
 * @param imageUrl base64 image or object URL
 * @returns extracted text string
 */
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  // If not yet loaded, try to load it now
  if (!tesseractWorker && !isInitializing) {
    await preloadOCRModel();
  }
  
  // If it's currently initializing in the background, we must wait for it to finish.
  // A simplistic polling loop since isInitializing isn't a promise
  const waitForInitialization = () => new Promise<void>(resolve => {
    const check = setInterval(() => {
      if (!isInitializing) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });

  if (isInitializing) {
    await waitForInitialization();
  }

  if (!tesseractWorker) {
    throw new Error("OCR Worker failed to initialize.");
  }

  const { data: { text } } = await tesseractWorker.recognize(imageUrl);
  return text.trim();
}
