import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle2 } from "@/lib/icons";
import { usePatientScope } from "@/hooks/usePatientScope";
import { isReminderScheduledOnDate } from "@/services/reminderService";
import { parseReminderTimes } from "@/lib/dynamicSchedule";
import { useTranslation } from "react-i18next";

export function RemindersWidget() {
  const { t } = useTranslation();
  const { scopedReminders, scopedDoseLogs } = usePatientScope();

  const now = useMemo(() => new Date(), []);
  const todayStr = now.toDateString();

  const todayReminders = useMemo(() => {
    return scopedReminders.filter((r) => isReminderScheduledOnDate(r, now, scopedDoseLogs));
  }, [scopedReminders, scopedDoseLogs, now]);

  const activeReminders = scopedReminders.filter((r) => r.enabled);
  const nextReminder = todayReminders.sort((a, b) => a.time.localeCompare(b.time))[0];

  const totalPlannedDoses = useMemo(() => {
    return todayReminders.reduce((acc, r) => acc + parseReminderTimes(r.time).length, 0);
  }, [todayReminders]);

  const todayLogs = scopedDoseLogs.filter(
    (l) => l.action === "taken" && new Date(l.actionTime).toDateString() === todayStr
  );
  const adherenceRate =
    totalPlannedDoses > 0
      ? Math.round((todayLogs.length / totalPlannedDoses) * 100)
      : todayLogs.length > 0
      ? 100
      : 100;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Schedule Overview</h4>
          <Clock size={14} className="text-primary" />
        </div>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
               <span className="text-lg font-black text-primary">{activeReminders.length}</span>
            </div>
            <div>
              <p className="text-[12px] font-black text-foreground uppercase tracking-tight">Active Reminders</p>
              {nextReminder ? (
                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">
                  Next: {nextReminder.time}
                </p>
              ) : (
                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">
                  Schedule clear
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Daily Adherence</h4>
          <CheckCircle2 size={14} className="text-success" />
        </div>
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-background/40 backdrop-blur-sm rounded-[2rem] p-6 border border-border/50 shadow-sm relative overflow-hidden group"
        >
          <div className="flex items-center gap-6">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-muted/10" />
                <motion.circle 
                  cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" 
                  strokeDasharray={2 * Math.PI * 28}
                  initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - Math.min(adherenceRate, 100) / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-primary shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[12px] font-black">{Math.min(adherenceRate, 100)}%</span>
            </div>
            <div>
              <p className="text-[11px] font-black text-foreground uppercase tracking-tight">Target Met</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 mt-1">{todayLogs.length} / {totalPlannedDoses} Doses Taken</p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
