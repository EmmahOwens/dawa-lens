import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Camera,
  Plus,
  History,
  Pill,
  Bell,
  AlertTriangle,
  Package2,
  Users,
  User,
  Plane,
  Heart,
  FileText,
  Sparkles,
  Sun,
  Moon,
  Cloud,
  Sunrise,
  ShieldAlert,
  ArrowRight,
  Info,
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import AchievementOverlay from "@/components/AchievementOverlay";
import { DashboardBanner } from "@/components/DashboardBanner";
import { FeatureSlideshow } from "@/components/FeatureSlideshow";
import { calculateRefillStatus, RefillStatus } from "@/services/refillService";
import { calculateNextDose } from "@/services/reminderService";
import { StatusHero } from "@/components/StatusHero";
import { calculateVitalitySummary } from "@/lib/vitalityUtils";
import { DailyTimeline } from "@/components/dashboard/DailyTimeline";
import { HealthWidgets } from "@/components/dashboard/HealthWidgets";
import { FamilyStatusDots } from "@/components/dashboard/FamilyStatusDots";
import { AIInsightCard } from "@/components/dashboard/AIInsightCard";
import {
  EDITORIAL_EASE,
  EditorialEyebrow,
  EditorialSectionHeader,
} from "@/components/editorial/EditorialPrimitives";

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
  show: { transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EDITORIAL_EASE } },
};

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

  const totalPillsCount = useMemo(() => {
    return scopedMedicines
      .filter((m) => m.currentQuantity !== undefined)
      .reduce((sum, m) => sum + (m.currentQuantity ?? 0), 0);
  }, [scopedMedicines]);

  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5)
      return { text: "Good late night", icon: Moon };
    if (hour < 12)
      return { text: t("dashboard.good_morning", "Good morning"), icon: Sunrise };
    if (hour < 17)
      return { text: t("dashboard.good_afternoon", "Good afternoon"), icon: Sun };
    if (hour < 21)
      return { text: t("dashboard.good_evening", "Good evening"), icon: Cloud };
    return { text: "Good night", icon: Moon };
  }, [t]);

  const formattedToday = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    []
  );

  const quickActions = [
    { icon: Camera, label: t("dashboard.quick_scan"), to: "/scan" },
    {
      icon: Users,
      label: isProfessionalMode ? "Patient Hub" : "Family Hub",
      to: "/family",
    },
    { icon: Heart, label: "Wellness", to: "/wellness" },
    { icon: Plane, label: "Travel", to: "/travel" },
    { icon: ShieldAlert, label: "Safety Check", to: "/interactions" },
    { icon: Bell, label: "Reminders", to: "/reminders" },
    { icon: History, label: "History", to: "/history" },
    { icon: FileText, label: "Reports", to: "/report" },
    { icon: Package2, label: t("nav.medvault", "Med Vault"), to: "/medvault" },
    { icon: Pill, label: t("nav.medications", "Medications"), to: "/medications" },
  ];

  const todayReminders = useMemo(() => {
    const todayNum = new Date().getDay();
    const todayStr = new Date().toDateString();

    return scopedReminders.filter((r) => {
      if (!r.enabled) return false;

      if (r.repeatSchedule === "once") {
        const previousDayLog = scopedDoseLogs.some(
          (l) =>
            l.reminderId === r.id &&
            ["taken", "skipped", "missed"].includes(l.action) &&
            new Date(l.actionTime).toDateString() !== todayStr &&
            new Date(l.actionTime).getTime() < new Date().getTime()
        );
        if (previousDayLog) {
          const hasTodayLog = scopedDoseLogs.some(
            (l) =>
              l.reminderId === r.id &&
              new Date(l.actionTime).toDateString() === todayStr
          );
          if (!hasTodayLog) return false;
        }
      }

      if (r.repeatSchedule === "custom" && r.repeatDays && r.repeatDays.length > 0) {
        if (!r.repeatDays.includes(todayNum)) return false;
      }

      if (r.repeatSchedule === "weekly") {
        if (r.repeatDays && r.repeatDays.length > 0) {
          if (!r.repeatDays.includes(todayNum)) return false;
        } else {
          const createdDate = r.createdAt ? new Date(r.createdAt) : new Date();
          const createdDay = isNaN(createdDate.getTime())
            ? todayNum
            : createdDate.getDay();
          if (createdDay !== todayNum) return false;
        }
      }

      return true;
    });
  }, [scopedReminders, scopedDoseLogs]);

  const expectedDosesToday = useMemo(() => {
    return todayReminders.reduce(
      (sum, r) => sum + ((r?.time || "").split(",").filter(Boolean).length || 1),
      0
    );
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
    } catch {
      toast.error("Failed to log dose");
    }
  };

  const firstName =
    userProfile?.name?.split(" ")[0] || t("dashboard.greeting_there");

  return (
    <div className="pt-2 sm:pt-4">
      <AchievementOverlay
        open={showAchievement}
        onClose={() => setShowAchievement(false)}
        title="Perfect Day!"
        subtitle="You've taken all your scheduled medications for today. Keep up the great work!"
        emoji="🏆"
      />

      {/* 1. Editorial Greeting Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EDITORIAL_EASE }}
        className="mb-7"
      >
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="min-w-0">
            <EditorialEyebrow
              label={`${greetingInfo.text} · ${formattedToday}`}
              dotColor="bg-primary"
              className="mb-2"
            />
            <h1 className="editorial-display text-[34px] sm:text-[44px] font-medium text-foreground leading-[0.98] tracking-[-0.038em] truncate">
              Hi,{" "}
              <em className="editorial-serif text-[1.09em] text-muted-foreground font-normal">
                {firstName}.
              </em>
            </h1>
          </div>

          {selectedPatientId ? (
            <button
              type="button"
              onClick={() => setSelectedPatientId(null)}
              className="inline-flex items-center gap-2 min-h-[38px] px-4 rounded-full border border-border bg-card hover:bg-secondary text-[12.5px] font-medium text-foreground active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
            >
              <User size={14} className="text-primary" aria-hidden="true" />
              <span>Switch Profile</span>
            </button>
          ) : (
            <div className="w-11 h-11 rounded-full bg-secondary border border-border/80 flex items-center justify-center text-foreground font-medium text-[15px] shrink-0">
              {userProfile?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
        </div>

        {(isProfessionalMode || patients.length > 0) && (
          <FamilyStatusDots
            patients={patients}
            selectedId={selectedPatientId}
            onSelect={setSelectedPatientId}
          />
        )}
      </motion.div>

      {/* 2. Signature Obsidian Status Hero */}
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
          <EditorialSectionHeader
            index="02"
            label="Attention Required"
            title="Refill"
            accent="alerts"
          />
          {refillStatuses.map((status) => (
            <div
              key={status.medicineId}
              className="editorial-card border-amber-500/35 p-4 sm:p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-foreground truncate">
                    {status.medicineName}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground editorial-tabular">
                    {status.currentQuantity === 0
                      ? "Out of stock"
                      : status.daysRemaining !== null
                        ? `~${status.daysRemaining} day${status.daysRemaining !== 1 ? "s" : ""} remaining · ${status.currentQuantity} units`
                        : `Low stock · ${status.currentQuantity} units`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/medvault")}
                className="min-h-[36px] px-4 rounded-full bg-foreground text-background hover:opacity-90 text-[12px] font-medium active:scale-95 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Refill
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 5. Daily Timeline */}
      <DailyTimeline
        reminders={todayReminders}
        doseLogs={scopedDoseLogs}
        onAction={handleAction}
      />

      {/* 6. Health Widgets (Mood / Energy) */}
      <HealthWidgets
        wellnessLogs={scopedWellnessLogs}
        onAddLog={(type, data) =>
          addWellnessLog({ type, data, patientId: selectedPatientId })
        }
      />

      {/* 7. Architectural Editorial Bento Grid */}
      <div className="mb-10">
        <EditorialSectionHeader
          index="03"
          label="Clinical Suite"
          title="Tools &"
          accent="services"
        />

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3.5"
        >
          {/* Spotlight Tile: Optical Quick Scan (Obsidian Focal Tile) */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate(quickActions[0].to)}
            className="col-span-2 editorial-panel-dark rounded-[24px] p-5 sm:p-6 min-h-[188px] sm:min-h-[204px] flex flex-col justify-between items-start text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="editorial-grain" aria-hidden="true" />
            <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent animate-bento-scanner pointer-events-none" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="editorial-glass-dark w-10 h-10 rounded-full flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <Camera size={18} />
              </div>
              <span className="editorial-glass-dark rounded-full px-3 py-1 editorial-mono text-[9.5px] text-white/80 flex items-center gap-1.5">
                <Sparkles size={10} className="text-sky-300" />
                Optical AI
              </span>
            </div>

            <div className="relative z-10 pt-5 w-full flex items-end justify-between gap-3">
              <div>
                <p className="editorial-mono text-[9.5px] text-white/50 mb-1">
                  01 / Recognition
                </p>
                <h3 className="editorial-display text-[24px] sm:text-[26px] font-medium text-white leading-tight">
                  Quick{" "}
                  <em className="editorial-serif text-[1.08em] text-white/70 font-normal">
                    Scan
                  </em>
                </h3>
                <p className="text-[13px] text-white/65 mt-1 leading-snug max-w-[16rem]">
                  Identify loose pills, blister strips, and prescriptions instantly
                </p>
              </div>
              <span className="w-8 h-8 rounded-full bg-white text-[#0a0c10] inline-flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:-rotate-45">
                <ArrowRight size={14} />
              </span>
            </div>
          </motion.button>

          {/* Metric Tile: Adherence */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate("/history")}
            className="col-span-1 editorial-card p-5 min-h-[148px] flex flex-col justify-between text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground">
                <History size={16} aria-hidden="true" />
              </div>
              <svg
                width="30"
                height="30"
                viewBox="0 0 36 36"
                className="-rotate-90 shrink-0"
                aria-hidden="true"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-border"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="88"
                  strokeDashoffset={
                    88 - (88 * Math.min(Math.max(adherencePercent, 0), 100)) / 100
                  }
                  strokeLinecap="round"
                  className="text-emerald-500 transition-all duration-700"
                />
              </svg>
            </div>
            <div className="pt-3">
              <p className="editorial-tabular text-[26px] font-light leading-none tracking-[-0.03em] text-foreground">
                {adherencePercent}
                <span className="text-[13px] font-normal text-muted-foreground ml-0.5">%</span>
              </p>
              <p className="editorial-mono text-[9.5px] text-muted-foreground mt-2">
                Adherence
              </p>
            </div>
          </motion.button>

          {/* Metric Tile: Med Vault */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate("/medvault")}
            className="col-span-1 editorial-card p-5 min-h-[148px] flex flex-col justify-between text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground">
                <Package2 size={16} />
              </div>
              <span className="editorial-mono text-[9px] text-muted-foreground">
                NDA
              </span>
            </div>
            <div className="pt-3">
              <p className="editorial-tabular text-[26px] font-light leading-none tracking-[-0.03em] text-foreground">
                {formatCompactNumber(totalPillsCount)}
                <span className="text-[12px] font-normal text-muted-foreground ml-1">
                  units
                </span>
              </p>
              <p className="editorial-mono text-[9.5px] text-muted-foreground mt-2">
                Med Vault
              </p>
            </div>
          </motion.button>

          {/* Wide Tile: Family Hub */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate(quickActions[1].to)}
            className="col-span-2 editorial-card p-5 min-h-[92px] flex items-center gap-4 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground shrink-0">
              <Users size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium leading-tight text-foreground truncate">
                {quickActions[1].label}
              </p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Circle of Care
              </p>
            </div>
            <div className="flex -space-x-2 shrink-0">
              {patients.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="w-7 h-7 rounded-full border-2 border-card bg-secondary text-foreground text-[11px] font-medium flex items-center justify-center uppercase"
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

          {/* Tile: Reminders */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate("/reminders")}
            className="col-span-1 editorial-card p-5 min-h-[138px] flex flex-col justify-between text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground">
                <Bell size={16} />
              </div>
              <span className="editorial-mono editorial-tabular text-[10px] text-primary">
                {takenToday}/{expectedDosesToday}
              </span>
            </div>
            <div className="pt-3">
              <p className="text-[15px] font-medium text-foreground leading-tight">
                Reminders
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                {expectedDosesToday - takenToday <= 0
                  ? "All complete"
                  : `${expectedDosesToday - takenToday} remaining`}
              </p>
            </div>
          </motion.button>

          {/* Tile: Wellness */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate(quickActions[2].to)}
            className="col-span-1 editorial-card p-5 min-h-[138px] flex flex-col justify-between text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground">
                <Heart size={16} />
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            </div>
            <div className="pt-3">
              <p className="text-[15px] font-medium text-foreground leading-tight">
                Wellness
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Mood &amp; Nutrition
              </p>
            </div>
          </motion.button>

          {/* Tile: Medications Cabinet */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate("/medications")}
            className="col-span-1 editorial-card p-5 min-h-[138px] flex flex-col justify-between text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground">
                <Pill size={16} />
              </div>
              <span className="editorial-mono editorial-tabular text-[10px] text-muted-foreground">
                {scopedMedicines.length}
              </span>
            </div>
            <div className="pt-3">
              <p className="text-[15px] font-medium text-foreground leading-tight">
                Medications
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Active Cabinet
              </p>
            </div>
          </motion.button>

          {/* Tile: Travel */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate(quickActions[3].to)}
            className="col-span-1 editorial-card p-5 min-h-[138px] flex flex-col justify-between text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="w-9 h-9 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground">
              <Plane size={16} />
            </div>
            <div className="pt-3">
              <p className="text-[15px] font-medium text-foreground leading-tight">
                Travel
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Timezone Shield
              </p>
            </div>
          </motion.button>

          {/* Wide Tile: Safety Check */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate(quickActions[4].to)}
            className="col-span-2 editorial-card p-5 min-h-[92px] flex items-center gap-4 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium leading-tight text-foreground">
                Safety Check
              </p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                Rx Interactions &amp; Local Diet Matrix
              </p>
            </div>
            <span className="editorial-mono text-[10px] px-3 py-1.5 rounded-full border border-border bg-secondary/70 text-foreground shrink-0 group-hover:border-foreground/30 transition-colors">
              Review
            </span>
          </motion.button>

          {/* Full-Span Tile: Medical Reports */}
          <motion.button
            type="button"
            variants={item}
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate(quickActions[7].to)}
            className="col-span-2 sm:col-span-4 editorial-card p-5 sm:p-6 min-h-[92px] flex items-center gap-4 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-foreground shrink-0">
              <FileText size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium leading-tight text-foreground">
                Medical Reports
              </p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                Doctor-Ready Clinical PDF Export &amp; 7-Day Adherence Analytics
              </p>
            </div>
            <div className="hidden sm:block shrink-0 w-24 h-7 opacity-75 group-hover:opacity-100 transition-opacity">
              <svg className="w-full h-full" viewBox="0 0 70 22" fill="none" aria-hidden="true">
                <path
                  d="M2 18 C 12 18, 16 7, 26 12 C 36 17, 42 3, 52 8 C 60 12, 64 5, 68 4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                />
                <circle cx="68" cy="4" r="2.2" fill="currentColor" className="text-primary" />
              </svg>
            </div>
            <span className="editorial-mono text-[10px] px-3.5 py-1.5 rounded-full bg-foreground text-background shrink-0">
              Export
            </span>
          </motion.button>
        </motion.div>
      </div>

      {/* 8. Wellness Pulse */}
      <DashboardBanner />

      {/* 9. Discover & Learn */}
      <div className="mb-8">
        <EditorialSectionHeader
          index="06"
          label="Clinical Notes"
          title="Discover &"
          accent="learn"
        />
        <FeatureSlideshow />
      </div>

      {/* 10. Clinical Disclaimer */}
      <div className="mt-4 rounded-[20px] border border-border/75 bg-secondary/45 p-5 mb-8">
        <div className="flex items-start gap-3 text-[12px] text-muted-foreground leading-relaxed">
          <Info size={15} className="text-foreground/60 shrink-0 mt-0.5" />
          <span>{t("dashboard.disclaimer")}</span>
        </div>
      </div>
    </div>
  );
}
