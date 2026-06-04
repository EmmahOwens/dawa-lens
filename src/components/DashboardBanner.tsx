import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Calendar, ArrowRight, Loader2 } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { usePatientScope } from "@/hooks/usePatientScope";
import { format, subDays, isSameDay } from "date-fns";
import { toDate } from "@/lib/utils";
import { aiApi } from "@/services/api";

export function DashboardBanner() {
  const navigate = useNavigate();
  const { userProfile } = useApp();
  const { scopedDoseLogs } = usePatientScope();
  const { t } = useTranslation();

  const [quote, setQuote] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // 1. Fetch Dynamic Quote using GROQ_API_KEY_2 (via backend)
  useEffect(() => {
    const fetchQuote = async () => {
      setLoadingQuote(true);
      try {
        const res = await aiApi.getWellnessQuote({
          userName: userProfile?.name?.split(" ")[0]
        });
        setQuote(res.quote);
      } catch (err) {
        console.error("Failed to fetch wellness quote:", err);
        // Fallback
        setQuote(`Consistency is your greatest strength, ${userProfile?.name?.split(" ")[0] || "friend"}.`);
      } finally {
        setLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [userProfile?.name]);

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
    if (loadingQuote && !quote) {
      return (
        <div className="flex items-center gap-2 opacity-30">
          <Loader2 size={20} className="animate-spin text-primary" />
          <span className="text-xl font-medium italic">Gathering inspiration...</span>
        </div>
      );
    }

    if (!quote) return null;

    return (
      <h2 className="text-2xl font-bold text-foreground max-w-sm leading-tight tracking-tight">
        {quote}
      </h2>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative mb-10 premium-card overflow-hidden group"
    >
      {/* Calm background shapes */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          x: [0, 10, 0],
          y: [0, -10, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: "hsla(158, 64%, 88%, 0.4)" }}
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, -15, 0],
          y: [0, 15, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: "hsla(261, 71%, 88%, 0.4)" }}
        className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles size={14} className="text-primary" />
            </div>
            <span className="section-title mb-0">Wellness Pulse</span>
          </div>
          
          {renderQuote()}

          <div className="flex items-center gap-6 pt-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">7-Day Consistency</span>
              <div className="flex items-center gap-2 mt-1">
                <TrendingUp size={16} className="text-success" />
                <span className="text-xl font-bold text-foreground tracking-tight">{adherencePercent}%</span>
              </div>
            </div>
            <div className="w-[1px] h-8 bg-border" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Success Streak</span>
              <div className="flex items-center gap-2 mt-1">
                <Calendar size={16} className="text-primary" />
                <span className="text-xl font-bold text-foreground tracking-tight">
                  {streak} {streak === 1 ? 'Day' : 'Days'}
                </span>
              </div>
            </div>
          </div>
        </div>


        <button 
          onClick={() => navigate('/report')}
          className="self-start md:self-center group/btn flex items-center gap-3 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
        >
          <span className="text-xs font-bold uppercase tracking-wider">Detailed Report</span>
          <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}
