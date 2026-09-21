import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Check, Clock, AlertCircle, RefreshCw } from "@/lib/icons";
import { Reminder, DoseLog } from "@/contexts/AppContext";
import confetti from "canvas-confetti";
import { toDate } from "@/lib/utils";
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
        particleCount: 30,
        spread: 60,
        origin: { x, y },
        colors: ["#3b82f6", "#10b981", "#8b5cf6", "#e05c30"],
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Clock size={14} />
          Daily Timeline
        </h2>
        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
          {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {slots.length === 0 ? (
        <div className="w-full py-8 text-center bg-muted/20 rounded-3xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No reminders for today!</p>
        </div>
      ) : (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 no-scrollbar snap-x overscroll-x-contain">
          {slots.map((entry, index) => {
            const { reminder: r, displayTime, scheduledISO, offsetMinutes, log, slotIndex, isActioned } = entry;
            const isTaken = log?.action === "taken";
            const isSkipped = log?.action === "skipped";
            const isMissed = log?.action === "missed";
            const hasShift = offsetMinutes !== 0 && entry.slotIndex > -1;

            // Actionable if this is the next pending dose for this reminder's queue
            const isActionable = !isActioned && activeSlotPerReminder.get(r.id) === entry;
            // Upcoming if this is a subsequent dose of the SAME reminder queue that still has an earlier pending dose
            const isUpcoming = !isActioned && !isActionable;
            // The single overall next dose in chronological time gets the featured "Next Dose" badge
            const isNextDose = !isActioned && entry === overallNextSlot;

            return (
              <motion.div
                key={`${r.id}-${slotIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex-shrink-0 w-44 snap-start rounded-[2rem] p-5 border transition-all relative ${
                  isNextDose
                    ? "bg-card border-primary/50 ring-1 ring-primary/30 shadow-md"
                    : isActionable
                      ? "bg-card border-primary/30 shadow-sm"
                      : isTaken
                        ? "bg-success/5 border-success/20 opacity-60"
                        : isActioned
                          ? "bg-muted/50 border-border opacity-50"
                          : "bg-card/70 border-border opacity-90 shadow-none"
                }`}
              >
                <div className="flex flex-col gap-3.5 h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                        isTaken
                          ? "bg-success/20 text-success"
                          : isMissed
                            ? "bg-destructive/20 text-destructive"
                            : isSkipped
                              ? "bg-muted text-muted-foreground border border-border"
                              : isActionable
                                ? "bg-primary/20 text-primary shadow-sm"
                                : "bg-muted text-muted-foreground"
                      }`}>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={isTaken ? "check" : isMissed ? "missed" : isSkipped ? "skipped" : "pill"}
                            initial={{ scale: 0.8, rotate: -45, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            exit={{ scale: 0.8, rotate: 45, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {isTaken ? (
                              <Check size={20} />
                            ) : isMissed || isSkipped ? (
                              <AlertCircle size={20} />
                            ) : (
                              <Pill size={20} />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {isNextDose && (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-sm">
                          Next Dose
                        </span>
                      )}
                    </div>

                    {/* Time display with shift badge */}
                    <div className="flex items-center gap-1 flex-wrap mb-0.5">
                      <p className={`text-xs font-bold uppercase tracking-widest leading-none ${
                        isActionable ? "text-primary font-black" : "text-muted-foreground"
                      }`}>
                        {displayTime}
                      </p>
                      {hasShift && (
                        <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1 py-0.5 rounded-full ${
                          offsetMinutes > 0
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-blue-500/10 text-blue-500"
                        }`}>
                          <RefreshCw size={7} />
                          {offsetMinutes > 0 ? "+" : ""}{offsetMinutes}m
                        </span>
                      )}
                    </div>

                    {r.patientName && (
                      <span className="inline-block text-[9px] font-bold text-primary/80 truncate max-w-full mb-0.5">
                        For {r.patientName}
                      </span>
                    )}

                    <h3 className="text-sm font-black text-foreground leading-tight line-clamp-1">
                      {r.medicineName}
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                      {r.dose}
                    </p>
                  </div>

                  {isActionable ? (
                    <div className="flex gap-2 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={(e) => handleActionWithConfetti(e, r, "taken", scheduledISO)}
                        className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
                        title="Take dose"
                        aria-label="Take dose"
                      >
                        <Check size={16} strokeWidth={3} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => onAction(r, "skipped", scheduledISO)}
                        className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                        title="Mark missed or skipped"
                        aria-label="Mark missed or skipped"
                      >
                        <AlertCircle size={16} />
                      </motion.button>
                    </div>
                  ) : isUpcoming ? (
                    <div className="pt-2">
                      <div className="h-9 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-center gap-1.5 text-muted-foreground">
                        <Clock size={11} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Upcoming</span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        isTaken ? "text-success" : isSkipped ? "text-muted-foreground" : "text-destructive"
                      }`}>
                        {isTaken ? "Done" : isSkipped ? "Skipped" : "Missed"}
                      </span>
                      {log && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          @ {toDate(log.actionTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
