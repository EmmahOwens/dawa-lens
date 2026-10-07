import React, { useMemo } from "react";
import { Clock, CheckCircle2 } from "@/lib/icons";
import { usePatientScope } from "@/hooks/usePatientScope";
import { isReminderScheduledOnDate } from "@/services/reminderService";
import { parseReminderTimes } from "@/lib/dynamicSchedule";
import { computeDailyTimelineSlots } from "@/lib/timelineSchedule";

export function RemindersWidget() {
  const { scopedReminders, scopedDoseLogs } = usePatientScope();

  const now = useMemo(() => new Date(), []);
  const todayStr = now.toDateString();

  const todayReminders = useMemo(() => {
    return scopedReminders.filter((r) => isReminderScheduledOnDate(r, now, scopedDoseLogs));
  }, [scopedReminders, scopedDoseLogs, now]);

  const activeReminders = scopedReminders.filter((r) => r.enabled);
  const { overallNextSlot } = useMemo(() => {
    return computeDailyTimelineSlots(scopedReminders, scopedDoseLogs);
  }, [scopedReminders, scopedDoseLogs]);

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
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule Overview</h4>
          <Clock size={14} className="text-primary" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-primary">
               <span className="text-base font-semibold">{activeReminders.length}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground tracking-tight">Active Reminders</p>
              {overallNextSlot ? (
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5 flex items-center gap-1">
                  <span>Next: {overallNextSlot.displayTime}</span>
                  {overallNextSlot.offsetMinutes !== 0 && (
                    <span className="text-primary font-semibold">
                      ({overallNextSlot.offsetMinutes > 0 ? "+" : ""}{overallNextSlot.offsetMinutes}m)
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  Schedule clear
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Daily Adherence</h4>
          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs">
          <div className="flex items-center gap-5">
            <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r="23" fill="transparent" stroke="currentColor" strokeWidth="5" className="text-muted" />
                <circle 
                  cx="28" cy="28" r="23" fill="transparent" stroke="currentColor" strokeWidth="5" 
                  strokeDasharray={2 * Math.PI * 23}
                  strokeDashoffset={2 * Math.PI * 23 * (1 - Math.min(adherenceRate, 100) / 100)}
                  className="text-primary transition-all duration-1000 ease-out" 
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-semibold">{Math.min(adherenceRate, 100)}%</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground tracking-tight">Daily Target Met</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{todayLogs.length} of {totalPlannedDoses} doses logged</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
