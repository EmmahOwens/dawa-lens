import React, { useEffect, useRef, useMemo, useState } from 'react';
import maplibregl, { Map, Marker, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane } from "@/lib/icons";
import { RiveMoji } from "../rive/RiveMoji";

interface TravelMapProps {
  isAnimating: boolean;
  destination: string;
  userCoords?: [number, number] | null;
  userCountry?: string | null;
}

// ── Comprehensive geographic coordinates (capital/major-city [lng, lat]) ──────
const LOCATION_MAP: Record<string, [number, number]> = {
  // ─── Africa ────────────────────────────────────────────────────────────────
  algeria: [3.06, 36.75], angola: [13.23, -8.84], benin: [2.63, 6.50],
  botswana: [25.91, -24.65], burkinafaso: [-1.52, 12.37], burundi: [29.36, -3.38],
  cameroon: [11.52, 3.87], capeverde: [-23.51, 14.93], car: [18.56, 4.36],
  centralafricanrepublic: [18.56, 4.36], chad: [15.04, 12.13], comoros: [43.25, -11.70],
  congo: [15.28, -4.27], drc: [15.31, -4.32], djibouti: [43.15, 11.59],
  egypt: [31.24, 30.06], equatorialguinea: [8.78, 3.75], eritrea: [38.93, 15.34],
  eswatini: [31.13, -26.31], swaziland: [31.13, -26.31], ethiopia: [38.74, 9.00],
  gabon: [9.45, 0.39], gambia: [-16.58, 13.45], ghana: [-0.19, 5.56],
  guinea: [-13.68, 9.54], guineabissau: [-15.60, 11.86], ivorycoast: [-5.55, 6.83],
  cotedivoire: [-5.55, 6.83], kenya: [36.82, -1.29], lesotho: [27.48, -29.31],
  liberia: [-10.80, 6.30], libya: [13.18, 32.90], madagascar: [47.52, -18.88],
  malawi: [33.79, -13.97], mali: [-8.00, 12.65], mauritania: [-15.98, 18.09],
  mauritius: [57.50, -20.16], morocco: [-7.09, 31.79], mozambique: [32.57, -25.97],
  namibia: [17.08, -22.56], niger: [2.11, 13.51], nigeria: [3.38, 6.45],
  rwanda: [29.87, -1.94], saotomeandprincipe: [6.73, 0.34],
  senegal: [-17.47, 14.72], seychelles: [55.45, -4.62], sierraleone: [-13.23, 8.48],
  somalia: [45.34, 2.05], southafrica: [28.04, -26.20], southsudan: [31.58, 4.85],
  sudan: [32.53, 15.50], tanzania: [39.28, -6.79], togo: [1.23, 6.14],
  tunisia: [10.17, 36.81], uganda: [32.58, 0.32], zambia: [28.28, -15.42],
  zimbabwe: [31.05, -17.83],

  // ─── Europe ────────────────────────────────────────────────────────────────
  albania: [19.82, 41.33], andorra: [1.52, 42.51], armenia: [44.51, 40.18],
  austria: [16.37, 48.21], azerbaijan: [49.87, 40.41], belarus: [27.57, 53.90],
  belgium: [4.35, 50.85], bosniaandherzegovina: [18.41, 43.86], bosnia: [18.41, 43.86],
  bulgaria: [23.32, 42.70], croatia: [15.98, 45.81], cyprus: [33.38, 35.17],
  czechrepublic: [14.42, 50.08], czechia: [14.42, 50.08], denmark: [12.57, 55.68],
  estonia: [24.75, 59.44], finland: [24.94, 60.17], france: [2.35, 48.86],
  georgia: [44.79, 41.72], germany: [13.41, 52.52], greece: [23.73, 37.98],
  hungary: [19.04, 47.50], iceland: [-21.90, 64.14], ireland: [-6.26, 53.35],
  italy: [12.50, 41.90], kosovo: [21.17, 42.66], latvia: [24.11, 56.95],
  liechtenstein: [9.52, 47.14], lithuania: [25.28, 54.69], luxembourg: [6.13, 49.61],
  malta: [14.51, 35.90], moldova: [28.86, 47.01], monaco: [7.42, 43.73],
  montenegro: [19.26, 42.44], netherlands: [4.90, 52.37], northmacedonia: [21.43, 42.00],
  macedonia: [21.43, 42.00], norway: [10.75, 59.91], poland: [21.01, 52.23],
  portugal: [-9.14, 38.72], romania: [26.10, 44.43], russia: [37.62, 55.75],
  sanmarino: [12.46, 43.94], serbia: [20.46, 44.81], slovakia: [17.11, 48.15],
  slovenia: [14.51, 46.06], spain: [-3.70, 40.42], sweden: [18.07, 59.33],
  switzerland: [7.45, 46.95], ukraine: [30.52, 50.45],
  uk: [-0.13, 51.51], unitedkingdom: [-0.13, 51.51], england: [-0.13, 51.51],
  scotland: [-3.19, 55.95], wales: [-3.18, 51.48],
  vatican: [12.45, 41.90],

  // ─── Asia ──────────────────────────────────────────────────────────────────
  afghanistan: [69.17, 34.53], bahrain: [50.58, 26.23], bangladesh: [90.41, 23.81],
  bhutan: [89.64, 27.47], brunei: [114.95, 4.93], cambodia: [104.92, 11.56],
  china: [116.40, 39.91], india: [77.21, 28.61], indonesia: [106.85, -6.21],
  iran: [51.42, 35.70], iraq: [44.36, 33.34], israel: [35.22, 31.77],
  japan: [139.69, 35.69], jordan: [35.94, 31.96], kazakhstan: [71.45, 51.17],
  kuwait: [47.97, 29.38], kyrgyzstan: [74.59, 42.87], laos: [102.63, 17.97],
  lebanon: [35.50, 33.89], malaysia: [101.69, 3.14], maldives: [73.51, 4.18],
  mongolia: [106.91, 47.92], myanmar: [96.17, 16.87], burma: [96.17, 16.87],
  nepal: [85.32, 27.72], northkorea: [125.75, 39.02], oman: [58.39, 23.61],
  pakistan: [73.04, 33.72], palestine: [35.23, 31.90], philippines: [120.98, 14.60],
  qatar: [51.53, 25.29], saudiarabia: [46.68, 24.69], singapore: [103.82, 1.35],
  southkorea: [126.98, 37.57], srilanka: [80.64, 7.88], syria: [36.29, 33.51],
  taiwan: [121.56, 25.03], tajikistan: [68.77, 38.56], thailand: [100.52, 13.75],
  timorleste: [125.57, -8.56], easttimorleste: [125.57, -8.56],
  turkey: [32.87, 39.93], turkmenistan: [58.38, 37.95],
  uae: [55.30, 25.20], unitedarabemirates: [55.30, 25.20],
  uzbekistan: [69.28, 41.30], vietnam: [105.85, 21.03], yemen: [44.21, 15.35],

  // ─── Americas ──────────────────────────────────────────────────────────────
  antiguaandbarbuda: [-61.80, 17.12], argentina: [-58.38, -34.60],
  bahamas: [-77.35, 25.06], barbados: [-59.60, 13.10], belize: [-88.77, 17.25],
  bolivia: [-68.15, -16.50], brazil: [-47.86, -15.78], canada: [-75.70, 45.42],
  chile: [-70.67, -33.45], colombia: [-74.08, 4.71], costarica: [-84.09, 9.93],
  cuba: [-82.38, 23.11], dominica: [-61.39, 15.30],
  dominicanrepublic: [-69.90, 18.47], ecuador: [-78.47, -0.18],
  elsalvador: [-89.19, 13.69], grenada: [-61.75, 12.06],
  guatemala: [-90.53, 14.63], guyana: [-58.16, 6.80], haiti: [-72.34, 18.54],
  honduras: [-87.22, 14.08], jamaica: [-76.79, 18.00], mexico: [-99.13, 19.43],
  nicaragua: [-86.25, 12.14], panama: [-79.52, 9.00], paraguay: [-57.58, -25.28],
  peru: [-77.04, -12.05], saintkittsandnevis: [-62.72, 17.30],
  saintlucia: [-61.00, 14.01], saintvincentandthegrenadines: [-61.21, 13.16],
  suriname: [-55.17, 5.82], trinidadandtobago: [-61.50, 10.65],
  usa: [-77.04, 38.90], unitedstates: [-77.04, 38.90],
  uruguay: [-56.16, -34.88], venezuela: [-66.91, 10.48],

  // ─── Oceania ───────────────────────────────────────────────────────────────
  australia: [149.13, -35.31], fiji: [178.44, -18.14],
  kiribati: [172.98, 1.45], marshallislands: [171.38, 7.09],
  micronesia: [158.16, 6.92], nauru: [166.92, -0.52],
  newzealand: [174.78, -36.85], palau: [134.48, 7.50],
  papuanewguinea: [147.15, -6.31], samoa: [-171.76, -13.83],
  solomonislands: [159.97, -9.43], tonga: [-175.20, -21.21],
  tuvalu: [179.19, -8.52], vanuatu: [168.32, -17.73],
};

// ── Aliases: common alternate names → canonical LOCATION_MAP key ────────────
const ALIAS_MAP: Record<string, string> = {
  // Short forms & common names
  'us': 'usa', 'america': 'usa', 'unitedstatesofamerica': 'usa', 'states': 'usa',
  'britain': 'uk', 'greatbritain': 'uk',
  'emirates': 'uae', 'dubai': 'uae', 'abudhabi': 'uae',
  'korea': 'southkorea', 'republicofkorea': 'southkorea',
  'dprk': 'northkorea', 'northkorea': 'northkorea',
  'congo': 'drc', 'democraticrepublicofthecongo': 'drc', 'congokinshasa': 'drc',
  'republicofthecongo': 'congo', 'congobrazzaville': 'congo',
  'ivorycoast': 'cotedivoire', 'côtedivoire': 'cotedivoire',
  'czechrepublic': 'czechia',
  'swaziland': 'eswatini',
  'burma': 'myanmar',
  'persia': 'iran',
  'holland': 'netherlands',
  'vatican': 'vatican', 'vaticancity': 'vatican', 'holysee': 'vatican',
  'easttimorleste': 'timorleste', 'easttimor': 'timorleste',
  'capeverde': 'capeverde', 'caboverde': 'capeverde',
  'saotome': 'saotomeandprincipe',
  'trinidadtobago': 'trinidadandtobago', 'trinidad': 'trinidadandtobago',
  'antiguabarbuda': 'antiguaandbarbuda', 'antigua': 'antiguaandbarbuda',
  'stkitts': 'saintkittsandnevis', 'saintkitts': 'saintkittsandnevis',
  'stlucia': 'saintlucia',
  'stvincent': 'saintvincentandthegrenadines', 'saintvincent': 'saintvincentandthegrenadines',
  'papuanewguinea': 'papuanewguinea', 'png': 'papuanewguinea',
  'bosniaherz': 'bosnia', 'bih': 'bosnia',
  'northmacedonia': 'macedonia', 'fyrom': 'macedonia',
  'dominicanrep': 'dominicanrepublic',
};

// Default home: Kampala, Uganda (fallback when GPS is unavailable)
const DEFAULT_HOME_LNG_LAT: [number, number] = [32.58, 0.35];

// Free vector tile styles – no API key required
// OpenFreeMap is the most reliable free tile source for MapLibre v5
const PRIMARY_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/bright';

/** Interpolate N points along a great-circle arc in LngLat space */
function buildArcCoordinates(
  from: [number, number],
  to: [number, number],
  steps = 100
): [number, number][] {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Simple spherical linear interpolation (good enough for a map arc)
    const lng = from[0] + (to[0] - from[0]) * t;
    const lat = from[1] + (to[1] - from[1]) * t;
    // Add a vertical bow: raise mid-point latitude by ~12° to look like a flight arc
    const arc = Math.sin(Math.PI * t) * 12;
    coords.push([lng, lat + arc]);
  }
  return coords;
}

/** Safely constructs a DOM popup node to prevent XSS from unescaped user location or destination strings */
function createSafePopupElement(prefix: string, text: string): HTMLElement {
  const container = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = `${prefix} ${text}`;
  container.appendChild(strong);
  return container;
}

/** Interpolate exact coordinate along the precomputed arc at normalized progress t [0, 1] */
function interpolateArc(arcCoords: [number, number][], t: number): [number, number] {
  if (!arcCoords || arcCoords.length === 0) return [0, 0];
  const clampedT = Math.max(0, Math.min(1, t));
  const total = arcCoords.length - 1;
  const rawIdx = clampedT * total;
  const idx = Math.min(Math.floor(rawIdx), total - 1);
  const subT = rawIdx - idx;
  const p1 = arcCoords[idx];
  const p2 = arcCoords[idx + 1];
  return [
    p1[0] + (p2[0] - p1[0]) * subT,
    p1[1] + (p2[1] - p1[1]) * subT,
  ];
}

/** Calculate current position and tangent bearing (degrees) along the flight arc */
function getArcPointAndBearing(
  map: Map,
  arcCoords: [number, number][],
  t: number
): { coords: [number, number]; bearingDeg: number } {
  const coords = interpolateArc(arcCoords, t);

  // Central-difference sampling along trajectory for instantaneous tangent
  const sample1T = Math.max(0, Math.min(t - 0.01, 0.98));
  const sample2T = sample1T + 0.02;
  const p1Coords = interpolateArc(arcCoords, sample1T);
  const p2Coords = interpolateArc(arcCoords, sample2T);

  let bearingDeg = 0;
  try {
    const pt1 = map.project(p1Coords);
    const pt2 = map.project(p2Coords);
    const dx = pt2.x - pt1.x;
    const dy = pt2.y - pt1.y;
    if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
      bearingDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    }
  } catch {
    bearingDeg = 0;
  }

  return { coords, bearingDeg };
}

/** Create DOM elements for the mini plane marker */
function createPlaneElement(isBoosting = false): {
  container: HTMLDivElement;
  inner: HTMLDivElement;
  contrail: HTMLDivElement;
} {
  const container = document.createElement('div');
  container.className = 'travel-mini-plane-marker';
  container.style.cssText = `
    position: relative;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    will-change: transform;
    z-index: 10;
  `;

  const inner = document.createElement('div');
  inner.className = 'travel-mini-plane-inner';
  inner.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    will-change: transform, opacity;
  `;

  // Glowing jet contrail behind the aircraft tail
  const contrail = document.createElement('div');
  contrail.className = 'travel-plane-contrail';
  contrail.style.cssText = `
    position: absolute;
    left: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: ${isBoosting ? '24px' : '16px'};
    height: ${isBoosting ? '5px' : '3.5px'};
    background: ${
      isBoosting
        ? 'linear-gradient(90deg, rgba(0,122,255,0) 0%, rgba(0,210,255,0.85) 50%, rgba(255,255,255,1) 100%)'
        : 'linear-gradient(90deg, rgba(0,122,255,0) 0%, rgba(0,198,255,0.7) 60%, rgba(255,255,255,0.95) 100%)'
    };
    border-radius: 9999px;
    filter: blur(0.8px);
    opacity: 0.85;
    pointer-events: none;
    z-index: 1;
    animation: travel-contrail-flicker 0.4s ease-in-out infinite alternate;
  `;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.cssText = `
    filter: drop-shadow(0 2px 6px ${
      isBoosting ? 'rgba(0, 198, 255, 0.8)' : 'rgba(0, 122, 255, 0.6)'
    }) drop-shadow(0 1px 3px rgba(0,0,0,0.35));
    position: relative;
    z-index: 2;
    overflow: visible;
  `;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M22 12C22 12 18.5 10.2 14 10.5L9.5 3.5C9.2 3.1 8.6 3.1 8.4 3.5L7.2 5.5C7.0 5.8 7.1 6.3 7.5 6.6L10.8 11.2C9 11.4 6 11.6 4.5 10.8L3.2 8.5C3.0 8.2 2.6 8.1 2.3 8.3L1.5 8.8C1.2 9.0 1.1 9.4 1.3 9.7L2.4 12L1.3 14.3C1.1 14.6 1.2 15.0 1.5 15.2L2.3 15.7C2.6 15.9 3.0 15.8 3.2 15.5L4.5 13.2C6 12.4 9 12.6 10.8 12.8L7.5 17.4C7.1 17.7 7.0 18.2 7.2 18.5L8.4 20.5C8.6 20.9 9.2 20.9 9.5 20.5L14 13.5C18.5 13.8 22 12 22 12Z'
  );
  path.setAttribute('fill', '#007AFF');
  path.setAttribute('stroke', '#FFFFFF');
  path.setAttribute('stroke-width', '1.2');
  path.setAttribute('stroke-linejoin', 'round');

  svg.appendChild(path);
  inner.appendChild(contrail);
  inner.appendChild(svg);
  container.appendChild(inner);

  return { container, inner, contrail };
}

/**
 * Resolve a destination string to [lng, lat] coordinates.
 * Checks aliases first, then direct LOCATION_MAP match, then substring matching.
 */
function resolveDestinationStatic(destination: string): [number, number] | null {
  if (!destination) return null;
  const key = destination.toLowerCase().replace(/[^a-z]/g, '');

  // 1. Exact key match
  if (LOCATION_MAP[key]) return LOCATION_MAP[key];

  // 2. Alias lookup
  if (ALIAS_MAP[key] && LOCATION_MAP[ALIAS_MAP[key]]) return LOCATION_MAP[ALIAS_MAP[key]];

  // 3. Substring match (user typed partial or full name)
  for (const [k, v] of Object.entries(LOCATION_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }

  return null;
}

// In-memory cache for geocoded results to avoid repeated API calls
const geocodeCache: Record<string, [number, number]> = {};

/**
 * Geocode a country/place name via Nominatim (free, no API key).
 * Returns [lng, lat] or null.
 */
async function geocodeFallback(destination: string): Promise<[number, number] | null> {
  const cacheKey = destination.toLowerCase().trim();
  if (geocodeCache[cacheKey]) return geocodeCache[cacheKey];

  try {
    const params = new URLSearchParams({
      q: destination,
      format: 'json',
      limit: '1',
      addressdetails: '0',
      email: 'support@dawa-lens.com',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
      geocodeCache[cacheKey] = coords;
      return coords;
    }
  } catch (e) {
    console.warn('Geocoding fallback failed:', e);
  }
  return null;
}


export const TravelMap: React.FC<TravelMapProps> = ({ isAnimating, destination, userCoords, userCountry }) => {
  // Use real GPS coordinates when available, fall back to default
  const homeLngLat: [number, number] = userCoords ?? DEFAULT_HOME_LNG_LAT;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const homeMarkerRef = useRef<Marker | null>(null);
  const destMarkerRef = useRef<Marker | null>(null);
  const planeMarkerRef = useRef<Marker | null>(null);
  const planeInnerElRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Destination coordinates: try static lookup first, then async geocoding
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!destination) {
      setDestCoords(null);
      return;
    }

    // Try instant static resolution
    const staticResult = resolveDestinationStatic(destination);
    if (staticResult) {
      setDestCoords(staticResult);
      return;
    }

    // Debounce the geocoding fallback (user may still be typing)
    let cancelled = false;
    const timer = setTimeout(async () => {
      const geocoded = await geocodeFallback(destination);
      if (!cancelled) setDestCoords(geocoded);
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [destination]);

  // ── Initialise Map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let fallbackApplied = false;

    const initMap = (style: string) => {
      if (!mapContainerRef.current) return null;

      try {
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: [20, 10],
          zoom: 1.5,
          attributionControl: false,
          dragRotate: false,
          touchPitch: false,
          canvasContextAttributes: {
            failIfMajorPerformanceCaveat: false,
            antialias: true,
          },
        });

        // Error handling – swap to fallback style on failure
        map.on('error', (e) => {
          console.error('MapLibre error:', e);
          if (!fallbackApplied) {
            fallbackApplied = true;
            console.warn('Primary map style failed, switching to fallback...');
            try {
              map.setStyle(FALLBACK_STYLE);
            } catch (styleErr) {
              console.warn('Failed to set fallback style:', styleErr);
            }
          }
        });

        // Compact attribution
        try {
          map.addControl(
            new maplibregl.AttributionControl({ compact: true }),
            'bottom-left'
          );
        } catch (ctrlErr) {
          console.warn('Failed to add attribution control:', ctrlErr);
        }

        map.on('load', () => {
          try {
            // Force a resize on load to fix blank canvas when the container was
            // laid out before the map's WebGL canvas had definite dimensions
            map.resize();

            // ── Flight arc source + layer ─────────────────────────────────────────
            map.addSource('flight-arc', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
            });

            map.addLayer({
              id: 'flight-arc-dashes',
              type: 'line',
              source: 'flight-arc',
              paint: {
                'line-color': '#007AFF',
                'line-width': 2,
                'line-dasharray': [4, 4],
                'line-opacity': 0.5,
              },
            });

            map.addLayer({
              id: 'flight-arc-solid',
              type: 'line',
              source: 'flight-arc',
              paint: {
                'line-color': '#007AFF',
                'line-width': 2.5,
                'line-opacity': 0.9,
                'line-blur': 0,
              },
            });

            // ── Home pulse marker ───────────────────────────────────────────────────
            const homeEl = document.createElement('div');
            homeEl.className = 'travel-map-home-marker';
            homeEl.innerHTML = `
              <div style="
                width:16px; height:16px; border-radius:50%;
                background:#007AFF; border:3px solid #fff;
                box-shadow:0 0 0 4px rgba(0,122,255,0.3), 0 2px 8px rgba(0,0,0,0.3);
                position:relative;
              ">
                <span style="
                  position:absolute; inset:-6px; border-radius:50%;
                  border:2px solid rgba(0,122,255,0.4);
                  animation:travel-pulse 2s ease-out infinite;
                "></span>
              </div>`;

            homeMarkerRef.current = new maplibregl.Marker({ element: homeEl, anchor: 'center' })
              .setLngLat(homeLngLat)
              .setPopup(new maplibregl.Popup({ offset: 20 }).setDOMContent(createSafePopupElement('📍', userCountry || 'Your Location')))
              .addTo(map);

            setIsMapLoaded(true);
          } catch (loadErr) {
            console.warn('[TravelMap] Error during map on-load configuration:', loadErr);
          }
        });

        mapRef.current = map;

        // Handle container resizing
        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            try {
              map.resize();
            } catch {}
          });
          resizeObserver.observe(mapContainerRef.current);
        }

        // Also trigger resize after a short delay to handle layout shifts
        const timer = setTimeout(() => {
          try {
            map.resize();
          } catch {}
        }, 300);

        return { map, resizeObserver, timer };
      } catch (err) {
        console.warn('[TravelMap] Failed to initialize MapLibre GL map:', err);
        return null;
      }
    };

    const result = initMap(PRIMARY_STYLE);

    return () => {
      if (result) {
        clearTimeout(result.timer);
        result.resizeObserver?.disconnect();
        try {
          result.map.remove();
        } catch (removeErr) {
          console.warn('[TravelMap] Error removing map:', removeErr);
        }
      }
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, []);

  // ── Reposition home marker when user GPS arrives ──────────────────────────
  useEffect(() => {
    if (homeMarkerRef.current) {
      homeMarkerRef.current.setLngLat(homeLngLat);
      // Update popup text safely
      homeMarkerRef.current.setPopup(
        new maplibregl.Popup({ offset: 20 }).setDOMContent(createSafePopupElement('📍', userCountry || 'Your Location'))
      );
    }
    // Re-center map to home if no destination is active
    const map = mapRef.current;
    if (map && !destCoords) {
      map.flyTo({ center: homeLngLat, zoom: 2.5, duration: 1200 });
    }
  }, [homeLngLat, userCountry]);


  // ── Update arc + destination marker + mini plane flight loop ───────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !isMapLoaded) return;

    // Cleanup prior destination marker
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    // Cleanup prior plane marker & animation loop
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (planeMarkerRef.current) {
      planeMarkerRef.current.remove();
      planeMarkerRef.current = null;
    }
    planeInnerElRef.current = null;

    const arcSource = map.getSource('flight-arc') as maplibregl.GeoJSONSource | undefined;

    if (!destCoords) {
      // Clear arc
      arcSource?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
      // Fly back to overview
      map.flyTo({ center: [20, 10], zoom: 1.5, duration: 1500 });
      return;
    }

    // Build arc coordinates
    const arcCoords = buildArcCoordinates(homeLngLat, destCoords);
    arcSource?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: arcCoords },
    });

    // Destination marker
    const destEl = document.createElement('div');
    destEl.innerHTML = `
      <div style="
        width:20px; height:20px; border-radius:50%;
        background:#FF3B30; border:3px solid #fff;
        box-shadow:0 0 0 5px rgba(255,59,48,0.25), 0 2px 10px rgba(0,0,0,0.35);
        animation:travel-dest-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
      "></div>`;
    destMarkerRef.current = new maplibregl.Marker({ element: destEl, anchor: 'center' })
      .setLngLat(destCoords)
      .setPopup(new maplibregl.Popup({ offset: 20 }).setDOMContent(createSafePopupElement('✈️', destination)))
      .addTo(map);

    // Fit map to show both endpoints with padding
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(homeLngLat);
    bounds.extend(destCoords);
    // Also extend to arc peak so it's visible
    arcCoords.forEach(c => bounds.extend(c as LngLatLike));
    map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, duration: 1800, maxZoom: 5 });

    // ── Mini Plane Flight Marker & Loop ──────────────────────────────────────
    const { container: planeContainer, inner: planeInner } = createPlaneElement(isAnimating);
    const planeMarker = new maplibregl.Marker({
      element: planeContainer,
      anchor: 'center',
    })
      .setLngLat(homeLngLat)
      .addTo(map);

    planeMarkerRef.current = planeMarker;
    planeInnerElRef.current = planeInner;

    // Flight timing parameters: default 2.0s duration with subtle rest pause
    const cycleDuration = isAnimating ? 1200 : 2000;
    const pauseDuration = isAnimating ? 150 : 250;
    const totalDuration = cycleDuration + pauseDuration;
    let startTime: number | null = null;

    const animateFlight = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) % totalDuration;

      if (elapsed <= cycleDuration) {
        const t = elapsed / cycleDuration;
        const { coords, bearingDeg } = getArcPointAndBearing(map, arcCoords, t);
        planeMarker.setLngLat(coords);

        // Smooth takeoff fade-in and touchdown fade-out
        let opacity = 1;
        let scale = 1;
        if (t < 0.08) {
          const easeIn = t / 0.08;
          opacity = easeIn;
          scale = 0.7 + 0.3 * easeIn;
        } else if (t > 0.92) {
          const easeOut = (1 - t) / 0.08;
          opacity = easeOut;
          scale = 0.7 + 0.3 * easeOut;
        }

        if (planeInnerElRef.current) {
          planeInnerElRef.current.style.transform = `rotate(${bearingDeg}deg) scale(${scale})`;
          planeInnerElRef.current.style.opacity = `${opacity}`;
        }
      } else {
        // Paused at destination before next takeoff cycle
        if (planeInnerElRef.current) {
          planeInnerElRef.current.style.opacity = '0';
        }
      }

      animFrameRef.current = requestAnimationFrame(animateFlight);
    };

    animFrameRef.current = requestAnimationFrame(animateFlight);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (planeMarkerRef.current) {
        planeMarkerRef.current.remove();
        planeMarkerRef.current = null;
      }
      planeInnerElRef.current = null;
    };
  }, [destCoords, isAnimating, destination, homeLngLat, isMapLoaded]);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-primary/15 shadow-2xl"
         style={{ height: '280px' }}>

      {/* Inject keyframe CSS for marker animations */}
      <style>{`
        @keyframes travel-pulse {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes travel-dest-pop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes travel-contrail-flicker {
          0%, 100% { opacity: 0.8; transform: translateY(-50%) scaleX(1); }
          50%      { opacity: 1.0; transform: translateY(-50%) scaleX(1.3); }
        }
        .maplibregl-map { border-radius: inherit; }
        .maplibregl-ctrl-attrib { font-size: 9px !important; }
        .maplibregl-popup-content {
          border-radius: 12px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important;
          padding: 10px 14px !important;
        }
      `}</style>

      {/* MapLibre container – must have explicit width & height so the WebGL
          canvas gets real pixel dimensions before MapLibre initialises */}
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Origin label */}
      <div className="absolute top-3 left-3 z-10 flex flex-col pointer-events-none">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/50 bg-background/70 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
          <RiveMoji emoji="📍" size={12} /> Current Location
        </span>
      </div>

      {/* Destination label */}
      <AnimatePresence>
        {destination && (
          <motion.div
            key="dest-label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-3 right-3 z-10 flex flex-col items-end pointer-events-none"
          >
            <span className="text-xs font-black text-white bg-primary px-3 py-1 rounded-full shadow-lg shadow-primary/30 flex items-center gap-1">
              <RiveMoji emoji="✈️" size={14} /> {destination}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "En Route" badge */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            key="badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.8 }}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-background/80 backdrop-blur-sm shadow-sm"
          >
            <Plane size={10} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-wider text-primary">En Route</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
