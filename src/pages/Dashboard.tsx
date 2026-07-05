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
        "bg-warning/10 border-warning/20 text-warning-foreground dark:text-warning",
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
          Tools & Actions
        </h2>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-2 sm:grid-cols-4 sm:grid-rows-5 gap-3 h-auto sm:h-[520px]"
        >
          {/* Large Card: Quick Scan */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[0].to)}
            className="col-span-2 sm:row-span-2 rounded-[2rem] p-6 min-h-[160px] sm:min-h-0 flex flex-col justify-between items-start text-left relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.01] transition-all duration-300"
          >
            {/* Animated Scanning Line */}
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_#22d3ee] animate-scanner-line pointer-events-none" />
            
            {/* Ambient Background Glows */}
            <motion.div
              className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-400/25 rounded-full blur-2xl pointer-events-none"
              animate={{
                scale: [1, 1.2, 1],
                x: [0, 8, -8, 0],
                y: [0, -8, 8, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute -bottom-8 -left-8 w-28 h-28 bg-violet-400/25 rounded-full blur-2xl pointer-events-none"
              animate={{
                scale: [1, 1.15, 1],
                x: [0, -6, 6, 0],
                y: [0, 6, -6, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />
            
            {/* Top Badge */}
            <div className="absolute top-5 right-5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-[9px] font-black tracking-widest uppercase text-white/95 flex items-center gap-1.5 backdrop-blur-md shadow-sm">
              <Sparkles size={8} className="animate-pulse text-cyan-300" />
              AI Vision
            </div>

            <div className="p-3 bg-white/15 border border-white/20 rounded-2xl backdrop-blur-md shadow-inner relative z-10">
              <Camera size={26} />
            </div>
            
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-200 opacity-90 mb-0.5">
                {quickActions[0].description}
              </p>
              <h3 className="text-2xl font-black leading-tight tracking-tight">
                {quickActions[0].label}
              </h3>
            </div>
          </motion.button>

          {/* Medium Card: Family Hub */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[1].to)}
            className="col-span-2 sm:row-span-1 rounded-[1.5rem] p-4 flex items-center gap-3 border bg-gradient-to-br from-emerald-500/5 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/20 dark:to-teal-900/25 border-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500/40 hover-wiggle transition-all duration-200"
          >
            <div className="p-2.5 bg-emerald-500/15 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 w-10 h-10 wiggle-icon transition-transform">
              <Users size={20} />
            </div>
            <div className="text-left flex-grow min-w-0">
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-foreground truncate">
                {quickActions[1].label}
              </span>
              <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-bold uppercase tracking-wider block">
                Circle of Care
              </span>
            </div>
            
            {/* Dynamic Patient Bubbles */}
            <div className="flex -space-x-1.5 overflow-hidden shrink-0 pr-1">
              {patients.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="w-7 h-7 rounded-full border-2 border-background bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-black text-white flex items-center justify-center shadow-sm uppercase shrink-0"
                >
                  {p.name.charAt(0)}
                </div>
              ))}
              {patients.length > 3 && (
                <div className="w-7 h-7 rounded-full border-2 border-background bg-teal-800 text-[9px] font-black text-white flex items-center justify-center shadow-sm shrink-0">
                  +{patients.length - 3}
                </div>
              )}
              {patients.length === 0 && (
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-emerald-500/30 flex items-center justify-center text-emerald-500/50 shrink-0">
                  <Plus size={10} />
                </div>
              )}
            </div>
          </motion.button>

          {/* Small Card: Wellness */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[2].to)}
            className="col-span-1 sm:row-span-1 h-24 sm:h-auto rounded-[1.25rem] border bg-gradient-to-br from-rose-500/5 to-pink-500/10 dark:from-rose-950/20 dark:to-pink-900/20 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:border-rose-500/40 hover-wiggle flex flex-col items-center justify-center gap-1.5 transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 dark:bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center animate-pulse-glow wiggle-icon">
              <Heart size={18} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400 leading-none">
              {quickActions[2].label}
            </span>
          </motion.button>

          {/* Small Card: Travel */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[3].to)}
            className="col-span-1 sm:row-span-1 h-24 sm:h-auto rounded-[1.25rem] border bg-gradient-to-br from-sky-500/5 to-blue-500/10 dark:from-sky-950/20 dark:to-blue-900/20 border-sky-500/20 text-sky-600 dark:text-sky-400 hover:border-sky-500/40 hover-wiggle flex flex-col items-center justify-center gap-1.5 transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 dark:bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center animate-float-plane wiggle-icon">
              <Plane size={18} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-400 leading-none">
              {quickActions[3].label}
            </span>
          </motion.button>

          {/* Row 3: Safety Check (2x1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[4].to)}
            className="col-span-2 sm:row-span-1 rounded-[1.5rem] p-4 flex items-center gap-3 border bg-gradient-to-br from-amber-500/5 via-orange-500/10 to-amber-500/5 dark:from-amber-950/25 dark:to-orange-950/20 border-amber-500/30 text-amber-900 dark:text-amber-300 hover:border-amber-500/50 hover-wiggle transition-all duration-200"
          >
            <div className="p-2.5 bg-amber-500/20 dark:bg-amber-500/15 rounded-xl text-amber-700 dark:text-amber-400 border border-amber-500/35 flex items-center justify-center shrink-0 w-10 h-10 wiggle-icon">
              <ShieldAlert size={20} />
            </div>
            <div className="text-left flex-grow min-w-0">
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-amber-950 dark:text-amber-200 truncate">
                {quickActions[4].label}
              </span>
              <span className="text-[9px] text-amber-700/80 dark:text-amber-400/80 font-bold uppercase tracking-wider block">
                Rx Interactions
              </span>
            </div>
            <div className="ml-auto shrink-0 pr-1">
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-300 uppercase tracking-widest">
                Check
              </span>
            </div>
          </motion.button>

          {/* Row 3: Reminders (2x1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[5].to)}
            className="col-span-2 sm:row-span-1 rounded-[1.5rem] p-4 flex items-center gap-3 border bg-gradient-to-br from-violet-500/5 to-fuchsia-500/10 dark:from-violet-950/20 dark:to-fuchsia-900/20 border-violet-500/20 text-violet-800 dark:text-violet-300 hover:border-violet-500/40 hover-wiggle transition-all duration-200"
          >
            <div className="p-2.5 bg-violet-500/15 dark:bg-violet-500/10 rounded-xl text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center justify-center shrink-0 w-10 h-10 wiggle-icon">
              <Bell size={20} />
            </div>
            <div className="text-left flex-grow min-w-0">
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-foreground truncate">
                {quickActions[5].label}
              </span>
              <span className="text-[9px] text-violet-600/80 dark:text-violet-400/80 font-bold uppercase tracking-wider block">
                Daily Schedule
              </span>
            </div>
            <div className="ml-auto shrink-0 pr-1">
              {todayReminders.length > 0 ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-violet-500/15 dark:bg-violet-500/25 border border-violet-500/30 text-violet-700 dark:text-violet-300 uppercase tracking-widest">
                  {expectedDosesToday - takenToday <= 0 ? "Done" : `${expectedDosesToday - takenToday} Left`}
                </span>
              ) : (
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">None</span>
              )}
            </div>
          </motion.button>

          {/* Row 4: History (2x1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[6].to)}
            className="col-span-2 sm:row-span-1 rounded-[1.5rem] p-4 flex items-center gap-3 border bg-gradient-to-br from-cyan-500/5 to-blue-500/10 dark:from-cyan-950/20 dark:to-blue-900/20 border-cyan-500/20 text-cyan-800 dark:text-cyan-300 hover:border-cyan-500/40 hover-wiggle transition-all duration-200"
          >
            <div className="p-2.5 bg-cyan-500/15 dark:bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0 w-10 h-10 wiggle-icon">
              <History size={20} />
            </div>
            <div className="text-left flex-grow min-w-0">
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-foreground truncate">
                {quickActions[6].label}
              </span>
              <span className="text-[9px] text-cyan-600/80 dark:text-cyan-400/80 font-bold uppercase tracking-wider block">
                Dose Log Book
              </span>
            </div>
            <div className="ml-auto shrink-0 pr-1">
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-cyan-500/15 dark:bg-cyan-500/25 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 uppercase tracking-widest">
                {adherencePercent}% Score
              </span>
            </div>
          </motion.button>

          {/* Row 4: Reports (2x1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[7].to)}
            className="col-span-2 sm:row-span-1 rounded-[1.5rem] p-4 flex items-center gap-3 border bg-gradient-to-br from-indigo-500/5 to-purple-500/10 dark:from-indigo-950/20 dark:to-purple-900/20 border-indigo-500/20 text-indigo-800 dark:text-indigo-300 hover:border-indigo-500/40 hover-wiggle transition-all duration-200"
          >
            <div className="p-2.5 bg-indigo-500/15 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 w-10 h-10 wiggle-icon">
              <FileText size={20} />
            </div>
            <div className="text-left flex-grow min-w-0">
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-foreground truncate">
                {quickActions[7].label}
              </span>
              <span className="text-[9px] text-indigo-600/80 dark:text-indigo-400/80 font-bold uppercase tracking-wider block">
                PDF & Analytics
              </span>
            </div>
            
            {/* Sparkline Graphic */}
            <div className="ml-auto shrink-0 pr-1 w-12 h-6 opacity-75 dark:opacity-90">
              <svg className="w-full h-full" viewBox="0 0 50 20" fill="none">
                <motion.path
                  d="M2 18 C 10 12, 12 16, 20 6 C 28 -4, 32 10, 48 4"
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
                <circle
                  cx="48"
                  cy="4"
                  r="2.5"
                  fill="currentColor"
                  className="text-purple-400 animate-pulse"
                />
              </svg>
            </div>
          </motion.button>

          {/* Row 5: Med Vault (col-span-2 sm:row-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/medvault")}
            className="col-span-2 sm:row-span-1 rounded-[1.5rem] p-4 flex items-center gap-3 border bg-gradient-to-br from-teal-500/5 to-cyan-500/10 dark:from-teal-950/20 dark:to-cyan-900/20 border-teal-500/20 text-teal-800 dark:text-teal-300 hover:border-teal-500/40 hover-wiggle transition-all duration-200 text-left"
          >
            <div className="p-2.5 bg-teal-500/15 dark:bg-teal-500/10 rounded-xl text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0 w-10 h-10 wiggle-icon">
              <Package2 size={20} />
            </div>
            <div className="text-left flex-grow min-w-0">
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-foreground truncate">
                {t("nav.medvault", "Med Vault")}
              </span>
              <span className="text-[9px] text-teal-600/80 dark:text-teal-400/80 font-bold uppercase tracking-wider block">
                Pill Stock Tracker
              </span>
            </div>
            <div className="ml-auto shrink-0 pr-1">
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-teal-500/15 dark:bg-teal-500/25 border border-teal-500/30 text-teal-700 dark:text-teal-300 uppercase tracking-widest">
                {totalPillsCount} Pills
              </span>
            </div>
          </motion.button>

          {/* Row 5: Medications (col-span-2 sm:row-span-1) */}
          <motion.button
            variants={item}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/medications")}
            className="col-span-2 sm:row-span-1 rounded-[1.5rem] p-4 flex items-center gap-3 border bg-gradient-to-br from-indigo-500/5 to-purple-500/10 dark:from-indigo-950/20 dark:to-purple-900/20 border-indigo-500/20 text-indigo-800 dark:text-indigo-300 hover:border-indigo-500/40 hover-wiggle transition-all duration-200 text-left"
          >
            <div className="p-2.5 bg-indigo-500/15 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 w-10 h-10 wiggle-icon">
              <Pill size={20} />
            </div>
            <div className="text-left flex-grow min-w-0">
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-foreground truncate">
                {t("nav.medications", "Medications")}
              </span>
              <span className="text-[9px] text-indigo-600/80 dark:text-indigo-400/80 font-bold uppercase tracking-wider block">
                Prescription Cabinet
              </span>
            </div>
            <div className="ml-auto shrink-0 pr-1">
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-500/15 dark:bg-indigo-500/25 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">
                {scopedMedicines.length} Saved
              </span>
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
