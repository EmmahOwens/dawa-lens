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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-[12px] font-normal text-foreground hover:bg-muted active:scale-95 transition-all"
            >
              <User size={14} className="text-primary" />
              <span>Switch Profile</span>
            </button>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-medium text-[15px] border border-border">
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
          <h2 className="section-title flex items-center gap-2 text-warning">
            <AlertTriangle size={13} />
            Stock & Refill Alerts
          </h2>
          {refillStatuses.map((status) => (
            <div
              key={status.medicineId}
              className="rounded-[18px] border border-border bg-card p-4 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-warning">
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
                className="h-8 px-4 rounded-full bg-primary text-primary-foreground text-[12px] font-normal hover:brightness-105 active:scale-95 transition-all"
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
          <Plus size={13} />
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
            className="col-span-2 sm:col-span-2 rounded-[22px] p-5 sm:p-6 min-h-[180px] sm:min-h-[200px] flex flex-col justify-between items-start text-left border border-cyan-500/30 bg-gradient-to-br from-[#121629] via-[#0d1224] to-[#1a1435] text-white relative overflow-hidden group shadow-lg shadow-cyan-950/20 hover:shadow-cyan-500/15 hover:border-cyan-400/50 transition-all duration-300"
          >
            {/* Animated Laser Scanning Beam */}
            <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_rgba(34,211,238,0.9)] animate-bento-scanner pointer-events-none" />

            {/* Ambient Apple Intelligence Glows */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-400/30 transition-all duration-700" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-violet-600/25 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-600/35 transition-all duration-700" />

            {/* Header: Camera Squircle + AI Vision Badge */}
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30 flex items-center justify-center text-cyan-300 group-hover:scale-105 group-hover:border-cyan-400/50 transition-all duration-300 shadow-sm">
                <Camera size={20} className="group-hover:rotate-6 transition-transform duration-300" />
              </div>
              <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-cyan-500/15 backdrop-blur-md border border-cyan-400/30 text-cyan-100 flex items-center gap-1.5 shadow-xs">
                <Sparkles size={11} className="text-cyan-300 animate-pulse" />
                <span>AI Vision</span>
              </span>
            </div>

            {/* Footer Text */}
            <div className="relative z-10 pt-4">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-cyan-300 mb-0.5">Recognition</p>
              <h3 className="text-[22px] sm:text-[24px] font-semibold leading-tight tracking-tight text-white">
                Quick Scan
              </h3>
              <p className="text-[13px] text-cyan-100/70 mt-1 font-normal leading-snug">
                Identify pills, bottles, and prescriptions instantly
              </p>
            </div>
          </motion.button>

          {/* Metric Tile: Adherence (col-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/history")}
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] transition-colors">
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
                  className="text-[#0066cc] dark:text-[#2997ff] transition-all duration-700 ease-out"
                />
              </svg>
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[22px] font-semibold leading-none tracking-tight text-foreground flex items-baseline">
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
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-foreground transition-colors">
                <Package2 size={17} />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/60">
                Vault
              </span>
            </div>
            <div className="relative z-10 pt-3">
              <p className="text-[22px] font-semibold leading-none tracking-tight text-foreground">
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
            className="col-span-2 sm:col-span-2 rounded-[22px] p-5 min-h-[92px] flex items-center gap-4 border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] shrink-0">
              <Users size={18} />
            </div>
            <div className="flex-1 text-left min-w-0 relative z-10">
              <p className="text-[15px] font-semibold leading-tight text-foreground truncate">
                {quickActions[1].label}
              </p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Circle of Care
              </p>
            </div>
            <div className="flex -space-x-1.5 shrink-0 relative z-10">
              {patients.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="w-7 h-7 rounded-full border-2 border-card bg-secondary text-[11px] font-semibold text-foreground flex items-center justify-center uppercase shadow-xs"
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
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-foreground transition-colors">
                <Bell size={17} />
              </div>
              <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border/60">
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
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-rose-500 transition-colors">
                <Heart size={17} />
              </div>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
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
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-foreground transition-colors">
                <Pill size={17} />
              </div>
              <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border/60">
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
            className="col-span-1 rounded-[22px] p-5 min-h-[142px] flex flex-col justify-between text-left border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="w-9 h-9 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-foreground transition-colors relative z-10">
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
            className="col-span-2 sm:col-span-2 rounded-[22px] p-5 min-h-[92px] flex items-center gap-4 border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-amber-500 shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div className="flex-1 text-left min-w-0 relative z-10">
              <p className="text-[15px] font-semibold leading-tight text-foreground">Safety Check</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">Rx Interactions &amp; Allergies</p>
            </div>
            <span className="text-[12px] font-medium px-3.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-foreground border border-border/60 transition-colors shrink-0 relative z-10">
              Review
            </span>
          </motion.button>

          {/* Wide Tile: Medical Reports (col-span-2, sm:col-span-4) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[7].to)}
            className="col-span-2 sm:col-span-4 rounded-[22px] p-5 sm:p-6 min-h-[92px] flex items-center gap-4 border border-border/80 bg-card hover:border-foreground/20 hover:bg-card/90 shadow-xs group relative overflow-hidden transition-colors duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 text-left min-w-0 relative z-10">
              <p className="text-[15px] font-semibold leading-tight text-foreground">Medical Reports</p>
              <p className="text-[12px] text-muted-foreground font-normal mt-0.5">Clinical PDF Export &amp; Analytics</p>
            </div>
            {/* Clinical ECG / Sparkline Trend Graphic */}
            <div className="hidden sm:block shrink-0 w-24 h-7 opacity-75 group-hover:opacity-100 transition-opacity relative z-10">
              <svg className="w-full h-full" viewBox="0 0 70 22" fill="none">
                <path
                  d="M2 18 C 12 18, 16 7, 26 12 C 36 17, 42 3, 52 8 C 60 12, 64 5, 68 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                />
                <circle cx="68" cy="4" r="2" fill="currentColor" className="text-[#0066cc] dark:text-[#2997ff]" />
              </svg>
            </div>
            <span className="text-[12px] font-medium px-3.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-foreground border border-border/60 transition-colors shrink-0 relative z-10">
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
          <Sparkles size={14} />
          Discover & Learn
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
