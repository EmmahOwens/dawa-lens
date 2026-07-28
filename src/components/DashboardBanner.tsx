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

const FALLBACK_QUOTES = [
  (name: string) => `Consistency is your greatest strength, ${name}.`,
  (name: string) => `Every small step toward your health counts today, ${name}.`,
  (name: string) => `Your future self will thank you for taking care of yourself today, ${name}.`,
  (name: string) => `Wellness is a daily journey of small, positive habits, ${name}.`,
  (name: string) => `Prioritizing your health is the highest form of self-care, ${name}.`,
  (name: string) => `Small daily improvements over time lead to remarkable results, ${name}.`,
  (name: string) => `You are doing an incredible job taking care of your health, ${name}.`,
  (name: string) => `Stay mindful, stay consistent, and keep nourishing your life, ${name}.`,
  (name: string) => `Health is not a destination, it is a daily commitment, ${name}.`,
  (name: string) => `Every dose and every log brings you closer to optimal vitality, ${name}.`,
  (name: string) => `Take a breath and celebrate every step of your wellness journey, ${name}.`,
  (name: string) => `Building healthy habits is an investment in your best tomorrow, ${name}.`,
  (name: string) => `Listen to your body, honour your routine, and keep shining, ${name}.`,
  (name: string) => `Great achievements are built on small, consistent choices, ${name}.`,
  (name: string) => `Your dedication to your well-being inspires everyone around you, ${name}.`,
  (name: string) => `Nurture your mind and body with patience and positivity today, ${name}.`,
  (name: string) => `Progress over perfection: every healthy choice matters, ${name}.`,
  (name: string) => `You are stronger, healthier, and more resilient every single day, ${name}.`,
  (name: string) => `Self-care is never selfish—it is your foundation, ${name}.`,
  (name: string) => `Keep up the momentum, ${name}, your health journey is worth every effort.`,
  (name: string) => `Rest, recover, and keep moving forward with confidence, ${name}.`
];

function getRandomFallbackQuote(name: string = "friend"): string {
  const randomIndex = Math.floor(Math.random() * FALLBACK_QUOTES.length);
  return FALLBACK_QUOTES[randomIndex](name);
}

export function DashboardBanner() {
  const navigate = useNavigate();
  const { userProfile } = useApp();
  const { scopedDoseLogs } = usePatientScope();
  const { t } = useTranslation();

  const [quote, setQuote] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("dawa_wellness_quote");
    } catch {
      return null;
    }
  });
  const [loadingQuote, setLoadingQuote] = useState(false);

  // 1. Fetch Dynamic Quote using GROQ_API_KEY_2 (via backend) - Once per session
  useEffect(() => {
    const cachedQuote = (() => {
      try {
        return sessionStorage.getItem("dawa_wellness_quote");
      } catch {
        return null;
      }
    })();

    if (cachedQuote) {
      setQuote(cachedQuote);
      return;
    }

    const fetchQuote = async () => {
      setLoadingQuote(true);
      try {
        const res = await aiApi.getWellnessQuote({
          userName: userProfile?.name?.split(" ")[0]
        });
        if (res?.quote) {
          setQuote(res.quote);
          try {
            sessionStorage.setItem("dawa_wellness_quote", res.quote);
          } catch (e) {
            console.error("Failed to save quote to sessionStorage", e);
          }
        } else {
          throw new Error("No quote returned");
        }
      } catch (err) {
        console.error("Failed to fetch wellness quote, using fallback:", err);
        // Fallback with random quote from pool
        const fallbackQuote = getRandomFallbackQuote(userProfile?.name?.split(" ")[0] || "friend");
        setQuote(fallbackQuote);
        try {
          sessionStorage.setItem("dawa_wellness_quote", fallbackQuote);
        } catch (e) {
          console.error("Failed to save fallback quote to sessionStorage", e);
        }
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
