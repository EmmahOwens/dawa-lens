import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNearbyPharmacies } from "../useNearbyPharmacies";
import {
  saveLastKnownLocation,
  clearLastKnownLocation,
  DEFAULT_KAMPALA_COORDS,
} from "../../services/pharmacyService";

// Mock useNetworkStatus and useGeolocation
let mockIsOnline = true;
let mockGeoState = {
  location: null as { latitude: number; longitude: number; country?: string | null; countryCode?: string | null } | null,
  status: "idle",
  error: null as string | null,
  requestLocation: vi.fn(),
};

vi.mock("../useNetworkStatus", () => ({
  useNetworkStatus: () => ({
    isOnline: mockIsOnline,
  }),
}));

vi.mock("../useGeolocation", () => ({
  useGeolocation: () => mockGeoState,
}));

describe("useNearbyPharmacies Hook - Network Resilience & Location Fallback", () => {
  beforeEach(() => {
    clearLastKnownLocation();
    localStorage.clear();
    mockIsOnline = true;
    mockGeoState = {
      location: null,
      status: "idle",
      error: null,
      requestLocation: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it("uses live GPS location when online and location is granted, saving it for future use", () => {
    mockIsOnline = true;
    mockGeoState = {
      location: { latitude: 0.6133, longitude: 30.6585, country: "Uganda", countryCode: "UG" }, // Mbarara
      status: "granted",
      error: null,
      requestLocation: vi.fn(),
    };

    const { result } = renderHook(() => useNearbyPharmacies());

    expect(result.current.userCoords).toEqual([30.6585, 0.6133]);
    expect(result.current.locationSource).toBe("live");
    expect(result.current.isUsingPreviousLocation).toBe(false);
    expect(result.current.isUsingDefaultLocation).toBe(false);
    expect(result.current.isNetworkIssue).toBe(false);
    expect(result.current.top5Pharmacies.length).toBeGreaterThan(0);
  });

  it("uses previous location when network issue occurs and previous location exists", () => {
    // User previously had their location saved in Jinja
    saveLastKnownLocation({
      latitude: 0.4479,
      longitude: 33.2026,
      district: "Jinja",
    });

    // Now there is a network issue (offline)
    mockIsOnline = false;
    mockGeoState = {
      location: null,
      status: "error",
      error: "Network error",
      requestLocation: vi.fn(),
    };

    const { result } = renderHook(() => useNearbyPharmacies());

    expect(result.current.userCoords[0]).toBeCloseTo(33.2026);
    expect(result.current.userCoords[1]).toBeCloseTo(0.4479);
    expect(result.current.locationSource).toBe("previous");
    expect(result.current.isUsingPreviousLocation).toBe(true);
    expect(result.current.isUsingDefaultLocation).toBe(false);
    expect(result.current.isNetworkIssue).toBe(true);
    expect(result.current.top5Pharmacies.length).toBeGreaterThan(0);
  });

  it("defaults to Kampala when network issue occurs for first-time users (no previous location)", () => {
    // No previous location stored
    clearLastKnownLocation();
    localStorage.clear();

    // Device is offline
    mockIsOnline = false;
    mockGeoState = {
      location: null,
      status: "error",
      error: "No network connection",
      requestLocation: vi.fn(),
    };

    const { result } = renderHook(() => useNearbyPharmacies());

    expect(result.current.userCoords).toEqual(DEFAULT_KAMPALA_COORDS); // [32.5825, 0.3476]
    expect(result.current.locationSource).toBe("default");
    expect(result.current.isUsingPreviousLocation).toBe(false);
    expect(result.current.isUsingDefaultLocation).toBe(true);
    expect(result.current.isNetworkIssue).toBe(true);
    expect(result.current.top5Pharmacies.length).toBeGreaterThan(0);
  });

  it("defaults to Kampala when GPS status is error and no previous location exists", () => {
    clearLastKnownLocation();
    localStorage.clear();

    mockIsOnline = true;
    mockGeoState = {
      location: null,
      status: "error",
      error: "Geolocation timeout",
      requestLocation: vi.fn(),
    };

    const { result } = renderHook(() => useNearbyPharmacies());

    expect(result.current.userCoords).toEqual(DEFAULT_KAMPALA_COORDS);
    expect(result.current.isUsingDefaultLocation).toBe(true);
    expect(result.current.isNetworkIssue).toBe(true); // geo error treated as network/location issue
  });
});
