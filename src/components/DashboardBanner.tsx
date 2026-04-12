import React from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

export function DashboardBanner() {
  const { doseLogs, reminders, userProfile } = useApp();
  const { t } = useTranslation();

  // Basic stats calculation
  const today = new Date().toDateString();
  const takenToday = doseLogs.filter(
    (l) => l.action === "taken" && new Date(l.actionTime).toDateString() === today
  ).length;
  
  const totalDueToday = reminders.filter(r => r.enabled).length;
  const adherencePercent = totalDueToday > 0 ? Math.round((takenToday / totalDueToday) * 100) : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative mb-10 overflow-hidden rounded-[2.5rem] bg-white/40 dark:bg-black/10 border border-white/60 dark:border-white/10 p-8 backdrop-blur-2xl shadow-xl shadow-primary/5 group"
    >
      {/* Calm background shapes */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          x: [0, 10, 0],
          y: [0, -10, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: "hsla(158, 64%, 88%, 0.4)" }}
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, -15, 0],
          y: [0, 15, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: "hsla(261, 71%, 88%, 0.4)" }}
        className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-white/80 dark:bg-white/5 shadow-sm">
              <Sparkles size={16} className="text-primary/70" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Wellness Pulse</span>
          </div>
          
          <h2 className="text-2xl font-black text-foreground max-w-sm leading-tight tracking-tight">
            Consistency is your <span className="text-primary/80">greatest strength</span>, {userProfile?.name?.split(" ")[0] || "friend"}.
          </h2>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">7-Day Consistency</span>
              <div className="flex items-center gap-2 mt-1">
                <TrendingUp size={14} className="text-success" />
                <span className="text-lg font-black text-foreground">{adherencePercent}%</span>
              </div>
            </div>
            <div className="w-[1px] h-8 bg-border/40" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Success Streak</span>
              <div className="flex items-center gap-2 mt-1">
                <Calendar size={14} className="text-primary/60" />
                <span className="text-lg font-black text-foreground">12 Days</span>
              </div>
            </div>
          </div>
        </div>

        <button className="self-start md:self-center group/btn flex items-center gap-3 bg-white/80 dark:bg-white/5 border border-white/60 dark:border-white/10 px-6 py-3 rounded-full shadow-lg shadow-black/5 hover:bg-white dark:hover:bg-white/10 transition-all active:scale-95">
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Detailed Report</span>
          <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}
