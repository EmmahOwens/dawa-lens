import React from "react";
import { motion } from "framer-motion";
import { Pill, Check, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { Reminder, DoseLog } from "@/contexts/AppContext";
import { computeShiftOffset } from "@/services/reminderService";

interface DailyTimelineProps {
  reminders: Reminder[];
  doseLogs: DoseLog[];
  onAction: (reminder: Reminder, action: "taken" | "skipped") => void;
}

export function DailyTimeline({ reminders, doseLogs, onAction }: DailyTimelineProps) {
  // Combine reminders and logs for the day
  const today = new Date().toDateString();
  
  // Sort reminders by time
  const sortedReminders = [...reminders]
    .filter(r => r.enabled)
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="mb-8 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0 flex items-center gap-2">
           <Clock size={14} />
           Daily Timeline
        </h2>
        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-4 px-4 scrollbar-hide snap-x">
        {sortedReminders.map((r, index) => {
          const log = doseLogs.find(l => l.reminderId === r.id && new Date(l.actionTime).toDateString() === today);
          const isTaken = log?.action === "taken";
          const isSkipped = log?.action === "skipped";
          const isMissed = log?.action === "missed";
          const isActioned = isTaken || isSkipped || isMissed;
          
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
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
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${
                    isTaken ? "bg-success/20 text-success" : "bg-primary/10 text-primary"
                  }`}>
                    {isTaken ? <Check size={20} /> : <Pill size={20} />}
                  </div>
                  {(() => {
                    const offsetMinutes = computeShiftOffset(r, doseLogs);
                    const baseTimes = r.time.split(",").map(t => t.trim());
                    // Find taken slot index from today's log
                    let takenSlotIndex = -1;
                    if (offsetMinutes !== 0) {
                      const todayLog = [...doseLogs]
                        .filter(l =>
                          l.reminderId === r.id &&
                          l.action === "taken" &&
                          new Date(l.actionTime).toDateString() === today
                        )
                        .sort((a, b) => new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime())[0];
                      if (todayLog) {
                        const sd = new Date(todayLog.scheduledTime);
                        const ts = `${sd.getHours().toString().padStart(2,"0")}:${sd.getMinutes().toString().padStart(2,"0")}`;
                        takenSlotIndex = baseTimes.indexOf(ts);
                        if (takenSlotIndex === -1) {
                          const sm = sd.getHours() * 60 + sd.getMinutes();
                          let minD = Infinity;
                          baseTimes.forEach((t, i) => {
                            const [hh, mm] = t.split(":").map(Number);
                            const d = Math.abs(hh * 60 + mm - sm);
                            if (d < minD) { minD = d; takenSlotIndex = i; }
                          });
                        }
                      }
                    }
                    const displayTimes = baseTimes.map((t, idx) => {
                      if (offsetMinutes === 0 || idx <= takenSlotIndex) return t;
                      // shifted: base time + offset
                      const [h, m] = t.split(":").map(Number);
                      const total = ((h * 60 + m + offsetMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
                      return `${Math.floor(total / 60).toString().padStart(2,"0")}:${(total % 60).toString().padStart(2,"0")}`;
                    });
                    const hasShift = offsetMinutes !== 0 && takenSlotIndex !== -1;
                    return (
                      <>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">
                          {displayTimes.join(", ")}
                        </p>
                        {hasShift && (
                          <span className={`inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded-full mb-1 ${
                            offsetMinutes > 0 ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                          }`}>
                            <RefreshCw size={7} />
                            {offsetMinutes > 0 ? "+" : ""}{offsetMinutes}m
                          </span>
                        )}
                      </>
                    );
                  })()}
                  <h3 className="text-sm font-black text-foreground leading-tight line-clamp-1">
                    {r.medicineName}
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                    {r.dose}
                  </p>
                </div>

                {!isActioned ? (
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => onAction(r, "taken")}
                      className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <button 
                      onClick={() => onAction(r, "skipped")}
                      className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-transform"
                    >
                      <AlertCircle size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 text-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isTaken ? "text-success" : "text-muted-foreground"
                    }`}>
                      {isTaken ? "Done" : isSkipped ? "Skipped" : "Missed"}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {sortedReminders.length === 0 && (
          <div className="w-full py-8 text-center bg-muted/20 rounded-3xl border border-dashed border-border">
             <p className="text-sm text-muted-foreground">No more tasks for today!</p>
          </div>
        )}
      </div>
    </div>
  );
}
