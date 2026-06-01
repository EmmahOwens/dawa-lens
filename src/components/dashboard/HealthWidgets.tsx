import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Smile, Meh, Frown, Loader2 } from "@/lib/icons";
import { RiveMoji } from "../rive/RiveMoji";
import { WellnessLog } from "@/contexts/AppContext";
import { aiApi } from "@/services/api";
import { useApp } from "@/contexts/AppContext";

interface HealthWidgetsProps {
  wellnessLogs: WellnessLog[];
  onAddLog: (type: "food" | "symptom", data: any) => void;
}

const MOOD_OPTIONS = [
  { value: 1, icon: Frown, emoji: "😔", color: "text-destructive", bg: "bg-destructive/10", label: "Low" },
  { value: 2, icon: Frown, emoji: "😕", color: "text-orange-400", bg: "bg-orange-400/10", label: "Meh" },
  { value: 3, icon: Meh, emoji: "😐", color: "text-warning", bg: "bg-warning/10", label: "Okay" },
  { value: 4, icon: Smile, emoji: "🙂", color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Good" },
  { value: 5, icon: Smile, emoji: "💎", color: "text-success", bg: "bg-success/10", label: "Great" },
];

const getMoodLabel = (value: number) => {
  const found = MOOD_OPTIONS.find((m) => m.value === value);
  return found?.label ?? "Okay";
};

export function HealthWidgets({ wellnessLogs, onAddLog }: HealthWidgetsProps) {
  const { medicines } = useApp();
  const today = new Date().toDateString();
  const [savingMood, setSavingMood] = useState<number | null>(null);

  // Latest mood logged today (from symptom entries)
  const latestMood = useMemo(() => {
    const todaySymptomLogs = wellnessLogs
      .filter(
        (l) =>
          l.type === "symptom" &&
          l.data?.mood != null &&
          new Date(l.timestamp).toDateString() === today
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return todaySymptomLogs.length > 0 ? (todaySymptomLogs[0].data?.mood != null ? Number(todaySymptomLogs[0].data.mood) : null) : null;
  }, [wellnessLogs, today]);

  const activeMoodCfg = latestMood != null ? MOOD_OPTIONS.find((m) => m.value === latestMood) : null;

  /**
   * When the user taps a mood:
   * 1. Fetch a Groq AI reflection (same service as Wellness Hub)
   * 2. Save the wellness log with the reflection baked in
   */
  const handleMoodTap = async (moodValue: number) => {
    if (savingMood !== null) return; // prevent double-tap
    setSavingMood(moodValue);

    try {
      // Step 1: Get AI reflection from Groq (energy defaults to 3 on quick-tap; no symptoms)
      let aiReflection: { reflection: string; affirmation: string; tip: string } | null = null;
      try {
        aiReflection = await aiApi.getEmotionReflection({
          mood: moodValue,
          energy: 3,
          symptoms: [],
          medicines,
        });
      } catch (err) {
        console.warn("Groq reflection failed on Dashboard mood tap:", err);
      }

      // Step 2: Save log with reflection (gracefully falls back if reflection is null)
      onAddLog("symptom", {
        mood: moodValue,
        energy: 3,
        symptoms: [],
        ...(aiReflection ? { aiReflection } : {}),
      });
    } finally {
      setSavingMood(null);
    }
  };

  return (
    <div className="mb-8">
      {/* Mood Tracker */}
      <div className="bg-card border border-border/50 rounded-[2rem] p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div
            className={`p-1 rounded-xl w-fit ${
              activeMoodCfg ? activeMoodCfg.bg : "bg-indigo-500/10 text-indigo-500"
            }`}
          >
            {activeMoodCfg ? (
              <RiveMoji emoji={activeMoodCfg.emoji} size={24} />
            ) : (
              <Smile size={18} className="text-indigo-500" />
            )}
          </div>
          {activeMoodCfg && (
            <span
              className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${activeMoodCfg.bg} ${activeMoodCfg.color}`}
            >
              {getMoodLabel(latestMood!)}
            </span>
          )}
        </div>

        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
          {activeMoodCfg ? `Feeling ${getMoodLabel(latestMood!)} today` : "Daily Mood"}
        </p>

        {/* 5-step mood buttons */}
        <div className="flex justify-between items-center bg-muted/30 p-1.5 rounded-2xl gap-1 mt-auto">
          {MOOD_OPTIONS.map((mood) => {
            const MoodIcon = mood.icon;
            const isActive = latestMood === mood.value;
            const isLoading = savingMood === mood.value;

            return (
              <motion.button
                key={mood.value}
                whileTap={{ scale: 0.85 }}
                onClick={() => handleMoodTap(mood.value)}
                disabled={savingMood !== null}
                className={`flex-1 flex items-center justify-center py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? `${mood.bg} ${mood.color} shadow-sm scale-110`
                    : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
                } ${savingMood !== null && !isLoading ? "opacity-40" : ""}`}
                title={mood.label}
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <motion.div
                    animate={isActive ? {
                      y: [0, -4, 0],
                      scale: [1, 1.05, 1],
                    } : {}}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <RiveMoji emoji={mood.emoji} size={20} active={isActive} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Subtle AI hint while generating */}
        {savingMood !== null && (
          <p className="text-[9px] text-muted-foreground/50 font-medium text-center mt-2 tracking-wider animate-pulse">
            ✨ Generating your reflection…
          </p>
        )}
      </div>
    </div>
  );
}
