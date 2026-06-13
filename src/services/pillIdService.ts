import { visionApi } from './api';
import { extractTextFromImage } from './visionService';

export interface PillMatch {
  name: string;
  confidence: number;
  genericName?: string;
  recommendedDosage?: string;
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
    
    const response = await visionApi.identifyPill({ image: cleanImage, patientAge, ocrText: ocrText.trim() });
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
    throw new Error('Failed to identify medication accurately. Please try a manual search or verify your connection.');
  }
}

