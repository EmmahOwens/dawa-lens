import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map, Marker, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import { NdaPharmacy, PharmacyRoute } from "@/services/pharmacyService";
import {
  Navigation,
  Compass,
  Crosshair,
  CheckCircle,
  RefreshCw,
} from "@/lib/icons";

interface PharmacyRouteMapProps {
  userCoords: [number, number]; // [lng, lat]
  topPharmacies: NdaPharmacy[];
  selectedPharmacy: NdaPharmacy | null;
  route: PharmacyRoute | null;
  isRouteLoading?: boolean;
  onSelectPharmacy: (pharmacy: NdaPharmacy) => void;
  className?: string;
}

const PRIMARY_STYLE = "https://tiles.openfreemap.org/styles/positron";
const FALLBACK_STYLE = "https://tiles.openfreemap.org/styles/bright";

export const PharmacyRouteMap: React.FC<PharmacyRouteMapProps> = ({
  userCoords,
  topPharmacies,
  selectedPharmacy,
  route,
  isRouteLoading = false,
  onSelectPharmacy,
  className = "h-[340px] w-full",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const pharmacyMarkersRef = useRef<Marker[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // ── 1. Initialize MapLibre GL ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let fallbackApplied = false;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: PRIMARY_STYLE,
        center: userCoords,
        zoom: 13,
        attributionControl: false,
        dragRotate: false,
        touchPitch: false,
      });

      map.on("error", (e) => {
        console.warn("[PharmacyRouteMap] MapLibre error:", e);
        if (!fallbackApplied) {
          fallbackApplied = true;
          try {
            map.setStyle(FALLBACK_STYLE);
          } catch (err) {
            console.warn("[PharmacyRouteMap] Fallback style failed:", err);
          }
        }
      });

      map.on("load", () => {
        try {
          map.resize();

          // Add Route Source
          map.addSource("pharmacy-route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [],
              },
            },
          });

          // Outer Glow Layer
          map.addLayer({
            id: "pharmacy-route-glow",
            type: "line",
            source: "pharmacy-route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#0d9488",
              "line-width": 8,
              "line-opacity": 0.35,
              "line-blur": 3,
            },
          });

          // Core Route Line
          map.addLayer({
            id: "pharmacy-route-core",
            type: "line",
            source: "pharmacy-route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#0f766e",
              "line-width": 4,
              "line-opacity": 0.95,
            },
          });

          // Dashed Inner Line for visual motion
          map.addLayer({
            id: "pharmacy-route-dash",
            type: "line",
            source: "pharmacy-route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#5eead4",
              "line-width": 2,
              "line-dasharray": [1, 2],
              "line-opacity": 0.9,
            },
          });

          setIsMapLoaded(true);
        } catch (loadErr) {
          console.warn("[PharmacyRouteMap] Error on map load:", loadErr);
        }
      });

      mapRef.current = map;
    } catch (initErr) {
      console.error("[PharmacyRouteMap] Initialization failed:", initErr);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ── 2. Render User Marker ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(userCoords);
      return;
    }

    // Create custom pulsing user dot element
    const el = document.createElement("div");
    el.className = "pharmacy-user-marker";
    el.style.cssText = `
      position: relative;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    `;

    const pulse = document.createElement("div");
    pulse.style.cssText = `
      position: absolute;
      width: 38px;
      height: 38px;
      border-radius: 9999px;
      background: rgba(13, 148, 136, 0.25);
      border: 1.5px solid rgba(13, 148, 136, 0.6);
      animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
    `;

    const dot = document.createElement("div");
    dot.style.cssText = `
      position: relative;
      width: 16px;
      height: 16px;
      border-radius: 9999px;
      background: #0f766e;
      border: 2.5px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 2;
    `;

    el.appendChild(pulse);
    el.appendChild(dot);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(userCoords)
      .addTo(map);

    userMarkerRef.current = marker;
  }, [userCoords]);

  // ── 3. Render Top 5 Pharmacy Markers ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old pharmacy markers
    pharmacyMarkersRef.current.forEach((m) => m.remove());
    pharmacyMarkersRef.current = [];

    topPharmacies.forEach((pharmacy, index) => {
      const isSelected = selectedPharmacy?.id === pharmacy.id;
      const rank = index + 1;

      const el = document.createElement("div");
      el.className = `pharmacy-pin-marker ${isSelected ? "selected" : ""}`;
      el.style.cssText = `
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform-origin: bottom center;
        z-index: ${isSelected ? 30 : 15 - index};
      `;

      const badge = document.createElement("div");
      badge.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: ${isSelected ? "34px" : "28px"};
        height: ${isSelected ? "34px" : "28px"};
        padding: 0 4px;
        border-radius: 9999px;
        background: ${
          isSelected
            ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)"
            : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
        };
        color: #ffffff;
        font-family: inherit;
        font-size: ${isSelected ? "12px" : "11px"};
        font-weight: 900;
        border: 2px solid ${isSelected ? "#5eead4" : "#cbd5e1"};
        box-shadow: ${
          isSelected
            ? "0 4px 14px rgba(13, 148, 136, 0.5)"
            : "0 2px 6px rgba(0,0,0,0.25)"
        };
      `;
      badge.innerText = `#${rank}`;

      // Arrow tip under pin
      const tip = document.createElement("div");
      tip.style.cssText = `
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid ${isSelected ? "#0f766e" : "#0f172a"};
        margin-top: -1px;
      `;

      el.appendChild(badge);
      el.appendChild(tip);

      el.addEventListener("click", () => {
        onSelectPharmacy(pharmacy);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([pharmacy.longitude, pharmacy.latitude])
        .addTo(map);

      pharmacyMarkersRef.current.push(marker);
    });
  }, [topPharmacies, selectedPharmacy, onSelectPharmacy]);

  // ── 4. Update Route Line Geometry ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    try {
      const source = map.getSource("pharmacy-route") as maplibregl.GeoJSONSource;
      if (!source) return;

      if (route && route.coordinates.length > 0) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: route.coordinates,
          },
        });
      } else {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        });
      }
    } catch (routeErr) {
      console.warn("[PharmacyRouteMap] Error updating route geometry:", routeErr);
    }
  }, [route, isMapLoaded]);

  // ── 5. Auto Fit Camera to frame User and Selected Pharmacy ──────────────────
  const fitCameraToBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedPharmacy) {
      map.flyTo({ center: userCoords, zoom: 14, duration: 800 });
      return;
    }

    const bounds = new LngLatBounds();
    bounds.extend(userCoords);
    bounds.extend([selectedPharmacy.longitude, selectedPharmacy.latitude]);

    if (route && route.coordinates.length > 0) {
      route.coordinates.forEach((c) => bounds.extend(c));
    }

    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 16,
      duration: 900,
    });
  }, [userCoords, selectedPharmacy, route]);

  useEffect(() => {
    if (isMapLoaded) {
      fitCameraToBounds();
    }
  }, [isMapLoaded, selectedPharmacy, route, fitCameraToBounds]);

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-border/60 bg-muted/20 shadow-inner ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {/* Route Info Badge (Top Right) */}
      <AnimatePresence>
        {selectedPharmacy && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-2xl bg-card/90 backdrop-blur-md px-3.5 py-2 border border-border/60 shadow-lg text-foreground"
          >
            {isRouteLoading ? (
              <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Routing…</span>
              </div>
            ) : route ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-teal-600 dark:text-teal-400">
                  <Navigation className="size-3.5" />
                  <span>{route.distanceKm} km</span>
                </div>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-xs font-extrabold text-foreground">
                  ~{route.durationMinutes} min{route.durationMinutes !== 1 ? "s" : ""}
                </span>
              </div>
            ) : selectedPharmacy.distanceKm !== undefined ? (
              <span className="text-xs font-black text-teal-600 dark:text-teal-400">
                {selectedPharmacy.distanceKm} km away
              </span>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recenter & Map Controls (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={fitCameraToBounds}
          title="Recenter Route"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/90 backdrop-blur-md border border-border/60 text-foreground shadow-md transition-all hover:bg-card active:scale-90"
        >
          <Crosshair className="size-4 text-teal-600 dark:text-teal-400" />
        </button>
      </div>

      {/* NDA License Verified Tag (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-xl bg-card/90 backdrop-blur-md px-2.5 py-1.5 border border-border/60 shadow-sm pointer-events-none">
        <CheckCircle className="size-3 text-emerald-500 shrink-0" />
        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          Source: NDA Uganda Outlets
        </span>
      </div>
    </div>
  );
};
