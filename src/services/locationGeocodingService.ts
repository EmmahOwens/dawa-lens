/**
 * Location Geocoding Service
 *
 * Provides address-to-GPS conversion and instant typeahead drop-down search suggestions
 * powered primarily by Photon (by Komoot - OpenStreetMap geocoder) with modular support
 * for Pelias (Mapzen/Geocode Earth) endpoints.
 *
 * Features:
 * - Converts addresses, neighborhoods, landmarks, and towns to exact [lng, lat] GPS coordinates.
 * - Instant typeahead search suggestions with location biasing for Uganda.
 * - In-memory LRU/map caching to minimize latency on keystrokes.
 * - Reverse geocoding from coordinates to human-readable names.
 * - Graceful fallback and offline resilience.
 */

export interface GeocodedPlace {
  id: string;
  name: string;
  displayName: string;
  coordinates: [number, number]; // [longitude, latitude]
  type: string; // "city" | "suburb" | "district" | "street" | "place" | "amenity" | "country"
  street?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  provider: "photon" | "pelias";
}

export interface GeocodeSearchOptions {
  limit?: number;
  biasLat?: number;
  biasLon?: number;
  countryCode?: string;
  provider?: "photon" | "pelias";
  timeoutMs?: number;
}

// Uganda center coordinates for default geographic biasing
export const UGANDA_DEFAULT_BIAS = {
  lat: 0.3476,
  lon: 32.5825,
};

const PHOTON_API_BASE = "https://photon.komoot.io";
const DEFAULT_LIMIT = 6;
const DEFAULT_TIMEOUT_MS = 5000;

// In-memory query cache to speed up typeahead and reduce repetitive API requests
const searchCache = new Map<string, GeocodedPlace[]>();
const reverseCache = new Map<string, GeocodedPlace>();
const MAX_CACHE_SIZE = 100;

function addToCache<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

/**
 * Cleanly format place parts into a readable display name.
 */
export function formatPlaceDisplayName(properties: Record<string, any>): string {
  const parts: string[] = [];

  if (properties.name) parts.push(properties.name);
  if (properties.street && properties.street !== properties.name) {
    parts.push(properties.street);
  }
  if (properties.locality && properties.locality !== properties.name) {
    parts.push(properties.locality);
  }
  if (properties.district && !parts.includes(properties.district)) {
    parts.push(properties.district);
  }
  if (properties.city && !parts.includes(properties.city)) {
    parts.push(properties.city);
  }
  if (properties.state && !parts.includes(properties.state)) {
    parts.push(properties.state);
  }
  if (properties.country && !parts.includes(properties.country)) {
    parts.push(properties.country);
  }

  return parts.length > 0 ? parts.join(", ") : properties.name || "Unknown Location";
}

/**
 * Normalizes Photon API GeoJSON Feature into GeocodedPlace
 */
export function normalizePhotonFeature(feature: any): GeocodedPlace | null {
  if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
    return null;
  }

  const [lng, lat] = feature.geometry.coordinates;
  if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) {
    return null;
  }

  const props = feature.properties || {};
  const placeName = props.name || props.street || props.city || props.district || "Location";
  const placeType = props.type || props.osm_value || props.osm_key || "place";

  return {
    id: `photon-${props.osm_type || "N"}-${props.osm_id || Math.random().toString(36).substring(2, 9)}`,
    name: placeName,
    displayName: formatPlaceDisplayName(props),
    coordinates: [lng, lat],
    type: placeType,
    street: props.street,
    district: props.district || props.county,
    city: props.city,
    state: props.state,
    country: props.country,
    countryCode: (props.countrycode || "").toUpperCase() || undefined,
    provider: "photon",
  };
}

/**
 * Normalizes Pelias GeoJSON Feature into GeocodedPlace
 */
export function normalizePeliasFeature(feature: any): GeocodedPlace | null {
  if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
    return null;
  }

  const [lng, lat] = feature.geometry.coordinates;
  if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) {
    return null;
  }

  const props = feature.properties || {};
  return {
    id: `pelias-${props.id || props.gid || Math.random().toString(36).substring(2, 9)}`,
    name: props.name || props.label || "Location",
    displayName: props.label || formatPlaceDisplayName(props),
    coordinates: [lng, lat],
    type: props.layer || "place",
    street: props.street,
    district: props.county || props.region,
    city: props.locality,
    state: props.region,
    country: props.country,
    countryCode: (props.country_a || "").toUpperCase() || undefined,
    provider: "pelias",
  };
}

/**
 * Safe fetch wrapper with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  let signal: AbortSignal | undefined = undefined;
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      signal = AbortSignal.timeout(timeoutMs);
    } else if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeoutMs);
      signal = controller.signal;
    }
  } catch {}

  return await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
}

/**
 * Search address suggestions using Photon (by Komoot).
 * Converts user query to ranked address suggestions with coordinates.
 */
export async function searchPhotonSuggestions(
  query: string,
  options: GeocodeSearchOptions = {}
): Promise<GeocodedPlace[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const {
    limit = DEFAULT_LIMIT,
    biasLat = UGANDA_DEFAULT_BIAS.lat,
    biasLon = UGANDA_DEFAULT_BIAS.lon,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const cacheKey = `photon:${trimmed.toLowerCase()}:${limit}:${biasLat.toFixed(2)},${biasLon.toFixed(2)}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  try {
    const params = new URLSearchParams({
      q: trimmed,
      limit: String(limit),
      lat: String(biasLat),
      lon: String(biasLon),
    });

    const url = `${PHOTON_API_BASE}/api/?${params.toString()}`;
    const res = await fetchWithTimeout(url, timeoutMs);

    if (!res.ok) {
      console.warn(`[LocationGeocoding] Photon API error: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.features)) {
      return [];
    }

    const results: GeocodedPlace[] = [];
    for (const feat of data.features) {
      const place = normalizePhotonFeature(feat);
      if (place) results.push(place);
    }

    addToCache(searchCache, cacheKey, results);
    return results;
  } catch (err) {
    console.warn("[LocationGeocoding] Photon search failed:", err);
    return [];
  }
}

/**
 * Search address suggestions using a Pelias-compatible endpoint.
 */
export async function searchPeliasSuggestions(
  query: string,
  peliasBaseUrl: string,
  options: GeocodeSearchOptions = {}
): Promise<GeocodedPlace[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const {
    limit = DEFAULT_LIMIT,
    biasLat = UGANDA_DEFAULT_BIAS.lat,
    biasLon = UGANDA_DEFAULT_BIAS.lon,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const cacheKey = `pelias:${trimmed.toLowerCase()}:${limit}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  try {
    const params = new URLSearchParams({
      text: trimmed,
      size: String(limit),
      "focus.point.lat": String(biasLat),
      "focus.point.lon": String(biasLon),
    });

    const url = `${peliasBaseUrl.replace(/\/+$/, "")}/v1/autocomplete?${params.toString()}`;
    const res = await fetchWithTimeout(url, timeoutMs);

    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.features)) return [];

    const results: GeocodedPlace[] = [];
    for (const feat of data.features) {
      const place = normalizePeliasFeature(feat);
      if (place) results.push(place);
    }

    addToCache(searchCache, cacheKey, results);
    return results;
  } catch (err) {
    console.warn("[LocationGeocoding] Pelias search failed:", err);
    return [];
  }
}

/**
 * Primary search suggestions function:
 * Searches address and location suggestions using Photon by Komoot (or Pelias if configured).
 */
export async function searchAddressSuggestions(
  query: string,
  options: GeocodeSearchOptions = {}
): Promise<GeocodedPlace[]> {
  const provider = options.provider || "photon";
  const peliasUrl = typeof process !== "undefined" && (process.env?.VITE_PELIAS_API_URL || "");

  if (provider === "pelias" && peliasUrl) {
    return searchPeliasSuggestions(query, peliasUrl, options);
  }

  return searchPhotonSuggestions(query, options);
}

/**
 * Reverse-geocodes [lat, lon] to a human-readable location using Photon.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lon: number,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<GeocodedPlace | null> {
  if (typeof lat !== "number" || typeof lon !== "number" || isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const cacheKey = `reverse:${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey)!;
  }

  try {
    const url = `${PHOTON_API_BASE}/reverse?lat=${lat}&lon=${lon}`;
    const res = await fetchWithTimeout(url, timeoutMs);

    if (!res.ok) return null;

    const data = await res.json();
    if (data && Array.isArray(data.features) && data.features.length > 0) {
      const place = normalizePhotonFeature(data.features[0]);
      if (place) {
        addToCache(reverseCache, cacheKey, place);
        return place;
      }
    }
  } catch (err) {
    console.warn("[LocationGeocoding] Reverse geocoding failed:", err);
  }

  return null;
}

/**
 * Clear in-memory caches (useful for testing or memory resets)
 */
export function clearGeocodeCache(): void {
  searchCache.clear();
  reverseCache.clear();
}
