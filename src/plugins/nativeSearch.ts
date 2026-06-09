/**
 * NativeSearch — Capacitor plugin for offline drug name fuzzy search.
 *
 * Backed by a Rust library (libdawa_search) compiled as a native binary
 * for each platform. Uses Jaro-Winkler similarity ranking over a bundled
 * index of ~1,000 common drug names from the EAC Essential Medicines List.
 *
 * Results are returned in < 1 ms with no network call, enabling true
 * offline autocomplete in the drug interaction checker.
 *
 * Falls back gracefully: if the native library is unavailable (simulator,
 * older OS), isAvailable() returns false and callers use the NLM API.
 */
import { registerPlugin } from '@capacitor/core';

export interface DrugSearchResult {
  name: string;
  score: number;   // 0-1 Jaro-Winkler similarity
  rxcui?: string;  // RxNorm CUI if known
}

export interface NativeSearchPlugin {
  fuzzySearch(options: { query: string; limit?: number }): Promise<{ results: DrugSearchResult[] }>;
  isAvailable(): Promise<{ available: boolean }>;
}

const NativeSearch = registerPlugin<NativeSearchPlugin>('NativeSearch');
export { NativeSearch };
