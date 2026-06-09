import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus, Loader2 } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { aiApi } from "@/services/api";
import { toDate } from "@/lib/utils";
import { RiveMoji } from "../rive/RiveMoji";

interface AIInsightCardProps {
  adherencePercent: number;
}

export function AIInsightCard({ adherencePercent }: AIInsightCardProps) {
  const { wellnessLogs, medicines, doseLogs, setIsDawaGPTOpen } = useApp();

  const today = new Date().toDateString();

  const { mood, energy, latestReflection } = useMemo(() => {
    const todayLogs = wellnessLogs
      .filter(
        (l) =>
          l.type === "symptom" &&
          toDate(l.timestamp).toDateString() === today
      )
      .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime());

    if (todayLogs.length === 0) return { mood: null, energy: null, latestReflection: null };

    const latest = todayLogs[0].data as any;
    return {
      mood: latest?.mood != null ? Number(latest.mood) : null,
      energy: latest?.energy != null ? Number(latest.energy) : null,
      // Reuse saved AI reflection from the most recent log if it exists
      latestReflection: latest?.aiReflection ?? null,
    };
  }, [wellnessLogs, today]);

  // Live Groq insight state
  const [groqInsight, setGroqInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  // Track what data the last fetch was built on to avoid redundant calls
  const lastFetchKey = useRef<string>("");

  useEffect(() => {
    const fetchKey = `${adherencePercent}-${mood}-${energy}-${doseLogs.length}`;
    if (fetchKey === lastFetchKey.current) return;
    lastFetchKey.current = fetchKey;

    const fetchInsight = async () => {
      setInsightLoading(true);
      try {
        const res = await aiApi.getWellnessInsight({
          doseLogs: doseLogs.slice(0, 30),
          wellnessLogs: wellnessLogs.slice(0, 10),
          medicines,
        });
        const data = res as any;
        // Prefer a short summary; fall back to first insight bullet
        const text: string =
          data?.summary ??
          (Array.isArray(data?.insights) && data.insights.length > 0
            ? data.insights[0]
            : null);
        if (text) setGroqInsight(text);
      } catch (err) {
        console.warn("AIInsightCard Groq call failed:", err);
      } finally {
        setInsightLoading(false);
      }
    };

    fetchInsight();
  }, [adherencePercent, mood, energy, doseLogs.length]);

  // Displayed insight text — prefer live Groq, then saved reflection summary, then nothing
  const displayInsight =
    groqInsight ??
    (latestReflection?.reflection ?? null);

  // Trend indicator based on mood + adherence
  const TrendIcon =
    adherencePercent >= 80 && (mood == null || mood >= 3) ? TrendingUp
    : adherencePercent < 60 || (mood != null && mood <= 2) ? TrendingDown
    : Minus;

  const trendColor =
    TrendIcon === TrendingUp ? "text-emerald-300"
    : TrendIcon === TrendingDown ? "text-red-300"
    : "text-amber-300";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-8 relative overflow-hidden rounded-3xl bg-background border border-border/50 p-6 text-foreground shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Sparkles size={100} className="text-primary" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20">
              <Sparkles size={14} className="text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              AI Health Insight
            </span>
          </div>
          {insightLoading ? (
            <Loader2 size={14} className="text-muted-foreground animate-spin" />
          ) : (
            <TrendIcon size={16} className={trendColor.replace("white", "primary").replace("indigo", "primary").replace("-300", "-500")} />
          )}
        </div>

        {/* Emotion summary pills (only when data exists) */}
        {(mood != null || energy != null) && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {mood != null && (
              <span className="text-[10px] font-bold uppercase tracking-widest bg-muted/50 border border-border/50 px-3 py-1.5 rounded-xl text-muted-foreground flex items-center gap-1.5">
                Mood{" "}
                {mood >= 4 ? (
                  <span className="flex items-center gap-1"><RiveMoji emoji="😊" size={14} /> Positive</span>
                ) : mood <= 2 ? (
                  <span className="flex items-center gap-1"><RiveMoji emoji="😔" size={14} /> Low</span>
                ) : (
                  <span className="flex items-center gap-1"><RiveMoji emoji="😐" size={14} /> Neutral</span>
                )}
              </span>
            )}
            {energy != null && (
              <span className="text-[10px] font-bold uppercase tracking-widest bg-muted/50 border border-border/50 px-3 py-1.5 rounded-xl text-muted-foreground flex items-center gap-1.5">
                Energy{" "}
                {energy >= 4 ? (
                  <span className="flex items-center gap-1"><RiveMoji emoji="⚡" size={14} /> High</span>
                ) : energy <= 2 ? (
                  <span className="flex items-center gap-1"><RiveMoji emoji="🪫" size={14} /> Low</span>
                ) : (
                  <span className="flex items-center gap-1"><RiveMoji emoji="🔋" size={14} /> Moderate</span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Insight text */}
        {insightLoading && !displayInsight ? (
          <div className="space-y-2 mb-6">
            <div className="h-3 bg-muted rounded-full w-full animate-pulse" />
            <div className="h-3 bg-muted rounded-full w-4/5 animate-pulse" />
            <div className="h-3 bg-muted/80 rounded-full w-3/5 animate-pulse" />
          </div>
        ) : displayInsight ? (
          <div className="text-[15px] font-medium leading-relaxed mb-6 text-foreground/90">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">"{children}"</p>,
                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                li: ({ children }) => <li className="text-[13px] leading-tight">{children}</li>,
              }}
            >
              {displayInsight}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-[15px] font-medium leading-relaxed mb-6 text-muted-foreground italic">
            Log your mood or take a medication dose to generate a personalized insight.
          </p>
        )}

        <button
          onClick={() => setIsDawaGPTOpen(true)}
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shadow-primary/10"
        >
          Ask DawaGPT <ArrowRight size={12} />
        </button>
      </div>
    </motion.div>
  );
}
