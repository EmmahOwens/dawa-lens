import React from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, ChevronRight } from "@/lib/icons";
import { NextDoseInfo } from "@/services/reminderService";

interface StatusHeroProps {
  nextDose: NextDoseInfo | null;
  takenToday: number;
  totalToday: number;
  onNextDoseClick: () => void;
  onProgressClick: () => void;
}

export function StatusHero({
  nextDose,
  takenToday,
  totalToday,
  onNextDoseClick,
  onProgressClick,
}: StatusHeroProps) {
  const progress = totalToday > 0 ? (takenToday / totalToday) * 100 : 0;

  return (
    <div className="mb-8">
      <div className="relative overflow-hidden rounded-[22px] border border-blue-500/25 bg-gradient-to-br from-[#1d4ed8] via-[#1e40af] to-[#0f172a] text-white p-5 sm:p-7 shadow-lg shadow-blue-950/20 transition-all duration-200">
        {/* Subtle Ambient Glows */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-5 sm:gap-6">
          {/* Header Row */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1 shadow-xs">
              <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
              <span className="text-[11px] font-medium tracking-normal text-white">
                Schedule Status
              </span>
            </div>

            {progress === 100 && totalToday > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 px-3 py-1 shadow-xs">
                <span className="text-[11px] font-medium text-emerald-100">
                  All doses completed
                </span>
              </div>
            )}
          </div>

          {/* Main Hero Metrics */}
          <div className="relative z-10 flex items-center justify-between gap-4 sm:gap-6">
            {/* Left: Next Dose Info */}
            <div
              className="flex-1 min-w-0 cursor-pointer group active:scale-[0.98] transition-transform"
              onClick={onNextDoseClick}
            >
              <div className="flex items-center gap-1.5 mb-1.5 text-blue-100/80">
                <Clock size={13} className="text-sky-300 shrink-0" />
                <span className="text-[12px] font-medium tracking-normal truncate">
                  Next Scheduled Dose
                </span>
              </div>

              {nextDose ? (
                <>
                  <h2 className="text-[32px] sm:text-[42px] font-bold leading-tight tracking-tight text-white mb-1">
                    {nextDose.timeUntil}
                  </h2>
                  <p className="text-[14px] sm:text-[15px] font-normal text-blue-100/80 truncate">
                    {nextDose.reminder.medicineName} · {nextDose.reminder.time}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-[30px] sm:text-[38px] font-bold leading-tight tracking-tight text-white mb-1">
                    All Set
                  </h2>
                  <p className="text-[13px] sm:text-[14px] font-normal text-blue-100/80">
                    No remaining doses scheduled for today
                  </p>
                </>
              )}
            </div>

            {/* Right: Circular Progress Meter */}
            <div
              className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 cursor-pointer items-center justify-center active:scale-95 transition-transform"
              onClick={onProgressClick}
            >
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="8"
                />
                {/* Active Progress Arc */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#38bdf8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "238.76", strokeDashoffset: "238.76" }}
                  animate={{
                    strokeDashoffset: 238.76 - (progress / 100) * 238.76,
                  }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none text-center p-1">
                <span className="text-[20px] sm:text-[22px] font-bold text-white leading-none tracking-tight">
                  {takenToday}
                </span>
                <span className="text-[11px] sm:text-[12px] font-medium text-blue-100/80 mt-1 leading-none">
                  of {totalToday}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/15">
            <div className="flex items-center gap-1.5">
              {[...Array(Math.min(totalToday, 5))].map((_, i) => (
                <div
                  key={i}
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    i < takenToday
                      ? "bg-sky-400 text-slate-950 font-bold shadow-xs shadow-sky-400/40"
                      : "bg-white/15 text-white/70"
                  }`}
                >
                  {i < takenToday ? <CheckCircle2 size={11} /> : i + 1}
                </div>
              ))}
              {totalToday > 5 && (
                <span className="text-[11px] font-medium text-blue-100/70 pl-1">
                  +{totalToday - 5}
                </span>
              )}
            </div>

            <button
              onClick={onNextDoseClick}
              className="inline-flex items-center gap-1 h-8 px-4 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-[13px] font-medium transition-all active:scale-95 shadow-xs"
            >
              <span>View Schedule</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
