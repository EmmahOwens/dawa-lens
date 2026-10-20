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
 * Contains both Streets (clean OpenStreetMap or CARTO if key provided) and Satellite (Esri maxzoom 17 + Hybrid labels)
 * in a single style specification.
 *
 * Switching between Streets and Satellite is done via layer visibility toggling,
 * completely avoiding map.setStyle() teardowns that wipe out route polylines!
 */
export const COMPOSITE_PHARMACY_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "streets-source": {
      type: "raster",
      tiles: CARTO_API_KEY
        ? [`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${cartoKeyParam}`]
        : ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: CARTO_API_KEY
        ? "© OpenStreetMap contributors, © CARTO"
        : "© OpenStreetMap contributors",
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
