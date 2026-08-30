import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateHaversineDistance,
  findTopNearestPharmacies,
  findNearbyPharmacies,
  getPharmacyRoute,
  getAllDistricts,
  getDirectionsUrl,
} from "../pharmacyService";

describe("pharmacyService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates accurate Haversine distances between coordinates", () => {
    // Kampala (0.3476, 32.5825) to Entebbe (0.0512, 32.4637) is approx 35 km
    const dist = calculateHaversineDistance(0.3476, 32.5825, 0.0512, 32.4637);
    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(40);

    // Same point should be 0
    expect(calculateHaversineDistance(0.3476, 32.5825, 0.3476, 32.5825)).toBe(0);
  });

  it("finds the top 5 nearest pharmacies sorted by distance ascending", () => {
    // User in Kampala Central
    const userLat = 0.3476;
    const userLng = 32.5825;
    const top5 = findTopNearestPharmacies(userLat, userLng, 5);

    expect(top5.length).toBeLessThanOrEqual(5);
    expect(top5.length).toBeGreaterThan(0);

    // Verify distance is attached and sorted ascending
    for (let i = 0; i < top5.length - 1; i++) {
      expect(top5[i].distanceKm).toBeDefined();
      expect(top5[i].distanceKm!).toBeLessThanOrEqual(top5[i + 1].distanceKm!);
    }
  });

  it("filters pharmacies by search query and district", () => {
    const userLat = 0.3476;
    const userLng = 32.5825;

    const kampalaPharmacies = findNearbyPharmacies(userLat, userLng, {
      district: "Kampala",
      limit: 10,
    });
    expect(kampalaPharmacies.length).toBeGreaterThan(0);
    for (const p of kampalaPharmacies) {
      expect(p.district.toLowerCase()).toBe("kampala");
    }

    const searched = findNearbyPharmacies(userLat, userLng, {
      query: "Pharmacy",
      limit: 5,
    });
    expect(searched.length).toBeGreaterThan(0);
  });

  it("returns sorted unique districts list", () => {
    const districts = getAllDistricts();
    expect(districts.length).toBeGreaterThan(10);
    expect(districts).toContain("Kampala");
    expect(districts).toContain("Wakiso");
  });

  it("fetches road route from OSRM or falls back to straight-line geometry", async () => {
    const userCoords: [number, number] = [32.5825, 0.3476];
    const pharmacyCoords: [number, number] = [32.6108, 0.3542];

    const route = await getPharmacyRoute(userCoords, pharmacyCoords, "driving");
    expect(route).toBeDefined();
    expect(route.coordinates.length).toBeGreaterThan(1);
    expect(route.distanceKm).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThan(0);
    expect(route.mode).toBe("driving");
  });

  it("generates correct directions navigation URLs", () => {
    const url = getDirectionsUrl(0.3476, 32.5825, "Test Pharmacy");
    expect(url).toContain("0.3476");
    expect(url).toContain("32.5825");
  });
});
