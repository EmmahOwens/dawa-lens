import React, { useMemo } from "react";
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

  const { overallNextSlot } = useMemo(() => {
    return computeDailyTimelineSlots(scopedReminders, scopedDoseLogs);
  }, [scopedReminders, scopedDoseLogs]);

  const hasReminders = scopedReminders.some((r) => r.enabled);
  const nowMs = new Date().getTime();
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
          whileHover={{ scale: 1.01 }}
          className="bg-primary/5 backdrop-blur-md border border-primary/20 rounded-[2rem] p-6 relative overflow-hidden group shadow-sm hover:shadow-primary/5 transition-all"
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
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-primary/10">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => handleActionWithConfetti(e, overallNextSlot.reminder, "taken", overallNextSlot.scheduledISO)}
                    className="flex-1 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-1.5 text-[11px] font-bold shadow-sm hover:bg-primary/90 transition-colors"
                    title="Take dose"
                    aria-label="Take dose"
                  >
                    <Check size={14} />
                    <span>Take Dose</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAction(overallNextSlot.reminder, "skipped", overallNextSlot.scheduledISO)}
                    className="h-8 px-3 rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors border border-border/40"
                    title="Skip dose"
                    aria-label="Skip dose"
                  >
                    <AlertCircle size={14} />
                    <span>Skip</span>
                  </motion.button>
                </div>
              </>
            ) : hasReminders ? (
              <div className="flex items-center gap-3 py-1">
                <div className="w-9 h-9 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center text-success shrink-0">
                  <Check size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-foreground">All Doses Complete</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                    All scheduled doses completed for today
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No Reminders</p>
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
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">7-Day Streak</h4>
          <TrendingUp size={14} className="text-success" />
        </div>
        <div className="flex gap-1.5 justify-between">
          {dailyStatus.map((item, i) => (
            <motion.div 
              key={i} 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`h-10 flex-1 rounded-xl border-2 shadow-sm flex items-center justify-center text-[11px] font-black uppercase transition-all duration-300 ${
                item.status === "success"
                  ? "bg-success/10 border-success/30 ring-4 ring-success/5 text-success" 
                  : item.status === "missed"
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "bg-muted/20 border-border/50 text-muted-foreground/40"
              }`} 
            >
              {item.letter}
            </motion.div>
          ))}
        </div>
        
        <motion.div 
          whileHover={{ y: -2 }}
          className="mt-6 bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-5 flex items-start gap-4 shadow-sm min-h-[80px]"
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
             <Sparkles size={16} className="text-primary" />
          </div>
          <div className="flex-1">
            {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Analyzing logs...</span>
                </div>
            ) : insight ? (
                <div className="text-[11px] leading-relaxed text-foreground/80 font-medium">
                  <MessageRenderer
                    text={insight}
                    className="text-[11px] leading-relaxed [&_strong]:text-primary"
                  />
                </div>
            ) : (
                <p className="text-[11px] leading-relaxed text-foreground/80 font-medium italic">
                  Log your doses consistently to build your streak and receive personalized health insights.
                </p>
            )}
          </div>
        </motion.div>

        {nutritionalTip && (
          <motion.div 
            whileHover={{ y: -2 }}
            className="mt-3 bg-primary/5 border border-primary/20 rounded-[1.5rem] p-4 flex items-start gap-3 shadow-sm"
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
               <Salad size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <MessageRenderer text={nutritionalTip} className="text-[10px] leading-relaxed text-foreground/80" />
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
}
