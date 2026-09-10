import rawNdaData from "../data/ndaPharmacies.json";

export interface NdaPharmacy {
  id: string;
  name: string;
  premiseNo: string;
  premiseType: string;
  isRetail: boolean;
  isWholesale: boolean;
  expiryDate: string;
  address: string;
  street: string;
  pharmacist: string;
  psuNo: string;
  category: string;
  district: string;
  region: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  verified: boolean;
  distanceKm?: number;
  durationMinutes?: number;
}

export interface PharmacyRoute {
  coordinates: [number, number][]; // [lng, lat] for MapLibre GeoJSON LineString
  distanceKm: number;
  durationMinutes: number;
  mode: "driving" | "walking";
  isFallback?: boolean;
}

export interface PharmacyFilterOptions {
  radiusKm?: number;
  district?: string;
  query?: string;
  onlyRetail?: boolean;
  limit?: number;
}

export const NDA_SOURCE_METADATA = {
  authority: "National Drug Authority (NDA)",
  fullName: "National Drug Authority Uganda",
  country: "Uganda",
  portalUrl: "https://www.nda.or.ug",
  registerName: "Official Register of Licensed Drug Outlets & Pharmacies",
  verificationStatement: "Verified and licensed by the National Drug Authority (NDA) Uganda under the National Drug Policy and Authority Act.",
} as const;

export const DEFAULT_KAMPALA_COORDS: [number, number] = [32.5825, 0.3476]; // [lng, lat]
export const KAMPALA_LAT_LNG = { latitude: 0.3476, longitude: 32.5825 } as const;
export const LAST_KNOWN_LOCATION_STORAGE_KEY = "dawa_pharmacy_last_location";

export interface SavedPharmacyLocation {
  latitude: number;
  longitude: number;
  country?: string | null;
  countryCode?: string | null;
  district?: string | null;
  timestamp: number;
}

let inMemorySavedLocation: SavedPharmacyLocation | null = null;

export function saveLastKnownLocation(location: {
  latitude: number;
  longitude: number;
  country?: string | null;
  countryCode?: string | null;
  district?: string | null;
}): void {
  if (
    typeof location?.latitude !== "number" ||
    isNaN(location.latitude) ||
    typeof location?.longitude !== "number" ||
    isNaN(location.longitude) ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    return;
  }

  const saved: SavedPharmacyLocation = {
    latitude: location.latitude,
    longitude: location.longitude,
    country: location.country ?? null,
    countryCode: location.countryCode ?? null,
    district: location.district ?? null,
    timestamp: Date.now(),
  };

  inMemorySavedLocation = saved;

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_KNOWN_LOCATION_STORAGE_KEY, JSON.stringify(saved));
    }
  } catch (err) {
    console.warn("[pharmacyService] Failed to persist last known location to localStorage:", err);
  }
}

export function getLastKnownLocation(): SavedPharmacyLocation | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw =
        localStorage.getItem(LAST_KNOWN_LOCATION_STORAGE_KEY) ||
        localStorage.getItem("dawa_last_known_location");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed?.latitude === "number" &&
          !isNaN(parsed.latitude) &&
          typeof parsed?.longitude === "number" &&
          !isNaN(parsed.longitude) &&
          parsed.latitude >= -90 &&
          parsed.latitude <= 90 &&
          parsed.longitude >= -180 &&
          parsed.longitude <= 180
        ) {
          inMemorySavedLocation = parsed as SavedPharmacyLocation;
          return parsed as SavedPharmacyLocation;
        }
      }
    }
  } catch (err) {
    console.warn("[pharmacyService] Failed to read last known location from localStorage:", err);
  }

  return inMemorySavedLocation;
}

export function clearLastKnownLocation(): void {
  inMemorySavedLocation = null;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LAST_KNOWN_LOCATION_STORAGE_KEY);
      localStorage.removeItem("dawa_last_known_location");
    }
  } catch {}
}

export interface ResolveCoordinatesOptions {
  liveLocation?: { latitude: number; longitude: number } | null;
  hasNetworkIssue?: boolean;
}

export interface ResolvedCoordinates {
  coords: [number, number]; // [lng, lat]
  source: "live" | "previous" | "default";
}

/**
 * Resolves user coordinates for the NDA Pharmacy locator:
 * - If online and live GPS location is available -> uses live location.
 * - If there is a network issue (or live location unavailable):
 *     1. Uses the previous location if one was previously recorded.
 *     2. If no previous location exists (e.g. first-time user with network issue), defaults to Kampala.
 */
export function resolvePharmacyCoordinates(
  options: ResolveCoordinatesOptions = {}
): ResolvedCoordinates {
  const { liveLocation, hasNetworkIssue = false } = options;

  const hasValidLive =
    liveLocation &&
    typeof liveLocation.latitude === "number" &&
    !isNaN(liveLocation.latitude) &&
    typeof liveLocation.longitude === "number" &&
    !isNaN(liveLocation.longitude);

  // If we have valid live GPS and NO network issue, use live location
  if (hasValidLive && !hasNetworkIssue) {
    return {
      coords: [liveLocation.longitude, liveLocation.latitude],
      source: "live",
    };
  }

  // Network issue OR live location not available:
  // Check if a previous location exists
  const previous = getLastKnownLocation();
  if (previous) {
    return {
      coords: [previous.longitude, previous.latitude],
      source: "previous",
    };
  }

  // First-time users with network issues (or no previous location): default to Kampala
  return {
    coords: DEFAULT_KAMPALA_COORDS,
    source: "default",
  };
}

// In-memory cache for road routes: `${lng1},${lat1}->${lng2},${lat2}:${mode}`
const routeCache = new Map<string, PharmacyRoute>();

const PHARMACIES: NdaPharmacy[] = (rawNdaData?.pharmacies || []) as NdaPharmacy[];

/**
 * Calculates the great-circle distance between two points on Earth in kilometers using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Returns the Top N nearest licensed pharmacies relative to the user's GPS coordinates.
 */
export function findTopNearestPharmacies(
  userLat: number,
  userLng: number,
  count = 5,
  onlyRetail = true
): NdaPharmacy[] {
  if (!PHARMACIES || PHARMACIES.length === 0) return [];

  const valid = PHARMACIES.filter((p) => {
    if (onlyRetail && !p.isRetail) return false;
    return typeof p.latitude === "number" && typeof p.longitude === "number";
  });

  const withDist = valid.map((p) => {
    const dist = calculateHaversineDistance(userLat, userLng, p.latitude, p.longitude);
    return { ...p, distanceKm: dist };
  });

  withDist.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return withDist.slice(0, count);
}

/**
 * Searches and filters licensed pharmacies by distance radius, district, and search query.
 */
export function findNearbyPharmacies(
  userLat: number,
  userLng: number,
  options: PharmacyFilterOptions = {}
): NdaPharmacy[] {
  const {
    radiusKm = 25,
    district = "",
    query = "",
    onlyRetail = true,
    limit = 50,
  } = options;

  let results = PHARMACIES.filter((p) => {
    if (onlyRetail && !p.isRetail) return false;
    if (district && district !== "ALL" && p.district.toLowerCase() !== district.toLowerCase()) {
      return false;
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchAddress = p.address.toLowerCase().includes(q);
      const matchStreet = p.street.toLowerCase().includes(q);
      const matchPharmacist = p.pharmacist.toLowerCase().includes(q);
      const matchDistrict = p.district.toLowerCase().includes(q);
      if (!matchName && !matchAddress && !matchStreet && !matchPharmacist && !matchDistrict) {
        return false;
      }
    }
    return true;
  });

  const withDist = results.map((p) => {
    const dist = calculateHaversineDistance(userLat, userLng, p.latitude, p.longitude);
    return { ...p, distanceKm: dist };
  });

  const filteredByRadius =
    radiusKm && radiusKm < 1000
      ? withDist.filter((p) => (p.distanceKm ?? Infinity) <= radiusKm)
      : withDist;

  filteredByRadius.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return filteredByRadius.slice(0, limit);
}

/**
 * Formats duration in minutes to a user-friendly string (e.g., "~12 mins" or "~1h 35m").
 */
export function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) {
    return `~${minutes} min${minutes !== 1 ? "s" : ""}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `~${hours} hr${hours !== 1 ? "s" : ""}`;
  }
  return `~${hours}h ${remainingMins}m`;
}

/**
 * Safe wrapper around fetch with timeout signal that gracefully falls back if
 * the test environment (jsdom vs node) has cross-realm AbortSignal mismatch.
 */
async function safeFetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  let signal: AbortSignal | undefined = undefined;
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      signal = AbortSignal.timeout(timeoutMs);
    } else if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeoutMs);
      signal = controller.signal;
    }
  } catch {
    // Ignore signal creation errors
  }

  try {
    return await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (err: any) {
    if (signal && err instanceof TypeError && err.message?.includes("AbortSignal")) {
      return await fetch(url, {
        headers: { Accept: "application/json" },
      });
    }
    throw err;
  }
}

/**
 * Fetches turn-by-turn road route coordinates and distance/duration using OSRM (Open Source Routing Machine),
 * with graceful fallback to straight-line interpolation if offline or network failure.
 *
 * userCoords: [lng, lat]
 * pharmacyCoords: [lng, lat]
 */
export async function getPharmacyRoute(
  userCoords: [number, number],
  pharmacyCoords: [number, number],
  mode: "driving" | "walking" = "driving"
): Promise<PharmacyRoute> {
  const cacheKey = `${userCoords[0].toFixed(5)},${userCoords[1].toFixed(5)}->${pharmacyCoords[0].toFixed(5)},${pharmacyCoords[1].toFixed(5)}:${mode}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  const [uLng, uLat] = userCoords;
  const [pLng, pLat] = pharmacyCoords;
  const straightDist = calculateHaversineDistance(uLat, uLng, pLat, pLng);

  try {
    const osrmProfile = mode === "walking" ? "walking" : "driving";
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${uLng},${uLat};${pLng},${pLat}?overview=full&geometries=geojson`;

    const res = await safeFetchWithTimeout(url, 6000);

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const routeObj = data.routes[0];
        const routeDistanceKm = Math.round((routeObj.distance / 1000) * 10) / 10;
        
        // OSRM demo server only computes driving durations. For walking, calculate realistic walking time based on distance (4.8 km/h).
        const durationMinutes =
          mode === "walking"
            ? Math.max(1, Math.round((routeDistanceKm / 4.8) * 60))
            : Math.max(1, Math.round(routeObj.duration / 60));

        const routeResult: PharmacyRoute = {
          coordinates: routeObj.geometry.coordinates as [number, number][],
          distanceKm: routeDistanceKm,
          durationMinutes,
          mode,
          isFallback: false,
        };
        routeCache.set(cacheKey, routeResult);
        return routeResult;
      }
    }
  } catch (err) {
    console.warn("[PharmacyService] OSRM route fetch failed, using direct geometry fallback:", err);
  }

  // Graceful fallback geometry: 10 interpolated points connecting start and end
  const steps = 10;
  const fallbackCoords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fallbackCoords.push([
      uLng + (pLng - uLng) * t,
      uLat + (pLat - uLat) * t,
    ]);
  }

  const speedKmh = mode === "walking" ? 4.8 : 30; // avg city speed in Uganda
  const estDuration = Math.max(1, Math.round((straightDist / speedKmh) * 60));

  const fallbackResult: PharmacyRoute = {
    coordinates: fallbackCoords,
    distanceKm: straightDist,
    durationMinutes: estDuration,
    mode,
    isFallback: true,
  };

  routeCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

/**
 * Fetches true turn-by-turn road route distances for a list of candidate pharmacies using the OSRM table service.
 * If OSRM is unavailable or offline, seamlessly preserves existing distances (e.g. Haversine).
 */
export async function fetchTopPharmaciesRoadDistances(
  userCoords: [number, number],
  pharmacies: NdaPharmacy[],
  mode: "driving" | "walking" = "driving"
): Promise<NdaPharmacy[]> {
  if (!pharmacies || pharmacies.length === 0) return pharmacies;

  const [uLng, uLat] = userCoords;
  const coordsStr = [
    `${uLng.toFixed(5)},${uLat.toFixed(5)}`,
    ...pharmacies.map((p) => `${p.longitude.toFixed(5)},${p.latitude.toFixed(5)}`),
  ].join(";");

  try {
    const osrmProfile = mode === "walking" ? "walking" : "driving";
    const url = `https://router.project-osrm.org/table/v1/${osrmProfile}/${coordsStr}?sources=0&annotations=distance,duration`;

    const res = await safeFetchWithTimeout(url, 5000);

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && Array.isArray(data.distances) && data.distances[0]) {
        const distRow = data.distances[0]; // [0, distToP1, distToP2, ...]
        const durationRow = Array.isArray(data.durations) ? data.durations[0] : null;

        const withDistances = pharmacies.map((p, idx) => {
          const distMeters = distRow[idx + 1];
          if (typeof distMeters === "number" && distMeters > 0) {
            const distKm = Math.round((distMeters / 1000) * 10) / 10;
            let durationMins: number | undefined = undefined;

            if (mode === "walking") {
              durationMins = Math.max(1, Math.round((distKm / 4.8) * 60));
            } else if (durationRow && typeof durationRow[idx + 1] === "number") {
              durationMins = Math.max(1, Math.round(durationRow[idx + 1] / 60));
            }

            return {
              ...p,
              distanceKm: distKm,
              durationMinutes: durationMins,
            };
          }
          return p;
        });

        // Always sort in ascending order from nearest to farthest distance
        return withDistances.sort(
          (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        );
      }
    }
  } catch (err) {
    console.warn("[PharmacyService] Failed to fetch road distances via OSRM table:", err);
  }

  return [...pharmacies].sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  );
}

/**
 * Returns a sorted list of unique Ugandan districts present in the NDA dataset.
 */
export function getAllDistricts(): string[] {
  const set = new Set<string>();
  for (const p of PHARMACIES) {
    if (p.district && p.district !== "\\N") {
      set.add(p.district);
    }
  }
  return Array.from(set).sort();
}

/**
 * Generates an external deep link to open navigation in Google Maps or Apple Maps.
 */
export function getDirectionsUrl(lat: number, lng: number, name?: string): string {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name || "Pharmacy")}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name || "Pharmacy")}`;
}

