import React, { useEffect, useRef, useMemo, useState } from 'react';
import maplibregl, { Map, Marker, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane } from 'lucide-react';

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
  steps = 80
): [number, number][] {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Simple spherical linear interpolation (good enough for a map arc)
    const lng = from[0] + (to[0] - from[0]) * t;
    const lat = from[1] + (to[1] - from[1]) * t;
    // Add a vertical bow: raise mid-point latitude by ~10° to look like a flight arc
    const arc = Math.sin(Math.PI * t) * 12;
    coords.push([lng, lat + arc]);
  }
  return coords;
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
      if (!mapContainerRef.current) return;

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
          map.setStyle(FALLBACK_STYLE);
        }
      });

      // Compact attribution
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-left'
      );

      map.on('load', () => {
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
          .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(`<strong>📍 ${userCountry || 'Your Location'}</strong>`))
          .addTo(map);
      });

      mapRef.current = map;

      // Handle container resizing
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(mapContainerRef.current!);

      // Also trigger resize after a short delay to handle layout shifts
      const timer = setTimeout(() => map.resize(), 300);

      return { map, resizeObserver, timer };
    };

    const result = initMap(PRIMARY_STYLE);

    return () => {
      if (result) {
        clearTimeout(result.timer);
        result.resizeObserver.disconnect();
        result.map.remove();
      }
      mapRef.current = null;
    };
  }, []);

  // ── Reposition home marker when user GPS arrives ──────────────────────────
  useEffect(() => {
    if (homeMarkerRef.current) {
      homeMarkerRef.current.setLngLat(homeLngLat);
      // Update popup text
      homeMarkerRef.current.setPopup(
        new maplibregl.Popup({ offset: 20 }).setHTML(`<strong>📍 ${userCountry || 'Your Location'}</strong>`)
      );
    }
    // Re-center map to home if no destination is active
    const map = mapRef.current;
    if (map && !destCoords) {
      map.flyTo({ center: homeLngLat, zoom: 2.5, duration: 1200 });
    }
  }, [homeLngLat, userCountry]);


  // ── Update arc + destination marker when destination changes ───────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove old destination marker
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

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
      .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(`<strong>✈️ ${destination}</strong>`))
      .addTo(map);

    // Fit map to show both endpoints with padding
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(homeLngLat);
    bounds.extend(destCoords);
    // Also extend to arc peak so it's visible
    arcCoords.forEach(c => bounds.extend(c as LngLatLike));
    map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, duration: 1800, maxZoom: 5 });
  }, [destCoords, isAnimating, destination, homeLngLat]);

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
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/50 bg-background/70 backdrop-blur-sm px-2 py-0.5 rounded-full">
          📍 Current Location
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
            <span className="text-xs font-black text-white bg-primary px-3 py-1 rounded-full shadow-lg shadow-primary/30">
              ✈️ {destination}
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
