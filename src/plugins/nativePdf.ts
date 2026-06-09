/**
 * NativePdf — Capacitor plugin for native PDF report generation.
 *
 * Android: android.graphics.pdf.PdfDocument — draws page-by-page via Canvas,
 *          peak memory ~8 MB vs ~150 MB for html2canvas.
 * iOS:     UIGraphicsPDFRenderer — Core Graphics, hardware-accelerated.
 *
 * Returns a local file URI that can be passed directly to @capacitor/share.
 */
import { registerPlugin } from '@capacitor/core';

export interface NativeReportData {
  patientName: string;
  patientAge: string;
  dateRange: string;
  adherenceScore: number;
  chartData: Array<{ name: string; adherence: number; mood: number | null; energy: number | null }>;
  medicines: Array<{ name: string; dosage?: string; daysRemaining?: number }>;
  topSymptoms: Array<{ name: string; count: number }>;
  averageMood: number;
  averageEnergy: number;
  generatedAt: string;
}

export interface NativePdfPlugin {
  generateReport(options: NativeReportData): Promise<{ filePath: string; fileUri: string }>;
}

const NativePdf = registerPlugin<NativePdfPlugin>('NativePdf');
export { NativePdf };
