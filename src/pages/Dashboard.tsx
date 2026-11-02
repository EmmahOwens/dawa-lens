import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Camera,
  Plus,
  History,
  Search,
  Pill,
  Bell,
  AlertTriangle,
  Package2,
  Users,
  User,
  Plane,
  Heart,
  FileText,
  Check,
  X,
  Sparkles,
  Sun,
  Moon,
  Cloud,
  Sunrise,
  ShieldAlert,
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo } from "react";
import { toDate } from "@/lib/utils";
import { toast } from "sonner";
import AchievementOverlay from "@/components/AchievementOverlay";
import { DashboardBanner } from "@/components/DashboardBanner";
import { FeatureSlideshow } from "@/components/FeatureSlideshow";
import { calculateRefillStatus, RefillStatus } from "@/services/refillService";
import { calculateNextDose, NextDoseInfo } from "@/services/reminderService";
import { StatusHero } from "@/components/StatusHero";
import { RiveMoji } from "@/components/rive/RiveMoji";
import { calculateVitalitySummary } from "@/lib/vitalityUtils";

// New Dashboard Components

import { DailyTimeline } from "@/components/dashboard/DailyTimeline";
import { HealthWidgets } from "@/components/dashboard/HealthWidgets";
import { FamilyStatusDots } from "@/components/dashboard/FamilyStatusDots";
import { AIInsightCard } from "@/components/dashboard/AIInsightCard";

const formatCompactNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    userProfile,
    isProfessionalMode,
    patients,
    selectedPatientId,
    logDose,
    setSelectedPatientId,
    addWellnessLog,
  } = useApp();
  const { t } = useTranslation();
  const [showAchievement, setShowAchievement] = useState(false);

  const {
    scopedMedicines,
    scopedReminders,
    scopedDoseLogs,
    scopedWellnessLogs,
  } = usePatientScope();

  const refillStatuses = useMemo(() => {
    return scopedMedicines
      .map((m) => calculateRefillStatus(m, scopedReminders))
      .filter((s): s is RefillStatus => s !== null && (s.isLow || s.isWarning));
  }, [scopedMedicines, scopedReminders]);

  const nextDose = useMemo(() => {
    return calculateNextDose(scopedReminders, scopedDoseLogs);
  }, [scopedReminders, scopedDoseLogs]);

  const trackedMedicinesCount = useMemo(() => {
    return scopedMedicines.filter((m) => m.currentQuantity !== undefined).length;
  }, [scopedMedicines]);

  const totalPillsCount = useMemo(() => {
    return scopedMedicines
      .filter((m) => m.currentQuantity !== undefined)
      .reduce((sum, m) => sum + (m.currentQuantity ?? 0), 0);
  }, [scopedMedicines]);

  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5)
      return { text: "Good late night", icon: Moon, color: "text-indigo-400" };
    if (hour < 12)
      return {
        text: t("dashboard.good_morning", "Good morning"),
        icon: Sunrise,
        color: "text-amber-500",
      };
    if (hour < 17)
      return {
        text: t("dashboard.good_afternoon", "Good afternoon"),
        icon: Sun,
        color: "text-orange-500",
      };
    if (hour < 21)
      return {
        text: t("dashboard.good_evening", "Good evening"),
        icon: Cloud,
        color: "text-blue-400",
      };
    return { text: "Good night", icon: Moon, color: "text-indigo-500" };
  }, [t]);

  const quickActions = [
    {
      icon: Camera,
      label: t("dashboard.quick_scan"),
      to: "/scan",
      color: "bg-primary text-primary-foreground",
      description: "AI Recognition",
    },
    {
      icon: Users,
      label: isProfessionalMode ? "Patient Hub" : "Family Hub",
      to: "/family",
      color: "bg-success/10 border-success/20 text-success",
    },
    {
      icon: Heart,
      label: "Wellness",
      to: "/wellness",
      color: "bg-destructive/10 border-destructive/20 text-destructive",
    },
    {
      icon: Plane,
      label: "Travel",
      to: "/travel",
      color: "bg-blue-500/10 border-blue-500/20 text-blue-600",
    },
    {
      icon: ShieldAlert,
      label: "Safety Check",
      to: "/interactions",
      color:
        "bg-warning/10 border-warning/20 text-amber-800 dark:text-amber-300",
    },
    {
      icon: Bell,
      label: "Reminders",
      to: "/reminders",
      color: "bg-amber-500/10 border-amber-500/20 text-amber-600",
    },
    {
      icon: History,
      label: "History",
      to: "/history",
      color: "bg-accent border-accent/60 text-accent-foreground",
    },
    {
      icon: FileText,
      label: "Reports",
      to: "/report",
      color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
    },
    {
      icon: Package2,
      label: t("nav.medvault", "Med Vault"),
      to: "/medvault",
      color: "bg-teal-500/10 border-teal-500/20 text-teal-600",
      description: "Pill Stock Tracker",
    },
    {
      icon: Pill,
      label: t("nav.medications", "Medications"),
      to: "/medications",
      color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600",
      description: "Prescription Cabinet",
    },
  ];

  const todayReminders = useMemo(() => {
    const todayNum = new Date().getDay();
    const todayStr = new Date().toDateString();

    return scopedReminders.filter((r) => {
      if (!r.enabled) return false;

      // 1. Filter out 'once' reminders if they were already completed on a previous day
      if (r.repeatSchedule === "once") {
        const previousDayLog = scopedDoseLogs.some(l => 
          l.reminderId === r.id && 
          ["taken", "skipped", "missed"].includes(l.action) &&
          new Date(l.actionTime).toDateString() !== todayStr &&
          new Date(l.actionTime).getTime() < new Date().getTime()
        );
        if (previousDayLog) {
          const hasTodayLog = scopedDoseLogs.some(l => 
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
    });
  }, [scopedReminders, scopedDoseLogs]);

  const expectedDosesToday = useMemo(() => {
    return todayReminders.reduce((sum, r) => sum + ((r?.time || "").split(",").filter(Boolean).length || 1), 0);
  }, [todayReminders]);

  const takenToday = scopedDoseLogs.filter(
    (l) =>
      l.action === "taken" &&
      new Date(l.actionTime).toDateString() === new Date().toDateString()
  ).length;

  const adherencePercent = useMemo(() => {
    const chartData = calculateVitalitySummary(scopedDoseLogs, scopedWellnessLogs);
    return Math.round(chartData.reduce((acc, d) => acc + d.adherence, 0) / 7) || 0;
  }, [scopedDoseLogs, scopedWellnessLogs]);

  useEffect(() => {
    if (expectedDosesToday > 0 && takenToday >= expectedDosesToday) {
      const today = new Date().toDateString();
      const lastCelebrated = localStorage.getItem("last_celebration_date");

      if (lastCelebrated !== today) {
        setShowAchievement(true);
        localStorage.setItem("last_celebration_date", today);
      }
    }
  }, [takenToday, expectedDosesToday]);

  // scheduledTime is the exact ISO datetime for the specific dose slot being actioned,
  // provided by DailyTimeline so each slot in a multi-dose reminder is tracked individually.
  const handleAction = async (
    reminder: any,
    action: "taken" | "skipped",
    scheduledTime: string
  ) => {
    try {
      await logDose({
        reminderId: reminder.id,
        medicineName: reminder.medicineName,
        dose: reminder.dose,
        scheduledTime,
        action,
      });
      toast.success(action === "taken" ? "Dose logged!" : "Dose skipped.");
    } catch (error) {
      toast.error("Failed to log dose");
    }
  };

  return (
    <div className="pt-2 sm:pt-4">
      <AchievementOverlay
        open={showAchievement}
        onClose={() => setShowAchievement(false)}
        title="Perfect Day!"
        subtitle="You've taken all your scheduled medications for today. Keep up the great work!"
        emoji="🏆"
      />

      {/* 1. Greeting & Search */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <greetingInfo.icon size={14} className={greetingInfo.color} />
              <span className="text-[12px] font-normal text-muted-foreground">
                {greetingInfo.text}
              </span>
            </div>
            <h1 className="text-[32px] sm:text-[38px] font-semibold tracking-tight text-foreground leading-none">
              Hi,{" "}
              <span>
                {userProfile?.name?.split(" ")[0] ||
                  t("dashboard.greeting_there")}
              </span>
            </h1>
          </div>
          {selectedPatientId ? (
            <button
              onClick={() => setSelectedPatientId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-[12px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/15 active:scale-95 transition-all"
            >
              <User size={14} className="text-primary" />
              <span>Switch Profile</span>
            </button>
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-primary font-semibold text-[15px] border border-blue-500/25 shadow-xs">
              {userProfile?.name?.charAt(0) || "U"}
            </div>
          )}
        </div>

        {/* Circle of Care (Family Status) */}
        {(isProfessionalMode || patients.length > 0) && (
          <FamilyStatusDots
            patients={patients}
            selectedId={selectedPatientId}
            onSelect={setSelectedPatientId}
          />
        )}
      </div>

      {/* 2. Combined Hero Section */}
      <StatusHero
        nextDose={nextDose}
        takenToday={takenToday}
        totalToday={expectedDosesToday}
        onNextDoseClick={() => navigate("/reminders")}
        onProgressClick={() => navigate("/history")}
      />

      {/* 3. AI Health Insight Card */}
      <AIInsightCard adherencePercent={adherencePercent} />

      {/* 4. Critical Stock & Refill Alerts */}
      {refillStatuses.length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="section-title flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} className="text-amber-500" />
            Stock &amp; Refill Alerts
          </h2>
          {refillStatuses.map((status) => (
            <div
              key={status.medicineId}
              className="rounded-[18px] border border-amber-500/25 bg-amber-500/[0.03] hover:border-amber-500/40 p-4 flex items-center justify-between transition-all shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
                  <Package2 size={18} />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-foreground">
                    {status.medicineName}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {status.currentQuantity === 0
                      ? "Out of stock"
                      : status.daysRemaining !== null
                      ? `~${status.daysRemaining} day${status.daysRemaining !== 1 ? "s" : ""} remaining (${status.currentQuantity} units)`
                      : `Low stock (${status.currentQuantity} units)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/medvault")}
                className="h-8 px-4 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 text-[12px] font-medium shadow-xs active:scale-95 transition-all"
              >
                Refill
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 5. Daily Timeline (Reminders) */}
      <DailyTimeline
        reminders={todayReminders}
        doseLogs={scopedDoseLogs}
        onAction={handleAction}
      />

      {/* 6. Health Widgets (Water/Mood) */}
      <HealthWidgets
        wellnessLogs={scopedWellnessLogs}
        onAddLog={(type, data) =>
          addWellnessLog({ type, data, patientId: selectedPatientId })
        }
      />

      {/* 7. Bento Grid Tools & Actions */}
      <div className="mb-10">
        <h2 className="section-title flex items-center gap-2">
          <Plus size={14} className="text-[#0066cc] dark:text-[#2997ff]" />
          Tools &amp; Services
        </h2>

        {/* Apple Dynamic Bento Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3.5"
        >
          {/* Hero Tile: Quick Scan (col-span-2) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            onClick={() => navigate(quickActions[0].to)}
            className="col-span-2 sm:col-span-2 rounded-[22px] p-5 sm:p-6 min-h-[180px] sm:min-h-[200px] flex flex-col justify-between items-start text-left border border-blue-500/30 bg-gradient-to-br from-[#0b1b36] via-[#0e2448] to-[#071326] text-white relative overflow-hidden group shadow-lg shadow-blue-950/25 hover:shadow-blue-500/10 hover:border-blue-400/50 transition-all duration-300"
          >
            {/* Animated Laser Scanning Beam */}
            <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(56,189,248,0.8)] animate-bento-scanner pointer-events-none" />

            {/* Subtle Clinical Vignette */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header: Camera Squircle + AI Vision Badge */}
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/25 backdrop-blur-md border border-blue-400/40 flex items-center justify-center text-blue-200 group-hover:scale-105 transition-all duration-200 shadow-xs">
                <Camera size={20} className="group-hover:rotate-6 transition-transform duration-300" />
              </div>
              <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-md border border-blue-400/35 text-blue-100 flex items-center gap-1.5 shadow-xs">
                <Sparkles size={11} className="text-cyan-300" />
                <span>AI Vision</span>
              </span>
            </div>

            {/* Footer Text */}
            <div className="relative z-10 pt-4">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-cyan-300 mb-0.5">Recognition</p>
              <h3 className="text-[22px] sm:text-[24px] font-semibold leading-tight tracking-tight text-white">
                Quick Scan
              </h3>
              <p className="text-[13px] text-blue-100/75 mt-1 font-normal leading-snug">
                Identify pills, bottles, and prescriptions instantly
              </p>
            </div>
          </motion.button>

          {/* Metric Tile: Adherence (col-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/history")}
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-emerald-500/20 bg-gradient-to-br from-card via-card to-emerald-500/[0.05] dark:to-emerald-500/[0.08] hover:border-emerald-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs transition-colors">
                <History size={17} />
              </div>
              {/* Apple Activity Progress Ring */}
              <svg width="32" height="32" viewBox="0 0 36 36" className="transform -rotate-90 shrink-0">
                <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="88"
                  strokeDashoffset={88 - (88 * Math.min(Math.max(adherencePercent, 0), 100)) / 100}
                  strokeLinecap="round"
                  className="text-emerald-500 dark:text-emerald-400 transition-all duration-700 ease-out"
                />
              </svg>
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[22px] font-bold leading-none tracking-tight text-emerald-600 dark:text-emerald-400 flex items-baseline">
                {adherencePercent}<span className="text-[13px] font-medium text-muted-foreground ml-0.5">%</span>
              </p>
              <p className="text-[12px] text-muted-foreground font-medium mt-1">Adherence</p>
            </div>
          </motion.button>

          {/* Metric Tile: Pill Stock / Med Vault (col-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/medvault")}
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-amber-500/20 bg-gradient-to-br from-card via-card to-amber-500/[0.05] dark:to-amber-500/[0.08] hover:border-amber-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs transition-colors">
                <Package2 size={17} />
              </div>
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                Vault
              </span>
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[22px] font-bold leading-none tracking-tight text-amber-600 dark:text-amber-400">
                {formatCompactNumber(totalPillsCount)}<span className="text-[12px] font-normal text-muted-foreground ml-1">units</span>
              </p>
              <p className="text-[12px] text-muted-foreground font-medium mt-1">Med Vault</p>
            </div>
          </motion.button>

          {/* Wide Tile: Family Hub / Circle of Care (col-span-2) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[1].to)}
            className="col-span-2 sm:col-span-2 rounded-[22px] p-5 min-h-[92px] flex items-center gap-4 border border-teal-500/20 bg-gradient-to-br from-card via-card to-teal-500/[0.05] dark:to-teal-500/[0.08] hover:border-teal-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-xs">
              <Users size={18} />
            </div>
            <div className="flex-1 text-left min-w-0 relative z-10">
              <p className="text-[15px] font-semibold leading-tight text-foreground truncate">
                {quickActions[1].label}
              </p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.6)]" />
                Circle of Care
              </p>
            </div>
            <div className="flex -space-x-1.5 shrink-0 relative z-10">
              {patients.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="w-7 h-7 rounded-full border-2 border-card bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[11px] font-semibold flex items-center justify-center uppercase shadow-xs"
                >
                  {p.name.charAt(0)}
                </div>
              ))}
              {patients.length === 0 && (
                <div className="w-7 h-7 rounded-full border border-dashed border-border text-muted-foreground flex items-center justify-center">
                  <Plus size={12} />
                </div>
              )}
            </div>
          </motion.button>

          {/* Metric Tile: Reminders (col-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/reminders")}
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-indigo-500/20 bg-gradient-to-br from-card via-card to-indigo-500/[0.05] dark:to-indigo-500/[0.08] hover:border-indigo-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs transition-colors">
                <Bell size={17} />
              </div>
              <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                {takenToday}/{expectedDosesToday}
              </span>
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[15px] font-semibold text-foreground leading-tight">Reminders</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">
                {expectedDosesToday - takenToday <= 0 ? "Completed" : `${expectedDosesToday - takenToday} remaining`}
              </p>
            </div>
          </motion.button>

          {/* Small Tile: Wellness (col-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[2].to)}
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-rose-500/20 bg-gradient-to-br from-card via-card to-rose-500/[0.05] dark:to-rose-500/[0.08] hover:border-rose-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-400 shadow-xs transition-colors">
                <Heart size={17} />
              </div>
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[15px] font-semibold text-foreground leading-tight">Wellness</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">Health Log</p>
            </div>
          </motion.button>

          {/* Metric Tile: Medications Cabinet (col-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/medications")}
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-blue-500/20 bg-gradient-to-br from-card via-card to-blue-500/[0.05] dark:to-blue-500/[0.08] hover:border-blue-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs transition-colors">
                <Pill size={17} />
              </div>
              <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                {scopedMedicines.length}
              </span>
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[15px] font-semibold text-foreground leading-tight">Medications</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">Cabinet</p>
            </div>
          </motion.button>

          {/* Small Tile: Travel (col-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[3].to)}
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-sky-500/20 bg-gradient-to-br from-card via-card to-sky-500/[0.05] dark:to-sky-500/[0.08] hover:border-sky-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-xs transition-colors relative z-10">
              <Plane size={17} />
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[15px] font-semibold text-foreground leading-tight">Travel</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">Companion</p>
            </div>
          </motion.button>

          {/* Wide Tile: Safety Check (col-span-2) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[4].to)}
            className="col-span-2 sm:col-span-2 rounded-[22px] p-5 min-h-[92px] flex items-center gap-4 border border-orange-500/20 bg-gradient-to-br from-card via-card to-orange-500/[0.05] dark:to-orange-500/[0.08] hover:border-orange-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0 shadow-xs">
              <ShieldAlert size={18} />
            </div>
            <div className="flex-1 text-left min-w-0 relative z-10">
              <p className="text-[15px] font-semibold leading-tight text-foreground">Safety Check</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">Rx Interactions &amp; Allergies</p>
            </div>
            <span className="text-[12px] font-medium px-3.5 py-1 rounded-full bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-300 border border-orange-500/30 transition-colors shrink-0 relative z-10">
              Review
            </span>
          </motion.button>

          {/* Wide Tile: Medical Reports (col-span-2, sm:col-span-4) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[7].to)}
            className="col-span-2 sm:col-span-4 rounded-[22px] p-5 sm:p-6 min-h-[92px] flex items-center gap-4 border border-purple-500/20 bg-gradient-to-br from-card via-card to-purple-500/[0.05] dark:to-purple-500/[0.08] hover:border-purple-500/40 shadow-xs group relative overflow-hidden transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-xs">
              <FileText size={18} />
            </div>
            <div className="flex-1 text-left min-w-0 relative z-10">
              <p className="text-[15px] font-semibold leading-tight text-foreground">Medical Reports</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">Clinical PDF Export &amp; Analytics</p>
            </div>
            {/* Clinical ECG / Sparkline Trend Graphic */}
            <div className="hidden sm:block shrink-0 w-24 h-7 opacity-90 group-hover:opacity-100 transition-opacity relative z-10">
              <svg className="w-full h-full" viewBox="0 0 70 22" fill="none">
                <path
                  d="M2 18 C 12 18, 16 7, 26 12 C 36 17, 42 3, 52 8 C 60 12, 64 5, 68 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-purple-500/70"
                />
                <circle cx="68" cy="4" r="2.5" fill="currentColor" className="text-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.7)]" />
              </svg>
            </div>
            <span className="text-[12px] font-medium px-3.5 py-1 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition-colors shrink-0 relative z-10">
              Export
            </span>
          </motion.button>
        </motion.div>
      </div>

      {/* 8. Wellness Pulse */}
      <DashboardBanner />

      {/* 9. Discover / Slideshow */}
      <div className="mb-8">
        <h2 className="section-title flex items-center gap-2">
          <Sparkles size={14} className="text-amber-500" />
          Discover &amp; Learn
        </h2>
        <FeatureSlideshow />
      </div>

      {/* 10. Disclaimer */}
      <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-5 mb-8">
        <p className="text-[10px] text-warning/80 leading-relaxed flex items-start gap-3 font-medium uppercase tracking-wide">
          <span className="shrink-0 text-xs">
            <RiveMoji emoji="⚠️" size={16} />
          </span>
          <span>{t("dashboard.disclaimer")}</span>
        </p>
      </div>
    </div>
  );
}
