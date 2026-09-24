import { describe, it, expect, vi, beforeEach } from 'vitest';
import { identifyPill } from './pillIdService';
import { visionApi } from './api';
import * as visionService from './visionService';

vi.mock('./api', () => ({
  visionApi: {
    identifyPill: vi.fn(),
  },
}));

vi.mock('./visionService', () => ({
  extractTextFromImage: vi.fn(),
}));

describe('pillIdService - identifyPill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('proceeds with multimodal image scan when local OCR fails or throws', async () => {
    // Local OCR throws an error (e.g. Tesseract worker fails in browser)
    vi.mocked(visionService.extractTextFromImage).mockRejectedValueOnce(
      new Error('Worker initialization failed')
    );

    const mockResponse = {
      success: true,
      matches: [{ name: 'REVIDOL', confidence: 0.98, genericName: 'Paracetamol' }],
      imprints: ['500'],
      labels: ['REVIDOL 500MG'],
      summary: 'Revidol paracetamol 500mg',
    };
    vi.mocked(visionApi.identifyPill).mockResolvedValueOnce(mockResponse);

    const base64Image = 'data:image/jpeg;base64,1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const result = await identifyPill(base64Image, '30');

    expect(result).toEqual(mockResponse);
    expect(visionApi.identifyPill).toHaveBeenCalledTimes(1);
    expect(visionApi.identifyPill).toHaveBeenCalledWith({
      image: '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      patientAge: '30',
      ocrText: '',
    });
  });

  it('combines image and OCR text when local OCR succeeds', async () => {
    vi.mocked(visionService.extractTextFromImage).mockResolvedValueOnce('REVIDOL PARACETAMOL 500MG');

    const mockResponse = {
      success: true,
      matches: [{ name: 'REVIDOL', confidence: 0.99 }],
      imprints: ['500'],
      labels: ['REVIDOL'],
    };
    vi.mocked(visionApi.identifyPill).mockResolvedValueOnce(mockResponse);

    const base64Image = 'data:image/jpeg;base64,1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const result = await identifyPill(base64Image, '25');

    expect(result).toEqual(mockResponse);
    expect(visionApi.identifyPill).toHaveBeenCalledWith({
      image: '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      patientAge: '25',
      ocrText: 'REVIDOL PARACETAMOL 500MG',
    });
  });

  it('rejects when both image and OCR text are missing', async () => {
    vi.mocked(visionService.extractTextFromImage).mockResolvedValueOnce('');

    await expect(identifyPill('', '25')).rejects.toThrow(
      'No medication image or label text detected'
    );
  });

  it('propagates actionable 401 authentication error messages', async () => {
    vi.mocked(visionService.extractTextFromImage).mockResolvedValueOnce('Test Med');
    const authError: any = new Error('Unauthorized');
    authError.statusCode = 401;
    vi.mocked(visionApi.identifyPill).mockRejectedValueOnce(authError);

    const base64Image = 'data:image/jpeg;base64,1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    await expect(identifyPill(base64Image)).rejects.toThrow(
      'Session expired or authentication failed. Please sign in again.'
    );
  });

  it('propagates actionable rate limit error messages', async () => {
    vi.mocked(visionService.extractTextFromImage).mockResolvedValueOnce('Test Med');
    const rateLimitErr: any = new Error('Too many requests');
    rateLimitErr.statusCode = 429;
    vi.mocked(visionApi.identifyPill).mockRejectedValueOnce(rateLimitErr);

    const base64Image = 'data:image/jpeg;base64,1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    await expect(identifyPill(base64Image)).rejects.toThrow(
      'Scan limit reached. Please wait a few minutes before scanning again.'
    );
  });
});
