/**
 * WebAssembly (WASM) Bridge for the Rust `dawa-search` Clinical, Fuzzy Search & Geospatial Engine.
 *
 * Compiles `rust/` (`wasm32-unknown-unknown`) into `public/wasm/dawa_search.wasm` so both the
 * Web/PWA build and the Capacitor Android WebView execute the exact same memory-safe Rust core
 * 100% offline with zero network dependency.
 */

import type { ClinicalDrugDef } from "../services/clinicalInteractionsData";
import type { ParsedInteraction } from "../types/interactions";

interface DawaWasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  w_alloc: (size: number) => number;
  w_dealloc: (ptr: number, size: number) => void;
  w_last_len: () => number;
  dawa_haversine_km: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  dawa_is_same_substance: (ptrA: number, lenA: number, ptrB: number, lenB: number) => number;
  dawa_normalize_drug: (ptr: number, len: number) => number;
  dawa_resolve_canonical_json: (ptr: number, len: number) => number;
  dawa_evaluate_interaction_json: (ptrA: number, lenA: number, ptrB: number, lenB: number) => number;
  dawa_check_interactions_json: (ptr: number, len: number) => number;
  dawa_fuzzy_search_json: (ptr: number, len: number, limit: number) => number;
}

export interface WasmDrugSearchResult {
  name: string;
  score: number;
  rxcui?: string | null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let wasmExports: DawaWasmExports | null = null;
let initPromise: Promise<boolean> | null = null;
let nodeSyncAttempted = false;

/**
 * Attempts synchronous instantiation in Node.js / Vitest environments so unit tests
 * and SSR can use the Rust WASM engine immediately without awaiting a fetch.
 */
function tryInitSyncInNode(): DawaWasmExports | null {
  if (wasmExports) return wasmExports;
  if (nodeSyncAttempted) return null;
  nodeSyncAttempted = true;

  try {
    const proc = (globalThis as unknown as {
      process?: {
        versions?: { node?: string };
        cwd?: () => string;
        getBuiltinModule?: (id: string) => unknown;
      };
    }).process;

    if (proc?.versions?.node && typeof proc.getBuiltinModule === "function") {
      const fs = proc.getBuiltinModule("fs") as {
        existsSync: (p: string) => boolean;
        readFileSync: (p: string) => Uint8Array;
      };
      const path = proc.getBuiltinModule("path") as {
        resolve: (...parts: string[]) => string;
      };
      const cwd = typeof proc.cwd === "function" ? proc.cwd() : ".";
      const wasmPath = path.resolve(cwd, "public/wasm/dawa_search.wasm");
      if (fs.existsSync(wasmPath)) {
        const bytes = fs.readFileSync(wasmPath);
        const mod = new WebAssembly.Module(bytes as BufferSource);
        const instance = new WebAssembly.Instance(mod, {});
        wasmExports = instance.exports as DawaWasmExports;
        return wasmExports;
      }
    }
  } catch {
    // Ignore and fall back to async browser load or pure TS fallback
  }
  return null;
}

/**
 * Asynchronously loads and instantiates `/wasm/dawa_search.wasm` in Browser / PWA / Android WebView.
 * Safe to call multiple times; caches the initialized instance.
 */
export async function initDawaWasm(): Promise<boolean> {
  if (wasmExports || tryInitSyncInNode()) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof fetch === "undefined") return false;
      const response = await fetch("/wasm/dawa_search.wasm");
      if (!response.ok) return false;

      if (typeof WebAssembly.instantiateStreaming === "function") {
        try {
          const { instance } = await WebAssembly.instantiateStreaming(response.clone(), {});
          wasmExports = instance.exports as DawaWasmExports;
          return true;
        } catch {
          // Fallback if MIME type is not application/wasm on local file:// server
        }
      }

      const buffer = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(buffer, {});
      wasmExports = instance.exports as DawaWasmExports;
      return true;
    } catch {
      return false;
    }
  })();

  return initPromise;
}

// Kick off background initialization in browser environments
if (typeof window !== "undefined") {
  void initDawaWasm();
}

function getWasm(): DawaWasmExports | null {
  return wasmExports || tryInitSyncInNode();
}

export function isDawaWasmReady(): boolean {
  return getWasm() !== null;
}

const MAX_WASM_STRING_BYTES = 64 * 1024;

function withWasmString<T>(
  wasm: DawaWasmExports,
  str: string,
  fn: (ptr: number, len: number) => T
): T {
  const bytes = encoder.encode(str);
  const len = bytes.byteLength;
  if (len === 0 || len > MAX_WASM_STRING_BYTES) {
    return fn(0, 0);
  }
  const ptr = wasm.w_alloc(len);
  if (!ptr) {
    return fn(0, 0);
  }
  try {
    new Uint8Array(wasm.memory.buffer, ptr, len).set(bytes);
    return fn(ptr, len);
  } finally {
    wasm.w_dealloc(ptr, len);
  }
}

function readOutputString(wasm: DawaWasmExports, outPtr: number): string {
  const outLen = wasm.w_last_len();
  if (!outPtr || outLen === 0) return "";
  const view = new Uint8Array(wasm.memory.buffer, outPtr, outLen);
  return decoder.decode(view);
}

/**
 * Computes great-circle Haversine distance in kilometers via Rust WASM.
 */
export function wasmHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number | null {
  const wasm = getWasm();
  if (!wasm) return null;
  return wasm.dawa_haversine_km(lat1, lon1, lat2, lon2);
}

/**
 * Checks whether two medication strings refer to the same active substance via Rust WASM.
 */
export function wasmIsSameDrugSubstance(drugA: string, drugB: string): boolean | null {
  const wasm = getWasm();
  if (!wasm) return null;
  return withWasmString(wasm, drugA, (ptrA, lenA) =>
    withWasmString(wasm, drugB, (ptrB, lenB) => {
      return wasm.dawa_is_same_substance(ptrA, lenA, ptrB, lenB) === 1;
    })
  );
}

/**
 * Resolves a free-form drug query to its canonical drug definition via Rust WASM.
 * Returns `undefined` if WASM is not yet loaded, or `ClinicalDrugDef | null` when evaluated by Rust.
 */
export function wasmResolveCanonicalDrug(
  query: string
): ClinicalDrugDef | null | undefined {
  const wasm = getWasm();
  if (!wasm) return undefined;
  return withWasmString(wasm, query, (ptr, len) => {
    const outPtr = wasm.dawa_resolve_canonical_json(ptr, len);
    const json = readOutputString(wasm, outPtr);
    if (!json) return null;
    try {
      return JSON.parse(json) as ClinicalDrugDef;
    } catch {
      return null;
    }
  });
}

/**
 * Evaluates a clinical drug-drug interaction between two medications via Rust WASM.
 * Returns `undefined` if WASM is not yet loaded, or `ParsedInteraction | null` when evaluated by Rust.
 */
export function wasmEvaluateClinicalInteraction(
  medA: string,
  medB: string
): ParsedInteraction | null | undefined {
  const wasm = getWasm();
  if (!wasm) return undefined;
  return withWasmString(wasm, medA, (ptrA, lenA) =>
    withWasmString(wasm, medB, (ptrB, lenB) => {
      const outPtr = wasm.dawa_evaluate_interaction_json(ptrA, lenA, ptrB, lenB);
      const json = readOutputString(wasm, outPtr);
      if (!json) return null;
      try {
        return JSON.parse(json) as ParsedInteraction;
      } catch {
        return null;
      }
    })
  );
}

/**
 * Runs Jaro-Winkler fuzzy search over the embedded Rust drug catalog via WASM.
 */
export function wasmFuzzySearch(
  query: string,
  limit = 8
): WasmDrugSearchResult[] | null {
  const wasm = getWasm();
  if (!wasm) return null;
  const trimmed = query.trim();
  if (!trimmed) return [];
  return withWasmString(wasm, trimmed, (ptr, len) => {
    const outPtr = wasm.dawa_fuzzy_search_json(ptr, len, Math.max(1, Math.min(20, limit)));
    const json = readOutputString(wasm, outPtr);
    if (!json) return [];
    try {
      return JSON.parse(json) as WasmDrugSearchResult[];
    } catch {
      return [];
    }
  });
}
