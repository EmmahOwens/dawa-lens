import { visionApi } from './api';
import { extractTextFromImage } from './visionService';

export interface PillMatch {
  name: string;
  confidence: number;
  genericName?: string;
  unverifiedNotice?: string;
  boxedWarning?: string | null;
  indications?: string | null;
  ndcValidated?: boolean;
  deaSchedule?: string | null;
  storageWarning?: string | null;
}

export interface PillIdResponse {
  success: boolean;
  matches: PillMatch[];
  imprints: string[];
  labels: string[];
  summary?: string;
}

/**
 * Sends a captured pill image to the backend for AI-powered identification
 * using local OCR and text LLM processing.
 * 
 * @param base64Image The image data (with or without data:image prefix)
 * @param patientAge Optional age of the patient to get a recommended dosage
 * @returns Prediction results from the vision service
 */
/**
 * One retry for transient backend failures. A timed-out first attempt usually
 * means the hosted server (Render free tier) was waking from a cold start —
 * the attempt still wakes it, so the retry lands in ~1s.
 */
function isTransientScanError(err: any): boolean {
  const statusCode = err?.statusCode as number | undefined;
  if (typeof statusCode === "number") {
    return statusCode === 408 || statusCode >= 500;
  }
  // No statusCode → network-level failure (fetch TypeError, offline flap)
  return true;
}

function isNetworkError(err: any): boolean {
  return (
    err instanceof TypeError ||
    /failed to fetch|networkerror|load failed|internet connection/i.test(
      err?.message || ""
    )
  );
}

/** Maps raw failures to specific, actionable user messages. */
function describeScanFailure(err: any): string {
  const statusCode = err?.statusCode as number | undefined;
  if (statusCode === 429) {
    return "Scan limit reached. Please wait a few minutes before scanning again.";
  }
  if (statusCode === 408) {
    return "The scan server took too long to respond (it may have been waking up). Please try again in a moment.";
  }
  if (statusCode && statusCode >= 500) {
    return "The scan service is temporarily unavailable. Please try again shortly.";
  }
  if (isNetworkError(err)) {
    return "Cannot reach the Dawa Lens server. Please check your internet connection and try again.";
  }
  return "Failed to identify medication accurately. Please try a manual search or verify your connection.";
}

export async function identifyPill(base64Image: string, patientAge?: string): Promise<PillIdResponse> {
  try {
    // 1. Run local OCR first
    let ocrText = "";
    try {
      ocrText = await extractTextFromImage(base64Image);
    } catch (ocrErr) {
      console.error('[pillIdService] Local OCR failed:', ocrErr);
      throw new Error('The scanner was unable to read the label. Please ensure the lighting is good, the image is clear, and the text is not blurry.');
    }

    if (!ocrText || !ocrText.trim()) {
      throw new Error('No text detected on the package or pill. Please make sure the medication label is facing the camera, holds steady, and matches the scan box.');
    }

    // Strip the data:image/jpeg;base64, prefix if it exists
    const cleanImage = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const payload = { image: cleanImage, patientAge, ocrText: ocrText.trim() };
    let response: unknown;
    try {
      response = await visionApi.identifyPill(payload);
    } catch (apiErr: any) {
      if (!isTransientScanError(apiErr)) throw apiErr;
      console.warn("[pillIdService] Transient scan failure, retrying once:", apiErr?.message);
      response = await visionApi.identifyPill(payload);
    }
    return response as PillIdResponse;
  } catch (error: any) {
    console.error('Pill identification failed:', error);
    // If it's a specific custom error from local OCR or API, propagate it directly
    if (error.message && (
      error.message.includes('No text detected') ||
      error.message.includes('unable to read') ||
      error.code
    )) {
      throw error;
    }
    throw new Error(describeScanFailure(error));
  }
}

