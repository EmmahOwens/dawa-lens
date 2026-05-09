import React, { useEffect, useRef, useMemo, useCallback } from 'react';
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

// ── Known geographic coordinates ─────────────────────────────────────────────
const LOCATION_MAP: Record<string, [number, number]> = {
  // Africa
  kenya: [36.82, -1.29], nigeria: [3.38, 6.45], southafrica: [28.04, -26.20],
  egypt: [31.24, 30.06], ghana: [-0.19, 5.56], ethiopia: [38.74, 9.00],
  tanzania: [34.89, -6.37], uganda: [32.58, 0.32], cameroon: [11.52, 3.87],
  senegal: [-14.71, 14.68], morocco: [-7.09, 31.79], algeria: [2.63, 28.03],
  // Europe
  france: [2.35, 48.86], uk: [-0.13, 51.51], germany: [13.41, 52.52],
  italy: [12.50, 41.90], spain: [-3.70, 40.42], portugal: [-9.14, 38.72],
  netherlands: [4.90, 52.37], sweden: [18.07, 59.33], norway: [10.75, 59.91],
  denmark: [12.57, 55.68], poland: [21.01, 52.23], ukraine: [30.52, 50.45],
  russia: [37.62, 55.75], greece: [23.73, 37.98], switzerland: [7.45, 46.95],
  austria: [16.37, 48.21], belgium: [4.35, 50.85],
  // Asia
  china: [116.40, 39.91], india: [77.21, 28.61], japan: [139.69, 35.69],
  southkorea: [126.98, 37.57], thailand: [100.52, 13.75], vietnam: [105.85, 21.03],
  singapore: [103.82, 1.35], indonesia: [106.85, -6.21], malaysia: [101.69, 3.14],
  pakistan: [73.04, 33.72], bangladesh: [90.41, 23.81], srilanka: [80.64, 7.88],
  uae: [55.30, 25.20], saudiarabia: [46.68, 24.69], turkey: [32.87, 39.93],
  iran: [51.42, 35.70], iraq: [44.36, 33.34], israel: [35.22, 31.77],
  jordan: [35.94, 31.96], qatar: [51.53, 25.29],
  // Americas
  usa: [-95.71, 37.09], canada: [-75.70, 45.42], mexico: [-99.13, 19.43],
  brazil: [-47.86, -15.78], argentina: [-58.38, -34.60], colombia: [-74.08, 4.71],
  peru: [-77.04, -12.05], chile: [-70.67, -33.45], venezuela: [-66.91, 10.48],
  cuba: [-82.38, 23.11],
  // Oceania
  australia: [149.13, -35.31], newzealand: [174.78, -36.85],
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

function resolveDestination(destination: string): [number, number] | null {
  if (!destination) return null;
  const key = destination.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(LOCATION_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
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

  const destCoords = useMemo(() => resolveDestination(destination), [destination]);

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

    if (!destCoords || !isAnimating) {
      // Clear arc
      arcSource?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
      // Fly back to overview
      if (!destCoords) {
        map.flyTo({ center: [20, 10], zoom: 1.5, duration: 1500 });
      }
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
