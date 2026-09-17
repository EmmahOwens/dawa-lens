import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plane, MapPin, Globe, ShieldAlert, Sparkles, CheckCircle2 } from "@/lib/icons";
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
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            Travel Intelligence
          </h4>
          <Plane size={14} className="text-primary" />
        </div>

        {cachedAdvice ? (
          <div className="space-y-4">
            {/* Active Destination Card */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-primary/5 backdrop-blur-md border border-primary/20 rounded-[1.75rem] p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Globe size={15} />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                      Trip Active
                    </span>
                    <p className="text-sm font-black text-foreground tracking-tight">
                      {destination || "International Trip"}
                    </p>
                  </div>
                </div>
                {Array.isArray(cachedAdvice.equivalents) && cachedAdvice.equivalents.length > 0 && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                    {cachedAdvice.equivalents.length} Equivalents
                  </span>
                )}
              </div>

              {/* Timezone Snapshot */}
              {cachedAdvice.timezoneAdvice && (
                <div className="pt-2 border-t border-border/40 space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Timezone Strategy
                  </span>
                  <div className="text-[11px] text-foreground/90 font-medium leading-snug line-clamp-3">
                    <MessageRenderer
                      text={cachedAdvice.timezoneAdvice}
                      className="text-[11px] leading-snug [&_strong]:text-blue-600 dark:[&_strong]:text-blue-400"
                    />
                  </div>
                </div>
              )}

              {/* Customs Snapshot */}
              {cachedAdvice.customsNotes && (
                <div className="pt-2 border-t border-border/40 space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Customs Alert
                  </span>
                  <div className="text-[11px] text-foreground/90 font-medium leading-snug line-clamp-3">
                    <MessageRenderer
                      text={cachedAdvice.customsNotes}
                      className="text-[11px] leading-snug [&_strong]:text-amber-600 dark:[&_strong]:text-amber-400"
                    />
                  </div>
                </div>
              )}
            </motion.div>

            {/* Quick Ask DawaGPT */}
            <button
              onClick={() =>
                openDawaGPTWithPrompt(
                  `What are the important medicine travel rules and customs requirements for traveling to ${destination || "my destination"}?`
                )
              }
              className="w-full text-left p-3.5 rounded-2xl bg-primary/10 hover:bg-primary/15 border border-primary/20 text-xs font-bold text-primary transition-all flex items-center justify-between group active:scale-95 shadow-xs"
            >
              <span>Ask DawaGPT about {destination || "Trip"}</span>
              <Sparkles size={14} className="text-primary group-hover:rotate-12 transition-transform shrink-0" />
            </button>
          </div>
        ) : (
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-primary/5 backdrop-blur-md border border-primary/20 rounded-[2rem] p-6 shadow-sm hover:shadow-primary/5 transition-all space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <MapPin size={16} />
              </div>
              <p className="text-[12px] font-black uppercase tracking-tight">Trip Analysis</p>
            </div>
            <p className="text-[11px] leading-relaxed text-foreground/80 font-medium">
              Enter your destination in the Travel Companion to analyze cross-border medication regulations, generic equivalents, and local health advisory data.
            </p>

            <button
              onClick={() =>
                openDawaGPTWithPrompt("What should I prepare before traveling abroad with prescription medications?")
              }
              className="w-full text-left p-3 rounded-xl bg-background/60 hover:bg-background/90 border border-border/60 text-[10px] font-bold text-foreground/80 transition-all flex items-center justify-between group active:scale-95"
            >
              <span>Travel Checklist Prompt</span>
              <Sparkles size={12} className="text-primary group-hover:rotate-12 transition-transform shrink-0" />
            </button>
          </motion.div>
        )}
      </section>
    </div>
  );
}
