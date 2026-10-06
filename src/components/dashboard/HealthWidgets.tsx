import React, { useMemo, useState } from "react";
import { Smile, Meh, Frown, Loader2 } from "@/lib/icons";
import { LottieMoji } from "../rive/LottieMoji";
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
  { value: 2, icon: Frown, emoji: "😕", color: "text-amber-500", bg: "bg-amber-500/10", label: "Meh" },
  { value: 3, icon: Meh, emoji: "😐", color: "text-muted-foreground", bg: "bg-muted", label: "Okay" },
  { value: 4, icon: Smile, emoji: "🙂", color: "text-primary", bg: "bg-primary/10", label: "Good" },
  { value: 5, icon: Smile, emoji: "🤩", color: "text-primary", bg: "bg-primary/15", label: "Great" },
];

const getMoodLabel = (value: number) => {
  const found = MOOD_OPTIONS.find((m) => m.value === value);
  return found?.label ?? "Okay";
};

export function HealthWidgets({ wellnessLogs, onAddLog }: HealthWidgetsProps) {
  const { medicines } = useApp();
  const today = new Date().toDateString();
  const [savingMood, setSavingMood] = useState<number | null>(null);

  // Latest mood logged today
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

  const handleMoodTap = async (moodValue: number) => {
    if (savingMood !== null) return;
    setSavingMood(moodValue);

    try {
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
      <div className="bg-card border border-border rounded-[18px] p-6 flex flex-col transition-all duration-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-foreground">
              Daily Wellness Check
            </span>
          </div>
          {activeMoodCfg && (
            <span
              className="text-[12px] font-medium px-2.5 py-0.5 rounded-full bg-muted border border-border text-foreground"
            >
              {getMoodLabel(latestMood!)}
            </span>
          )}
        </div>

        <p className="text-[13px] text-muted-foreground mb-4">
          {activeMoodCfg ? `Logged as feeling ${getMoodLabel(latestMood!).toLowerCase()} today.` : "How are you feeling right now?"}
        </p>

        {/* 5-step mood selector */}
        <div className="flex justify-between items-center bg-muted/50 border border-border p-1.5 rounded-full gap-1">
          {MOOD_OPTIONS.map((mood) => {
            const isActive = latestMood === mood.value;
            const isLoading = savingMood === mood.value;

            return (
              <button
                type="button"
                key={mood.value}
                onClick={() => handleMoodTap(mood.value)}
                disabled={savingMood !== null}
                className={`flex-1 flex items-center justify-center py-2 rounded-full transition-all duration-150 active:scale-90 ${
                  isActive
                    ? "bg-white dark:bg-[#2a2a2c] shadow-sm border border-border text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                } ${savingMood !== null && !isLoading ? "opacity-40" : ""}`}
                title={mood.label}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <LottieMoji emoji={mood.emoji} size={20} active={isActive} />
                )}
              </button>
            );
          })}
        </div>

        {savingMood !== null && (
          <p className="text-[11px] text-muted-foreground font-normal text-center mt-2.5 animate-pulse flex items-center justify-center gap-1">
            <RiveMoji emoji="✨" size={11} /> Generating clinical reflection…
          </p>
        )}
      </div>
    </div>
  );
}
