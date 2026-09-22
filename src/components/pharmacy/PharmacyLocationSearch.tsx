import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Crosshair,
  Loader2,
  X,
  Compass,
  Check,
  Building2,
  Navigation,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  searchAddressSuggestions,
  GeocodedPlace,
} from "@/services/locationGeocodingService";

export interface PharmacyLocationSearchProps {
  currentCoords: [number, number]; // [lng, lat]
  activeLocationLabel: string;
  isCustomLocation: boolean;
  onSelectPlace: (place: GeocodedPlace) => void;
  onResetToGps: () => void;
  className?: string;
  placeholder?: string;
}

export const PharmacyLocationSearch: React.FC<PharmacyLocationSearchProps> = ({
  currentCoords,
  activeLocationLabel,
  isCustomLocation,
  onSelectPlace,
  onResetToGps,
  className = "",
  placeholder = "Search town, neighborhood, or address (e.g. Ntinda, Kololo, Jinja)…",
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search via Photon (by Komoot)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const places = await searchAddressSuggestions(trimmed, {
          biasLat: currentCoords[1],
          biasLon: currentCoords[0],
          limit: 6,
        });
        setSuggestions(places);
        setIsOpen(true);
      } catch (err) {
        console.warn("[PharmacyLocationSearch] Failed to fetch suggestions:", err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, currentCoords]);

  // Click outside to dismiss suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSelectSuggestion = (place: GeocodedPlace) => {
    onSelectPlace(place);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClearQuery = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleGpsResetClick = () => {
    onResetToGps();
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* ── Search Input Field ─────────────────────────────────────────── */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-teal-600 dark:text-teal-400" />
          ) : (
            <Search className="size-4" />
          )}
        </div>

        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 || query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-11 pl-10 pr-24 rounded-2xl bg-card/80 backdrop-blur-md border border-border/50 text-xs font-semibold placeholder:text-muted-foreground/70 focus-visible:ring-teal-500/30 transition-all shadow-sm"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />

        {/* Right side controls (Clear / Provider badge) */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={handleClearQuery}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}

          <span
            className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded border border-border/30 select-none"
            title="Geocoding via Photon by Komoot (OpenStreetMap)"
          >
            Photon
          </span>
        </div>
      </div>

      {/* ── Active Custom Location Pill Indicator ───────────────────────── */}
      {isCustomLocation && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs"
        >
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <MapPin className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
            <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
              Near:
            </span>
            <span className="text-[11px] font-bold text-foreground truncate">
              {activeLocationLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={handleGpsResetClick}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 hover:text-teal-900 hover:underline px-2 py-0.5 rounded-md hover:bg-teal-500/15 transition-colors"
          >
            <Crosshair className="size-3" />
            <span>Use My GPS</span>
          </button>
        </motion.div>
      )}

      {/* ── Instant Drop-down Search Suggestions ────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-card border border-border/60 shadow-2xl backdrop-blur-xl overflow-hidden divide-y divide-border/30 max-h-80 overflow-y-auto no-scrollbar"
          >
            {/* Quick Action: Reset / Use Current Device GPS */}
            <div
              onClick={handleGpsResetClick}
              className={`p-2.5 px-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                !isCustomLocation
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-300"
                  : "hover:bg-muted/50 text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400">
                  <Crosshair className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Use My Current Device GPS</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Auto-detect live coordinates & nearest licensed outlets
                  </p>
                </div>
              </div>
              {!isCustomLocation && (
                <Check className="size-4 text-teal-600 dark:text-teal-400 shrink-0" />
              )}
            </div>

            {/* Suggestions list */}
            {suggestions.length > 0 ? (
              <div className="p-1">
                <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                  Location Suggestions (Photon)
                </div>
                {suggestions.map((place, idx) => {
                  const isHighlighted = highlightedIndex === idx;
                  return (
                    <div
                      key={place.id || `${place.name}-${idx}`}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelectSuggestion(place)}
                      className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-2.5 transition-all ${
                        isHighlighted
                          ? "bg-teal-500/15 text-foreground border border-teal-500/30"
                          : "hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-xl bg-muted/60 text-muted-foreground shrink-0">
                          {place.type === "city" || place.type === "district" ? (
                            <Building2 className="size-3.5" />
                          ) : (
                            <MapPin className="size-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {place.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {place.displayName}
                          </p>
                        </div>
                      </div>

                      {/* Type badge */}
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground shrink-0 border border-border/30">
                        {place.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : query.trim().length >= 2 && !isLoading ? (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground font-medium">
                  No places matching "{query}" found in Uganda.
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Try searching a major neighborhood (e.g. Kololo, Ntinda), street, or district.
                </p>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
