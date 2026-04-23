import React from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

export function DashboardWidget() {
  const { t } = useTranslation();
  const { reminders, doseLogs } = useApp();

  const nextReminder = reminders
    .filter(r => r.enabled)
    .sort((a, b) => a.time.localeCompare(b.time))[0];

  const today = new Date().toDateString();
  const takenCount = doseLogs.filter(l => 
    l.action === "taken" && new Date(l.actionTime).toDateString() === today
  ).length;

  return (
    <div className="space-y-8">
      {/* Next Dose Countdown */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("Intelligence.next_dose")}</h4>
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-primary/5 backdrop-blur-md border border-primary/20 rounded-[2rem] p-6 relative overflow-hidden group shadow-sm hover:shadow-primary/5 transition-all"
        >
          <div className="z-10 relative">
            {nextReminder ? (
              <>
                <div className="flex items-baseline gap-2">
                   <p className="text-3xl font-black tracking-tighter text-foreground">{nextReminder.time}</p>
                   <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Upcoming</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                   <Clock size={12} className="text-muted-foreground" />
                   <p className="text-[11px] font-black text-muted-foreground uppercase tracking-tight">{nextReminder.medicineName} • {nextReminder.dose}</p>
                </div>
              </>
            ) : (
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("Intelligence.no_reminders")}</p>
            )}
          </div>
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1], 
              opacity: [0.2, 0.4, 0.2],
              x: [0, 10, 0]
            }}
            transition={{ duration: 6, repeat: Infinity }}
            className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"
          />
        </motion.div>
      </section>

      {/* Adherence Insight */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("Intelligence.adherence_streak")}</h4>
          <TrendingUp size={14} className="text-success" />
        </div>
        <div className="flex gap-1.5 justify-between">
          {[...Array(7)].map((_, i) => (
            <motion.div 
              key={i} 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`h-10 flex-1 rounded-xl border-2 shadow-sm ${
                i < 5 
                  ? "bg-success/10 border-success/30 ring-4 ring-success/5" 
                  : "bg-muted/20 border-border/50"
              }`} 
            />
          ))}
        </div>
        <motion.div 
          whileHover={{ y: -2 }}
          className="mt-6 bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-5 flex items-start gap-4 shadow-sm"
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
             <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[11px] leading-relaxed text-foreground/80 font-medium italic">
              "You are <span className="text-primary font-black">20% more likely</span> to maintain your streak when logging early in the morning."
            </p>
          </div>
        </motion.div>
      </section>
    </div>

  );
}
