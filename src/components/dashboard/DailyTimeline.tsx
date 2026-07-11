import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Check, Clock, AlertCircle, RefreshCw } from "@/lib/icons";
import { Reminder, DoseLog } from "@/contexts/AppContext";
import { computeShiftOffset } from "@/services/reminderService";
import confetti from "canvas-confetti";
import { toDate } from "@/lib/utils";

interface DailyTimelineProps {
  reminders: Reminder[];
  doseLogs: DoseLog[];
  /** scheduledTime is the full ISO datetime for the specific slot being actioned */
  onAction: (reminder: Reminder, action: "taken" | "skipped", scheduledTime: string) => void;
}

/** Shift a "HH:mm" base time by offsetMinutes and return the display string. */
function shiftHHmm(base: string, offsetMinutes: number): string {
  const [h, m] = base.split(":").map(Number);
  const total = ((h * 60 + m + offsetMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

/** Build the ISO datetime for today at HH:mm */
function todayAt(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
}

export function DailyTimeline({ reminders, doseLogs, onAction }: DailyTimelineProps) {
  const today = new Date().toDateString();

  const handleActionWithConfetti = (
    e: React.MouseEvent,
    r: Reminder,
    action: "taken" | "skipped",
    scheduledISO: string
  ) => {
    if (action === "taken") {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;
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

  // Expand each reminder into individual (reminder, slotIndex, slotTime) entries
  // so the user can log each dose independently
  type SlotEntry = {
    reminder: Reminder;
    slotIndex: number;
    baseTime: string;       // original HH:mm from reminder.time
    displayTime: string;    // effective time (shifted if applicable)
    scheduledISO: string;   // ISO datetime to store in the dose log
    offsetMinutes: number;
    log: DoseLog | undefined;
  };

  const slots: SlotEntry[] = [];

  const activeReminders = [...reminders]
    .filter(r => r.enabled)
    .sort((a, b) => a.time.localeCompare(b.time));

  activeReminders.forEach(r => {
    const times = r.time
      .split(",")
      .map((t) => t.trim())
      .filter((t) => {
        const parts = t.split(":");
        if (parts.length !== 2) return false;
        const [h, m] = parts.map(Number);
        return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
      });
    const offsetMinutes = computeShiftOffset(r, doseLogs);

    // Determine taken slot index from today's logs
    let takenSlotIndex = -1;
    const todayTakenLog = [...doseLogs]
      .filter(l =>
        l.reminderId === r.id &&
        l.action === "taken" &&
        new Date(l.actionTime).toDateString() === today
      )
      .sort((a, b) => new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime())[0];

    if (todayTakenLog && offsetMinutes !== 0) {
      const sd = new Date(todayTakenLog.scheduledTime);
      const ts = `${sd.getHours().toString().padStart(2, "0")}:${sd.getMinutes().toString().padStart(2, "0")}`;
      takenSlotIndex = times.indexOf(ts);
      if (takenSlotIndex === -1) {
        const sm = sd.getHours() * 60 + sd.getMinutes();
        let minD = Infinity;
        times.forEach((t, i) => {
          const [hh, mm] = t.split(":").map(Number);
          const d = Math.abs(hh * 60 + mm - sm);
          if (d < minD) { minD = d; takenSlotIndex = i; }
        });
      }
    }

    times.forEach((baseTime, idx) => {
      // Effective display time: apply offset to slots after the taken one
      const displayTime =
        offsetMinutes !== 0 && idx > takenSlotIndex
          ? shiftHHmm(baseTime, offsetMinutes)
          : baseTime;

      // Scheduled ISO: for shifted slots use the shifted datetime, for unshifted use base
      const scheduledISO =
        offsetMinutes !== 0 && idx > takenSlotIndex
          ? shiftHHmm(baseTime, offsetMinutes).replace(/(\d{2}):(\d{2})/, (_, h, m) => {
              const d = new Date();
              return new Date(d.getFullYear(), d.getMonth(), d.getDate(), +h, +m, 0, 0).toISOString();
            })
          : todayAt(baseTime).toISOString();

      // Find if this specific slot has already been logged today
      const slotISO = todayAt(baseTime).toISOString();
      // Match against both original AND shifted ISO (handles both first and subsequent logs)
      const shiftedISO = offsetMinutes !== 0 && idx > takenSlotIndex
        ? (() => {
            const [h, m] = displayTime.split(":").map(Number);
            const d = new Date();
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).toISOString();
          })()
        : slotISO;

      const log = doseLogs.find(l =>
        l.reminderId === r.id &&
        new Date(l.actionTime).toDateString() === today &&
        (l.scheduledTime === slotISO || l.scheduledTime === shiftedISO)
      );

      slots.push({ reminder: r, slotIndex: idx, baseTime, displayTime, scheduledISO: shiftedISO, offsetMinutes, log });
    });
  });

  // Sort slots by effective display time
  slots.sort((a, b) => a.displayTime.localeCompare(b.displayTime));

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

      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-4 px-4 scrollbar-hide snap-x">
        {slots.map((entry, index) => {
          const { reminder: r, displayTime, scheduledISO, offsetMinutes, log, slotIndex } = entry;
          const isTaken = log?.action === "taken";
          const isSkipped = log?.action === "skipped";
          const isMissed = log?.action === "missed";
          const isActioned = isTaken || isSkipped || isMissed;
          const hasShift = offsetMinutes !== 0 && entry.slotIndex > -1;

          return (
            <motion.div
              key={`${r.id}-${slotIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`flex-shrink-0 w-40 snap-start rounded-[2rem] p-5 border transition-all ${
                isTaken
                  ? "bg-success/5 border-success/20 opacity-60"
                  : isActioned
                    ? "bg-muted/50 border-border opacity-50"
                    : "bg-card border-border shadow-sm"
              }`}
            >
              <div className="flex flex-col gap-4 h-full justify-between">
                <div>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-colors duration-300 ${
                    isTaken ? "bg-success/20 text-success" : "bg-primary/10 text-primary"
                  }`}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={isTaken ? "check" : "pill"}
                        initial={{ scale: 0.8, rotate: -45, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0.8, rotate: 45, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isTaken ? <Check size={20} /> : <Pill size={20} />}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Time display with shift badge */}
                  <div className="flex items-center gap-1 flex-wrap mb-0.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">
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

                  <h3 className="text-sm font-black text-foreground leading-tight line-clamp-1">
                    {r.medicineName}
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                    {r.dose}
                  </p>
                </div>

                {!isActioned ? (
                  <div className="flex gap-2 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={(e) => handleActionWithConfetti(e, r, "taken", scheduledISO)}
                      className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center transition-colors"
                    >
                      <Check size={16} strokeWidth={3} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => onAction(r, "skipped", scheduledISO)}
                      className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <AlertCircle size={16} />
                    </motion.button>
                  </div>
                ) : (
                  <div className="pt-2 text-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isTaken ? "text-success" : "text-muted-foreground"
                    }`}>
                      {isTaken ? "Done" : isSkipped ? "Skipped" : "Missed"}
                    </span>
                    {isTaken && log && (
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

        {slots.length === 0 && (
          <div className="w-full py-8 text-center bg-muted/20 rounded-3xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No reminders for today!</p>
          </div>
        )}
      </div>
    </div>
  );
}
