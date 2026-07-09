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
      .filter((s): s is RefillStatus => s !== null && s.isLow);
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

  const todayReminders = scopedReminders.filter((r) => r.enabled);

  const expectedDosesToday = useMemo(() => {
    let count = 0;
    const todayNum = new Date().getDay();
    todayReminders.forEach((r) => {
      if (
        r.repeatSchedule === "custom" &&
        r.repeatDays &&
        r.repeatDays.length > 0
      ) {
        if (!r.repeatDays.includes(todayNum)) return;
      }
      if (r.repeatSchedule === "weekly") {
        if (r.repeatDays && r.repeatDays.length > 0) {
          if (!r.repeatDays.includes(todayNum)) return;
        } else {
          const createdDay = new Date(r.createdAt).getDay();
          if (createdDay !== todayNum) return;
        }
      }
      count += r.time.split(",").length;
    });
    return count;
  }, [todayReminders]);

  const takenToday = scopedDoseLogs.filter(
    (l) =>
      l.action === "taken" &&
      new Date(l.actionTime).toDateString() === new Date().toDateString()
  ).length;

  const adherencePercent =
    expectedDosesToday > 0
      ? Math.round((takenToday / expectedDosesToday) * 100)
      : 100;

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
    <div className="px-4 pt-8 pb-24">
      <AchievementOverlay
        open={showAchievement}
        onClose={() => setShowAchievement(false)}
        title="Perfect Day!"
        subtitle="You've taken all your scheduled medications for today. Keep up the great work!"
        emoji="🏆"
      />

      {/* 1. Greeting & Search */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <greetingInfo.icon size={16} className={greetingInfo.color} />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70">
                {greetingInfo.text}
              </span>
            </div>
            <motion.h1
              variants={item}
              className="text-3xl font-black tracking-tight text-foreground leading-none"
            >
              Hi,{" "}
              <span className="text-primary">
                {userProfile?.name?.split(" ")[0] ||
                  t("dashboard.greeting_there")}
              </span>
            </motion.h1>
          </div>
          {selectedPatientId ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedPatientId(null)}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <User size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                Switch
              </span>
            </motion.button>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground font-black border border-border shadow-sm">
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
      </motion.div>

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

      {/* 4. Critical Alerts (Conditional) */}
      {refillStatuses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8 space-y-3"
        >
          <h2 className="section-title flex items-center gap-2 text-warning">
            <AlertTriangle size={14} />
            Critical Refills
          </h2>
          {refillStatuses.map((status) => (
            <div
              key={status.medicineId}
              className="glass-card border-warning/30 bg-warning/5 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center text-warning">
                  <Package2 size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {status.medicineName}
                  </p>
                  <p className="text-[10px] font-bold text-warning uppercase tracking-wider">
                    {status.currentQuantity === 0
                      ? "Out of Stock"
                      : status.daysRemaining !== null
                      ? `${status.daysRemaining} day${status.daysRemaining !== 1 ? "s" : ""} remaining`
                      : `Low stock (${status.currentQuantity} left)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  navigate("/medvault")
                }
                className="bg-warning text-warning-foreground text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider"
              >
                Refill
              </button>
            </div>
          ))}
        </motion.div>
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
      {/* 7. Bento Grid Quick Actions */}
      <div className="mb-10">
        <h2 className="section-title flex items-center gap-2">
          <Plus size={14} />
          Tools &amp; Actions
        </h2>

        {/* ── BENTO GRID ── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >

          {/* ── HERO TILE: Quick Scan (col-span-2, tall) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(quickActions[0].to)}
            className="col-span-2 row-span-2 rounded-[2rem] p-5 h-[200px] sm:h-auto flex flex-col justify-between items-start text-left relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/30 hover:scale-[1.01] transition-all duration-300"
          >
            {/* Animated scanning line */}
            <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_14px_#22d3ee] animate-scanner-line pointer-events-none" />

            {/* Ambient glows */}
            <motion.div
              className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-400/25 rounded-full blur-3xl pointer-events-none"
              animate={{ scale: [1, 1.2, 1], x: [0, 8, -8, 0], y: [0, -8, 8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-10 -left-10 w-32 h-32 bg-violet-400/25 rounded-full blur-3xl pointer-events-none"
              animate={{ scale: [1, 1.15, 1], x: [0, -6, 6, 0], y: [0, 6, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />

            {/* AI Badge */}
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-[9px] font-black tracking-widest uppercase text-white/95 flex items-center gap-1.5 backdrop-blur-md z-10">
              <Sparkles size={8} className="animate-pulse text-cyan-300" />
              AI Vision
            </div>

            {/* Icon */}
            <div className="p-3 bg-white/15 border border-white/25 rounded-2xl backdrop-blur-md shadow-inner relative z-10 mt-1">
              <Camera size={24} />
            </div>

            {/* Label */}
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-0.5">AI Recognition</p>
              <h3 className="text-2xl font-black leading-tight tracking-tight">Quick Scan</h3>
              <p className="text-xs text-white/60 mt-1 font-medium">Identify any medicine instantly</p>
            </div>
          </motion.button>

          {/* ── METRIC TILE: Adherence (small) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/history")}
            className="col-span-1 rounded-[1.5rem] p-4 h-[95px] sm:h-auto flex flex-col justify-between relative overflow-hidden text-left border bg-gradient-to-br from-cyan-500/8 to-sky-600/12 dark:from-cyan-950/30 dark:to-sky-900/25 border-cyan-500/20 hover:border-cyan-400/40 hover-wiggle transition-all duration-200"
          >
            {/* Ambient circle glow */}
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-cyan-400/15 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between w-full">
              <div className="p-2 bg-cyan-500/15 border border-cyan-500/20 rounded-xl text-cyan-600 dark:text-cyan-400 wiggle-icon">
                <History size={15} />
              </div>
              {/* Mini arc */}
              <svg width="36" height="36" viewBox="0 0 36 36" className="opacity-80">
                <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-cyan-500/15" />
                <circle
                  cx="18" cy="18" r="14" fill="none"
                  stroke="currentColor" strokeWidth="3"
                  strokeDasharray={`${(adherencePercent / 100) * 88} 88`}
                  strokeLinecap="round"
                  strokeDashoffset="22"
                  className="text-cyan-500 dark:text-cyan-400"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                />
              </svg>
            </div>
            <div>
              <p className="text-[18px] font-black leading-none text-foreground">{adherencePercent}<span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 ml-0.5">%</span></p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 mt-0.5">Adherence</p>
            </div>
          </motion.button>

          {/* ── METRIC TILE: Pill Stock (small) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/medvault")}
            className="col-span-1 rounded-[1.5rem] p-4 h-[95px] sm:h-auto flex flex-col justify-between relative overflow-hidden text-left border bg-gradient-to-br from-teal-500/8 to-emerald-600/12 dark:from-teal-950/30 dark:to-emerald-900/25 border-teal-500/20 hover:border-teal-400/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-teal-400/15 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between w-full">
              <div className="p-2 bg-teal-500/15 border border-teal-500/20 rounded-xl text-teal-600 dark:text-teal-400 wiggle-icon">
                <Package2 size={15} />
              </div>
              {/* Mini bar stack */}
              <div className="flex items-end gap-[3px] h-6">
                {[0.4, 0.7, 0.55, 0.9, 0.65].map((h, i) => (
                  <div
                    key={i}
                    className="w-[5px] rounded-sm bg-teal-500 dark:bg-teal-400"
                    style={{ height: `${h * 100}%`, opacity: 0.4 + h * 0.6 }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[18px] font-black leading-none text-foreground">{formatCompactNumber(totalPillsCount)}<span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 ml-0.5">pills</span></p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mt-0.5">Med Vault</p>
            </div>
          </motion.button>

          {/* ── WIDE TILE: Family Hub (col-span-2) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[1].to)}
            className="col-span-2 sm:col-span-2 rounded-[1.75rem] p-4 h-[80px] sm:h-auto flex items-center gap-4 relative overflow-hidden border bg-gradient-to-br from-emerald-500/8 via-teal-500/10 to-emerald-500/8 dark:from-emerald-950/25 dark:to-teal-900/25 border-emerald-500/20 hover:border-emerald-500/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 wiggle-icon shrink-0">
              <Users size={18} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-extrabold text-sm leading-tight text-foreground truncate">{quickActions[1].label}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Circle of Care</p>
            </div>
            {/* Patient avatar cluster */}
            <div className="flex -space-x-2 shrink-0">
              {patients.slice(0, 3).map((p, idx) => (
                <div key={p.id || idx} className="w-7 h-7 rounded-full border-2 border-background bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-black text-white flex items-center justify-center uppercase">
                  {p.name.charAt(0)}
                </div>
              ))}
              {patients.length === 0 && (
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-emerald-500/40 flex items-center justify-center text-emerald-500/50">
                  <Plus size={10} />
                </div>
              )}
            </div>
          </motion.button>

          {/* ── TALL METRIC TILE: Today's Doses (col-span-1, row-span-2) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/reminders")}
            className="col-span-1 row-span-2 rounded-[1.75rem] p-4 h-full flex flex-col justify-between relative overflow-hidden text-left border bg-gradient-to-br from-violet-500/8 to-fuchsia-600/12 dark:from-violet-950/30 dark:to-fuchsia-900/25 border-violet-500/20 hover:border-violet-400/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-violet-500/15 rounded-full blur-2xl pointer-events-none" />

            <div className="p-2 bg-violet-500/15 border border-violet-500/20 rounded-xl text-violet-600 dark:text-violet-400 wiggle-icon self-start">
              <Bell size={15} />
            </div>

            {/* Dose pill dots */}
            <div className="flex flex-wrap gap-1.5 my-2">
              {Array.from({ length: Math.min(expectedDosesToday, 8) }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border ${
                    i < takenToday
                      ? "bg-violet-500 border-violet-400"
                      : "bg-violet-500/15 border-violet-500/30"
                  }`}
                />
              ))}
              {expectedDosesToday === 0 && (
                <p className="text-[9px] text-violet-500/60 font-bold uppercase tracking-wider">No doses</p>
              )}
            </div>

            <div>
              <p className="text-[22px] font-black leading-none text-foreground">
                {takenToday}<span className="text-sm font-bold text-violet-500/70 dark:text-violet-400/70">/{expectedDosesToday}</span>
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 mt-1">Reminders</p>
              <p className="text-[8px] text-violet-600/70 dark:text-violet-400/60 font-semibold mt-0.5">
                {expectedDosesToday - takenToday <= 0 ? "All done ✓" : `${expectedDosesToday - takenToday} left`}
              </p>
            </div>
          </motion.button>

          {/* ── SMALL TILE: Wellness ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(quickActions[2].to)}
            className="col-span-1 rounded-[1.5rem] p-4 h-[95px] sm:h-auto flex flex-col justify-between relative overflow-hidden text-left border bg-gradient-to-br from-rose-500/8 to-pink-600/12 dark:from-rose-950/30 dark:to-pink-900/25 border-rose-500/20 hover:border-rose-400/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -bottom-5 -right-5 w-20 h-20 bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="p-2 bg-rose-500/15 border border-rose-500/20 rounded-xl text-rose-500 animate-pulse-glow wiggle-icon">
              <Heart size={15} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground leading-tight">Wellness</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-rose-600/80 dark:text-rose-400/80 mt-0.5">Health Log</p>
            </div>
          </motion.button>

          {/* ── METRIC TILE: Medications Saved (small) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/medications")}
            className="col-span-1 rounded-[1.5rem] p-4 h-[95px] sm:h-auto flex flex-col justify-between relative overflow-hidden text-left border bg-gradient-to-br from-indigo-500/8 to-purple-600/12 dark:from-indigo-950/30 dark:to-purple-900/25 border-indigo-500/20 hover:border-indigo-400/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -bottom-5 -right-5 w-20 h-20 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="p-2 bg-indigo-500/15 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 wiggle-icon">
                <Pill size={15} />
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/25 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">{scopedMedicines.length}</span>
            </div>
            <div>
              <p className="text-sm font-black text-foreground leading-tight">Medications</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Cabinet</p>
            </div>
          </motion.button>

          {/* ── SMALL TILE: Travel ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(quickActions[3].to)}
            className="col-span-2 sm:col-span-1 rounded-[1.5rem] p-4 h-[95px] sm:h-auto flex flex-col justify-between relative overflow-hidden text-left border bg-gradient-to-br from-sky-500/8 to-blue-600/12 dark:from-sky-950/30 dark:to-blue-900/25 border-sky-500/20 hover:border-sky-400/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -bottom-5 -right-5 w-20 h-20 bg-sky-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="p-2 bg-sky-500/15 border border-sky-500/20 rounded-xl text-sky-500 animate-float-plane wiggle-icon">
              <Plane size={15} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground leading-tight">Travel</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-sky-600/80 dark:text-sky-400/80 mt-0.5">Companion</p>
            </div>
          </motion.button>

          {/* ── WIDE TILE: Safety Check (col-span-2, sm:col-span-3) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[4].to)}
            className="col-span-2 sm:col-span-3 rounded-[1.75rem] p-4 h-[80px] sm:h-auto flex items-center gap-4 relative overflow-hidden border bg-gradient-to-br from-amber-500/8 via-orange-500/10 to-amber-500/8 dark:from-amber-950/25 dark:to-orange-950/20 border-amber-500/20 hover:border-amber-500/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 wiggle-icon shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-extrabold text-sm leading-tight text-foreground">Safety Check</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80 mt-0.5">Rx Interactions</p>
            </div>
            <span className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-800 dark:text-amber-300 uppercase tracking-widest shrink-0">Check</span>
          </motion.button>

          {/* ── WIDE METRIC TILE: Reports with sparkline (col-span-2, sm:col-span-4) ── */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[7].to)}
            className="col-span-2 sm:col-span-4 rounded-[1.75rem] p-4 h-[95px] sm:h-auto flex items-center gap-4 relative overflow-hidden border bg-gradient-to-br from-indigo-500/8 via-purple-500/8 to-indigo-500/8 dark:from-indigo-950/25 dark:to-purple-900/20 border-indigo-500/20 hover:border-indigo-400/40 hover-wiggle transition-all duration-200"
          >
            <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 wiggle-icon shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-extrabold text-sm leading-tight text-foreground">Reports</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">PDF &amp; Analytics</p>
            </div>
            {/* Sparkline */}
            <div className="shrink-0 w-16 h-7 opacity-75 dark:opacity-90">
              <svg className="w-full h-full" viewBox="0 0 60 24" fill="none">
                <motion.path
                  d="M2 20 C 10 14, 14 18, 22 10 C 30 2, 36 14, 58 5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-indigo-500 dark:text-indigo-400"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                />
                <circle cx="58" cy="5" r="3" fill="currentColor" className="text-purple-400 animate-pulse" />
              </svg>
            </div>
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
