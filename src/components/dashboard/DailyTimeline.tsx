import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Check, Clock, AlertCircle, RefreshCw } from "@/lib/icons";
import { Reminder, DoseLog } from "@/contexts/AppContext";
import confetti from "canvas-confetti";
import { toDate } from "@/lib/utils";
import { getMedicineTheme, iconMap } from "@/lib/medicineTheme";
import {
  todayAt,
  getMedicationKey,
  getLogMinutes,
  getCircularDiffMinutes,
  computeDailyTimelineSlots,
  TimelineSlotEntry,
} from "@/lib/timelineSchedule";

export {
  todayAt,
  getMedicationKey,
  getLogMinutes,
  getCircularDiffMinutes,
  computeDailyTimelineSlots,
  type TimelineSlotEntry,
};

interface DailyTimelineProps {
  reminders: Reminder[];
  doseLogs: DoseLog[];
  /** scheduledTime is the full ISO datetime for the specific slot being actioned */
  onAction: (reminder: Reminder, action: "taken" | "skipped", scheduledTime: string) => void;
}

export function DailyTimeline({ reminders, doseLogs, onAction }: DailyTimelineProps) {
  const handleActionWithConfetti = (
    e: React.MouseEvent,
    r: Reminder,
    action: "taken" | "skipped",
    scheduledISO: string
  ) => {
    if (action === "taken") {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / (window.innerWidth || 1);
      const y = (rect.top + rect.height / 2) / (window.innerHeight || 1);
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { x, y },
        colors: ["#0066cc", "#34c759", "#ff9500"],
        zIndex: 150,
      });
    }
    onAction(r, action, scheduledISO);
  };

  const { slots, overallNextSlot, activeSlotPerReminder } = useMemo(() => {
    return computeDailyTimelineSlots(reminders, doseLogs);
  }, [reminders, doseLogs]);

  return (
    <div className="mb-8 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Clock size={13} className="text-primary" />
          Daily Schedule
        </h2>
        <span className="text-[12px] font-medium text-muted-foreground bg-secondary/60 px-2.5 py-0.5 rounded-full border border-border/40">
          {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {slots.length === 0 ? (
        <div className="w-full py-8 px-4 text-center bg-gradient-to-b from-card to-card/60 rounded-[22px] border border-border/70 shadow-xs flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Clock size={18} />
          </div>
          <p className="text-[14px] font-semibold text-foreground">No reminders scheduled for today</p>
          <p className="text-[12px] text-muted-foreground">All caught up! Check back when your next dose is due.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar snap-x overscroll-x-contain">
          {slots.map((entry, index) => {
            const { reminder: r, displayTime, scheduledISO, offsetMinutes, log, slotIndex, isActioned } = entry;
            const theme = getMedicineTheme({ name: r.medicineName, id: r.id, color: r.color });
            const IconComp = iconMap[r.icon || "pill"] || Pill;

            const isTaken = log?.action === "taken";
            const isSkipped = log?.action === "skipped";
            const isMissed = log?.action === "missed";
            const hasShift = offsetMinutes !== 0 && entry.slotIndex > -1;

            const isActionable = !isActioned && activeSlotPerReminder.get(r.id) === entry;
            const isUpcoming = !isActioned && !isActionable;
            const isNextDose = !isActioned && entry === overallNextSlot;

            return (
              <motion.div
                key={`${r.id}-${slotIndex}`}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`flex-shrink-0 w-48 snap-start rounded-[22px] p-4 border transition-all relative overflow-hidden shadow-xs ${
                  isNextDose
                    ? `bg-card ${theme.border} ring-2 ring-primary/60 shadow-lg shadow-primary/10`
                    : isActionable
                      ? `bg-card ${theme.border} hover:border-primary/60 hover:shadow-md`
                      : isTaken
                        ? "bg-muted/40 border-border/60 opacity-75"
                        : isActioned
                          ? "bg-muted/30 border-border/50 opacity-65"
                          : `bg-card ${theme.border} hover:shadow-md`
                }`}
              >
                {/* Ambient theme glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGlow} pointer-events-none opacity-60`} />

                {/* Left accent bar */}
                <div
                  className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                    isTaken ? "bg-emerald-500" : isMissed ? "bg-rose-500" : isSkipped ? "bg-muted-foreground/40" : theme.accentBar
                  }`}
                />

                <div className="relative z-10 flex flex-col gap-3 h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isTaken
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : isMissed
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            : isSkipped
                              ? "bg-muted text-muted-foreground border border-border/50"
                              : `bg-gradient-to-br ${theme.gradient} text-white shadow-sm border border-white/20`
                      }`}>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={isTaken ? "check" : isMissed ? "missed" : isSkipped ? "skipped" : "pill"}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            {isTaken ? (
                              <Check size={15} />
                            ) : isMissed || isSkipped ? (
                              <AlertCircle size={15} />
                            ) : (
                              <IconComp className="size-4 text-white" />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {isNextDose && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-xs animate-pulse">
                          Next
                        </span>
                      )}
                    </div>

                    {/* Time display with shift badge */}
                    <div className="flex items-center gap-1 flex-wrap mb-1">
                      <p className={`text-[13px] font-semibold tracking-tight ${
                        isActionable ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {displayTime}
                      </p>
                      {hasShift && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-normal px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <RefreshCw size={8} />
                          {offsetMinutes > 0 ? "+" : ""}{offsetMinutes}m
                        </span>
                      )}
                    </div>

                    {r.patientName && (
                      <span className="inline-block text-[10px] text-muted-foreground truncate max-w-full mb-0.5">
                        {r.patientName}
                      </span>
                    )}

                    <h3 className="text-[14px] font-medium text-foreground leading-tight line-clamp-1">
                      {r.medicineName}
                    </h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {r.dose}
                    </p>
                  </div>

                  {isActionable ? (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={(e) => handleActionWithConfetti(e, r, "taken", scheduledISO)}
                        className="flex-1 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:brightness-105 active:scale-95 transition-all"
                        title="Take dose"
                        aria-label="Take dose"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => onAction(r, "skipped", scheduledISO)}
                        className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all"
                        title="Mark skipped"
                        aria-label="Mark skipped"
                      >
                        <AlertCircle size={14} />
                      </button>
                    </div>
                  ) : isUpcoming ? (
                    <div className="pt-2">
                      <div className="h-8 rounded-full bg-muted border border-border flex items-center justify-center gap-1.5 text-muted-foreground">
                        <Clock size={11} />
                        <span className="text-[11px] font-normal">Upcoming</span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-center">
                      <span className={`text-[11px] font-medium ${
                        isTaken ? "text-success" : isSkipped ? "text-muted-foreground" : "text-destructive"
                      }`}>
                        {isTaken ? "Taken" : isSkipped ? "Skipped" : "Missed"}
                      </span>
                      {log && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {toDate(log.actionTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
