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
  Pencil,
  Syringe,
  Droplets,
  Tablets,
  UserRound,
  RefreshCw,
  WifiOff,
  Calendar,
} from "@/lib/icons";
import { useApp, Reminder } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { computeShiftOffset } from "@/services/reminderService";
import { addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { DailyTimeline } from "@/components/dashboard/DailyTimeline";
import { requestGoogleAccess } from "@/services/googleCalendarService";
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

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

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

/** Applies today's shift offset to a base HH:MM string and returns the display string. */
function shiftTimeStr(baseTime: string, offsetMinutes: number): string {
  const [h, m] = baseTime.split(":").map(Number);
  const total =
    (((h * 60 + m + offsetMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

const colorMap: Record<
  string,
  { value: string; border: string; text: string }
> = {
  blue: {
    value: "bg-blue-500",
    border: "border-blue-500/20",
    text: "text-blue-500",
  },
  green: {
    value: "bg-emerald-500",
    border: "border-emerald-500/20",
    text: "text-emerald-500",
  },
  purple: {
    value: "bg-violet-500",
    border: "border-violet-500/20",
    text: "text-violet-500",
  },
  rose: {
    value: "bg-rose-500",
    border: "border-rose-500/20",
    text: "text-rose-500",
  },
  amber: {
    value: "bg-amber-500",
    border: "border-amber-500/20",
    text: "text-amber-500",
  },
  slate: {
    value: "bg-slate-600",
    border: "border-slate-600/20",
    text: "text-slate-600",
  },
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  pill: Pill,
  tablet: Tablets,
  liquid: Droplets,
  syringe: Syringe,
};

export default function RemindersPage() {
  const navigate = useNavigate();
  const { 
    updateReminder, deleteReminder, isInitializing, pendingOfflineOps, logDose,
    googleCalendarEnabled, googleCalendarToken, googleCalendarTokenExpiry,
    isGoogleCalendarTokenValid, googleClientId, setGoogleCalendarToken, setGoogleCalendarTokenExpiry
  } = useApp();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleReconnectCalendar = async () => {
    if (!googleClientId) {
      toast({
        title: "Configuration Required",
        description: "Please enter your Google Client ID in Settings first.",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Connecting...",
        description: "Please complete Google authentication in the popup window."
      });
      const authResult = await requestGoogleAccess(googleClientId);
      setGoogleCalendarToken(authResult.accessToken);
      setGoogleCalendarTokenExpiry(Date.now() + authResult.expiresIn * 1000);
      toast({
        title: "Google Calendar Reconnected!",
        description: "Syncing will now resume."
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Reconnection Failed",
        description: err.message || "Failed to authenticate with Google.",
        variant: "destructive"
      });
    }
  };

  const { resolvedPatient, scopedReminders, scopedDoseLogs } =
    usePatientScope();

  // Sort: enabled first, then by time
  const sorted = useMemo(() => {
    return [...scopedReminders].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.time.localeCompare(b.time);
    });
  }, [scopedReminders]);

  // Today stats for the active profile — scoped to scopedReminders only
  const filteredReminderIds = useMemo(
    () => new Set(scopedReminders.map((r) => r.id)),
    [scopedReminders]
  );
  const enabledCount = scopedReminders.filter((r) => r.enabled).length;
  const todayStr = new Date().toDateString();
  const takenToday = scopedDoseLogs.filter(
    (l) =>
      filteredReminderIds.has(l.reminderId) &&
      l.action === "taken" &&
      new Date(l.actionTime).toDateString() === todayStr
  ).length;
  const missedToday = scopedDoseLogs.filter(
    (l) =>
      filteredReminderIds.has(l.reminderId) &&
      l.action === "missed" &&
      new Date(l.actionTime).toDateString() === todayStr
  ).length;

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

  return (
    <div className="px-4 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("reminders.title", "Reminders")}
          </h1>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            {enabledCount} active · {takenToday} taken today
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() =>
            navigate("/reminders/new", {
              state: {
                patientId: resolvedPatient.id,
                patientName: !resolvedPatient.isOwner
                  ? resolvedPatient.name
                  : null,
              },
            })
          }
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/25"
        >
          <Plus size={16} />
          Add
        </motion.button>
      </motion.div>

      {/* Active Profile Chip */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-2xl bg-secondary/60 border border-border/40 w-fit"
      >
        <UserRound size={13} className="text-primary flex-shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Viewing:
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
          {resolvedPatient.isOwner
            ? `${resolvedPatient.name} (You)`
            : resolvedPatient.name}
        </span>
      </motion.div>

      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <WifiOff size={14} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Offline mode
                </p>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 leading-snug">
                  {pendingOfflineOps > 0
                    ? `${pendingOfflineOps} change${pendingOfflineOps !== 1 ? "s" : ""} will sync when you reconnect`
                    : "Changes you make will sync when you reconnect"}
                </p>
              </div>
              {pendingOfflineOps > 0 && (
                <span className="flex-shrink-0 text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  {pendingOfflineOps} pending
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Calendar Alert Banner */}
      <AnimatePresence>
        {googleCalendarEnabled && !isGoogleCalendarTokenValid() && (
          <motion.div
            key="calendar-alert-banner"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                  <Calendar size={14} className="text-destructive" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-destructive">
                    Google Calendar Sync Paused
                  </p>
                  <p className="text-[10px] text-destructive/70 leading-snug">
                    Your Google session has expired. Reconnect to resume sync.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReconnectCalendar}
                className="flex-shrink-0 rounded-xl text-[9px] font-black uppercase tracking-widest px-3 h-8 border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-destructive bg-transparent"
              >
                Reconnect
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-2 mb-6"
      >
        <div className="p-3 rounded-2xl bg-primary/8 border border-primary/15 text-center">
          <p className="text-2xl font-bold text-primary">
            {scopedReminders.length}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
            Total
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-success/8 border border-success/15 text-center">
          <p className="text-2xl font-bold text-success">{enabledCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
            Active
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-accent border border-border/50 text-center">
          <p className="text-2xl font-bold text-foreground">{takenToday}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
            Taken
          </p>
        </div>
        <div
          className={`p-3 rounded-2xl text-center ${
            missedToday > 0
              ? "bg-destructive/8 border border-destructive/20"
              : "bg-accent border border-border/50"
          }`}
        >
          <p
            className={`text-2xl font-bold ${
              missedToday > 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {missedToday}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
            Missed
          </p>
        </div>
      </motion.div>

      {/* Daily Timeline (Only when offline since Dashboard is blocked) */}
      {!isOnline && (
        <DailyTimeline
          reminders={scopedReminders}
          doseLogs={scopedDoseLogs}
          onAction={handleAction}
        />
      )}

      {/* Reminder List */}
      {isInitializing ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 w-full rounded-2xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-border/50 bg-accent/20 text-center gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Bell size={28} />
          </div>
          <div>
            <p className="text-base font-bold text-foreground mb-1">
              No reminders yet
            </p>
            <p className="text-sm text-muted-foreground max-w-[220px]">
              Add your first medicine reminder to get started.
            </p>
          </div>
          <Button
            onClick={() =>
              navigate("/reminders/new", {
                state: {
                  patientId: resolvedPatient.id,
                  patientName: !resolvedPatient.isOwner
                    ? resolvedPatient.name
                    : null,
                },
              })
            }
            className="rounded-2xl mt-2 gap-2"
            size="sm"
          >
            <Plus size={15} /> Add Reminder
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          <AnimatePresence mode="popLayout">
            {sorted.map((reminder) => {
              const actionToday = scopedDoseLogs.find(
                (l) =>
                  l.reminderId === reminder.id &&
                  new Date(l.actionTime).toDateString() ===
                    new Date().toDateString()
              );

              return (
                <motion.div
                  key={reminder.id}
                  variants={item}
                  layout
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all shadow-sm ${
                    reminder.enabled
                      ? "bg-card border-border/50 hover:border-primary/20"
                      : "bg-muted/30 border-border/30 opacity-60"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                      reminder.enabled
                        ? `${
                            colorMap[reminder.color || "blue"]?.value ||
                            "bg-primary"
                          } bg-opacity-10 ${
                            colorMap[reminder.color || "blue"]?.text ||
                            "text-primary"
                          }`
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {(() => {
                      const IconComp = iconMap[reminder.icon || "pill"] || Pill;
                      return <IconComp className="size-5" />;
                    })()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-bold text-foreground leading-tight truncate">
                        {reminder.medicineName}
                      </p>
                      {/* For: Name tag — only shown on family member / client reminders */}
                      {reminder.patientName && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                          <UserRound size={9} /> For: {reminder.patientName}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const offsetMinutes = computeShiftOffset(
                        reminder,
                        scopedDoseLogs
                      );
                      const baseTimes = reminder.time
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => {
                          const parts = t.split(":");
                          if (parts.length !== 2) return false;
                          const [h, m] = parts.map(Number);
                          return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
                        });
                      // Determine which slots to shift: those after the taken slot index
                      let takenSlotIndex = -1;
                      if (offsetMinutes !== 0) {
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
                          const sd = new Date(todayLog.scheduledTime);
                          const ts = `${sd
                            .getHours()
                            .toString()
                            .padStart(2, "0")}:${sd
                            .getMinutes()
                            .toString()
                            .padStart(2, "0")}`;
                          takenSlotIndex = baseTimes.indexOf(ts);
                          if (takenSlotIndex === -1) {
                            const sm = sd.getHours() * 60 + sd.getMinutes();
                            let minD = Infinity;
                            baseTimes.forEach((t, i) => {
                              const [hh, mm] = t.split(":").map(Number);
                              const d = Math.abs(hh * 60 + mm - sm);
                              if (d < minD) {
                                minD = d;
                                takenSlotIndex = i;
                              }
                            });
                          }
                        }
                      }
                      const displayTimes = baseTimes.map((t, idx) =>
                        offsetMinutes !== 0 && idx > takenSlotIndex
                          ? shiftTimeStr(t, offsetMinutes)
                          : t
                      );
                      const hasShift =
                        offsetMinutes !== 0 && takenSlotIndex !== -1;
                      return (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                            <Clock size={11} />
                            {displayTimes.join(", ")}
                          </span>
                          {hasShift && (
                            <span
                              title={`Schedule shifted ${
                                offsetMinutes > 0 ? "+" : ""
                              }${offsetMinutes}m today`}
                              className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                                offsetMinutes > 0
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-blue-500/10 text-blue-500"
                              }`}
                            >
                              <RefreshCw size={8} />
                              {offsetMinutes > 0 ? "+" : ""}
                              {offsetMinutes}m
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground/40">
                            ·
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {reminder.dose}
                          </span>
                          <span className="text-[11px] text-muted-foreground/40">
                            ·
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground capitalize">
                            {repeatLabel(reminder)}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Today's action badge */}
                    {actionToday && (
                      <div className="mt-1.5 inline-flex items-center gap-1">
                        {actionToday.action === "taken" ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                            <AlarmCheck size={10} /> Taken today
                          </span>
                        ) : actionToday.action === "skipped" ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                            <AlarmClockOff size={10} /> Skipped today
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                            <Clock size={10} /> Snoozed today
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(reminder)}
                      className="transition-transform active:scale-90"
                      title={
                        reminder.enabled
                          ? "Pause reminder"
                          : "Activate reminder"
                      }
                    >
                      {reminder.enabled ? (
                        <ToggleRight size={28} className="text-primary" />
                      ) : (
                        <ToggleLeft
                          size={28}
                          className="text-muted-foreground"
                        />
                      )}
                    </button>

                    <div className="flex gap-1.5">
                      {/* Edit */}
                      <button
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
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Edit reminder"
                      >
                        <Pencil size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setPendingDeleteId(reminder.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete reminder"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Notes hint */}
      {sorted.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-3"
        >
          <Bell size={16} className="text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Reminders fire as native notifications when the app is in the
            background on your device.
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
              This reminder will be permanently removed. Your dose history will
              not be affected.
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
