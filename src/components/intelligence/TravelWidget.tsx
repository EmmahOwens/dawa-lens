import React, { useState, useEffect } from "react";
import { Plane, Globe, Sparkles, MapPin } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import MessageRenderer from "@/components/MessageRenderer";

export function TravelWidget() {
  const { openDawaGPTWithPrompt } = useApp();
  const [cachedAdvice, setCachedAdvice] = useState<any>(null);
  const [destination, setDestination] = useState<string>("");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("dawa_travel_advice");
      const dest = sessionStorage.getItem("dawa_travel_destination");
      if (stored) {
        setCachedAdvice(JSON.parse(stored));
      }
      if (dest) {
        setDestination(dest);
      }
    } catch (_) {}
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Travel Intelligence
          </h4>
          <Plane size={14} className="text-primary" />
        </div>

        {cachedAdvice ? (
          <div className="space-y-3">
            {/* Active Destination Card */}
            <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <Globe size={15} />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Trip Active
                    </span>
                    <p className="text-sm font-semibold text-foreground tracking-tight">
                      {destination || "International Trip"}
                    </p>
                  </div>
                </div>
                {Array.isArray(cachedAdvice.equivalents) && cachedAdvice.equivalents.length > 0 && (
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {cachedAdvice.equivalents.length} Equivalents
                  </span>
                )}
              </div>

              {/* Timezone Snapshot */}
              {cachedAdvice.timezoneAdvice && (
                <div className="pt-2.5 border-t border-border space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Timezone Strategy
                  </span>
                  <div className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-3">
                    <MessageRenderer
                      text={cachedAdvice.timezoneAdvice}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Customs Snapshot */}
              {cachedAdvice.customsNotes && (
                <div className="pt-2.5 border-t border-border space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Customs Alert
                  </span>
                  <div className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-3">
                    <MessageRenderer
                      text={cachedAdvice.customsNotes}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Ask DawaGPT */}
            <button
              onClick={() =>
                openDawaGPTWithPrompt(
                  `What are the important medicine travel rules and customs requirements for traveling to ${destination || "my destination"}?`
                )
              }
              className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-primary/10 hover:bg-primary/15 border border-primary/20 text-xs font-semibold text-primary transition-transform active:scale-95 flex items-center justify-between"
            >
              <span>Ask DawaGPT about {destination || "Trip"}</span>
              <Sparkles size={14} className="text-primary shrink-0" />
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <MapPin size={15} />
              </div>
              <p className="text-xs font-semibold text-foreground tracking-tight">Trip Analysis</p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground font-medium">
              Enter your destination in the Travel Companion to analyze cross-border medication regulations, generic equivalents, and local health advisory data.
            </p>

            <button
              onClick={() =>
                openDawaGPTWithPrompt("What should I prepare before traveling abroad with prescription medications?")
              }
              className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground transition-transform active:scale-95 flex items-center justify-between"
            >
              <span>Travel Checklist Prompt</span>
              <Sparkles size={13} className="text-primary shrink-0" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
