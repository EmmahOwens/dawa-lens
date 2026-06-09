import { visionApi } from './api';

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
 * using Google Cloud Vision/Gemini.
 * 
 * @param base64Image The image data (with or without data:image prefix)
 * @param patientAge Optional age of the patient to get a recommended dosage
 * @returns Prediction results from the vision service
 */
export async function identifyPill(base64Image: string, patientAge?: string): Promise<PillIdResponse> {
  try {
    // Strip the data:image/jpeg;base64, prefix if it exists
    const cleanImage = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    const response = await visionApi.identifyPill({ image: cleanImage, patientAge });
    return response;
  } catch (error) {
    console.error('Pill identification failed:', error);
    throw new Error('Failed to identify medication accurately. Please try a manual search.');
  }
}

