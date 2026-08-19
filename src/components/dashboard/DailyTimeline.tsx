import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Check, Clock, AlertCircle, RefreshCw } from "@/lib/icons";
import { Reminder, DoseLog } from "@/contexts/AppContext";
import { computeShiftOffset } from "@/services/reminderService";
import confetti from "canvas-confetti";
import { toDate } from "@/lib/utils";
import {
  parseReminderTimes,
  findSlotIndexForTime,
  getInterSlotInterval,
  minutesToTimeStr,
  timeStrToMinutes,
} from "@/lib/dynamicSchedule";

/** Shift a "HH:mm" base time by offsetMinutes and return the display string. */
function shiftHHmm(base: string, offsetMinutes: number): string {
  const total = timeStrToMinutes(base) + offsetMinutes;
  return minutesToTimeStr(total);
}

/** Build the ISO datetime for today at HH:mm */
function todayAt(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
}

interface DailyTimelineProps {
  reminders: Reminder[];
  doseLogs: DoseLog[];
  /** scheduledTime is the full ISO datetime for the specific slot being actioned */
  onAction: (reminder: Reminder, action: "taken" | "skipped", scheduledTime: string) => void;
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
    isActioned: boolean;
  };

  const slots: SlotEntry[] = [];

  const todayNum = new Date().getDay();
  const todayStr = new Date().toDateString();

  const activeReminders = [...reminders]
    .filter(r => {
      if (!r.enabled) return false;

      // 1. Filter out 'once' reminders if they were already completed on a previous day
      if (r.repeatSchedule === "once") {
        const previousDayLog = doseLogs.some(l => 
          l.reminderId === r.id && 
          ["taken", "skipped", "missed"].includes(l.action) &&
          new Date(l.actionTime).toDateString() !== todayStr &&
          new Date(l.actionTime).getTime() < new Date().getTime()
        );
        if (previousDayLog) {
          const hasTodayLog = doseLogs.some(l => 
            l.reminderId === r.id && 
            new Date(l.actionTime).toDateString() === todayStr
          );
          if (!hasTodayLog) return false;
        }
      }

      // 2. Filter out custom reminders if today is not in repeatDays
      if (r.repeatSchedule === "custom" && r.repeatDays && r.repeatDays.length > 0) {
        if (!r.repeatDays.includes(todayNum)) return false;
      }

      // 3. Filter out weekly reminders if today is not the scheduled day
      if (r.repeatSchedule === "weekly") {
        if (r.repeatDays && r.repeatDays.length > 0) {
          if (!r.repeatDays.includes(todayNum)) return false;
        } else {
          const createdDate = r.createdAt ? new Date(r.createdAt) : new Date();
          const createdDay = isNaN(createdDate.getTime()) ? todayNum : createdDate.getDay();
          if (createdDay !== todayNum) return false;
        }
      }

      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  activeReminders.forEach((r) => {
    const times = parseReminderTimes(r.time);
    const offsetMinutes = computeShiftOffset(r, doseLogs);

    // Determine taken slot index from today's logs
    let takenSlotIndex = -1;
    const todayTakenLog = [...doseLogs]
      .filter(
        (l) =>
          l.reminderId === r.id &&
          l.action === "taken" &&
          new Date(l.actionTime).toDateString() === today
      )
      .sort(
        (a, b) =>
          new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime()
      )[0];

    if (todayTakenLog) {
      takenSlotIndex = findSlotIndexForTime(
        times,
        todayTakenLog.scheduledTime || todayTakenLog.actionTime
      );
    }

    times.forEach((baseTime, idx) => {
      let displayTime = baseTime;
      let slotOffset = 0;

      if (todayTakenLog && takenSlotIndex !== -1 && idx > takenSlotIndex) {
        let cumulativeInterval = 0;
        for (let s = takenSlotIndex; s < idx; s++) {
          cumulativeInterval += getInterSlotInterval(times, s, s + 1);
        }
        const actualTakeDate = toDate(todayTakenLog.actionTime);
        const totalMins =
          actualTakeDate.getHours() * 60 +
          actualTakeDate.getMinutes() +
          cumulativeInterval;
        displayTime = minutesToTimeStr(totalMins);

        let diff = timeStrToMinutes(displayTime) - timeStrToMinutes(baseTime);
        if (diff > 12 * 60) diff -= 24 * 60;
        if (diff < -12 * 60) diff += 24 * 60;
        slotOffset = diff;
      } else if (todayTakenLog && idx === takenSlotIndex) {
        slotOffset = offsetMinutes;
      }

      const scheduledISO = todayAt(displayTime).toISOString();
      const slotISO = todayAt(baseTime).toISOString();

      const log = doseLogs.find((l) => {
        if (l.reminderId !== r.id) return false;
        if (new Date(l.actionTime).toDateString() !== today) return false;
        if (l.scheduledTime === slotISO || l.scheduledTime === scheduledISO) return true;

        if (l.scheduledTime) {
          const lDate = toDate(l.scheduledTime);
          const lMins = lDate.getHours() * 60 + lDate.getMinutes();
          const baseMins = timeStrToMinutes(baseTime);
          let diff = Math.abs(lMins - baseMins);
          if (diff > 12 * 60) diff = 24 * 60 - diff;
          if (diff <= 30) return true;
        }
        return false;
      });

      const isTaken = log?.action === "taken";
      const isSkipped = log?.action === "skipped";
      const isMissed = log?.action === "missed";
      const isActioned = isTaken || isSkipped || isMissed;

      slots.push({
        reminder: r,
        slotIndex: idx,
        baseTime,
        displayTime,
        scheduledISO,
        offsetMinutes: slotOffset,
        log,
        isActioned,
      });
    });
  });

  // Separate pending vs actioned slots, sorting each chronologically
  const pendingSlots = slots
    .filter((s) => !s.isActioned)
    .sort((a, b) => timeStrToMinutes(a.displayTime) - timeStrToMinutes(b.displayTime));

  const actionedSlots = slots
    .filter((s) => s.isActioned)
    .sort((a, b) => timeStrToMinutes(a.displayTime) - timeStrToMinutes(b.displayTime));

  // The next dose is placed on the far left, followed by upcoming doses to the right,
  // followed by already completed/actioned doses
  const orderedSlots = [...pendingSlots, ...actionedSlots];

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
        {orderedSlots.map((entry, index) => {
          const { reminder: r, displayTime, scheduledISO, offsetMinutes, log, slotIndex, isActioned } = entry;
          const isTaken = log?.action === "taken";
          const isSkipped = log?.action === "skipped";
          const isMissed = log?.action === "missed";
          const hasShift = offsetMinutes !== 0 && entry.slotIndex > -1;

          // Only the earliest pending dose is the active next dose card
          const isNextDose = !isActioned && pendingSlots.length > 0 && entry === pendingSlots[0];
          const isUpcoming = !isActioned && !isNextDose;

          return (
            <motion.div
              key={`${r.id}-${slotIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`flex-shrink-0 w-44 snap-start rounded-[2rem] p-5 border transition-all relative ${
                isNextDose
                  ? "bg-card border-primary/50 ring-1 ring-primary/30 shadow-md"
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
                        : isNextDose
                          ? "bg-primary/20 text-primary shadow-sm"
                          : "bg-muted text-muted-foreground"
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

                    {isNextDose && (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-sm">
                        Next Dose
                      </span>
                    )}
                  </div>

                  {/* Time display with shift badge */}
                  <div className="flex items-center gap-1 flex-wrap mb-0.5">
                    <p className={`text-xs font-bold uppercase tracking-widest leading-none ${
                      isNextDose ? "text-primary font-black" : "text-muted-foreground"
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

                  <h3 className="text-sm font-black text-foreground leading-tight line-clamp-1">
                    {r.medicineName}
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                    {r.dose}
                  </p>
                </div>

                {isNextDose ? (
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

        {orderedSlots.length === 0 && (
          <div className="w-full py-8 text-center bg-muted/20 rounded-3xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No reminders for today!</p>
          </div>
        )}
      </div>
    </div>
  );
}
