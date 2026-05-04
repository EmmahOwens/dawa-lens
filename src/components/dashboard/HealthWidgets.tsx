import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Droplets, Smile, Meh, Frown, Plus } from "lucide-react";
import { WellnessLog } from "@/contexts/AppContext";

interface HealthWidgetsProps {
  wellnessLogs: WellnessLog[];
  onAddLog: (type: "food" | "symptom", data: any) => void;
}

export function HealthWidgets({ wellnessLogs, onAddLog }: HealthWidgetsProps) {
  const today = new Date().toDateString();
  
  // Calculate water intake for today
  const waterIntake = useMemo(() => {
    return wellnessLogs
      .filter(l => l.type === "food" && (l.data as any).type === "water" && new Date(l.timestamp).toDateString() === today)
      .reduce((acc, l) => acc + ((l.data as any).amount || 0), 0);
  }, [wellnessLogs, today]);

  const waterGoal = 2000; // 2L goal
  const waterProgress = Math.min(100, (waterIntake / waterGoal) * 100);

  const moodEmojis = [
    { value: 1, icon: Frown, color: "text-destructive", label: "Bad" },
    { value: 3, icon: Meh, color: "text-warning", label: "Okay" },
    { value: 5, icon: Smile, color: "text-success", label: "Good" },
  ];

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
            className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} />
          </button>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Hydration</p>
          <div className="flex items-end gap-1 mb-2">
            <span className="text-xl font-black text-foreground">{(waterIntake / 1000).toFixed(1)}L</span>
            <span className="text-[10px] font-bold text-muted-foreground mb-1">/ 2.0L</span>
          </div>
          <div className="h-1.5 w-full bg-blue-500/10 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${waterProgress}%` }}
               className="h-full bg-blue-500"
             />
          </div>
        </div>
      </motion.div>

      {/* Mood Tracker */}
      <div className="bg-card border border-border/50 rounded-[2rem] p-5 shadow-sm">
        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl w-fit mb-3">
           <Smile size={18} />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Daily Mood</p>
        <div className="flex justify-between items-center bg-muted/30 p-2 rounded-2xl">
          {moodEmojis.map((mood) => (
            <button
              key={mood.label}
              onClick={() => onAddLog("symptom", { mood: mood.value })}
              className={`p-2 rounded-xl hover:bg-white transition-colors active:scale-90 ${mood.color}`}
            >
              <mood.icon size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
