import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Pill,
  AlarmCheck,
  AlarmClockOff,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Syringe,
  Droplets,
  Tablets,
  UserRound,
  RefreshCw,
  WifiOff,
  MoreVertical,
  ChevronDown,
  Search,
  X,
  Check,
  Sparkles,
  Calendar,
} from "@/lib/icons";
import { useApp, Reminder } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { computeShiftOffset } from "@/services/reminderService";
import { toDate } from "@/lib/utils";
import {
  parseReminderTimes,
  findSlotIndexForTime,
  getInterSlotInterval,
  minutesToTimeStr,
  timeStrToMinutes,
} from "@/lib/dynamicSchedule";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { DailyTimeline, todayAt, getCircularDiffMinutes } from "@/components/dashboard/DailyTimeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getMedicineTheme, iconMap } from "@/lib/medicineTheme";
import { ScreenHeroImage } from "@/components/ScreenHeroImage";
import { SCREEN_MEDIA } from "@/lib/screenMedia";
import {
  EDITORIAL_EASE,
  EditorialEyebrow,
  EditorialMetricStrip,
} from "@/components/editorial/EditorialPrimitives";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

function repeatLabel(reminder: Reminder): string {
  const { repeatSchedule, repeatDays } = reminder;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  switch (repeatSchedule) {
    case "daily":
      return "Every day";
    case "once":
      return "One time";
    case "custom": {
      const timesCount = reminder.time
        .split(",")
        .map((t) => t.trim())
        .filter((t) => {
          const parts = t.split(":");
          if (parts.length !== 2) return false;
          const [h, m] = parts.map(Number);
          return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
        }).length;
      let label = timesCount > 1 ? `${timesCount} times a day` : "Custom";
      if (repeatDays && repeatDays.length > 0) {
        label += ` (${repeatDays.map((d) => days[d]).join(", ")})`;
      }
      return label;
    }
    default:
      return repeatSchedule;
  }
}

export default function RemindersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    updateReminder,
    deleteReminder,
    isInitializing,
    pendingOfflineOps,
    logDose,
    patients,
    selectedPatientId,
    setSelectedPatientId,
  } = useApp();

  const { resolvedPatient, scopedReminders, scopedDoseLogs } = usePatientScope();
  const { isOnline } = useNetworkStatus();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "taken" | "skipped" | "missed" | "paused">("all");

  // Sort: enabled first, then by time
  const sorted = useMemo(() => {
    return [...scopedReminders].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.time.localeCompare(b.time);
    });
  }, [scopedReminders]);

  // Today stats for the active profile
  const filteredReminderIds = useMemo(
    () => new Set(scopedReminders.map((r) => r.id)),
    [scopedReminders]
  );
  const totalCount = scopedReminders.length;
  const enabledCount = scopedReminders.filter((r) => r.enabled).length;
  const pausedCount = totalCount - enabledCount;
  const todayStr = new Date().toDateString();

  const takenToday = scopedDoseLogs.filter(
    (l) =>
      filteredReminderIds.has(l.reminderId) &&
      l.action === "taken" &&
      new Date(l.actionTime).toDateString() === todayStr
  ).length;

  const skippedToday = scopedDoseLogs.filter(
    (l) =>
      filteredReminderIds.has(l.reminderId) &&
      l.action === "skipped" &&
      new Date(l.actionTime).toDateString() === todayStr
  ).length;

  const missedToday = scopedDoseLogs.filter(
    (l) =>
      filteredReminderIds.has(l.reminderId) &&
      l.action === "missed" &&
      new Date(l.actionTime).toDateString() === todayStr
  ).length;

  const isComplete = takenToday > 0 && enabledCount > 0 && takenToday >= enabledCount;

  // Filtered Reminders List
  const filteredReminders = useMemo(() => {
    return sorted.filter((reminder) => {
      // 1. Text Search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = reminder.medicineName.toLowerCase().includes(q);
        const matchesDose = reminder.dose.toLowerCase().includes(q);
        const matchesTime = reminder.time.toLowerCase().includes(q);
        const matchesPatient = reminder.patientName?.toLowerCase().includes(q) ?? false;
        const matchesNotes = reminder.notes?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesDose && !matchesTime && !matchesPatient && !matchesNotes) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === "active") return reminder.enabled;
      if (statusFilter === "paused") return !reminder.enabled;
      if (statusFilter === "taken") {
        return scopedDoseLogs.some(
          (l) =>
            l.reminderId === reminder.id &&
            l.action === "taken" &&
            new Date(l.actionTime).toDateString() === todayStr
        );
      }
      if (statusFilter === "skipped") {
        return scopedDoseLogs.some(
          (l) =>
            l.reminderId === reminder.id &&
            l.action === "skipped" &&
            new Date(l.actionTime).toDateString() === todayStr
        );
      }
      if (statusFilter === "missed") {
        return scopedDoseLogs.some(
          (l) =>
            l.reminderId === reminder.id &&
            l.action === "missed" &&
            new Date(l.actionTime).toDateString() === todayStr
        );
      }

      return true;
    });
  }, [sorted, searchQuery, statusFilter, scopedDoseLogs, todayStr]);

  const handleToggle = async (reminder: Reminder) => {
    try {
      await updateReminder(reminder.id, { enabled: !reminder.enabled });
      toast({
        title: reminder.enabled ? "Reminder paused" : "Reminder activated",
        description: `${reminder.medicineName} @ ${reminder.time}`,
      });
    } catch {
      toast({ variant: "destructive", title: "Failed to update reminder" });
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteReminder(pendingDeleteId);
      toast({ title: "Reminder deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete reminder" });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleAction = async (
    reminder: Reminder,
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
        patientId: reminder.patientId ?? null,
      });
      toast({
        title: action === "taken" ? "Dose logged!" : "Dose skipped.",
        description: `${reminder.medicineName} @ ${reminder.time}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to log dose",
      });
    }
  };

  const toggleStatusFilter = (val: "all" | "active" | "taken" | "skipped" | "missed" | "paused") => {
    setStatusFilter((prev) => (prev === val ? "all" : val));
  };

  return (
    <div className="w-full pt-2 sm:pt-4 pb-10">
      {/* Unified Editorial Split Hero (removes duplicate header) */}
      <ScreenHeroImage
        asH1
        indexLabel="01"
        src={SCREEN_MEDIA.remindersSchedule.src}
        lqip={SCREEN_MEDIA.remindersSchedule.lqip}
        alt="Morning medication routine with water, daily pill case, and smartphone"
        eyebrow="Daily Schedule · Active Regimen"
        title={`Daily ${t("reminders.title", "Reminders")}`}
        accentWord={t("reminders.title", "Reminders")}
        subtitle={`Stay on track with smart dosing intervals, native offline alerts, and live schedule tracking for ${resolvedPatient.isOwner ? "your routine" : resolvedPatient.name}.`}
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                navigate("/reminders/new", {
                  state: {
                    patientId: resolvedPatient.id,
                    patientName: !resolvedPatient.isOwner ? resolvedPatient.name : null,
                  },
                })
              }
              className="btn-editorial-roll h-10 pl-4 pr-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-[12.5px] font-medium"
            >
              <span>Add Reminder</span>
              <span className="w-6 h-6 rounded-full bg-white text-primary inline-flex items-center justify-center">
                <Plus size={13} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/medications")}
              className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-card hover:bg-secondary text-foreground text-[12.5px] font-medium transition-colors active:scale-95"
            >
              <Pill className="size-3.5 text-primary" />
              <span>Medications</span>
            </button>
          </>
        }
      />

      {/* Luminous Clinical Sapphire / Emerald Live Schedule Panel */}
      <div
        className={`${
          isComplete ? "editorial-panel-emerald" : "editorial-panel-dark"
        } rounded-[26px] p-6 sm:p-7 mb-6 text-white`}
      >
        <div className="editorial-grain" aria-hidden="true" />
        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <EditorialEyebrow
              index="02"
              label="Live Dosing & Schedule"
              dotColor={isComplete ? "bg-emerald-400" : "bg-sky-300"}
              onDark
            />

            <button
              type="button"
              onClick={() => navigate("/medvault")}
              className="hidden sm:inline-flex items-center gap-1.5 editorial-glass-dark h-8 px-3.5 rounded-full text-white text-[11.5px] font-medium hover:bg-white/10 transition-colors active:scale-95"
            >
              <Pill size={12} />
              <span>Med Vault</span>
            </button>
          </div>

          <EditorialMetricStrip
            onDark
            items={[
              { label: "Active Schedules", value: enabledCount },
              { label: "Taken Today", value: takenToday, tone: takenToday > 0 ? "success" : "default" },
              {
                label: "Missed Today",
                value: missedToday,
                tone: missedToday > 0 ? "danger" : "default",
              },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/15">
            <div className="flex items-center gap-2 text-[12.5px] font-normal">
              {missedToday > 0 ? (
                <>
                  <AlertTriangle size={14} className="text-rose-300 animate-pulse flex-shrink-0" />
                  <span className="text-white/85">{missedToday} dose{missedToday > 1 ? "s" : ""} recorded as missed today</span>
                </>
              ) : isComplete ? (
                <>
                  <Check size={14} className="text-emerald-300 flex-shrink-0" />
                  <span className="text-emerald-100">All scheduled doses logged for today. Outstanding consistency.</span>
                </>
              ) : (
                <>
                  <Clock size={14} className="text-sky-300 flex-shrink-0" />
                  <span className="text-white/80">
                    {totalCount === 0
                      ? "Add medication reminders to track daily doses and smart shift alerts"
                      : `${enabledCount} active reminder${enabledCount !== 1 ? "s" : ""} running for ${resolvedPatient.isOwner ? "you" : resolvedPatient.name}`}
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/reminders/new", {
                  state: {
                    patientId: resolvedPatient.id,
                    patientName: !resolvedPatient.isOwner ? resolvedPatient.name : null,
                  },
                })
              }
              className="editorial-glass-dark inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-white text-[12px] font-medium hover:bg-white/10 transition-colors active:scale-95"
            >
              <Plus size={13} />
              <span>New Reminder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Profile Switcher Dropdown */}
      {patients.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="mb-5"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card hover:bg-secondary border border-border/80 transition-all text-left group"
              >
                <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                  <UserRound size={12} />
                </div>
                <span className="editorial-mono text-[9.5px] text-muted-foreground">
                  Viewing:
                </span>
                <span className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">
                  {resolvedPatient.isOwner
                    ? `${resolvedPatient.name} (You)`
                    : resolvedPatient.name}
                </span>
                <ChevronDown size={13} className="text-muted-foreground opacity-60 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-2xl p-1.5 min-w-[210px] shadow-xl border-border/60">
              <DropdownMenuItem
                onClick={() => setSelectedPatientId(null)}
                className={`rounded-xl px-3 py-2 text-xs font-medium cursor-pointer ${
                  selectedPatientId === null ? "bg-primary/10 text-primary" : ""
                }`}
              >
                <UserRound size={14} className="mr-2 text-primary" />
                Self (You)
              </DropdownMenuItem>
              {patients.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium cursor-pointer ${
                    selectedPatientId === p.id ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <UserRound size={14} className="mr-2 opacity-60" />
                  {p.name} {p.relation ? `(${p.relation})` : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full bg-card border border-border/80 w-fit"
        >
          <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
            <UserRound size={12} />
          </div>
          <span className="editorial-mono text-[9.5px] text-muted-foreground">
            Viewing:
          </span>
          <span className="text-[12px] font-medium text-foreground">
            {resolvedPatient.isOwner
              ? `${resolvedPatient.name} (You)`
              : resolvedPatient.name}
          </span>
        </motion.div>
      )}

      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-[20px] bg-amber-500/10 border border-amber-500/25">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <WifiOff size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-amber-700 dark:text-amber-300">
                  Offline mode
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-snug">
                  {pendingOfflineOps > 0
                    ? `${pendingOfflineOps} change${pendingOfflineOps !== 1 ? "s" : ""} will sync when you reconnect`
                    : "Changes you make will sync when you reconnect"}
                </p>
              </div>
              {pendingOfflineOps > 0 && (
                <span className="flex-shrink-0 editorial-mono text-[9.5px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                  {pendingOfflineOps} pending
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color-Tinted Interactive Status Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {/* Total */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("all")}
          className={`editorial-bento p-4 text-center cursor-pointer active:scale-[0.98] bg-gradient-to-br from-indigo-50/90 via-card to-indigo-50/35 dark:from-indigo-950/45 dark:via-card dark:to-indigo-950/20 ${
            statusFilter === "all"
              ? "border-indigo-500/50 ring-2 ring-indigo-500/25"
              : "border-indigo-500/25 hover:border-indigo-500/45"
          }`}
        >
          <p className="editorial-tabular text-[26px] font-light text-indigo-600 dark:text-indigo-400 leading-none">
            {scopedReminders.length}
          </p>
          <p className="editorial-mono text-[9.5px] text-indigo-700/75 dark:text-indigo-300/75 mt-2">
            Total
          </p>
        </button>

        {/* Active */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("active")}
          className={`editorial-bento p-4 text-center cursor-pointer active:scale-[0.98] bg-gradient-to-br from-sky-50/90 via-card to-blue-50/35 dark:from-sky-950/45 dark:via-card dark:to-blue-950/20 ${
            statusFilter === "active"
              ? "border-sky-500/50 ring-2 ring-sky-500/25"
              : "border-sky-500/25 hover:border-sky-500/45"
          }`}
        >
          <p className="editorial-tabular text-[26px] font-light text-sky-600 dark:text-sky-400 leading-none">
            {enabledCount}
          </p>
          <p className="editorial-mono text-[9.5px] text-sky-700/75 dark:text-sky-300/75 mt-2 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Active
          </p>
        </button>

        {/* Taken */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("taken")}
          className={`editorial-bento p-4 text-center cursor-pointer active:scale-[0.98] bg-gradient-to-br from-emerald-50/90 via-card to-teal-50/35 dark:from-emerald-950/45 dark:via-card dark:to-teal-950/20 ${
            statusFilter === "taken"
              ? "border-emerald-500/50 ring-2 ring-emerald-500/25"
              : "border-emerald-500/25 hover:border-emerald-500/45"
          }`}
        >
          <p className="editorial-tabular text-[26px] font-light text-emerald-600 dark:text-emerald-400 leading-none">
            {takenToday}
          </p>
          <p className="editorial-mono text-[9.5px] text-emerald-700/75 dark:text-emerald-300/75 mt-2 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Taken
          </p>
        </button>

        {/* Skipped */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("skipped")}
          className={`editorial-bento p-4 text-center cursor-pointer active:scale-[0.98] bg-gradient-to-br from-amber-50/90 via-card to-orange-50/35 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20 ${
            statusFilter === "skipped"
              ? "border-amber-500/50 ring-2 ring-amber-500/25"
              : "border-amber-500/25 hover:border-amber-500/45"
          }`}
        >
          <p className="editorial-tabular text-[26px] font-light text-amber-600 dark:text-amber-400 leading-none">
            {skippedToday}
          </p>
          <p className="editorial-mono text-[9.5px] text-amber-700/75 dark:text-amber-300/75 mt-2 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Skipped
          </p>
        </button>

        {/* Missed */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("missed")}
          className={`col-span-2 sm:col-span-1 editorial-bento p-4 text-center flex sm:flex-col items-center justify-between sm:justify-center cursor-pointer active:scale-[0.98] bg-gradient-to-br from-rose-50/90 via-card to-pink-50/35 dark:from-rose-950/40 dark:via-card dark:to-pink-950/20 ${
            statusFilter === "missed"
              ? "border-rose-500/50 ring-2 ring-rose-500/25"
              : "border-rose-500/25 hover:border-rose-500/45"
          }`}
        >
          <p className={`editorial-tabular text-[26px] font-light leading-none ${missedToday > 0 ? "text-rose-600 dark:text-rose-400" : "text-rose-700/70 dark:text-rose-300/80"}`}>
            {missedToday}
          </p>
          <p className="editorial-mono text-[9.5px] text-rose-700/75 dark:text-rose-300/75 mt-0 sm:mt-2 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${missedToday > 0 ? "bg-rose-500 animate-ping" : "bg-rose-400/60"}`} />
            Missed
          </p>
        </button>
      </div>

      {/* Daily Timeline */}
      <DailyTimeline
        reminders={scopedReminders}
        doseLogs={scopedDoseLogs}
        onAction={handleAction}
      />

      {/* Search Input Bar */}
      {scopedReminders.length > 0 && (
        <div className="relative mb-3.5">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reminders by medicine, dose, or time..."
            className="h-11 rounded-full border-border/80 bg-card pl-11 pr-10 text-[14px] focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Filter Chips Bar */}
      {scopedReminders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
          {[
            { id: "all", label: "All Reminders", count: totalCount },
            { id: "active", label: "Active", count: enabledCount, dot: "bg-sky-500" },
            { id: "taken", label: "Taken Today", count: takenToday, dot: "bg-emerald-500" },
            { id: "skipped", label: "Skipped", count: skippedToday, dot: "bg-amber-500" },
            { id: "missed", label: "Missed", count: missedToday, dot: "bg-rose-500", pulse: missedToday > 0 },
            { id: "paused", label: "Paused", count: pausedCount, dot: "bg-slate-400" },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-all whitespace-nowrap active:scale-95 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                    : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {tab.dot && (
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.dot} ${tab.pulse ? "animate-ping" : ""}`} />
                )}
                <span>{tab.label}</span>
                <span
                  className={`editorial-tabular text-[11px] ${
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Reminder List */}
      {isInitializing ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 w-full rounded-[24px] bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : scopedReminders.length === 0 ? (
        /* Editorial Empty State */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
          className="editorial-card relative overflow-hidden flex flex-col items-center justify-center py-14 px-6 text-center gap-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <Bell size={28} />
          </div>

          <div className="max-w-md space-y-1.5">
            <h3 className="editorial-display text-[24px] font-medium text-foreground">
              No reminders{" "}
              <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                scheduled.
              </em>
            </h3>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed">
              Add your first medicine reminder to stay on schedule with native offline alarms, dose logging, and intelligent interval shifting.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/reminders/new", {
                state: {
                  patientId: resolvedPatient.id,
                  patientName: !resolvedPatient.isOwner ? resolvedPatient.name : null,
                },
              })
            }
            className="btn-editorial-roll h-11 pl-5 pr-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-[13.5px] font-medium"
          >
            <span>Add First Reminder</span>
            <span className="w-7 h-7 rounded-full bg-white text-primary inline-flex items-center justify-center">
              <Plus size={14} />
            </span>
          </button>

          {/* Color-Tinted Feature Highlight Bento Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 w-full max-w-2xl pt-5 border-t border-border/60">
            <div className="editorial-bento p-4 bg-gradient-to-br from-indigo-50/85 via-card to-indigo-50/30 dark:from-indigo-950/40 dark:via-card dark:to-indigo-950/20 border-indigo-500/20 text-left">
              <p className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-500" /> Smart Intervals
              </p>
              <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">
                Automatically adjusts follow-up doses when taken late.
              </p>
            </div>
            <div className="editorial-bento p-4 bg-gradient-to-br from-sky-50/85 via-card to-sky-50/30 dark:from-sky-950/40 dark:via-card dark:to-sky-950/20 border-sky-500/20 text-left">
              <p className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                <Bell size={13} className="text-sky-500" /> Native Alerts
              </p>
              <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">
                Fires authoritative device alarms even when offline.
              </p>
            </div>
            <div className="editorial-bento p-4 bg-gradient-to-br from-emerald-50/85 via-card to-emerald-50/30 dark:from-emerald-950/40 dark:via-card dark:to-emerald-950/20 border-emerald-500/20 text-left">
              <p className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                <UserRound size={13} className="text-emerald-500" /> Family Care
              </p>
              <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">
                Track prescriptions for dependents and loved ones.
              </p>
            </div>
          </div>
        </motion.div>
      ) : filteredReminders.length === 0 ? (
        /* Empty State: Search or filter resulted in 0 matches */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-14 text-center rounded-[22px] border border-dashed border-border/70 bg-card p-6"
        >
          <Search size={24} className="mx-auto text-muted-foreground mb-2 opacity-50" />
          <h4 className="text-base font-bold text-foreground">No matching reminders</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {searchQuery
              ? `No reminders matching "${searchQuery}" in ${statusFilter} filter.`
              : `No reminders in the selected "${statusFilter}" filter.`}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Reset Filters
          </button>
        </motion.div>
      ) : (
        /* Populated Reminder List */
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          <AnimatePresence mode="popLayout">
            {filteredReminders.map((reminder) => {
              const theme = getMedicineTheme({
                name: reminder.medicineName,
                id: reminder.id,
                color: reminder.color,
              });
              const IconComp = iconMap[reminder.icon || "pill"] || Pill;

              return (
                <motion.div
                  key={reminder.id}
                  variants={item}
                  layout
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  className={`group relative overflow-hidden flex items-center gap-4 p-5 rounded-[22px] border transition-all duration-200 ${
                    reminder.enabled
                      ? `${theme.border} ${theme.borderHover} bg-card shadow-xs hover:shadow-lg`
                      : "bg-muted/30 border-border/60 opacity-60"
                  }`}
                >
                  {/* Soft ambient background glow */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${theme.bgGlow} pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity`}
                  />

                  {/* Left accent indicator bar */}
                  <div
                    className={`absolute left-0 top-3.5 bottom-3.5 w-1 rounded-r-full ${
                      reminder.enabled ? theme.accentBar : "bg-muted-foreground/30"
                    }`}
                  />

                  {/* Gradient Avatar */}
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
                      reminder.enabled
                        ? `bg-gradient-to-br ${theme.gradient} text-white shadow-md shadow-black/10 border border-white/20`
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <IconComp className="size-5.5 text-white" />
                  </div>

                  {/* Information Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[16px] font-bold text-foreground leading-tight truncate">
                        {reminder.medicineName}
                      </p>

                      {/* Dosage badge */}
                      {reminder.dose && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.bgLight} ${theme.text} border ${theme.border}`}
                        >
                          {reminder.dose}
                        </span>
                      )}

                      {/* For: Name tag — shown on family profile reminders */}
                      {reminder.patientName && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                          <UserRound size={9} /> For: {reminder.patientName}
                        </span>
                      )}
                    </div>

                    {/* Schedule timing & intervals */}
                    {(() => {
                      const offsetMinutes = computeShiftOffset(
                        reminder,
                        scopedDoseLogs
                      );
                      const baseTimes = parseReminderTimes(reminder.time);
                      let takenSlotIndex = -1;
                      const todayLog = [...scopedDoseLogs]
                        .filter(
                          (l) =>
                            l.reminderId === reminder.id &&
                            l.action === "taken" &&
                            new Date(l.actionTime).toDateString() ===
                              new Date().toDateString()
                        )
                        .sort(
                          (a, b) =>
                            new Date(b.actionTime).getTime() -
                            new Date(a.actionTime).getTime()
                        )[0];

                      if (todayLog) {
                        takenSlotIndex = findSlotIndexForTime(
                          baseTimes,
                          todayLog.scheduledTime || todayLog.actionTime
                        );
                      }

                      const displayTimes = baseTimes.map((t, idx) => {
                        if (todayLog && takenSlotIndex !== -1 && idx > takenSlotIndex) {
                          let cumulativeInterval = 0;
                          for (let s = takenSlotIndex; s < idx; s++) {
                            cumulativeInterval += getInterSlotInterval(baseTimes, s, s + 1);
                          }
                          const actualTakeDate = new Date(todayLog.actionTime);
                          const totalMins =
                            actualTakeDate.getHours() * 60 +
                            actualTakeDate.getMinutes() +
                            cumulativeInterval;
                          return minutesToTimeStr(totalMins);
                        }
                        return t;
                      });

                      const hasShift = offsetMinutes !== 0 && takenSlotIndex !== -1;
                      return (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground/80">
                            <Clock size={11} className="text-primary" />
                            {displayTimes.join(", ")}
                          </span>
                          {hasShift && (
                            <span
                              title={`Schedule shifted ${
                                offsetMinutes > 0 ? "+" : ""
                              }${offsetMinutes}m today`}
                              className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                                offsetMinutes > 0
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              <RefreshCw size={8} />
                              {offsetMinutes > 0 ? "+" : ""}
                              {offsetMinutes}m
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <span className="text-[11px] font-medium text-muted-foreground capitalize">
                            {repeatLabel(reminder)}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Today's Dose Status Badges */}
                    {(() => {
                      const baseTimes = parseReminderTimes(reminder.time);
                      const todayLogs = scopedDoseLogs.filter((l) => {
                        if (l.reminderId !== reminder.id) return false;
                        const lDate = toDate(l.scheduledTime || l.actionTime);
                        return lDate.toDateString() === todayStr;
                      });

                      if (baseTimes.length <= 1) {
                        const singleLog = todayLogs.sort(
                          (a, b) => toDate(b.actionTime).getTime() - toDate(a.actionTime).getTime()
                        )[0];

                        if (!singleLog) return null;

                        return (
                          <div className="mt-2 inline-flex items-center gap-1">
                            {singleLog.action === "taken" ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                <AlarmCheck size={11} /> Taken today
                              </span>
                            ) : singleLog.action === "skipped" ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                <AlarmClockOff size={11} /> Skipped today
                              </span>
                            ) : singleLog.action === "missed" ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                                <AlertCircle size={11} /> Missed today
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full">
                                <Clock size={11} /> Snoozed today
                              </span>
                            )}
                          </div>
                        );
                      }

                      // Multi-dose slots: match each slot to its log
                      const slotStatuses = baseTimes.map((baseTime, idx) => {
                        const slotISO = todayAt(baseTime).toISOString();
                        const matched = todayLogs.find((l) => {
                          if (l.scheduledTime === slotISO) return true;
                          const lDate = toDate(l.scheduledTime || l.actionTime);
                          const logMins =
                            l.scheduledTime && /^\d{1,2}:\d{2}$/.test(l.scheduledTime.trim())
                              ? timeStrToMinutes(l.scheduledTime.trim())
                              : lDate.getHours() * 60 + lDate.getMinutes();
                          const thisSlotDiff = getCircularDiffMinutes(timeStrToMinutes(baseTime), logMins);
                          return baseTimes.every((otherTimeStr, otherIdx) => {
                            if (otherIdx === idx) return true;
                            return thisSlotDiff <= getCircularDiffMinutes(timeStrToMinutes(otherTimeStr), logMins);
                          });
                        });

                        return {
                          time: baseTime,
                          action: matched?.action,
                        };
                      });

                      return (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {slotStatuses.map((s, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                s.action === "taken"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : s.action === "skipped"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  : s.action === "missed"
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                  : s.action === "snoozed"
                                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                  : "bg-muted text-muted-foreground border-border/50"
                              }`}
                            >
                              {s.action === "taken" ? (
                                <AlarmCheck size={9} />
                              ) : s.action === "missed" ? (
                                <AlertCircle size={9} />
                              ) : s.action === "skipped" ? (
                                <AlarmClockOff size={9} />
                              ) : (
                                <Clock size={9} />
                              )}
                              {s.time} {s.action ? s.action : "Pending"}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Actions: Toggle & 3-Dots */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(reminder)}
                      className="transition-transform active:scale-90"
                      title={
                        reminder.enabled
                          ? "Pause reminder schedule"
                          : "Activate reminder schedule"
                      }
                    >
                      {reminder.enabled ? (
                        <ToggleRight size={28} className="text-primary hover:text-primary/90" />
                      ) : (
                        <ToggleLeft size={28} className="text-muted-foreground opacity-60" />
                      )}
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all active:scale-90"
                          title="More options"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-1.5 min-w-[160px] shadow-xl border-border/40">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate("/reminders/new", {
                              state: {
                                editId: reminder.id,
                                medicineId: reminder.medicineId,
                                medicineName: reminder.medicineName,
                                dose: reminder.dose,
                                time: reminder.time,
                                repeat: reminder.repeatSchedule,
                                repeatDays: reminder.repeatDays,
                                notes: reminder.notes,
                                enabled: reminder.enabled,
                                color: reminder.color,
                                icon: reminder.icon,
                                patientId: reminder.patientId ?? null,
                                patientName: reminder.patientName ?? null,
                              },
                            })
                          }
                          className="gap-2.5 font-bold text-xs rounded-xl p-2.5 cursor-pointer"
                        >
                          <Pencil size={14} className="text-primary" />
                          Edit Schedule
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggle(reminder)}
                          className="gap-2.5 font-bold text-xs rounded-xl p-2.5 cursor-pointer"
                        >
                          <RefreshCw size={14} />
                          {reminder.enabled ? "Pause Schedule" : "Resume Schedule"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1 bg-border/40" />
                        <DropdownMenuItem
                          onClick={() => setPendingDeleteId(reminder.id)}
                          className="gap-2.5 font-bold text-xs rounded-xl p-2.5 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 size={14} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Background Notification Hint Banner */}
      {scopedReminders.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent border border-violet-500/20 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
            <Bell size={16} />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            Reminders automatically fire as native notifications with sound when your scheduled dose is due, even in the background.
          </p>
        </motion.div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              This reminder will be permanently removed. Your past dose logs and adherence history will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
