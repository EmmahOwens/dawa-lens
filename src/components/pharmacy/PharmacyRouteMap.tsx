import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map, Marker } from "maplibre-gl";
import { LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import { NdaPharmacy, PharmacyRoute, formatDuration } from "@/services/pharmacyService";
import {
  Navigation,
  Compass,
  Crosshair,
  CheckCircle,
  RefreshCw,
  Layers,
  Bike,
  Car,
  Maximize2,
  Minimize2,
} from "@/lib/icons";

import {
  initPmtilesProtocol,
  COMPOSITE_PHARMACY_MAP_STYLE,
  ESRI_SATELLITE_STYLE,
} from "@/services/mapTileService";

interface PharmacyRouteMapProps {
  userCoords: [number, number]; // [lng, lat]
  topPharmacies: NdaPharmacy[];
  selectedPharmacy: NdaPharmacy | null;
  route: PharmacyRoute | null;
  isRouteLoading?: boolean;
  onSelectPharmacy: (pharmacy: NdaPharmacy) => void;
  className?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const PharmacyRouteMap: React.FC<PharmacyRouteMapProps> = ({
  userCoords,
  topPharmacies,
  selectedPharmacy,
  route,
  isRouteLoading = false,
  onSelectPharmacy,
  className = "h-[340px] w-full",
  isFullscreen: isFullscreenProp,
  onToggleFullscreen,
}) => {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : internalFullscreen;

  const handleToggleFullscreen = useCallback(() => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen((prev) => !prev);
    }
  }, [onToggleFullscreen]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const pharmacyMarkersRef = useRef<Marker[]>([]);
  const routeRef = useRef<PharmacyRoute | null>(route);
  routeRef.current = route;

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapMode, setMapMode] = useState<"streets" | "satellite">("streets");
  const mapModeRef = useRef<"streets" | "satellite">("streets");
  mapModeRef.current = mapMode;

  // ── Helper: Attach route source & styling layers ───────────────────────────
  const setupRouteLayers = useCallback((map: Map, isSatellite: boolean) => {
    try {
      const currentRoute = routeRef.current;
      const initialCoords = currentRoute && currentRoute.coordinates.length > 0 ? currentRoute.coordinates : [];

      if (!map.getSource("pharmacy-route")) {
        map.addSource("pharmacy-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: initialCoords,
            },
          },
        });
      }

      // Outer Glow Layer
      if (!map.getLayer("pharmacy-route-glow")) {
        map.addLayer({
          id: "pharmacy-route-glow",
          type: "line",
          source: "pharmacy-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": isSatellite ? "#22d3ee" : "#0d9488",
            "line-width": 8,
            "line-opacity": isSatellite ? 0.75 : 0.4,
            "line-blur": 3,
          },
        });
      }

      // Core Route Line
      if (!map.getLayer("pharmacy-route-core")) {
        map.addLayer({
          id: "pharmacy-route-core",
          type: "line",
          source: "pharmacy-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": isSatellite ? "#06b6d4" : "#0f766e",
            "line-width": 4,
            "line-opacity": 0.95,
          },
        });
      }

      // Dashed Inner Line for visual motion
      if (!map.getLayer("pharmacy-route-dash")) {
        map.addLayer({
          id: "pharmacy-route-dash",
          type: "line",
          source: "pharmacy-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": isSatellite ? "#ffffff" : "#5eead4",
            "line-width": 2,
            "line-dasharray": [1, 2],
            "line-opacity": 0.95,
          },
        });
      }
    } catch (layerErr) {
      console.warn("[PharmacyRouteMap] Error setting up layers:", layerErr);
    }
  }, []);

  // ── 1. Initialize MapLibre with unified composite style ──────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      initPmtilesProtocol(maplibregl);

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: COMPOSITE_PHARMACY_MAP_STYLE,
        center: userCoords,
        zoom: 13,
        attributionControl: false,
        dragRotate: false,
        touchPitch: false,
        cooperativeGestures: true,
      });

      map.on("load", () => {
        try {
          map.resize();
          setupRouteLayers(map, mapModeRef.current === "satellite");
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
  }, [setupRouteLayers, userCoords]);

  // ── ResizeObserver to handle modal spring animations seamlessly ───────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const ro = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });

    ro.observe(mapContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Non-destructive Streets ↔ Satellite Visibility Toggling ────────────────
  const toggleMapMode = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const nextMode = mapMode === "streets" ? "satellite" : "streets";
    setMapMode(nextMode);

    try {
      // Toggle raster basemap layer visibilities (ZERO setStyle calls!)
      if (map.getLayer("streets-layer")) {
        map.setLayoutProperty("streets-layer", "visibility", nextMode === "streets" ? "visible" : "none");
      }
      if (map.getLayer("satellite-layer")) {
        map.setLayoutProperty("satellite-layer", "visibility", nextMode === "satellite" ? "visible" : "none");
      }
      if (map.getLayer("satellite-labels-layer")) {
        map.setLayoutProperty("satellite-labels-layer", "visibility", nextMode === "satellite" ? "visible" : "none");
      }

      // Adjust route colors for optimal contrast against satellite vs streets
      if (map.getLayer("pharmacy-route-glow")) {
        map.setPaintProperty("pharmacy-route-glow", "line-color", nextMode === "satellite" ? "#22d3ee" : "#0d9488");
        map.setPaintProperty("pharmacy-route-glow", "line-opacity", nextMode === "satellite" ? 0.75 : 0.4);
      }
      if (map.getLayer("pharmacy-route-core")) {
        map.setPaintProperty("pharmacy-route-core", "line-color", nextMode === "satellite" ? "#06b6d4" : "#0f766e");
      }
    } catch (err) {
      console.warn("[PharmacyRouteMap] Failed to toggle map mode:", err);
    }
  }, [mapMode]);

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

  // ── 3. Render Pharmacy Markers (Top outlets + Guaranteed Selected Pin) ─────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old pharmacy markers
    pharmacyMarkersRef.current.forEach((m) => m.remove());
    pharmacyMarkersRef.current = [];

    // Ensure selectedPharmacy is ALWAYS included among rendered pins
    const displayOutlets = [...topPharmacies];
    if (selectedPharmacy && !displayOutlets.some((p) => p.id === selectedPharmacy.id)) {
      displayOutlets.push(selectedPharmacy);
    }

    displayOutlets.forEach((pharmacy) => {
      const isSelected = selectedPharmacy?.id === pharmacy.id;
      const isDrugShop = pharmacy.outletType === "drug_shop";
      const rankIndex = topPharmacies.findIndex((p) => p.id === pharmacy.id);
      const rankText = rankIndex >= 0 ? `#${rankIndex + 1}` : "★";

      // Colour scheme: teal for pharmacies, amber for drug shops
      const activeBg = isDrugShop
        ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
        : "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)";
      const inactiveBg = isDrugShop
        ? "linear-gradient(135deg, #78350f 0%, #451a03 100%)"
        : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
      const activeBorder = isDrugShop ? "#fcd34d" : "#5eead4";
      const inactiveBorder = isDrugShop ? "#fbbf24" : "#cbd5e1";
      const activeTip = isDrugShop ? "#b45309" : "#0f766e";
      const inactiveTip = isDrugShop ? "#78350f" : "#0f172a";
      const activeShadow = isDrugShop
        ? "0 4px 14px rgba(217, 119, 6, 0.5)"
        : "0 4px 14px rgba(13, 148, 136, 0.5)";

      const el = document.createElement("div");
      el.className = `pharmacy-pin-marker ${isSelected ? "selected" : ""}`;
      el.style.cssText = `
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform-origin: bottom center;
        z-index: ${isSelected ? 30 : rankIndex >= 0 ? 15 - rankIndex : 10};
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
        background: ${isSelected ? activeBg : inactiveBg};
        color: #ffffff;
        font-family: inherit;
        font-size: ${isSelected ? "12px" : "11px"};
        font-weight: 900;
        border: 2px solid ${isSelected ? activeBorder : inactiveBorder};
        box-shadow: ${isSelected ? activeShadow : "0 2px 6px rgba(0,0,0,0.25)"};
      `;
      badge.innerText = rankText;

      const tip = document.createElement("div");
      tip.style.cssText = `
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid ${isSelected ? activeTip : inactiveTip};
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
      let source = map.getSource("pharmacy-route") as maplibregl.GeoJSONSource | undefined;
      if (!source) {
        setupRouteLayers(map, mapModeRef.current === "satellite");
        source = map.getSource("pharmacy-route") as maplibregl.GeoJSONSource | undefined;
      }

      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: route && route.coordinates.length > 0 ? route.coordinates : [],
          },
        });
      }
    } catch (routeErr) {
      console.warn("[PharmacyRouteMap] Error updating route geometry:", routeErr);
    }
  }, [route, isMapLoaded, setupRouteLayers]);

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

  // ── Handle Fullscreen transitions & gestures ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (isFullscreen) {
        map.cooperativeGestures?.disable();
      } else {
        map.cooperativeGestures?.enable();
      }
      // Give DOM time to update layout, then resize & fit bounds
      const timer = setTimeout(() => {
        map.resize();
        fitCameraToBounds();
      }, 120);
      return () => clearTimeout(timer);
    } catch (e) {
      console.warn("[PharmacyRouteMap] Error adjusting gestures on fullscreen change:", e);
    }
  }, [isFullscreen, fitCameraToBounds]);

  // ── Keyboard Escape listener to exit fullscreen ─────────────────────────────
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleToggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, handleToggleFullscreen]);

  useEffect(() => {
    if (isMapLoaded) {
      fitCameraToBounds();
    }
  }, [isMapLoaded, selectedPharmacy, route, fitCameraToBounds]);

  return (
    <div
      className={`relative overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-40 h-full w-full rounded-none border-0"
          : `rounded-3xl border border-border/60 bg-muted/20 shadow-inner ${className}`
      }`}
    >
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {/* Route Info Badge (Top Right or Left when Fullscreen) */}
      <AnimatePresence>
        {selectedPharmacy && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute z-20 flex items-center gap-2 rounded-2xl bg-card/90 backdrop-blur-md px-3.5 py-2 border border-border/60 shadow-lg text-foreground ${
              isFullscreen ? "top-4 left-4" : "top-3 right-3"
            }`}
          >
            {isRouteLoading ? (
              <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Routing…</span>
              </div>
            ) : route ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-teal-600 dark:text-teal-400">
                  {route.mode === "boda_boda" ? (
                    <Bike className="size-3.5" />
                  ) : route.mode === "walking" ? (
                    <Navigation className="size-3.5" />
                  ) : (
                    <Car className="size-3.5" />
                  )}
                  <span>{route.distanceKm} km</span>
                </div>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-xs font-extrabold text-foreground">
                  {formatDuration(route.durationMinutes)}
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

      {/* Recenter & Map Controls (Bottom Right / Top Right in Fullscreen) */}
      <div
        className={`absolute z-20 flex flex-col gap-1.5 items-end ${
          isFullscreen ? "top-4 right-4" : "bottom-3 right-3"
        }`}
      >
        {/* Fullscreen Toggle Button */}
        <button
          onClick={handleToggleFullscreen}
          title={isFullscreen ? "Exit Full Screen (Esc)" : "Full Screen Map"}
          aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen Map"}
          className={`flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur-md border shadow-md transition-all active:scale-90 ${
            isFullscreen
              ? "bg-teal-600 text-white border-teal-500 shadow-teal-600/30"
              : "bg-card/90 text-foreground border-border/60 hover:bg-card"
          }`}
        >
          {isFullscreen ? (
            <Minimize2 className="size-4 text-white" />
          ) : (
            <Maximize2 className="size-4 text-teal-600 dark:text-teal-400" />
          )}
        </button>

        {/* Satellite / Streets Toggle */}
        <button
          onClick={toggleMapMode}
          title={mapMode === "streets" ? "Switch to Satellite Imagery" : "Switch to Street Map"}
          className={`flex h-8 items-center gap-1.5 px-2.5 rounded-xl backdrop-blur-md border shadow-md transition-all active:scale-95 text-xs font-bold ${
            mapMode === "satellite"
              ? "bg-teal-600 text-white border-teal-500 shadow-teal-600/30"
              : "bg-card/90 text-foreground border-border/60 hover:bg-card"
          }`}
        >
          <Layers className="size-3.5" />
          <span className="text-[11px] font-extrabold">{mapMode === "streets" ? "Satellite" : "Streets"}</span>
        </button>

        {/* Recenter Button */}
        <button
          onClick={fitCameraToBounds}
          title="Recenter Route"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/90 backdrop-blur-md border border-border/60 text-foreground shadow-md transition-all hover:bg-card active:scale-90"
        >
          <Crosshair className="size-4 text-teal-600 dark:text-teal-400" />
        </button>
      </div>

      {/* Legend + NDA verified (Bottom Left) */}
      <div className={`absolute z-20 flex flex-col gap-1.5 ${isFullscreen ? "bottom-24 left-4" : "bottom-3 left-3"}`}>
        <div className="flex items-center gap-2 rounded-xl bg-card/90 backdrop-blur-md px-2.5 py-1.5 border border-border/60 shadow-sm pointer-events-none">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0" />
          <span className="text-[9px] font-bold text-muted-foreground">Pharmacy</span>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 ml-1" />
          <span className="text-[9px] font-bold text-muted-foreground">Drug Shop</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-card/90 backdrop-blur-md px-2.5 py-1.5 border border-border/60 shadow-sm pointer-events-none">
          <CheckCircle className="size-3 text-emerald-500 shrink-0" />
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            NDA Uganda Licensed
          </span>
        </div>
      </div>
    </div>
  );
};

