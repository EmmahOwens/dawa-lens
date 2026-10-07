import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map, Marker } from "maplibre-gl";
import { LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  NdaPharmacy,
  PharmacyRoute,
  formatDuration,
  PharmacyTransportMode,
  getDirectionsUrl,
} from "@/services/pharmacyService";
import { Medicine } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
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
  Building,
  Pill,
  Phone,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CloseSquare,
} from "@/lib/icons";

import {
  initPmtilesProtocol,
  COMPOSITE_PHARMACY_MAP_STYLE,
  ESRI_SATELLITE_STYLE,
} from "@/services/mapTileService";

export interface PharmacyRouteMapProps {
  userCoords: [number, number]; // [lng, lat]
  topPharmacies: NdaPharmacy[];
  selectedPharmacy: NdaPharmacy | null;
  route: PharmacyRoute | null;
  isRouteLoading?: boolean;
  onSelectPharmacy: (pharmacy: NdaPharmacy) => void;
  className?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Fullscreen interactive features
  transportMode?: PharmacyTransportMode;
  onTransportModeChange?: (mode: PharmacyTransportMode) => void;
  outletTab?: "pharmacy" | "drug_shop";
  onOutletTabChange?: (tab: "pharmacy" | "drug_shop") => void;
  onNavigate?: (pharmacy: NdaPharmacy) => void;
  onCall?: (pharmacy: NdaPharmacy) => void;
  onShare?: (pharmacy: NdaPharmacy) => void;
  onOpenVerification?: (pharmacy: NdaPharmacy) => void;
  medicine?: Medicine | null;
  onRefillLogged?: (medicine: Medicine, pharmacy: NdaPharmacy) => void;
  onClose?: () => void;
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
  transportMode: transportModeProp,
  onTransportModeChange,
  outletTab: outletTabProp,
  onOutletTabChange,
  onNavigate,
  onCall,
  onShare,
  onOpenVerification,
  medicine,
  onRefillLogged,
  onClose,
}) => {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : internalFullscreen;

  const [internalTransport, setInternalTransport] = useState<PharmacyTransportMode>("boda_boda");
  const currentTransport = transportModeProp ?? internalTransport;

  const [internalOutletTab, setInternalOutletTab] = useState<"pharmacy" | "drug_shop">("pharmacy");
  const currentOutletTab = outletTabProp ?? internalOutletTab;

  const [isDesktopCardCollapsed, setIsDesktopCardCollapsed] = useState(false);
  const [isMobileSheetExpanded, setIsMobileSheetExpanded] = useState(false);

  const handleToggleFullscreen = useCallback(() => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen((prev) => !prev);
    }
  }, [onToggleFullscreen]);

  const handleTransportChange = (mode: PharmacyTransportMode) => {
    if (onTransportModeChange) {
      onTransportModeChange(mode);
    } else {
      setInternalTransport(mode);
    }
  };

  const handleOutletTabChange = (tab: "pharmacy" | "drug_shop") => {
    if (onOutletTabChange) {
      onOutletTabChange(tab);
    } else {
      setInternalOutletTab(tab);
    }
  };

  const handleNavigate = (pharmacy: NdaPharmacy) => {
    if (onNavigate) {
      onNavigate(pharmacy);
    } else {
      const url = getDirectionsUrl(pharmacy.latitude, pharmacy.longitude, pharmacy.name, {
        userCoords,
        mode: currentTransport,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleShare = (pharmacy: NdaPharmacy) => {
    if (onShare) {
      onShare(pharmacy);
    } else {
      const url = getDirectionsUrl(pharmacy.latitude, pharmacy.longitude, pharmacy.name, {
        userCoords,
        mode: currentTransport,
      });
      const text = `🏥 ${pharmacy.name}\n📍 ${pharmacy.address || pharmacy.street}, ${pharmacy.district}\n📋 NDA License: ${pharmacy.premiseNo}\n🗺️ Directions: ${url}`;
      if (typeof navigator !== "undefined" && navigator.share) {
        navigator.share({ title: pharmacy.name, text, url }).catch(() => {});
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
    }
  };

  const handleCall = (pharmacy: NdaPharmacy) => {
    if (onCall) {
      onCall(pharmacy);
    } else if (pharmacy.phone) {
      window.open(`tel:${pharmacy.phone}`);
    }
  };
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

  const isDrugShop = selectedPharmacy?.outletType === "drug_shop" || currentOutletTab === "drug_shop";
  const activeThemeBg = isDrugShop ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20" : "bg-teal-600 hover:bg-teal-700 shadow-teal-500/20";
  const activeThemeText = isDrugShop ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400";
  const activeRing = isDrugShop ? "ring-amber-500/40 border-amber-500" : "ring-teal-500/40 border-teal-500";
  const activeBadgeSolid = isDrugShop ? "bg-amber-600 text-white" : "bg-teal-600 text-white";
  const activeBadgeBg = isDrugShop
    ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
    : "bg-teal-500/15 border-teal-500/30 text-teal-700 dark:text-teal-300";

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

      {/* ── NORMAL MODE: Route Info Badge (Top Right) ── */}
      {!isFullscreen && (
        <AnimatePresence>
          {selectedPharmacy && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-full bg-card/85 backdrop-blur-md px-3.5 py-1.5 border border-border shadow-xs text-foreground"
            >
              {isRouteLoading ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Routing…</span>
                </div>
              ) : route ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400">
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
                  <span className="text-xs font-bold text-foreground">
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
      )}

      {/* ── FULLSCREEN MODE: DESKTOP TOP BAR & CONTROLS ── */}
      {isFullscreen && (
        <>
          {/* Top Left: Exit Full Screen + Transport Mean Selector + ETA Badge */}
          <div className="absolute top-4 left-4 z-30 hidden md:flex items-center gap-2 pointer-events-auto">
            {/* Exit Full Screen */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title="Exit Full Screen (Esc)"
              aria-label="Exit Full Screen"
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-xs text-foreground hover:bg-card active:scale-95 transition-all text-xs font-semibold"
            >
              <Minimize2 className="size-3.5 text-teal-600 dark:text-teal-400" />
              <span>Exit Full Screen</span>
              <kbd className="text-[10px] text-muted-foreground ml-1 font-mono px-1.5 py-0.5 rounded-full bg-muted/60">Esc</kbd>
            </button>

            {/* Transport Mean Selector */}
            <div className="flex items-center rounded-full bg-card/90 backdrop-blur-md p-1 border border-border shadow-xs gap-0.5">
              <button
                type="button"
                onClick={() => handleTransportChange("boda_boda")}
                title="Boda Boda (Motorcycle)"
                aria-label="Boda Boda route"
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold transition-all ${
                  currentTransport === "boda_boda"
                    ? `${activeThemeBg} text-white shadow-xs`
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Bike className="size-3.5" />
                <span>Boda</span>
              </button>
              <button
                type="button"
                onClick={() => handleTransportChange("driving")}
                title="Driving (Car)"
                aria-label="Driving route"
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold transition-all ${
                  currentTransport === "driving"
                    ? `${activeThemeBg} text-white shadow-xs`
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Car className="size-3.5" />
                <span>Drive</span>
              </button>
              <button
                type="button"
                onClick={() => handleTransportChange("walking")}
                title="Walking"
                aria-label="Walking route"
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold transition-all ${
                  currentTransport === "walking"
                    ? `${activeThemeBg} text-white shadow-xs`
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Navigation className="size-3.5" />
                <span>Walk</span>
              </button>
            </div>

            {/* Live Distance & ETA badge */}
            <div className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-xs text-foreground text-xs font-semibold">
              {isRouteLoading ? (
                <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Routing…</span>
                </div>
              ) : route ? (
                <div className="flex items-center gap-1.5">
                  <span className={activeThemeText}>{route.distanceKm} km</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-foreground">{formatDuration(route.durationMinutes)}</span>
                </div>
              ) : selectedPharmacy?.distanceKm !== undefined ? (
                <span className={activeThemeText}>{selectedPharmacy.distanceKm} km away</span>
              ) : null}
            </div>
          </div>

          {/* Top Center: Outlet Switcher (Pharmacies vs Drug Shops) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 hidden md:flex items-center p-1 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-xs pointer-events-auto gap-0.5">
            <button
              type="button"
              onClick={() => handleOutletTabChange("pharmacy")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentOutletTab === "pharmacy"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Building className="size-3.5" />
              <span>Pharmacies</span>
            </button>
            <button
              type="button"
              onClick={() => handleOutletTabChange("drug_shop")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentOutletTab === "drug_shop"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Pill className="size-3.5" />
              <span>Drug Shops</span>
            </button>
          </div>

          {/* Top Right: Optional Close Button */}
          {onClose && (
            <div className="absolute top-4 right-4 z-30 hidden md:flex items-center pointer-events-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-lg text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                title="Close"
              >
                <CloseSquare size={18} />
              </button>
            </div>
          )}

          {/* Top 5 Nearest Outlets Strip (Desktop) */}
          {topPharmacies.length > 0 && (
            <div className="absolute top-16 left-4 right-[380px] lg:right-[390px] z-20 hidden md:flex items-center gap-2 pointer-events-auto overflow-x-auto no-scrollbar">
              {topPharmacies.slice(0, 5).map((outlet, idx) => {
                const isSelected = selectedPharmacy?.id === outlet.id;
                const dist = isSelected && route ? route.distanceKm : outlet.distanceKm;
                return (
                  <button
                    key={outlet.id}
                    type="button"
                    onClick={() => onSelectPharmacy(outlet)}
                    className={`flex-1 min-w-[130px] max-w-[210px] p-2.5 rounded-2xl border text-left backdrop-blur-xl transition-all active:scale-95 ${
                      isSelected
                        ? `${activeRing} shadow-lg ring-2 bg-card/95`
                        : "bg-card/85 border-border/50 hover:bg-card/95 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isSelected ? activeBadgeSolid : "bg-muted text-muted-foreground"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      {dist !== undefined && (
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                          isSelected ? activeThemeText : "text-muted-foreground"
                        }`}>
                          {dist} km
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-black text-foreground truncate leading-snug">
                      {outlet.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {outlet.street || outlet.district}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Right-Hand Selected Outlet Card (Desktop - pointing to where user's arrows point) */}
          {selectedPharmacy && (
            <>
              {!isDesktopCardCollapsed ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute top-16 right-4 bottom-6 w-80 lg:w-[350px] z-30 hidden md:flex flex-col bg-card/95 backdrop-blur-xl rounded-3xl border border-border/60 shadow-2xl overflow-hidden pointer-events-auto"
                >
                  {/* Card Header */}
                  <div className="p-4 pb-3 border-b border-border/40 flex items-start justify-between gap-2 shrink-0">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${activeBadgeBg}`}>
                          {selectedPharmacy.premiseType || (isDrugShop ? "Drug Shop" : "Retail Pharmacy")}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {selectedPharmacy.category}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-foreground tracking-tight mt-1.5 leading-snug line-clamp-2">
                        {selectedPharmacy.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {selectedPharmacy.address || selectedPharmacy.street}, <span className="font-bold text-foreground">{selectedPharmacy.district}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDesktopCardCollapsed(true)}
                      className="p-1.5 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Collapse details for full map view"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3.5 flex-1 overflow-y-auto no-scrollbar">
                    {/* Distance & ETA Row */}
                    <div className={`flex items-center justify-between p-3 rounded-2xl border ${activeBadgeBg}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${activeBadgeSolid}`}>
                          #{topPharmacies.findIndex((p) => p.id === selectedPharmacy.id) + 1 || "★"}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {route ? `${route.mode === "boda_boda" ? "Boda Boda" : route.mode === "walking" ? "Walking" : "Car"} route` : "Selected Outlet"}
                        </span>
                      </div>
                      <span className="text-sm font-black tracking-tight">
                        {route ? `${route.distanceKm} km · ${formatDuration(route.durationMinutes)}` : `${selectedPharmacy.distanceKm ?? "—"} km`}
                      </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-background/70 border border-border/40">
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                          {isDrugShop ? "Owner / Operator" : "Supervising Pharmacist"}
                        </p>
                        <p className="font-bold text-foreground mt-0.5 truncate">
                          {selectedPharmacy.pharmacist || (isDrugShop ? "Licensed Drug Shop" : "Registered Pharmacist")}
                        </p>
                        {selectedPharmacy.psuNo && (
                          <p className="text-[10px] text-muted-foreground">PSU: {selectedPharmacy.psuNo}</p>
                        )}
                      </div>
                      <div className="p-2.5 rounded-xl bg-background/70 border border-border/40">
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                          NDA Uganda License
                        </p>
                        <p className={`font-mono font-bold mt-0.5 truncate ${activeThemeText}`}>
                          {selectedPharmacy.premiseNo}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Expires: {selectedPharmacy.expiryDate?.split(" ")[0] || "Active"}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-1">
                      <Button
                        onClick={() => handleNavigate(selectedPharmacy)}
                        className={`w-full h-11 rounded-2xl font-black ${activeThemeBg} text-white shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider`}
                      >
                        <Navigation className="size-4" />
                        <span>Navigation</span>
                      </Button>

                      <div className="flex items-center gap-2">
                        {selectedPharmacy.phone && (
                          <button
                            type="button"
                            onClick={() => handleCall(selectedPharmacy)}
                            className="flex-1 h-10 px-3 rounded-2xl font-bold border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs flex items-center justify-center gap-1.5 transition-colors"
                            title={`Call ${selectedPharmacy.name}`}
                          >
                            <Phone className="size-3.5" />
                            <span>Call</span>
                          </button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => handleShare(selectedPharmacy)}
                          className="flex-1 h-10 px-3 rounded-2xl font-bold border-border/60 hover:bg-muted/40 text-xs flex items-center justify-center gap-1.5"
                          title="Share outlet location"
                        >
                          <Compass className="size-3.5 text-muted-foreground" />
                          <span>Share</span>
                        </Button>
                        {onOpenVerification && (
                          <Button
                            variant="outline"
                            onClick={() => onOpenVerification(selectedPharmacy)}
                            className="flex-1 h-10 px-3 rounded-2xl font-bold border-border/60 hover:bg-muted/40 text-xs flex items-center justify-center gap-1.5"
                            title="Verify premise location"
                          >
                            <ShieldCheck className="size-3.5 text-teal-600 dark:text-teal-400" />
                            <span>Verify</span>
                          </Button>
                        )}
                      </div>

                      {medicine && onRefillLogged && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            onRefillLogged(medicine, selectedPharmacy);
                            handleToggleFullscreen();
                          }}
                          className="w-full h-10 rounded-2xl font-black border-teal-500/40 text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 text-xs flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className="size-3.5" />
                          <span>Refill {medicine.name.split(" ")[0]}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* Collapsed Trigger Pill on Desktop */
                <button
                  type="button"
                  onClick={() => setIsDesktopCardCollapsed(false)}
                  className="absolute top-20 right-4 z-30 hidden md:flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl text-xs font-black text-foreground hover:bg-card active:scale-95 transition-all pointer-events-auto"
                  title="Expand selected outlet details"
                >
                  <ChevronLeft size={16} className={activeThemeText} />
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${activeBadgeSolid}`}>
                    #{topPharmacies.findIndex((p) => p.id === selectedPharmacy.id) + 1 || "★"}
                  </span>
                  <span className="truncate max-w-[120px]">{selectedPharmacy.name}</span>
                  <span className={`text-[10px] font-mono ${activeThemeText}`}>{selectedPharmacy.distanceKm}km</span>
                </button>
              )}
            </>
          )}

          {/* ── FULLSCREEN MODE: MOBILE EQUIVALENTS (< md) ── */}
          {/* Mobile Top Header (Stacked Rows) */}
          <div className="absolute top-0 left-0 right-0 z-30 pt-[max(env(safe-area-inset-top),0.75rem)] px-3 pointer-events-none md:hidden">
            <div className="pointer-events-auto space-y-2">
              {/* Mobile Row 1: Exit + Switcher + Close */}
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  title="Exit Full Screen"
                  aria-label="Exit Full Screen"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-lg text-foreground active:scale-95 transition-all shrink-0"
                >
                  <Minimize2 className="size-4 text-teal-600 dark:text-teal-400" />
                </button>

                {/* Outlet Switcher */}
                <div className="flex rounded-2xl bg-card/95 backdrop-blur-xl p-1 border border-border/60 shadow-lg gap-0.5 flex-1 justify-center max-w-[240px]">
                  <button
                    type="button"
                    onClick={() => handleOutletTabChange("pharmacy")}
                    className={`flex items-center justify-center gap-1 flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                      currentOutletTab === "pharmacy"
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Building className="size-3" />
                    <span>Pharmacies</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOutletTabChange("drug_shop")}
                    className={`flex items-center justify-center gap-1 flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                      currentOutletTab === "drug_shop"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Pill className="size-3" />
                    <span>Drug Shops</span>
                  </button>
                </div>

                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-lg text-muted-foreground hover:text-foreground active:scale-95 transition-all shrink-0"
                    title="Close"
                  >
                    <CloseSquare size={18} />
                  </button>
                )}
              </div>

              {/* Mobile Row 2: Transport Mode Selector + Distance/ETA */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center rounded-2xl bg-card/95 backdrop-blur-xl p-1 border border-border/60 shadow-lg gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleTransportChange("boda_boda")}
                    aria-label="Boda boda route"
                    className={`flex items-center justify-center w-9 h-8 rounded-xl transition-all ${
                      currentTransport === "boda_boda"
                        ? `${activeThemeBg} text-white shadow-sm`
                        : "text-muted-foreground"
                    }`}
                  >
                    <Bike className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTransportChange("driving")}
                    aria-label="Driving route"
                    className={`flex items-center justify-center w-9 h-8 rounded-xl transition-all ${
                      currentTransport === "driving"
                        ? `${activeThemeBg} text-white shadow-sm`
                        : "text-muted-foreground"
                    }`}
                  >
                    <Car className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTransportChange("walking")}
                    aria-label="Walking route"
                    className={`flex items-center justify-center w-9 h-8 rounded-xl transition-all ${
                      currentTransport === "walking"
                        ? `${activeThemeBg} text-white shadow-sm`
                        : "text-muted-foreground"
                    }`}
                  >
                    <Navigation className="size-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 h-10 px-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-lg text-xs font-black text-foreground">
                  {isRouteLoading ? (
                    <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                      <RefreshCw className="size-3 animate-spin" />
                      <span>Routing…</span>
                    </div>
                  ) : route ? (
                    <>
                      <span className={activeThemeText}>{route.distanceKm} km</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span>{formatDuration(route.durationMinutes)}</span>
                    </>
                  ) : selectedPharmacy?.distanceKm !== undefined ? (
                    <span className={activeThemeText}>{selectedPharmacy.distanceKm} km</span>
                  ) : null}
                </div>
              </div>

              {/* Mobile Row 3: Swipeable Top 5 Carousel */}
              {topPharmacies.length > 0 && (
                <div className="overflow-x-auto snap-x flex gap-2 no-scrollbar py-0.5">
                  {topPharmacies.slice(0, 5).map((outlet, idx) => {
                    const isSelected = selectedPharmacy?.id === outlet.id;
                    const dist = isSelected && route ? route.distanceKm : outlet.distanceKm;
                    return (
                      <button
                        key={outlet.id}
                        type="button"
                        onClick={() => onSelectPharmacy(outlet)}
                        className={`min-w-[130px] max-w-[155px] snap-start p-2 rounded-2xl border text-left backdrop-blur-xl transition-all active:scale-95 ${
                          isSelected
                            ? `${activeRing} shadow-md ring-2 bg-card/95`
                            : "bg-card/85 border-border/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                              isSelected ? activeBadgeSolid : "bg-muted text-muted-foreground"
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          {dist !== undefined && (
                            <span className={`text-[10px] font-black ${isSelected ? activeThemeText : "text-muted-foreground"}`}>
                              {dist} km
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-black text-foreground truncate">
                          {outlet.name}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate">
                          {outlet.street || outlet.district}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Adaptive Bottom Sheet (Peek Bar & Expandable Drawer) */}
          {selectedPharmacy && (
            <div className="absolute bottom-0 left-0 right-0 z-30 pb-[max(env(safe-area-inset-bottom),0.5rem)] px-3 pointer-events-auto md:hidden">
              <div className="bg-card/95 backdrop-blur-xl rounded-3xl border border-border/60 shadow-2xl overflow-hidden transition-all">
                {/* Peek Bar */}
                <div
                  onClick={() => setIsMobileSheetExpanded((prev) => !prev)}
                  className="flex items-center justify-between p-3 gap-2 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${activeBadgeSolid}`}>
                      #{topPharmacies.findIndex((p) => p.id === selectedPharmacy.id) + 1 || "★"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground truncate">{selectedPharmacy.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {route ? `${route.distanceKm} km · ${formatDuration(route.durationMinutes)}` : `${selectedPharmacy.distanceKm ?? "—"} km`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      onClick={() => handleNavigate(selectedPharmacy)}
                      className={`h-9 px-3 rounded-xl font-black ${activeThemeBg} text-white shadow-md text-xs uppercase tracking-wider flex items-center gap-1`}
                    >
                      <Navigation className="size-3.5" />
                      <span>Directions</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => setIsMobileSheetExpanded((prev) => !prev)}
                      className="p-2 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={isMobileSheetExpanded ? "Collapse sheet" : "Expand sheet"}
                    >
                      {isMobileSheetExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isMobileSheetExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-border/30 space-y-3">
                    <div className="text-xs text-muted-foreground">
                      <p className="font-bold text-foreground">{selectedPharmacy.address || selectedPharmacy.street}</p>
                      <p>{selectedPharmacy.district}{selectedPharmacy.region ? ` · ${selectedPharmacy.region}` : ""}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
                        <p className="font-bold uppercase text-muted-foreground">NDA License</p>
                        <p className={`font-mono font-bold ${activeThemeText} truncate mt-0.5`}>{selectedPharmacy.premiseNo}</p>
                        <p className="text-[9px] text-muted-foreground">Expires: {selectedPharmacy.expiryDate?.split(" ")[0] || "Active"}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
                        <p className="font-bold uppercase text-muted-foreground">{isDrugShop ? "Owner / Prop." : "Supervising Pharmacist"}</p>
                        <p className="font-bold text-foreground truncate mt-0.5">{selectedPharmacy.pharmacist || (isDrugShop ? "Licensed Drug Shop" : "Supervising Pharmacist")}</p>
                        {selectedPharmacy.psuNo && (
                          <p className="text-[9px] text-muted-foreground">PSU: {selectedPharmacy.psuNo}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {selectedPharmacy.phone && (
                        <button
                          type="button"
                          onClick={() => handleCall(selectedPharmacy)}
                          className="h-9 flex-1 rounded-xl font-bold border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <Phone className="size-3.5" /> Call
                        </button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShare(selectedPharmacy)}
                        className="h-9 flex-1 rounded-xl font-bold border-border/60 text-xs flex items-center justify-center gap-1"
                      >
                        <Compass className="size-3.5" /> Share
                      </Button>
                      {onOpenVerification && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenVerification(selectedPharmacy)}
                          className="h-9 flex-1 rounded-xl font-bold border-border/60 text-xs flex items-center justify-center gap-1"
                        >
                          <ShieldCheck className="size-3.5 text-teal-600 dark:text-teal-400" /> Verify
                        </Button>
                      )}
                      {medicine && onRefillLogged && (
                        <Button
                          size="sm"
                          onClick={() => {
                            onRefillLogged(medicine, selectedPharmacy);
                            handleToggleFullscreen();
                          }}
                          className="h-9 px-3 rounded-xl font-black border border-teal-500/40 text-teal-700 dark:text-teal-300 bg-teal-500/10 text-xs flex items-center gap-1"
                        >
                          <RefreshCw className="size-3" /> Refill
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Recenter & Satellite Map Controls ── */}
      {/* Normal mode controls */}
      {!isFullscreen && (
        <div className="absolute z-20 flex flex-col gap-1.5 items-end bottom-3 right-3">
          <button
            onClick={handleToggleFullscreen}
            title="Full Screen Map"
            aria-label="Full Screen Map"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/90 backdrop-blur-md border border-border/60 text-foreground shadow-md transition-all hover:bg-card active:scale-90"
          >
            <Maximize2 className="size-4 text-teal-600 dark:text-teal-400" />
          </button>
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
          <button
            onClick={fitCameraToBounds}
            title="Recenter Route"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/90 backdrop-blur-md border border-border/60 text-foreground shadow-md transition-all hover:bg-card active:scale-90"
          >
            <Crosshair className="size-4 text-teal-600 dark:text-teal-400" />
          </button>
        </div>
      )}

      {/* Fullscreen Desktop controls (positioned to the left of the docked right-hand card) */}
      {isFullscreen && (
        <div
          className={`absolute z-20 hidden md:flex flex-col gap-1.5 items-end bottom-6 transition-all ${
            isDesktopCardCollapsed ? "right-4" : "right-[370px] lg:right-[380px]"
          }`}
        >
          <button
            onClick={toggleMapMode}
            title={mapMode === "streets" ? "Switch to Satellite Imagery" : "Switch to Street Map"}
            className={`flex h-9 items-center gap-1.5 px-3 rounded-2xl backdrop-blur-xl border shadow-lg transition-all active:scale-95 text-xs font-bold ${
              mapMode === "satellite"
                ? "bg-teal-600 text-white border-teal-500 shadow-teal-600/30"
                : "bg-card/95 text-foreground border-border/60 hover:bg-card"
            }`}
          >
            <Layers className="size-4" />
            <span className="text-xs font-extrabold">{mapMode === "streets" ? "Satellite" : "Streets"}</span>
          </button>
          <button
            onClick={fitCameraToBounds}
            title="Recenter Route"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 text-foreground shadow-lg transition-all hover:bg-card active:scale-90"
          >
            <Crosshair className="size-4 text-teal-600 dark:text-teal-400" />
          </button>
        </div>
      )}

      {/* Fullscreen Mobile controls (positioned above mobile bottom sheet) */}
      {isFullscreen && (
        <div className="absolute z-20 flex md:hidden flex-col gap-1.5 items-end bottom-20 right-3">
          <button
            onClick={toggleMapMode}
            title={mapMode === "streets" ? "Switch to Satellite Imagery" : "Switch to Street Map"}
            className={`flex h-8 items-center gap-1 px-2.5 rounded-xl backdrop-blur-xl border shadow-lg transition-all active:scale-95 text-[11px] font-bold ${
              mapMode === "satellite"
                ? "bg-teal-600 text-white border-teal-500 shadow-teal-600/30"
                : "bg-card/95 text-foreground border-border/60 hover:bg-card"
            }`}
          >
            <Layers className="size-3.5" />
            <span>{mapMode === "streets" ? "Sat" : "Map"}</span>
          </button>
          <button
            onClick={fitCameraToBounds}
            title="Recenter Route"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/95 backdrop-blur-xl border border-border/60 text-foreground shadow-lg transition-all hover:bg-card active:scale-90"
          >
            <Crosshair className="size-4 text-teal-600 dark:text-teal-400" />
          </button>
        </div>
      )}

      {/* ── Legend + NDA verified (Bottom Left) ── */}
      <div
        className={`absolute z-20 flex flex-col gap-1.5 ${
          isFullscreen ? "bottom-20 md:bottom-6 left-3 md:left-4" : "bottom-3 left-3"
        }`}
      >
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



