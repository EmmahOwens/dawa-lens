import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

export function DashboardBanner() {
  const navigate = useNavigate();
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative mb-10 premium-card overflow-hidden group"
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
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles size={14} className="text-primary" />
            </div>
            <span className="section-title mb-0">Wellness Pulse</span>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground max-w-sm leading-tight tracking-tight">
            Consistency is your <span className="text-primary italic">greatest strength</span>, {userProfile?.name?.split(" ")[0] || "friend"}.
          </h2>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">7-Day Consistency</span>
              <div className="flex items-center gap-2 mt-1">
                <TrendingUp size={16} className="text-success" />
                <span className="text-xl font-bold text-foreground tracking-tight">{adherencePercent}%</span>
              </div>
            </div>
            <div className="w-[1px] h-8 bg-border" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Success Streak</span>
              <div className="flex items-center gap-2 mt-1">
                <Calendar size={16} className="text-primary" />
                <span className="text-xl font-bold text-foreground tracking-tight">12 Days</span>
              </div>
            </div>
          </div>
        </div>


        <button 
          onClick={() => navigate('/report')}
          className="self-start md:self-center group/btn flex items-center gap-3 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
        >
          <span className="text-xs font-bold uppercase tracking-wider">Detailed Report</span>
          <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}
