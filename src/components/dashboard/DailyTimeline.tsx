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
          <Clock size={13} />
          Daily Schedule
        </h2>
        <span className="text-[12px] font-normal text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {slots.length === 0 ? (
        <div className="w-full py-8 text-center bg-card rounded-[18px] border border-border">
          <p className="text-[14px] text-muted-foreground">No reminders scheduled for today</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar snap-x overscroll-x-contain">
          {slots.map((entry, index) => {
            const { reminder: r, displayTime, scheduledISO, offsetMinutes, log, slotIndex, isActioned } = entry;
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
                className={`flex-shrink-0 w-44 snap-start rounded-[18px] p-4 border transition-all relative ${
                  isNextDose
                    ? "bg-card border-primary ring-1 ring-primary/40"
                    : isActionable
                      ? "bg-card border-primary/40"
                      : isTaken
                        ? "bg-muted/40 border-border opacity-70"
                        : isActioned
                          ? "bg-muted/30 border-border opacity-60"
                          : "bg-card border-border"
                }`}
              >
                <div className="flex flex-col gap-3 h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isTaken
                          ? "bg-success/15 text-success"
                          : isMissed
                            ? "bg-destructive/15 text-destructive"
                            : isSkipped
                              ? "bg-muted text-muted-foreground"
                              : isActionable
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
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
                              <Check size={16} />
                            ) : isMissed || isSkipped ? (
                              <AlertCircle size={16} />
                            ) : (
                              <Pill size={16} />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {isNextDose && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
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
