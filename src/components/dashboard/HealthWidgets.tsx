import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Meh, Frown, Loader2, Sparkles, ChevronRight, Activity, Heart } from "@/lib/icons";
import { LottieMoji } from "../rive/LottieMoji";
import { RiveMoji } from "../rive/RiveMoji";
import { WellnessLog } from "@/contexts/AppContext";
import { aiApi } from "@/services/api";
import { useApp } from "@/contexts/AppContext";

interface HealthWidgetsProps {
  wellnessLogs: WellnessLog[];
  onAddLog: (type: "food" | "symptom", data: any) => void;
}

export interface MoodOption {
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  label: string;
  sublabel: string;
  gradient: string;
  glow: string;
  border: string;
  accentBar: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  activePill: string;
  dot: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    value: 1,
    icon: Frown,
    emoji: "😔",
    label: "Low",
    sublabel: "Taking it easy",
    gradient: "from-rose-500 to-pink-600",
    glow: "from-rose-500/[0.12] via-pink-500/[0.04] to-transparent",
    border: "border-rose-400/40 dark:border-rose-500/40",
    accentBar: "bg-rose-500",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-600 dark:text-rose-400",
    badgeBorder: "border-rose-500/30",
    activePill: "bg-rose-500/15 border-rose-400/60 shadow-rose-500/20 ring-rose-400/30",
    dot: "bg-rose-500",
  },
  {
    value: 2,
    icon: Frown,
    emoji: "😕",
    label: "Meh",
    sublabel: "Hanging in there",
    gradient: "from-amber-500 to-orange-500",
    glow: "from-amber-500/[0.12] via-orange-500/[0.04] to-transparent",
    border: "border-amber-400/40 dark:border-amber-500/40",
    accentBar: "bg-amber-500",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-600 dark:text-amber-400",
    badgeBorder: "border-amber-500/30",
    activePill: "bg-amber-500/15 border-amber-400/60 shadow-amber-500/20 ring-amber-400/30",
    dot: "bg-amber-500",
  },
  {
    value: 3,
    icon: Meh,
    emoji: "😐",
    label: "Okay",
    sublabel: "Balanced & steady",
    gradient: "from-sky-500 to-blue-600",
    glow: "from-sky-500/[0.12] via-blue-500/[0.04] to-transparent",
    border: "border-sky-400/40 dark:border-sky-500/40",
    accentBar: "bg-sky-500",
    badgeBg: "bg-sky-500/15",
    badgeText: "text-sky-600 dark:text-sky-400",
    badgeBorder: "border-sky-500/30",
    activePill: "bg-sky-500/15 border-sky-400/60 shadow-sky-500/20 ring-sky-400/30",
    dot: "bg-sky-500",
  },
  {
    value: 4,
    icon: Smile,
    emoji: "🙂",
    label: "Good",
    sublabel: "Feeling energized",
    gradient: "from-emerald-400 to-teal-600",
    glow: "from-emerald-500/[0.12] via-teal-500/[0.04] to-transparent",
    border: "border-emerald-400/40 dark:border-emerald-500/40",
    accentBar: "bg-emerald-500",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    badgeBorder: "border-emerald-500/30",
    activePill: "bg-emerald-500/15 border-emerald-400/60 shadow-emerald-500/20 ring-emerald-400/30",
    dot: "bg-emerald-500",
  },
  {
    value: 5,
    icon: Smile,
    emoji: "🤩",
    label: "Great",
    sublabel: "Vitality & thriving",
    gradient: "from-violet-500 via-purple-500 to-amber-500",
    glow: "from-violet-500/[0.14] via-indigo-500/[0.06] to-amber-500/[0.04]",
    border: "border-violet-400/45 dark:border-violet-500/45",
    accentBar: "bg-gradient-to-b from-violet-500 to-indigo-600",
    badgeBg: "bg-gradient-to-r from-violet-500/15 to-indigo-500/15",
    badgeText: "text-violet-600 dark:text-violet-400",
    badgeBorder: "border-violet-500/35",
    activePill: "bg-violet-500/15 border-violet-400/60 shadow-violet-500/25 ring-violet-400/35",
    dot: "bg-violet-500",
  },
];

const DEFAULT_THEME = {
  gradient: "from-violet-600 to-indigo-600",
  glow: "from-indigo-500/[0.05] via-purple-500/[0.02] to-transparent",
  border: "border-border/80 hover:border-primary/40",
  accentBar: "bg-primary/50",
};

export function HealthWidgets({ wellnessLogs, onAddLog }: HealthWidgetsProps) {
  const navigate = useNavigate();
  const { medicines } = useApp();
  const today = new Date().toDateString();
  const [savingMood, setSavingMood] = useState<number | null>(null);

  // Latest mood logged today
  const latestMoodLog = useMemo(() => {
    const todaySymptomLogs = wellnessLogs
      .filter(
        (l) =>
          l.type === "symptom" &&
          l.data?.mood != null &&
          new Date(l.timestamp).toDateString() === today
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return todaySymptomLogs.length > 0 ? todaySymptomLogs[0] : null;
  }, [wellnessLogs, today]);

  const latestMood = latestMoodLog?.data?.mood != null ? Number(latestMoodLog.data.mood) : null;
  const activeMoodCfg = latestMood != null ? MOOD_OPTIONS.find((m) => m.value === latestMood) : null;
  const aiReflection = latestMoodLog?.data?.aiReflection as
    | { reflection?: string; affirmation?: string; tip?: string }
    | undefined;

  const handleMoodTap = async (moodValue: number) => {
    if (savingMood !== null) return;
    setSavingMood(moodValue);

    try {
      let reflectionData: { reflection: string; affirmation: string; tip: string } | null = null;
      try {
        reflectionData = await aiApi.getEmotionReflection({
          mood: moodValue,
          energy: 3,
          symptoms: [],
          medicines,
        });
      } catch (err) {
        console.warn("Groq reflection failed on Dashboard mood tap:", err);
      }

      onAddLog("symptom", {
        mood: moodValue,
        energy: 3,
        symptoms: [],
        ...(reflectionData ? { aiReflection: reflectionData } : {}),
      });
    } finally {
      setSavingMood(null);
    }
  };

  return (
    <div className="mb-8">
      <motion.div
        layout
        className={`group relative overflow-hidden rounded-[24px] border ${
          activeMoodCfg ? activeMoodCfg.border : DEFAULT_THEME.border
        } bg-card p-5 sm:p-6 flex flex-col shadow-sm hover:shadow-md transition-all duration-300`}
      >
        {/* Dynamic Ambient Glow */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${
            activeMoodCfg ? activeMoodCfg.glow : DEFAULT_THEME.glow
          } pointer-events-none transition-all duration-500`}
        />

        {/* Ambient Jewel Blur Orb */}
        <div
          className={`absolute -top-12 -right-12 w-36 h-36 rounded-full ${
            activeMoodCfg ? "bg-primary/10" : "bg-violet-500/10"
          } blur-2xl pointer-events-none`}
        />

        {/* Left Vertical Accent Indicator Bar */}
        <div
          className={`absolute left-0 top-3.5 bottom-3.5 w-1.25 rounded-r-full ${
            activeMoodCfg ? activeMoodCfg.accentBar : DEFAULT_THEME.accentBar
          } transition-colors duration-300`}
        />

        <div className="relative z-10 flex flex-col">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${
                  activeMoodCfg ? activeMoodCfg.gradient : DEFAULT_THEME.gradient
                } text-white flex items-center justify-center shadow-xs shadow-black/10`}
              >
                <Activity size={15} className="text-white" />
              </div>
              <div>
                <h3 className="text-[15px] sm:text-[16px] font-bold text-foreground leading-tight tracking-tight">
                  Daily Wellness Check
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Track mood &amp; daily vitality
                </p>
              </div>
            </div>

            {/* Mood Status Chip */}
            {activeMoodCfg ? (
              <span
                className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full border shadow-xs transition-all ${activeMoodCfg.badgeBg} ${activeMoodCfg.badgeText} ${activeMoodCfg.badgeBorder}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeMoodCfg.dot} animate-pulse`} />
                {activeMoodCfg.label}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground px-2.5 py-0.5 rounded-full bg-secondary border border-border/50">
                Not logged yet
              </span>
            )}
          </div>

          {/* Subtitle Status */}
          <p className="text-[13px] text-muted-foreground mb-4 font-normal">
            {activeMoodCfg
              ? `Logged as feeling ${activeMoodCfg.label.toLowerCase()} today.`
              : "How are you feeling right now? Tap an expression to check in."}
          </p>

          {/* 5-Step Mood Selector */}
          <div className="relative flex justify-between items-center bg-secondary/80 dark:bg-muted/40 border border-border/80 p-1.5 rounded-2xl gap-1.5 sm:gap-2 shadow-inner">
            {MOOD_OPTIONS.map((mood) => {
              const isActive = latestMood === mood.value;
              const isLoading = savingMood === mood.value;

              return (
                <button
                  type="button"
                  key={mood.value}
                  onClick={() => handleMoodTap(mood.value)}
                  disabled={savingMood !== null}
                  className={`group relative flex-1 flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer ${
                    isActive
                      ? `bg-card dark:bg-card border ${mood.border} ring-2 ${mood.activePill} shadow-md scale-102`
                      : "hover:bg-card/70 hover:scale-105 border border-transparent"
                  } ${savingMood !== null && !isLoading ? "opacity-40" : ""}`}
                  title={`${mood.label} – ${mood.sublabel}`}
                >
                  {isLoading ? (
                    <div className="h-7 w-7 flex items-center justify-center">
                      <Loader2 size={18} className="animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="transition-transform duration-200 group-hover:scale-110">
                      <LottieMoji emoji={mood.emoji} size={26} active={isActive} grayscaleInactive={false} />
                    </div>
                  )}

                  <span
                    className={`text-[10px] font-semibold mt-1 transition-colors ${
                      isActive
                        ? `${mood.badgeText} font-bold`
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {mood.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* AI Clinical Reflection Banner (if logged today) */}
          <AnimatePresence>
            {aiReflection && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 14 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-2xl bg-secondary/70 dark:bg-muted/40 border border-border/60 flex items-start gap-2.5 shadow-xs">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br ${
                      activeMoodCfg ? activeMoodCfg.gradient : "from-primary to-indigo-600"
                    } text-white shadow-xs`}
                  >
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-foreground leading-tight">
                      {aiReflection.affirmation || "Today's Insight"}
                    </p>
                    {aiReflection.tip && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {aiReflection.tip}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate("/wellness")}
                    className="text-[11px] font-bold text-primary flex items-center gap-0.5 hover:underline whitespace-nowrap self-center ml-1"
                  >
                    Hub <ChevronRight size={11} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Saving Status Indicator */}
          {savingMood !== null && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] text-primary font-medium text-center mt-3 animate-pulse flex items-center justify-center gap-1.5"
            >
              <RiveMoji emoji="✨" size={12} /> Generating personalized clinical reflection…
            </motion.p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
