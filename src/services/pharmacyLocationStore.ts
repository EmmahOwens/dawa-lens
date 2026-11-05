export const DEFAULT_KAMPALA_COORDS: [number, number] = [32.5825, 0.3476]; // [lng, lat]
const LAST_KNOWN_LOCATION_STORAGE_KEY = "dawa_pharmacy_last_location";

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
  hasGpsIssue?: boolean;
}

export interface ResolvedCoordinates {
  coords: [number, number]; // [lng, lat]
  source: "live" | "previous" | "default";
}

export function resolvePharmacyCoordinates(
  options: ResolveCoordinatesOptions = {}
): ResolvedCoordinates {
  const { liveLocation, hasNetworkIssue = false, hasGpsIssue = false } = options;

  const hasValidLive =
    liveLocation &&
    typeof liveLocation.latitude === "number" &&
    !isNaN(liveLocation.latitude) &&
    typeof liveLocation.longitude === "number" &&
    !isNaN(liveLocation.longitude);

  if (hasValidLive && !hasNetworkIssue && !hasGpsIssue) {
    return {
      coords: [liveLocation.longitude, liveLocation.latitude],
      source: "live",
    };
  }

  const previous = getLastKnownLocation();
  if (previous) {
    return {
      coords: [previous.longitude, previous.latitude],
      source: "previous",
    };
  }

  return {
    coords: DEFAULT_KAMPALA_COORDS,
    source: "default",
  };
}
