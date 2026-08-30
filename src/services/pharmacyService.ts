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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const routeObj = data.routes[0];
        const routeResult: PharmacyRoute = {
          coordinates: routeObj.geometry.coordinates as [number, number][],
          distanceKm: Math.round((routeObj.distance / 1000) * 10) / 10,
          durationMinutes: Math.max(1, Math.round(routeObj.duration / 60)),
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

  const speedKmh = mode === "walking" ? 4.5 : 30; // avg city speed in Uganda
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
