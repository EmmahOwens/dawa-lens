import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import MessageRenderer from "@/components/MessageRenderer";
import { Clock, TrendingUp, Sparkles, Loader2, Salad, Check, AlertCircle, RefreshCw } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { useIntelligenceContext } from "@/hooks/useIntelligenceContext";
import { computeDailyTimelineSlots } from "@/lib/timelineSchedule";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Reminder } from "@/contexts/AppContext";

export function DashboardWidget() {
  const { logDose } = useApp();
  const { scopedReminders, scopedDoseLogs } = usePatientScope();
  const { insight, nutritionalTip, isLoading } = useIntelligenceContext();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { overallNextSlot, slots } = useMemo(() => {
    return computeDailyTimelineSlots(scopedReminders, scopedDoseLogs, now);
  }, [scopedReminders, scopedDoseLogs, now]);

  const hasReminders = scopedReminders.some((r) => r.enabled);
  const hasScheduledDosesToday = slots.length > 0;
  const nowMs = now.getTime();
  const isOverdue = overallNextSlot ? overallNextSlot.scheduledDate.getTime() <= nowMs : false;

  const handleAction = async (
    reminder: Reminder,
    action: "taken" | "skipped",
    scheduledTime: string
  ) => {
    try {
      await logDose({
        reminderId: reminder.id,
        medicineName: reminder.medicineName,
        dose: reminder.dose,
        scheduledTime,
        action,
      });
      toast.success(action === "taken" ? "Dose logged!" : "Dose skipped.");
    } catch {
      toast.error("Failed to update dose");
    }
  };

  const handleActionWithConfetti = (
    e: React.MouseEvent,
    reminder: Reminder,
    action: "taken" | "skipped",
    scheduledISO: string
  ) => {
    if (action === "taken") {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / (window.innerWidth || 1);
      const y = (rect.top + rect.height / 2) / (window.innerHeight || 1);
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { x, y },
        colors: ["#3b82f6", "#10b981", "#8b5cf6", "#e05c30"],
        zIndex: 150,
      });
    }
    handleAction(reminder, action, scheduledISO);
  };

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateStr: d.toDateString(),
      letter: d.toDateString()[0], // First letter of the day (e.g. 'M', 'T', 'W', etc.)
    };
  });

  const dailyStatus = last7Days.map(({ dateStr, letter }) => {
    const logsForDay = scopedDoseLogs.filter(l => new Date(l.actionTime).toDateString() === dateStr);
    let status: "success" | "missed" | "none" = "none";
    if (logsForDay.length > 0) {
      const takenLogs = logsForDay.filter(l => l.action === "taken");
      status = takenLogs.length > 0 ? "success" : "missed";
    }
    return { status, letter };
  });

  return (
    <div className="space-y-8">
      {/* Next Dose Countdown */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Next Dose</h4>
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        <motion.div 
          className="bg-card border border-border rounded-[18px] p-5 relative overflow-hidden transition-colors shadow-xs"
        >
          <div className="z-10 relative">
            {overallNextSlot ? (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black tracking-tighter text-foreground">{overallNextSlot.displayTime}</p>
                    {overallNextSlot.offsetMinutes !== 0 && (
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        overallNextSlot.offsetMinutes > 0
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      }`}>
                        <RefreshCw size={8} />
                        {overallNextSlot.offsetMinutes > 0 ? "+" : ""}{overallNextSlot.offsetMinutes}m
                      </span>
                    )}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    isOverdue
                      ? "bg-destructive/15 text-destructive border border-destructive/20"
                      : "bg-primary text-primary-foreground shadow-xs"
                  }`}>
                    {isOverdue ? "Overdue" : "Next Dose"}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Clock size={12} className="text-muted-foreground shrink-0" />
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-tight truncate">
                    {overallNextSlot.reminder.medicineName} • {overallNextSlot.reminder.dose}
                  </p>
                </div>

                {overallNextSlot.reminder.patientName && (
                  <span className="inline-block text-[9px] font-bold text-primary/80 truncate max-w-full mt-0.5">
                    For {overallNextSlot.reminder.patientName}
                  </span>
                )}

                {/* Quick Actions (Take / Skip) */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => handleActionWithConfetti(e, overallNextSlot.reminder, "taken", overallNextSlot.scheduledISO)}
                    className="flex-1 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-primary/90 transition-all active:scale-95"
                    title="Take dose"
                    aria-label="Take dose"
                  >
                    <Check size={14} />
                    <span>Take Dose</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAction(overallNextSlot.reminder, "skipped", overallNextSlot.scheduledISO)}
                    className="h-9 px-4 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center gap-1 text-xs font-semibold transition-all border border-border active:scale-95"
                    title="Skip dose"
                    aria-label="Skip dose"
                  >
                    <AlertCircle size={14} />
                    <span>Skip</span>
                  </motion.button>
                </div>
              </>
            ) : hasScheduledDosesToday ? (
              <div className="flex items-center gap-3 py-1">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">All Doses Complete</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    All scheduled doses completed for today
                  </p>
                </div>
              </div>
            ) : hasReminders ? (
              <div className="flex items-center gap-3 py-1">
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">No Doses Today</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    No medication doses scheduled for today
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-1">
                <div className="w-9 h-9 rounded-full bg-muted/40 border border-border flex items-center justify-center text-muted-foreground shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">No Reminders</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    No active medication reminders
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Adherence Insight */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">7-Day Streak</h4>
          <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex gap-1.5 justify-between">
          {dailyStatus.map((item, i) => (
            <motion.div 
              key={i} 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`h-9 flex-1 rounded-[10px] border flex items-center justify-center text-[11px] font-bold uppercase transition-all duration-300 ${
                item.status === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                  : item.status === "missed"
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "bg-muted/30 border-border text-muted-foreground/50"
              }`} 
            >
              {item.letter}
            </motion.div>
          ))}
        </div>
        
        <div 
          className="mt-5 bg-card border border-border rounded-[18px] p-4 flex items-start gap-3.5 shadow-xs"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
             <Sparkles size={16} />
          </div>
          <div className="flex-1">
            {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Analyzing logs...</span>
                </div>
            ) : insight ? (
                <div className="text-[11px] leading-relaxed text-foreground font-medium">
                  <MessageRenderer
                    text={insight}
                    className="text-[11px] leading-relaxed [&_strong]:text-primary"
                  />
                </div>
            ) : (
                <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                  Log your doses consistently to build your streak and receive personalized health insights.
                </p>
            )}
          </div>
        </div>

        {nutritionalTip && (
          <div 
            className="mt-3 bg-card border border-border rounded-[18px] p-4 flex items-start gap-3 shadow-xs"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary">
               <Salad size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <MessageRenderer text={nutritionalTip} className="text-[11px] leading-relaxed text-foreground" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
