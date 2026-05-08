import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

interface AIInsightCardProps {
  adherencePercent: number;
}

function buildInsight(adherence: number, mood: number | null, energy: number | null): string {
  const moodLabel =
    mood == null ? null
    : mood >= 4 ? "positive"
    : mood <= 2 ? "low"
    : "neutral";

  const energyLabel =
    energy == null ? null
    : energy >= 4 ? "high"
    : energy <= 2 ? "low"
    : "moderate";

  // Perfect adherence + positive mood
  if (adherence >= 100 && moodLabel === "positive") {
    return `Perfect dose consistency and a positive mood today — your body is getting exactly what it needs. You're in great shape!`;
  }

  // Perfect adherence + low mood
  if (adherence >= 100 && moodLabel === "low") {
    return `All doses are on track today — that's great commitment even when you're not feeling your best. Your consistency is what keeps treatment effective.`;
  }

  // High adherence + positive mood
  if (adherence >= 80 && moodLabel === "positive") {
    return `You're maintaining strong adherence and feeling good today. Setting a backup reminder for any remaining doses could push you to 100%.`;
  }

  // Low energy warning
  if (energyLabel === "low" && adherence < 80) {
    return `Your energy is running low and some doses were missed. Low energy can make it easy to forget — try pairing your meds with a daily habit like meals or brushing teeth.`;
  }

  // Good energy, poor adherence
  if (energyLabel === "high" && adherence < 70) {
    return `You're feeling energetic today — use that momentum to catch up on your medication routine. Consistent dosing is key for long-term effectiveness.`;
  }

  // Low mood, any adherence
  if (moodLabel === "low") {
    return `We noticed you're feeling low today. Remember that consistent medication is an important part of feeling better over time. Small steps matter.`;
  }

  // Fallback by adherence
  if (adherence >= 100) return "Your perfect consistency this week is improving your long-term recovery odds. Keep it up!";
  if (adherence > 80) return "You're doing great! Small tip: Setting a backup alarm for your evening dose might help hit that 100%.";
  return "We noticed some missed doses. Consistency is key for medication effectiveness. Need help setting better reminders?";
}

export function AIInsightCard({ adherencePercent }: AIInsightCardProps) {
  const { wellnessLogs, setIsDawaGPTOpen } = useApp();

  const today = new Date().toDateString();

  const { mood, energy } = useMemo(() => {
    const todayLogs = wellnessLogs
      .filter(
        (l) =>
          l.type === "symptom" &&
          new Date(l.timestamp).toDateString() === today
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (todayLogs.length === 0) return { mood: null, energy: null };

    const latest = todayLogs[0].data as any;
    return {
      mood: latest.mood != null ? Number(latest.mood) : null,
      energy: latest.energy != null ? Number(latest.energy) : null,
    };
  }, [wellnessLogs, today]);

  const insight = buildInsight(adherencePercent, mood, energy);

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
      className="mb-8 relative overflow-hidden rounded-[2rem] bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20"
    >
      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
              AI Health Insight
            </span>
          </div>
          <TrendIcon size={16} className={trendColor} />
        </div>

        {/* Emotion summary pills (only when data exists) */}
        {(mood != null || energy != null) && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {mood != null && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-white/15 border border-white/20 px-2.5 py-1 rounded-full">
                Mood:{" "}
                {mood >= 4 ? "😊 Positive" : mood <= 2 ? "😔 Low" : "😐 Neutral"}
              </span>
            )}
            {energy != null && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-white/15 border border-white/20 px-2.5 py-1 rounded-full">
                Energy:{" "}
                {energy >= 4 ? "⚡ High" : energy <= 2 ? "🪫 Low" : "🔋 Moderate"}
              </span>
            )}
          </div>
        )}

        <p className="text-sm font-medium leading-relaxed mb-5 text-white/95">
          "{insight}"
        </p>

        <button
          onClick={() => setIsDawaGPTOpen(true)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-colors border border-white/10 active:scale-95"
        >
          Ask DawaGPT <ArrowRight size={12} />
        </button>
      </div>
    </motion.div>
  );
}
