import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import * as pmtiles from "pmtiles";
import type * as maplibregl from "maplibre-gl";

import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import ugandaBoundaryData from "@/data/maps/ugandaBoundary.json";

// Standalone vector offline style using bundled Uganda administrative boundary GeoJSON
export const OFFLINE_UGANDA_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "uganda-boundary": {
      type: "geojson",
      data: ugandaBoundaryData as any,
    },
  },
  layers: [
    {
      id: "uganda-bg",
      type: "background",
      paint: {
        "background-color": "#0d1527",
      },
    },
    {
      id: "uganda-fill",
      type: "fill",
      source: "uganda-boundary",
      paint: {
        "fill-color": "#132338",
        "fill-opacity": 0.95,
      },
    },
    {
      id: "uganda-border",
      type: "line",
      source: "uganda-boundary",
      paint: {
        "line-color": "#10b981",
        "line-width": 1.5,
        "line-opacity": 0.8,
      },
    },
  ],
};

// Optional CARTO API key (CARTO requires an API key for unwatermarked basemaps)
const CARTO_API_KEY =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CARTO_API_KEY) ||
  (typeof process !== "undefined" && process.env?.VITE_CARTO_API_KEY) ||
  "";

const cartoKeyParam = CARTO_API_KEY ? `?api_key=${encodeURIComponent(CARTO_API_KEY)}` : "";

/**
 * Unified multi-layer composite map style:
 * Contains:
 * 1. Embedded offline Uganda boundary base layers (instant zero-network fallback under raster tiles)
 * 2. Streets (CARTO Voyager / OpenStreetMap multi-mirror high-detail tiles)
 * 3. Satellite (Esri maxzoom 17 + Hybrid labels)
 *
 * Switching between Offline, Streets, and Satellite is done via layer visibility toggling
 * or non-diff style application, avoiding destructive route polyline teardowns!
 */
export const COMPOSITE_PHARMACY_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "uganda-boundary": {
      type: "geojson",
      data: ugandaBoundaryData as any,
    },
    "streets-source": {
      type: "raster",
      tiles: CARTO_API_KEY
        ? [
            `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${cartoKeyParam}`,
            `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${cartoKeyParam}`,
            `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${cartoKeyParam}`,
          ]
        : [
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
      maxzoom: 19,
    },
    "satellite-source": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
      maxzoom: 17, // Capped at 17 to prevent Esri "Map data not yet available" tiles
    },
    "satellite-labels-source": {
      type: "raster",
      tiles: CARTO_API_KEY
        ? [`https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png${cartoKeyParam}`]
        : [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          ],
      tileSize: 256,
      attribution: CARTO_API_KEY
        ? "© OpenStreetMap contributors, © CARTO"
        : "Esri, HERE, Garmin, (c) OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "uganda-bg",
      type: "background",
      paint: {
        "background-color": "#0d1527",
      },
    },
    {
      id: "uganda-fill",
      type: "fill",
      source: "uganda-boundary",
      paint: {
        "fill-color": "#132338",
        "fill-opacity": 0.95,
      },
    },
    {
      id: "uganda-border",
      type: "line",
      source: "uganda-boundary",
      paint: {
        "line-color": "#10b981",
        "line-width": 1.5,
        "line-opacity": 0.8,
      },
    },
    {
      id: "streets-layer",
      type: "raster",
      source: "streets-source",
      minzoom: 0,
      maxzoom: 22,
      layout: {
        visibility: "visible",
      },
    },
    {
      id: "satellite-layer",
      type: "raster",
      source: "satellite-source",
      minzoom: 0,
      maxzoom: 22,
      layout: {
        visibility: "none",
      },
    },
    {
      id: "satellite-labels-layer",
      type: "raster",
      source: "satellite-labels-source",
      minzoom: 0,
      maxzoom: 22,
      layout: {
        visibility: "none",
      },
    },
  ],
};

/**
 * Checks whether online map tile servers are actively reachable.
 * Used to detect when weak/offline networks recover internet access
 * even when browser `online` events did not fire.
 */
export async function checkMapConnectivity(timeoutMs = 3500): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      if (!status.connected) return false;
    } catch {
      // Fall through to probe
    }
  }

  // In unit test environments (jsdom/vitest) without real network fetch, trust navigator.onLine
  if (typeof process !== "undefined" && (process.env?.VITEST || process.env?.NODE_ENV === "test")) {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }

  const probeUrls = [
    "https://tiles.openfreemap.org/styles/positron",
    "https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png",
    "https://tile.openstreetmap.org/0/0/0.png",
  ];

  for (const url of probeUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok || res.type === "opaque") {
        return true;
      }
    } catch {
      clearTimeout(timer);
    }
  }

  return false;
}

/**
 * Subscribes to both Capacitor native network changes and browser online/offline events.
 */
export function subscribeToMapNetworkChanges(
  onStatusChange: (connected: boolean) => void
): () => void {
  let cancelled = false;
  let nativeHandle: { remove: () => Promise<void> } | null = null;

  const handleOnline = () => {
    if (!cancelled) onStatusChange(true);
  };
  const handleOffline = () => {
    if (!cancelled) onStatusChange(false);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  if (Capacitor.isNativePlatform()) {
    Network.getStatus()
      .then((status) => {
        if (!cancelled) onStatusChange(status.connected);
      })
      .catch(() => {});

    Network.addListener("networkStatusChange", (status) => {
      if (!cancelled) onStatusChange(status.connected);
    })
      .then((handle) => {
        if (cancelled) {
          handle.remove().catch(() => {});
        } else {
          nativeHandle = handle;
        }
      })
      .catch(() => {});
  }

  return () => {
    cancelled = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    }
    if (nativeHandle) {
      nativeHandle.remove().catch(() => {});
    }
  };
}

let isProtocolRegistered = false;
let globalProtocolInstance: pmtiles.Protocol | null = null;
let isWorkerConfigured = false;

/**
 * Ensures MapLibre GL is configured with its bundled Web Worker URL in Vite.
 */
function setupMapLibreWorker(maplibreInstance?: any): void {
  if (isWorkerConfigured) return;
  try {
    const inst = maplibreInstance;
    const setWorkerUrlFn = inst?.setWorkerUrl || inst?.default?.setWorkerUrl;
    if (typeof setWorkerUrlFn === "function") {
      setWorkerUrlFn.call(inst, mapWorkerUrl);
      isWorkerConfigured = true;
    }
  } catch (err) {
    console.warn("[mapTileService] Failed to set MapLibre worker URL:", err);
  }
}

/**
 * Initializes and registers the PMTiles protocol handler with MapLibre GL once.
 */
export function initPmtilesProtocol(maplibreInstance: any): void {
  setupMapLibreWorker(maplibreInstance);

  if (isProtocolRegistered) return;

  try {
    const ProtocolClass = (pmtiles as any).Protocol;
    if (ProtocolClass) {
      globalProtocolInstance = new ProtocolClass();
      const addProtocolFn =
        maplibreInstance?.addProtocol || maplibreInstance?.default?.addProtocol;
      if (typeof addProtocolFn === "function") {
        addProtocolFn.call(maplibreInstance, "pmtiles", globalProtocolInstance.tile);
        isProtocolRegistered = true;
      }
    }
  } catch (err) {
    console.warn("[mapTileService] Failed to register PMTiles protocol:", err);
  }
}
