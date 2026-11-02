import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import MessageRenderer from "@/components/MessageRenderer";
import { Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus, Loader2 } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { aiApi } from "@/services/api";
import { generateLocalClinicalAssessment } from "@/services/clinicalAssessmentService";
import { toDate } from "@/lib/utils";
import { RiveMoji } from "../rive/RiveMoji";

interface AIInsightCardProps {
  adherencePercent: number;
}

export function AIInsightCard({ adherencePercent }: AIInsightCardProps) {
  const { wellnessLogs, medicines, doseLogs, openDawaGPTWithPrompt } = useApp();

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
      latestReflection: latest?.aiReflection ?? null,
    };
  }, [wellnessLogs, today]);

  // Live Groq insight state (Cached in sessionStorage per app session)
  const [groqInsight, setGroqInsight] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("dawa_ai_health_insight");
    } catch {
      return null;
    }
  });
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    const cachedInsight = (() => {
      try {
        return sessionStorage.getItem("dawa_ai_health_insight");
      } catch {
        return null;
      }
    })();

    if (cachedInsight) {
      setGroqInsight(cachedInsight);
      return;
    }

    const fetchInsight = async () => {
      setInsightLoading(true);
      try {
        const res = await aiApi.getWellnessInsight({
          doseLogs: doseLogs.slice(0, 30),
          wellnessLogs: wellnessLogs.slice(0, 10),
          medicines,
        });
        const data = res as any;
        const text: string =
          data?.summary ??
          (Array.isArray(data?.insights) && data.insights.length > 0
            ? data.insights[0]
            : null);
        if (text) {
          setGroqInsight(text);
          try {
            sessionStorage.setItem("dawa_ai_health_insight", text);
          } catch (e) {
            console.error("Failed to save AI health insight to sessionStorage", e);
          }
        } else {
          const fallback = generateLocalClinicalAssessment(doseLogs, wellnessLogs, medicines);
          const fallbackText = fallback.insight || fallback.summary;
          if (fallbackText) setGroqInsight(fallbackText);
        }
      } catch (err) {
        console.warn("AIInsightCard Groq call failed, generating local fallback:", err);
        const fallback = generateLocalClinicalAssessment(doseLogs, wellnessLogs, medicines);
        const fallbackText = fallback.insight || fallback.summary;
        if (fallbackText) setGroqInsight(fallbackText);
      } finally {
        setInsightLoading(false);
      }
    };

    if (doseLogs.length > 0 || wellnessLogs.length > 0) {
      fetchInsight();
    }
  }, [doseLogs, wellnessLogs, medicines]);

  const displayInsight = groqInsight || latestReflection;

  const { TrendIcon, trendColor } = useMemo(() => {
    if (adherencePercent >= 80) {
      return { TrendIcon: TrendingUp, trendColor: "text-primary" };
    }
    if (adherencePercent >= 50) {
      return { TrendIcon: Minus, trendColor: "text-muted-foreground" };
    }
    return { TrendIcon: TrendingDown, trendColor: "text-destructive" };
  }, [adherencePercent]);

  return (
    <div className="mb-8 overflow-hidden rounded-[20px] border border-blue-500/20 bg-gradient-to-br from-card via-card to-blue-500/[0.03] p-5 sm:p-6 text-foreground shadow-xs transition-all duration-200">
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-blue-500/15 border border-blue-500/25 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Sparkles size={14} />
            </div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-blue-600 dark:text-blue-400">
              Clinical Insight
            </span>
          </div>
          {insightLoading ? (
            <Loader2 size={14} className="text-muted-foreground animate-spin" />
          ) : (
            <TrendIcon size={16} className={trendColor} />
          )}
        </div>

        {/* Emotion summary chips */}
        {(mood != null || energy != null) && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {mood != null && (
              <span className={`text-[12px] font-normal border px-3 py-1 rounded-full flex items-center gap-1.5 ${
                mood >= 4
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                  : mood <= 2
                  ? "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300"
                  : "bg-muted border-border text-foreground"
              }`}>
                Mood:{" "}
                {mood >= 4 ? (
                  <span className="flex items-center gap-1 font-medium"><RiveMoji emoji="😊" size={13} /> Positive</span>
                ) : mood <= 2 ? (
                  <span className="flex items-center gap-1 font-medium"><RiveMoji emoji="😔" size={13} /> Low</span>
                ) : (
                  <span className="flex items-center gap-1 font-medium"><RiveMoji emoji="😐" size={13} /> Neutral</span>
                )}
              </span>
            )}
            {energy != null && (
              <span className={`text-[12px] font-normal border px-3 py-1 rounded-full flex items-center gap-1.5 ${
                energy >= 4
                  ? "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300"
                  : energy <= 2
                  ? "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300"
                  : "bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-300"
              }`}>
                Energy:{" "}
                {energy >= 4 ? (
                  <span className="flex items-center gap-1 font-medium"><RiveMoji emoji="⚡" size={13} /> High</span>
                ) : energy <= 2 ? (
                  <span className="flex items-center gap-1 font-medium"><RiveMoji emoji="🪫" size={13} /> Low</span>
                ) : (
                  <span className="flex items-center gap-1 font-medium"><RiveMoji emoji="🔋" size={13} /> Moderate</span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Insight text */}
        {insightLoading && !displayInsight ? (
          <div className="space-y-2 mb-5">
            <div className="h-3 bg-muted rounded-full w-full animate-pulse" />
            <div className="h-3 bg-muted rounded-full w-4/5 animate-pulse" />
          </div>
        ) : displayInsight ? (
          <div className="text-[15px] font-normal leading-relaxed mb-5 text-foreground">
            <MessageRenderer
              text={displayInsight}
              className="text-[15px] font-normal leading-relaxed text-foreground [&_strong]:font-semibold"
            />
          </div>
        ) : (
          <p className="text-[14px] font-normal leading-relaxed mb-5 text-muted-foreground">
            Log your wellness status or take a medication dose to generate a personalized clinical insight.
          </p>
        )}

        {/* Apple Pill CTA */}
        <button
          onClick={() => openDawaGPTWithPrompt()}
          className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-normal hover:brightness-105 active:scale-95 transition-all"
        >
          <span>Ask DawaGPT</span>
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
