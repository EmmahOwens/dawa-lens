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
      <div className="overflow-hidden rounded-[18px] border border-border bg-[#272729] text-white p-6 sm:p-8 transition-all duration-200">
        <div className="flex flex-col gap-6">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-[#2997ff]" />
              <span className="text-[11px] font-normal tracking-normal text-[#cccccc]">
                Schedule Status
              </span>
            </div>

            {progress === 100 && totalToday > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                <span className="text-[11px] font-normal text-white">
                  All doses completed
                </span>
              </div>
            )}
          </div>

          {/* Main Hero Metrics */}
          <div className="flex items-center justify-between gap-6">
            {/* Left: Next Dose Info */}
            <div
              className="flex-1 cursor-pointer group active:scale-[0.98] transition-transform"
              onClick={onNextDoseClick}
            >
              <div className="flex items-center gap-1.5 mb-1.5 text-[#cccccc]">
                <Clock size={13} />
                <span className="text-[12px] font-normal tracking-normal">
                  Next Scheduled Dose
                </span>
              </div>

              {nextDose ? (
                <>
                  <h2 className="text-[38px] sm:text-[44px] font-semibold leading-tight tracking-tight text-white mb-1">
                    {nextDose.timeUntil}
                  </h2>
                  <p className="text-[15px] font-normal text-[#cccccc] truncate max-w-sm">
                    {nextDose.reminder.medicineName} · {nextDose.reminder.time}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-[34px] sm:text-[40px] font-semibold leading-tight tracking-tight text-white mb-1">
                    All Set
                  </h2>
                  <p className="text-[15px] font-normal text-[#cccccc]">
                    No remaining doses scheduled for today
                  </p>
                </>
              )}
            </div>

            {/* Right: Circular Progress Meter */}
            <div
              className="relative flex h-22 w-22 sm:h-24 sm:w-24 shrink-0 cursor-pointer items-center justify-center active:scale-95 transition-transform"
              onClick={onProgressClick}
            >
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="8"
                />
                {/* Active Progress Arc */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#2997ff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "251.3", strokeDashoffset: "251.3" }}
                  animate={{
                    strokeDashoffset: 251.3 - (progress / 100) * 251.3,
                  }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] sm:text-[20px] font-semibold text-white leading-none">
                  {takenToday}
                </span>
                <span className="text-[11px] font-normal text-[#cccccc] mt-0.5">
                  / {totalToday}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-1.5">
              {[...Array(Math.min(totalToday, 5))].map((_, i) => (
                <div
                  key={i}
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                    i < takenToday
                      ? "bg-[#2997ff] text-white"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {i < takenToday ? <CheckCircle2 size={11} /> : i + 1}
                </div>
              ))}
              {totalToday > 5 && (
                <span className="text-[11px] text-[#cccccc] pl-1">
                  +{totalToday - 5}
                </span>
              )}
            </div>

            <button
              onClick={onNextDoseClick}
              className="inline-flex items-center gap-1 h-8 px-4 rounded-full bg-white/10 hover:bg-white/15 text-white text-[13px] font-normal transition-colors active:scale-95"
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
