import React from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, ArrowRight } from "@/lib/icons";
import { NextDoseInfo } from "@/services/reminderService";
import { EDITORIAL_EASE, EditorialEyebrow } from "@/components/editorial/EditorialPrimitives";

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
  const pct = totalToday > 0 ? Math.round(progress) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EDITORIAL_EASE }}
      className="mb-8"
    >
      <div
        className={`${
          isComplete ? "editorial-panel-emerald" : "editorial-panel-dark"
        } rounded-[28px] p-6 sm:p-8 text-white`}
      >
        {/* Subtle static film grain */}
        <div className="editorial-grain" aria-hidden="true" />

        {/* Subtle luminous corner accent */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-35 blur-3xl"
          style={{
            background: isComplete
              ? "radial-gradient(circle, rgba(52,211,153,0.5), transparent 70%)"
              : "radial-gradient(circle, hsl(var(--hero-accent) / 0.5), transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-6 sm:gap-7">
          {/* Top Mono Telemetry Row */}
          <div className="flex items-center justify-between gap-3">
            <EditorialEyebrow
              index="01"
              label={isComplete ? "Regimen Completed" : "Daily Schedule"}
              dotColor={isComplete ? "bg-emerald-400" : "bg-[#2997ff]"}
              onDark
            />

            {isComplete ? (
              <span className="editorial-glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-emerald-300">
                <CheckCircle2 size={12} aria-hidden="true" />
                <span>100% Completed</span>
              </span>
            ) : totalToday > 0 ? (
              <span className="editorial-mono text-[10px] editorial-tabular text-white/60">
                {takenToday} / {totalToday} Doses Taken
              </span>
            ) : null}
          </div>

          {/* Main Editorial Metric Row */}
          <div className="flex items-center justify-between gap-5 sm:gap-8">
            {/* Left: Next Scheduled Dose */}
            <button
              type="button"
              onClick={onNextDoseClick}
              aria-label={
                nextDose
                  ? `Next scheduled dose: ${nextDose.reminder.medicineName} ${nextDose.timeUntil}. Open schedule.`
                  : "View medication schedule"
              }
              className="flex-1 min-w-0 text-left cursor-pointer group active:scale-[0.99] transition-transform duration-150 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <div className="flex items-center gap-1.5 mb-2 text-white/55">
                <Clock
                  size={13}
                  aria-hidden="true"
                  className={isComplete ? "text-emerald-400" : "text-[#2997ff]"}
                />
                <span className="text-[12.5px] font-normal tracking-normal truncate">
                  {isComplete ? "Daily Target Achieved" : "Next Scheduled Dose"}
                </span>
              </div>

              {nextDose ? (
                <>
                  <h2 className="editorial-display editorial-tabular text-[clamp(34px,5.2vw,52px)] font-light leading-[0.96] tracking-[-0.04em] text-white mb-2">
                    {nextDose.timeUntil}
                  </h2>
                  <p className="text-[14px] sm:text-[15px] font-normal text-white/70 truncate">
                    <span className="text-white font-medium">{nextDose.reminder.medicineName}</span>
                    <span className="mx-2 text-white/30">·</span>
                    <span className="editorial-tabular">{nextDose.reminder.time}</span>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="editorial-display text-[clamp(30px,4.5vw,44px)] font-medium leading-[1.02] tracking-[-0.035em] text-white mb-2">
                    {isComplete ? (
                      <>
                        Regimen{" "}
                        <em className="editorial-serif text-[1.08em] text-emerald-300/90 font-normal">
                          complete.
                        </em>
                      </>
                    ) : (
                      <>
                        All{" "}
                        <em className="editorial-serif text-[1.08em] text-white/65 font-normal">
                          clear.
                        </em>
                      </>
                    )}
                  </h2>
                  <p className="text-[13.5px] sm:text-[14.5px] font-normal text-white/65 max-w-md">
                    {isComplete
                      ? "100% adherence logged for today's scheduled medications."
                      : "No remaining doses scheduled for today."}
                  </p>
                </>
              )}
            </button>

            {/* Right: Precision SVG Adherence Ring */}
            <button
              type="button"
              onClick={onProgressClick}
              aria-label={`Today's progress: ${takenToday} of ${totalToday} doses taken. View history.`}
              className="relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 cursor-pointer items-center justify-center rounded-full active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="transparent"
                  stroke={isComplete ? "#34d399" : "#2997ff"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "257.61", strokeDashoffset: "257.61" }}
                  animate={{
                    strokeDashoffset: 257.61 - (progress / 100) * 257.61,
                  }}
                  transition={{ duration: 0.9, ease: EDITORIAL_EASE }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none text-center">
                <span className="editorial-tabular text-[22px] sm:text-[26px] font-light text-white leading-none tracking-[-0.03em]">
                  {totalToday > 0 ? `${pct}%` : "—"}
                </span>
                <span className="editorial-mono text-[8.5px] text-white/50 mt-1.5 editorial-tabular">
                  {takenToday}/{totalToday}
                </span>
              </div>
            </button>
          </div>

          {/* Hairline Footer: Dose Slot Pips + Tactile Schedule Pill */}
          <div className="flex items-center justify-between gap-4 pt-5 border-t border-white/10">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {[...Array(Math.min(totalToday, 6))].map((_, i) => (
                <div
                  key={i}
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] editorial-tabular font-medium transition-colors duration-200 ${
                    i < takenToday
                      ? isComplete
                        ? "bg-emerald-400 text-[#080a0e]"
                        : "bg-white text-[#080a0e]"
                      : "bg-white/[0.07] text-white/55 border border-white/15"
                  }`}
                >
                  {i < takenToday ? <CheckCircle2 size={11} /> : i + 1}
                </div>
              ))}
              {totalToday > 6 && (
                <span className="editorial-mono text-[10px] text-white/55 pl-1">
                  +{totalToday - 6}
                </span>
              )}
              {totalToday === 0 && (
                <span className="editorial-mono text-[10px] text-white/45">
                  No active doses today
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onNextDoseClick}
              className="btn-editorial-roll editorial-glass-dark h-9 pl-4 pr-1.5 text-[12px] text-white hover:bg-white/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <span>View Schedule</span>
              <span className="roll-chip w-6 h-6 bg-white text-[#0d2448]">
                <ArrowRight size={12} aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
