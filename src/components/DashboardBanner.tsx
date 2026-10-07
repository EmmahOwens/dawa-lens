import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Calendar, ArrowRight } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { usePatientScope } from "@/hooks/usePatientScope";
import { format, subDays, isSameDay } from "date-fns";
import { toDate } from "@/lib/utils";
import { getNextWellnessPulseQuote } from "@/data/wellnessPulseQuotes";

export function DashboardBanner() {
  const navigate = useNavigate();
  const { userProfile } = useApp();
  const { scopedDoseLogs } = usePatientScope();
  const { t } = useTranslation();

  const firstName = userProfile?.name?.split(" ")[0];
  const [quote, setQuote] = useState<string>(() => getNextWellnessPulseQuote(firstName));

  // Keep quote personalized if profile loads asynchronously
  useEffect(() => {
    setQuote(getNextWellnessPulseQuote(firstName));
  }, [firstName]);

  // 2. Calculate 7-Day Consistency (Matching VitalityTrends logic)
  const adherencePercent = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), i));
    const dayScores = days.map(date => {
      const dayLogs = scopedDoseLogs.filter((l) =>
        isSameDay(toDate(l.actionTime), date)
      );
      const taken = dayLogs.filter((l) => l.action === "taken").length;
      const total = dayLogs.length;
      // If no doses scheduled, it's 100% adherence for that day
      return total > 0 ? (taken / total) * 100 : 100;
    });

    return Math.round(dayScores.reduce((acc, score) => acc + score, 0) / 7);
  }, [scopedDoseLogs]);

  // 3. Calculate Success Streak
  const streak = useMemo(() => {
    if (scopedDoseLogs.length === 0) return 0;

    let currentStreak = 0;
    // Find the oldest log to know when to stop counting backwards
    const oldestLogTimestamp = Math.min(...scopedDoseLogs.map(l => toDate(l.actionTime).getTime()));
    const oldestDate = new Date(oldestLogTimestamp);
    oldestDate.setHours(0, 0, 0, 0);

    // Check up to 100 days back
    for (let i = 0; i < 100; i++) {
      const date = subDays(new Date(), i);
      const comparisonDate = new Date(date);
      comparisonDate.setHours(0, 0, 0, 0);

      // Stop if we go before the user's first ever log
      if (comparisonDate < oldestDate) break;

      const dayLogs = scopedDoseLogs.filter((l) =>
        isSameDay(toDate(l.scheduledTime || l.actionTime), date)
      );

      if (dayLogs.length === 0) {
        // No logs for this day. Following the requirement to be similar to adherence,
        // days with no scheduled doses don't break the streak.
        currentStreak++;
        continue;
      }

      const total = dayLogs.length;
      const taken = dayLogs.filter((l) => l.action === "taken").length;
      const failed = dayLogs.filter((l) => l.action === "missed" || l.action === "skipped").length;

      if (failed > 0) {
        // Any failure (missed or skipped) resets the streak immediately.
        break;
      }

      if (taken === total) {
        currentStreak++;
      } else {
        // Some taken, some pending.
        if (i === 0) {
          // If it's today and no failures yet, keep the streak alive (it's in progress).
          currentStreak++;
        } else {
          // If it's a past day and it's not fully taken (and not a failure),
          // we treat it as a break in consistency.
          break;
        }
      }
    }
    return currentStreak;
  }, [scopedDoseLogs]);

  const renderQuote = () => {
    if (!quote) return null;

    return (
      <h2 className="text-2xl font-bold text-foreground max-w-sm leading-tight tracking-tight">
        {quote}
      </h2>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative mb-8 rounded-[22px] bg-gradient-to-br from-emerald-500/12 via-teal-500/8 to-cyan-500/12 dark:from-emerald-950/40 dark:via-teal-950/25 dark:to-cyan-950/35 border border-emerald-500/30 dark:border-emerald-500/25 p-6 sm:p-7 overflow-hidden backdrop-blur-xl shadow-lg shadow-emerald-950/5 transition-all"
    >
      {/* Ambient Apple Health Glow Orbs */}
      <div className="absolute -top-12 -right-12 w-52 h-52 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider shadow-xs">
              <Sparkles size={12} className="animate-pulse text-emerald-500" />
              Wellness Pulse
            </span>
          </div>

          {renderQuote()}

          <div className="flex items-center gap-6 pt-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300/80">7-Day Consistency</span>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={15} />
                </div>
                <span className="text-xl font-bold text-foreground tracking-tight">{adherencePercent}<span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 ml-0.5">%</span></span>
              </div>
            </div>
            <div className="w-px h-9 bg-emerald-500/25" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300/80">Success Streak</span>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Calendar size={15} />
                </div>
                <span className="text-xl font-bold text-foreground tracking-tight">
                  {streak} <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{streak === 1 ? 'Day' : 'Days'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => navigate('/report')}
          className="self-start md:self-center flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white h-11 px-5.5 rounded-full font-semibold text-xs tracking-wide shadow-md shadow-emerald-600/25 hover:shadow-emerald-600/35 hover:brightness-105 transition-all active:scale-95 shrink-0"
        >
          <span>Detailed Report</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}
