import * as pmtiles from "pmtiles";
import type * as maplibregl from "maplibre-gl";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

export const LOCAL_MAP_PACK_FILENAME = "uganda.pmtiles";

// Default Firebase Storage / CDN URL for Uganda PMTiles package
export const FIREBASE_PMTILES_STORAGE_URL =
  (typeof process !== "undefined" && process.env?.VITE_FIREBASE_PMTILES_URL) ||
  "https://firebasestorage.googleapis.com/v0/b/dawa-lens.appspot.com/o/tiles%2Fuganda.pmtiles?alt=media";

export const OPENFREEMAP_POSITRON_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const OPENFREEMAP_BRIGHT_STYLE = "https://tiles.openfreemap.org/styles/bright";

// High-resolution Esri World Imagery raster basemap
export const ESRI_SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

let isProtocolRegistered = false;
let globalProtocolInstance: pmtiles.Protocol | null = null;

/**
 * Initializes and registers the PMTiles protocol handler with MapLibre GL once.
 */
export function initPmtilesProtocol(maplibreInstance: typeof maplibregl): void {
  if (isProtocolRegistered) return;

  try {
    globalProtocolInstance = new pmtiles.Protocol();
    maplibreInstance.addProtocol("pmtiles", globalProtocolInstance.tile);
    isProtocolRegistered = true;
  } catch (err) {
    console.warn("[mapTileService] Failed to register PMTiles protocol:", err);
  }
}

/**
 * Checks if the local Uganda PMTiles package is stored on the device (Capacitor Android app storage).
 */
export async function isLocalOfflineMapAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // For Web, check Cache API
    try {
      if (typeof caches !== "undefined") {
        const cache = await caches.open("dawa-map-tiles-v1");
        const match = await cache.match("/tiles/uganda.pmtiles");
        return !!match;
      }
    } catch {}
    return false;
  }

  try {
    const res = await Filesystem.stat({
      path: LOCAL_MAP_PACK_FILENAME,
      directory: Directory.Data,
    });
    return !!res && res.size > 1024 * 1024; // Valid archive > 1MB
  } catch {
    return false;
  }
}

/**
 * Gets the file URI for the local offline map pack on Android or Web.
 */
export async function getLocalOfflineMapUri(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const uriResult = await Filesystem.getUri({
      path: LOCAL_MAP_PACK_FILENAME,
      directory: Directory.Data,
    });
    return uriResult?.uri || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the optimal vector map style:
 * 1. Android Native: If local PMTiles exists in Capacitor app storage -> returns local PMTiles style.
 * 2. Web App: If Firebase Storage PMTiles URL is reachable or preferred -> returns PMTiles style.
 * 3. Default fallback: OpenFreeMap Positron / Bright.
 */
export async function resolveActiveVectorStyle(): Promise<string> {
  try {
    if (Capacitor.isNativePlatform()) {
      const hasLocal = await isLocalOfflineMapAvailable();
      if (hasLocal) {
        const localUri = await getLocalOfflineMapUri();
        if (localUri) {
          const convertedUrl = Capacitor.convertFileSrc(localUri);
          return `pmtiles://${convertedUrl}`;
        }
      }
    }
  } catch (err) {
    console.warn("[mapTileService] Failed resolving offline map URI, falling back to online style:", err);
  }

  return OPENFREEMAP_POSITRON_STYLE;
}
