import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateHaversineDistance,
  findTopNearestPharmacies,
  findNearbyPharmacies,
  getPharmacyRoute,
  fetchTopPharmaciesRoadDistances,
  formatDuration,
  getAllDistricts,
  getDirectionsUrl,
  saveLastKnownLocation,
  getLastKnownLocation,
  clearLastKnownLocation,
  resolvePharmacyCoordinates,
  DEFAULT_KAMPALA_COORDS,
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
  }, 15000);

  it("generates correct directions navigation URLs for Google Maps with exact coordinates", () => {
    // Basic call with destination coordinates
    const url = getDirectionsUrl(0.3476, 32.5825, "Test Pharmacy");
    expect(url).toContain("destination=0.3476,32.5825");
    expect(url).toContain("dir_action=navigate");
    // Should NOT contain corrupted destination_place_id with pharmacy name
    expect(url).not.toContain("destination_place_id");
  });

  it("sends exact origin (user) and destination coordinates to Google Maps with travel mode", () => {
    // userCoords in [lng, lat] format (standard in dawa-lens)
    const userCoords: [number, number] = [32.5712, 0.3188];
    const pharmacyLat = 0.3542;
    const pharmacyLng = 32.6108;

    const drivingUrl = getDirectionsUrl(pharmacyLat, pharmacyLng, "Abacus Pharmacy", {
      userCoords,
      mode: "driving",
    });

    expect(drivingUrl).toContain("origin=0.3188,32.5712");
    expect(drivingUrl).toContain("destination=0.3542,32.6108");
    expect(drivingUrl).toContain("travelmode=driving");
    expect(drivingUrl).toContain("dir_action=navigate");
    expect(drivingUrl).not.toContain("destination_place_id");

    const walkingUrl = getDirectionsUrl(pharmacyLat, pharmacyLng, "First Pharmacy", {
      userCoords,
      mode: "walking",
    });

    expect(walkingUrl).toContain("origin=0.3188,32.5712");
    expect(walkingUrl).toContain("destination=0.3542,32.6108");
    expect(walkingUrl).toContain("travelmode=walking");
  });

  it("handles user coordinates passed as latitude/longitude object or direct array", () => {
    const fromObject = getDirectionsUrl(0.35, 32.60, "Object Pharmacy", {
      userCoords: { latitude: 0.32, longitude: 32.58 },
    });
    expect(fromObject).toContain("origin=0.32,32.58");
    expect(fromObject).toContain("destination=0.35,32.6");

    // Direct [lng, lat] 4th argument
    const fromArray = getDirectionsUrl(0.35, 32.60, "Array Pharmacy", [32.59, 0.33]);
    expect(fromArray).toContain("origin=0.33,32.59");
    expect(fromArray).toContain("destination=0.35,32.6");
  });

  it("formats Apple Maps URLs correctly when on iOS", () => {
    const originalUserAgent = navigator.userAgent;
    try {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        configurable: true,
      });

      const appleUrl = getDirectionsUrl(0.3542, 32.6108, "Life Pharmacy", {
        userCoords: [32.5712, 0.3188],
        mode: "walking",
      });

      expect(appleUrl).toContain("maps://maps.apple.com/");
      expect(appleUrl).toContain("saddr=0.3188,32.5712");
      expect(appleUrl).toContain("daddr=0.3542,32.6108");
      expect(appleUrl).toContain("dirflg=w");
      expect(appleUrl).toContain("q=Life%20Pharmacy");
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUserAgent,
        configurable: true,
      });
    }
  });

  it("formats route duration cleanly for minutes and hours", () => {
    expect(formatDuration(1)).toBe("~1 min");
    expect(formatDuration(15)).toBe("~15 mins");
    expect(formatDuration(60)).toBe("~1 hr");
    expect(formatDuration(120)).toBe("~2 hrs");
    expect(formatDuration(96)).toBe("~1h 36m");
  });

  it("calculates realistic walking duration instead of using car duration", async () => {
    const userCoords: [number, number] = [32.5825, 0.3476];
    const pharmacyCoords: [number, number] = [32.6108, 0.3542];

    const drivingRoute = await getPharmacyRoute(userCoords, pharmacyCoords, "driving");
    const walkingRoute = await getPharmacyRoute(userCoords, pharmacyCoords, "walking");

    expect(walkingRoute.durationMinutes).toBeGreaterThan(drivingRoute.durationMinutes);
    // Walking should roughly reflect ~4.8 km/h (approx 12.5 mins per km)
    const expectedApproxWalkMins = (walkingRoute.distanceKm / 4.8) * 60;
    expect(walkingRoute.durationMinutes).toBeCloseTo(expectedApproxWalkMins, -1);
  }, 15000);

  it("calculates realistic boda_boda duration and generates two_wheeler Google Maps URL", async () => {
    const userCoords: [number, number] = [32.5825, 0.3476];
    const pharmacyCoords: [number, number] = [32.6108, 0.3542];

    const bodaRoute = await getPharmacyRoute(userCoords, pharmacyCoords, "boda_boda");
    expect(bodaRoute.mode).toBe("boda_boda");
    expect(bodaRoute.distanceKm).toBeGreaterThan(0);
    expect(bodaRoute.durationMinutes).toBeGreaterThanOrEqual(1);

    // Boda boda (~26 km/h) should be much faster than walking (~4.8 km/h)
    const approxBodaMins = (bodaRoute.distanceKm / 26) * 60;
    expect(bodaRoute.durationMinutes).toBeCloseTo(approxBodaMins, -1);

    // Deep link contains travelmode=two_wheeler
    const navUrl = getDirectionsUrl(pharmacyCoords[1], pharmacyCoords[0], "First Pharmacy", {
      userCoords,
      mode: "boda_boda",
    });
    expect(navUrl).toContain("travelmode=two_wheeler");
    expect(navUrl).toContain(`destination=${pharmacyCoords[1]},${pharmacyCoords[0]}`);
  }, 15000);

  it("handles fetchTopPharmaciesRoadDistances gracefully and sorts ascending", async () => {
    const userCoords: [number, number] = [32.5825, 0.3476];
    const top5 = findTopNearestPharmacies(0.3476, 32.5825, 3);
    const enriched = await fetchTopPharmaciesRoadDistances(userCoords, top5, "boda_boda");

    expect(enriched).toHaveLength(top5.length);
    for (let i = 0; i < enriched.length; i++) {
      expect(enriched[i].distanceKm).toBeGreaterThan(0);
      if (i < enriched.length - 1) {
        expect(enriched[i].distanceKm!).toBeLessThanOrEqual(enriched[i + 1].distanceKm!);
      }
    }
  }, 15000);

  describe("Location persistence and fallback handling", () => {
    beforeEach(() => {
      clearLastKnownLocation();
      localStorage.clear();
    });

    it("saves and retrieves last known valid location", () => {
      expect(getLastKnownLocation()).toBeNull();

      saveLastKnownLocation({
        latitude: 0.6133,
        longitude: 30.6585,
        district: "Mbarara",
      });

      const saved = getLastKnownLocation();
      expect(saved).not.toBeNull();
      expect(saved?.latitude).toBeCloseTo(0.6133);
      expect(saved?.longitude).toBeCloseTo(30.6585);
      expect(saved?.district).toBe("Mbarara");
    });

    it("ignores invalid or NaN coordinates", () => {
      saveLastKnownLocation({
        latitude: NaN,
        longitude: 32.58,
      });
      expect(getLastKnownLocation()).toBeNull();

      saveLastKnownLocation({
        latitude: 100, // out of range -90..90
        longitude: 32.58,
      });
      expect(getLastKnownLocation()).toBeNull();
    });

    it("resolves to live location when online and GPS coordinate is available", () => {
      const live = { latitude: 0.4479, longitude: 33.2026 }; // Jinja
      const result = resolvePharmacyCoordinates({
        liveLocation: live,
        hasNetworkIssue: false,
      });

      expect(result.source).toBe("live");
      expect(result.coords).toEqual([33.2026, 0.4479]); // [lng, lat]
    });

    it("uses previous location in case of a network issue when previous location exists", () => {
      // User previously visited Mbarara
      saveLastKnownLocation({
        latitude: 0.6133,
        longitude: 30.6585,
        district: "Mbarara",
      });

      // Network issue occurs (e.g. offline or GPS network timeout)
      const result = resolvePharmacyCoordinates({
        liveLocation: null,
        hasNetworkIssue: true,
      });

      expect(result.source).toBe("previous");
      expect(result.coords[0]).toBeCloseTo(30.6585); // lng
      expect(result.coords[1]).toBeCloseTo(0.6133); // lat
    });

    it("defaults to Kampala in case of a network issue for first-time users (no previous location)", () => {
      // First-time user: no stored location
      clearLastKnownLocation();
      localStorage.clear();

      const result = resolvePharmacyCoordinates({
        liveLocation: null,
        hasNetworkIssue: true,
      });

      expect(result.source).toBe("default");
      expect(result.coords).toEqual(DEFAULT_KAMPALA_COORDS); // [32.5825, 0.3476] Kampala
    });

    it("defaults to Kampala if live GPS is unavailable and no previous location exists", () => {
      clearLastKnownLocation();
      localStorage.clear();

      const result = resolvePharmacyCoordinates({
        liveLocation: null,
        hasNetworkIssue: false,
      });

      expect(result.source).toBe("default");
      expect(result.coords).toEqual(DEFAULT_KAMPALA_COORDS);
    });
  });
});


