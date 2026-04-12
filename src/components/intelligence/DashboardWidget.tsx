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
    <div className="space-y-6">
      {/* Next Dose Countdown */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Intelligence.next_dose")}</h4>
          <Clock size={12} className="text-primary" />
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-3xl p-5 relative overflow-hidden group"
        >
          <div className="z-10 relative">
            {nextReminder ? (
              <>
                <p className="text-xl font-black tracking-tight text-foreground">{nextReminder.time}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{nextReminder.medicineName} • {nextReminder.dose}</p>
              </>
            ) : (
              <p className="text-xs font-bold text-muted-foreground uppercase">{t("Intelligence.no_reminders")}</p>
            )}
          </div>
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-primary/10 rounded-full blur-2xl"
          />
        </motion.div>
      </section>

      {/* Adherence Insight */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Intelligence.adherence_streak")}</h4>
          <TrendingUp size={12} className="text-success" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`h-8 rounded-lg border ${i < 5 ? "bg-success/20 border-success/30" : "bg-muted/30 border-border"}`} />
          ))}
        </div>
        <div className="mt-3 bg-card border border-border rounded-2xl p-4 flex items-start gap-2">
          <Sparkles size={14} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed text-muted-foreground font-medium italic">
            "You are 20% more likely to maintain your streak when logging early in the morning."
          </p>
        </div>
      </section>
    </div>
  );
}
