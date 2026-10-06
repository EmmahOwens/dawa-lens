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

        {/* Apple Utility Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">

          {/* Hero Tile: Quick Scan (col-span-2) */}
          <button
            onClick={() => navigate(quickActions[0].to)}
            className="col-span-2 sm:col-span-2 rounded-[18px] p-6 min-h-[170px] flex flex-col justify-between items-start text-left border border-border bg-[#272729] text-white hover:brightness-105 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                <Camera size={20} />
              </div>
              <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-white/10 text-white/90">
                AI Vision
              </span>
            </div>

            <div>
              <p className="text-[12px] font-normal text-[#cccccc] mb-0.5">Recognition</p>
              <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-white">
                Quick Scan
              </h3>
              <p className="text-[13px] text-[#cccccc] mt-1 font-normal">
                Identify pills, bottles, and prescriptions instantly
              </p>
            </div>
          </button>

          {/* Metric Tile: Adherence */}
          <button
            onClick={() => navigate("/history")}
            className="col-span-1 rounded-[18px] p-4.5 min-h-[120px] flex flex-col justify-between text-left border border-border bg-card hover:border-primary/40 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
                <History size={16} />
              </div>
            </div>
            <div>
              <p className="text-[22px] font-semibold leading-none tracking-tight text-foreground">
                {adherencePercent}<span className="text-[13px] font-normal text-muted-foreground ml-0.5">%</span>
              </p>
              <p className="text-[12px] font-normal text-muted-foreground mt-1">Adherence</p>
            </div>
          </button>

          {/* Metric Tile: Pill Stock */}
          <button
            onClick={() => navigate("/medvault")}
            className="col-span-1 rounded-[18px] p-4.5 min-h-[120px] flex flex-col justify-between text-left border border-border bg-card hover:border-primary/40 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
                <Package2 size={16} />
              </div>
            </div>
            <div>
              <p className="text-[22px] font-semibold leading-none tracking-tight text-foreground">
                {formatCompactNumber(totalPillsCount)}
              </p>
              <p className="text-[12px] font-normal text-muted-foreground mt-1">Med Vault</p>
            </div>
          </button>

          {/* Wide Tile: Family Hub (col-span-2) */}
          <button
            onClick={() => navigate(quickActions[1].to)}
            className="col-span-2 sm:col-span-2 rounded-[18px] p-4.5 min-h-[80px] flex items-center gap-3.5 border border-border bg-card hover:border-primary/40 active:scale-[0.98] transition-all"
          >
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-primary shrink-0">
              <Users size={18} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[15px] font-medium leading-tight text-foreground truncate">
                {quickActions[1].label}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Circle of Care</p>
            </div>
            <div className="flex -space-x-1.5 shrink-0">
              {patients.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="w-6 h-6 rounded-full border border-card bg-muted text-[10px] font-medium text-foreground flex items-center justify-center uppercase"
                >
                  {p.name.charAt(0)}
                </div>
              ))}
              {patients.length === 0 && (
                <div className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <Plus size={10} />
                </div>
              )}
            </div>
          </button>

          {/* Metric Tile: Reminders (col-span-1) */}
          <button
            onClick={() => navigate("/reminders")}
            className="col-span-1 rounded-[18px] p-4.5 min-h-[120px] flex flex-col justify-between text-left border border-border bg-card hover:border-primary/40 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
                <Bell size={16} />
              </div>
              <span className="text-[11px] font-normal text-muted-foreground">
                {takenToday}/{expectedDosesToday}
              </span>
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground leading-tight">Reminders</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {expectedDosesToday - takenToday <= 0 ? "Completed" : `${expectedDosesToday - takenToday} remaining`}
              </p>
            </div>
          </button>

          {/* Small Tile: Wellness (col-span-1) */}
          <button
            onClick={() => navigate(quickActions[2].to)}
            className="col-span-1 rounded-[18px] p-4.5 min-h-[120px] flex flex-col justify-between text-left border border-border bg-card hover:border-primary/40 active:scale-[0.97] transition-all"
          >
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
              <Heart size={16} />
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground leading-tight">Wellness</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Health Log</p>
            </div>
          </button>

          {/* Metric Tile: Medications Cabinet (col-span-1) */}
          <button
            onClick={() => navigate("/medications")}
            className="col-span-1 rounded-[18px] p-4.5 min-h-[120px] flex flex-col justify-between text-left border border-border bg-card hover:border-primary/40 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
                <Pill size={16} />
              </div>
              <span className="text-[11px] font-normal text-muted-foreground">{scopedMedicines.length}</span>
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground leading-tight">Medications</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Cabinet</p>
            </div>
          </button>

          {/* Small Tile: Travel (col-span-1) */}
          <button
            onClick={() => navigate(quickActions[3].to)}
            className="col-span-1 rounded-[18px] p-4.5 min-h-[120px] flex flex-col justify-between text-left border border-border bg-card hover:border-primary/40 active:scale-[0.97] transition-all"
          >
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary">
              <Plane size={16} />
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground leading-tight">Travel</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Companion</p>
            </div>
          </button>

          {/* Wide Tile: Safety Check (col-span-2) */}
          <button
            onClick={() => navigate(quickActions[4].to)}
            className="col-span-2 sm:col-span-2 rounded-[18px] p-4.5 min-h-[80px] flex items-center gap-3.5 border border-border bg-card hover:border-primary/40 active:scale-[0.98] transition-all"
          >
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-primary shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[15px] font-medium leading-tight text-foreground">Safety Check</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Rx Interactions</p>
            </div>
            <span className="text-[12px] font-normal px-3 py-1 rounded-full bg-muted text-foreground border border-border shrink-0">
              Review
            </span>
          </button>

          {/* Wide Tile: Reports (col-span-2, sm:col-span-4) */}
          <button
            onClick={() => navigate(quickActions[7].to)}
            className="col-span-2 sm:col-span-4 rounded-[18px] p-4.5 min-h-[80px] flex items-center gap-3.5 border border-border bg-card hover:border-primary/40 active:scale-[0.98] transition-all"
          >
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-primary shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[15px] font-medium leading-tight text-foreground">Medical Reports</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Clinical PDF Export &amp; Analytics</p>
            </div>
            <span className="text-[12px] font-normal px-3 py-1 rounded-full bg-muted text-foreground border border-border shrink-0">
              Export
            </span>
          </button>
        </div>
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
