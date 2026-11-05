/**
 * NativeSearch — Capacitor plugin for offline drug name fuzzy search.
 *
 * Backed by the Rust `dawa-search` crate:
 * - On Android: executed via JNI (`libdawa_search.so`) with automatic WebAssembly fallback.
 * - On Web / PWA: executed via WebAssembly (`/wasm/dawa_search.wasm`), using the exact same
 *   Rust Jaro-Winkler similarity ranking over the bundled Uganda Essential Medicines List (EMLU).
 *
 * Results are returned in < 1 ms with no network call, enabling true offline autocomplete.
 */
import { registerPlugin, WebPlugin } from "@capacitor/core";
import { initDawaWasm, wasmFuzzySearch } from "@/lib/dawaWasm";

export interface DrugSearchResult {
  name: string;
  score: number;   // 0-1 Jaro-Winkler similarity
  rxcui?: string;  // RxNorm CUI if known
}

export interface NativeSearchPlugin {
  fuzzySearch(options: { query: string; limit?: number }): Promise<{ results: DrugSearchResult[] }>;
  isAvailable(): Promise<{ available: boolean }>;
}

class NativeSearchWeb extends WebPlugin implements NativeSearchPlugin {
  async isAvailable(): Promise<{ available: boolean }> {
    const ready = await initDawaWasm();
    return { available: ready };
  }

  async fuzzySearch(options: { query: string; limit?: number }): Promise<{ results: DrugSearchResult[] }> {
    await initDawaWasm();
    const raw = wasmFuzzySearch(options.query || "", options.limit ?? 8) || [];
    const results: DrugSearchResult[] = raw.map((item) => {
      const entry: DrugSearchResult = {
        name: item.name,
        score: item.score,
      };
      if (item.rxcui) {
        entry.rxcui = item.rxcui;
      }
      return entry;
    });
    return { results };
  }
}

const NativeSearch = registerPlugin<NativeSearchPlugin>("NativeSearch", {
  web: () => new NativeSearchWeb(),
});

export { NativeSearch };
