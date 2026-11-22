import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { subDays, isSameDay } from "date-fns";
import { toDate } from "@/lib/utils";
import { getNextWellnessPulseQuote } from "@/data/wellnessPulseQuotes";
import {
  EDITORIAL_EASE,
  EditorialEyebrow,
  EditorialMetricStrip,
} from "@/components/editorial/EditorialPrimitives";

export function DashboardBanner() {
  const navigate = useNavigate();
  const { userProfile } = useApp();
  const { scopedDoseLogs } = usePatientScope();

  const firstName = userProfile?.name?.split(" ")[0];
  const [quote, setQuote] = useState<string>(() => getNextWellnessPulseQuote(firstName));

  useEffect(() => {
    setQuote(getNextWellnessPulseQuote(firstName));
  }, [firstName]);

  const adherencePercent = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), i));
    const dayScores = days.map((date) => {
      const dayLogs = scopedDoseLogs.filter((l) => isSameDay(toDate(l.actionTime), date));
      const taken = dayLogs.filter((l) => l.action === "taken").length;
      const total = dayLogs.length;
      return total > 0 ? (taken / total) * 100 : 100;
    });

    return Math.round(dayScores.reduce((acc, score) => acc + score, 0) / 7);
  }, [scopedDoseLogs]);

  const streak = useMemo(() => {
    if (scopedDoseLogs.length === 0) return 0;

    let currentStreak = 0;
    const oldestLogTimestamp = Math.min(
      ...scopedDoseLogs.map((l) => toDate(l.actionTime).getTime())
    );
    const oldestDate = new Date(oldestLogTimestamp);
    oldestDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 100; i++) {
      const date = subDays(new Date(), i);
      const comparisonDate = new Date(date);
      comparisonDate.setHours(0, 0, 0, 0);

      if (comparisonDate < oldestDate) break;

      const dayLogs = scopedDoseLogs.filter((l) =>
        isSameDay(toDate(l.scheduledTime || l.actionTime), date)
      );

      if (dayLogs.length === 0) {
        currentStreak++;
        continue;
      }

      const total = dayLogs.length;
      const taken = dayLogs.filter((l) => l.action === "taken").length;
      const failed = dayLogs.filter(
        (l) => l.action === "missed" || l.action === "skipped"
      ).length;

      if (failed > 0) break;

      if (taken === total) {
        currentStreak++;
      } else {
        if (i === 0) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
    return currentStreak;
  }, [scopedDoseLogs]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EDITORIAL_EASE }}
      className="editorial-card relative mb-8 p-6 sm:p-8 overflow-hidden"
    >
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-7">
        <div className="space-y-5 max-w-xl">
          <EditorialEyebrow
            index="05"
            label="Wellness Pulse"
            dotColor="bg-emerald-500"
          />

          {quote && (
            <h2 className="editorial-serif text-[26px] sm:text-[32px] leading-[1.12] text-foreground max-w-lg">
              &ldquo;{quote}&rdquo;
            </h2>
          )}

          <div className="pt-2 border-t border-border/70">
            <EditorialMetricStrip
              items={[
                {
                  label: "7-Day Consistency",
                  value: adherencePercent,
                  unit: "%",
                  tone: "success",
                },
                {
                  label: "Success Streak",
                  value: streak,
                  unit: streak === 1 ? "day" : "days",
                  tone: "default",
                },
              ]}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/report")}
          className="btn-editorial-roll self-start md:self-end h-11 pl-5 pr-2 bg-foreground text-background hover:opacity-90 text-[13px] font-medium shrink-0"
        >
          <span>Detailed Report</span>
          <span className="roll-chip w-7 h-7 bg-background text-foreground">
            <ArrowRight size={13} />
          </span>
        </button>
      </div>
    </motion.section>
  );
}
