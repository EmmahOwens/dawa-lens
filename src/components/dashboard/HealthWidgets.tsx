import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Droplets, Smile, Meh, Frown, Plus } from "lucide-react";
import { WellnessLog } from "@/contexts/AppContext";

interface HealthWidgetsProps {
  wellnessLogs: WellnessLog[];
  onAddLog: (type: "food" | "symptom", data: any) => void;
}

const MOOD_OPTIONS = [
  { value: 1, icon: Frown, color: "text-destructive", bg: "bg-destructive/10", label: "Low" },
  { value: 2, icon: Frown, color: "text-orange-400", bg: "bg-orange-400/10", label: "Meh" },
  { value: 3, icon: Meh, color: "text-warning", bg: "bg-warning/10", label: "Okay" },
  { value: 4, icon: Smile, color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Good" },
  { value: 5, icon: Smile, color: "text-success", bg: "bg-success/10", label: "Great" },
];

const getMoodLabel = (value: number) => {
  const found = MOOD_OPTIONS.find((m) => m.value === value);
  return found?.label ?? "Okay";
};

export function HealthWidgets({ wellnessLogs, onAddLog }: HealthWidgetsProps) {
  const today = new Date().toDateString();

  // Water intake for today
  const waterIntake = useMemo(() => {
    return wellnessLogs
      .filter(
        (l) =>
          l.type === "food" &&
          (l.data as any).type === "water" &&
          new Date(l.timestamp).toDateString() === today
      )
      .reduce((acc, l) => acc + ((l.data as any).amount || 0), 0);
  }, [wellnessLogs, today]);

  // Latest mood logged today (from symptom entries)
  const latestMood = useMemo(() => {
    const todaySymptomLogs = wellnessLogs
      .filter(
        (l) =>
          l.type === "symptom" &&
          (l.data as any).mood != null &&
          new Date(l.timestamp).toDateString() === today
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return todaySymptomLogs.length > 0 ? Number((todaySymptomLogs[0].data as any).mood) : null;
  }, [wellnessLogs, today]);

  const waterGoal = 2000;
  const waterProgress = Math.min(100, (waterIntake / waterGoal) * 100);

  const activeMoodCfg = latestMood != null ? MOOD_OPTIONS.find((m) => m.value === latestMood) : null;

  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      {/* Water Tracker */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="bg-card border border-border/50 rounded-[2rem] p-5 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
            <Droplets size={18} />
          </div>
          <button
            onClick={() => onAddLog("food", { type: "water", amount: 250 })}
            className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-90 transition-all"
          >
            <Plus size={16} />
          </button>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
            Hydration
          </p>
          <div className="flex items-end gap-1 mb-2">
            <span className="text-xl font-black text-foreground">
              {(waterIntake / 1000).toFixed(1)}L
            </span>
            <span className="text-[10px] font-bold text-muted-foreground mb-1">/ 2.0L</span>
          </div>
          <div className="h-1.5 w-full bg-blue-500/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${waterProgress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-blue-500"
            />
          </div>
          {waterProgress >= 100 && (
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1.5">
              Goal reached! 💧
            </p>
          )}
        </div>
      </motion.div>

      {/* Mood Tracker */}
      <div className="bg-card border border-border/50 rounded-[2rem] p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div
            className={`p-2 rounded-xl w-fit ${
              activeMoodCfg ? activeMoodCfg.bg : "bg-indigo-500/10 text-indigo-500"
            }`}
          >
            {activeMoodCfg ? (
              <activeMoodCfg.icon size={18} className={activeMoodCfg.color} />
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
            return (
              <motion.button
                key={mood.value}
                whileTap={{ scale: 0.85 }}
                onClick={() => onAddLog("symptom", { mood: mood.value, energy: 3 })}
                className={`flex-1 flex items-center justify-center py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? `${mood.bg} ${mood.color} shadow-sm scale-110`
                    : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
                }`}
                title={mood.label}
              >
                <MoodIcon size={16} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
