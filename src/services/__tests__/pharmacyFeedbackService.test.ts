import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  submitPharmacyFeedback,
  getQueuedFeedback,
  flushPendingFeedback,
  PharmacyFeedbackSubmission,
} from "../pharmacyFeedbackService";

describe("pharmacyFeedbackService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockFeedback: PharmacyFeedbackSubmission = {
    pharmacyId: "test-pharmacy-1",
    pharmacyName: "Kampala Central Pharmacy",
    currentLat: 0.3163,
    currentLng: 32.5825,
    verifiedLat: 0.3165,
    verifiedLng: 32.5828,
    gpsAccuracyMeters: 5,
    feedbackType: "confirm_location",
    isOpen: true,
  };

  it("enqueues feedback to localStorage when offline", async () => {
    // Mock navigator.onLine = false
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    const result = await submitPharmacyFeedback(mockFeedback);
    expect(result.success).toBe(true);
    expect(result.queued).toBe(true);

    const queued = getQueuedFeedback();
    expect(queued).toHaveLength(1);
    expect(queued[0].pharmacyId).toBe("test-pharmacy-1");
    expect(queued[0].verifiedLat).toBe(0.3165);
    expect(queued[0].synced).toBe(false);
  });

  it("handles empty queue gracefully on flush", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });

    const flushed = await flushPendingFeedback();
    expect(flushed).toBe(0);
  });
});
