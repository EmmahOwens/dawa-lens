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

  const isComplete = progress === 100 && totalToday > 0;

  return (
    <div className="mb-8">
      <div className={`relative overflow-hidden rounded-[22px] border p-5 sm:p-7 shadow-xl transition-all duration-300 text-white ${
        isComplete
          ? "bg-gradient-to-br from-[#092019] via-[#0d2a21] to-[#071712] border-emerald-500/30 shadow-emerald-950/25"
          : "bg-gradient-to-br from-[#0c182b] via-[#0f213d] to-[#0a1526] border-blue-500/25 shadow-blue-950/25"
      }`}>
        <div className="flex flex-col gap-5 sm:gap-6">
          {/* Header Row */}
          <div className="relative z-10 flex items-center justify-between">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 border transition-colors ${
              isComplete
                ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-200"
                : "bg-blue-500/20 border-blue-400/30 text-blue-200"
            }`}>
              <div className={`h-2 w-2 rounded-full ${
                isComplete
                  ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  : "bg-[#2997ff] shadow-[0_0_8px_#2997ff]"
              }`} />
              <span className="text-[12px] font-medium tracking-normal">
                {isComplete ? "Schedule Completed" : "Schedule Status"}
              </span>
            </div>

            {isComplete ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1">
                <CheckCircle2 size={13} className="text-emerald-400" aria-hidden="true" />
                <span className="text-[12px] font-medium text-emerald-200">
                  All doses completed
                </span>
              </div>
            ) : totalToday > 0 ? (
              <span className="text-[12px] font-medium text-white/80">
                {takenToday} of {totalToday} taken
              </span>
            ) : null}
          </div>

          {/* Main Hero Metrics */}
          <div className="relative z-10 flex items-center justify-between gap-4 sm:gap-6">
            {/* Left: Next Dose Info */}
            <button
              type="button"
              onClick={onNextDoseClick}
              aria-label={
                nextDose
                  ? `Next scheduled dose: ${nextDose.reminder.medicineName} ${nextDose.timeUntil}. Open schedule.`
                  : "View medication schedule"
              }
              className="flex-1 min-w-0 text-left cursor-pointer group active:scale-[0.98] transition-transform duration-150 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <div className="flex items-center gap-1.5 mb-1.5 text-white/80">
                <Clock
                  size={14}
                  aria-hidden="true"
                  className={`shrink-0 ${isComplete ? "text-emerald-400" : "text-[#2997ff]"}`}
                />
                <span className="text-[13px] font-medium tracking-normal truncate">
                  {isComplete ? "Daily Target Achieved" : "Next Scheduled Dose"}
                </span>
              </div>

              {nextDose ? (
                <>
                  <h2 className="text-[32px] sm:text-[40px] font-semibold leading-tight tracking-tight text-white mb-1">
                    {nextDose.timeUntil}
                  </h2>
                  <p className="text-[14px] sm:text-[15px] font-normal text-white/80 truncate">
                    {nextDose.reminder.medicineName} · {nextDose.reminder.time}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-[28px] sm:text-[34px] font-semibold leading-tight tracking-tight text-white mb-1">
                    {isComplete ? "Great Job Today!" : "All Set"}
                  </h2>
                  <p className="text-[13px] sm:text-[14px] font-normal text-white/80">
                    {isComplete
                      ? "100% adherence logged for today's regimen"
                      : "No remaining doses scheduled for today"}
                  </p>
                </>
              )}
            </button>

            {/* Right: Circular Progress Meter */}
            <button
              type="button"
              onClick={onProgressClick}
              aria-label={`Today's progress: ${takenToday} of ${totalToday} doses taken. View history.`}
              className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 cursor-pointer items-center justify-center rounded-full active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="8"
                />
                {/* Active Progress Arc */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke={isComplete ? "#34d399" : "#2997ff"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "238.76", strokeDashoffset: "238.76" }}
                  animate={{
                    strokeDashoffset: 238.76 - (progress / 100) * 238.76,
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none text-center p-1">
                <span className="text-[20px] sm:text-[22px] font-semibold text-white leading-none tracking-tight">
                  {takenToday}
                </span>
                <span className="text-[12px] font-medium text-white/80 mt-1 leading-none">
                  of {totalToday}
                </span>
              </div>
            </button>
          </div>

          {/* Action Footer */}
          <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {[...Array(Math.min(totalToday, 5))].map((_, i) => (
                <div
                  key={i}
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-medium transition-colors duration-200 ${
                    i < takenToday
                      ? isComplete
                        ? "bg-emerald-400 text-slate-950 font-semibold"
                        : "bg-[#2997ff] text-slate-950 font-semibold"
                      : "bg-white/10 text-white/70 border border-white/10"
                  }`}
                >
                  {i < takenToday ? <CheckCircle2 size={12} /> : i + 1}
                </div>
              ))}
              {totalToday > 5 && (
                <span className="text-[12px] font-medium text-white/75 pl-1">
                  +{totalToday - 5}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onNextDoseClick}
              className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-full border text-[13px] font-medium transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
                isComplete
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/30 text-emerald-100"
                  : "bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/30 text-blue-100"
              }`}
            >
              <span>View Schedule</span>
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
