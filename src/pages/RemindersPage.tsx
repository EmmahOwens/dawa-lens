import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight, Clock,
  Pill, AlarmCheck, AlarmClockOff, Pencil, Syringe, Droplets, Tablets
} from "lucide-react";
import { useApp, Reminder } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function repeatLabel(reminder: Reminder): string {
  const { repeatSchedule, repeatDays } = reminder;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  switch (repeatSchedule) {
    case "daily": return "Every day";
    case "once": return "One time";
    case "custom": 
      const timesCount = reminder.time.split(",").length;
      let label = timesCount > 1 ? `${timesCount} times a day` : "Custom";
      if (repeatDays && repeatDays.length > 0) {
        label += ` (${repeatDays.map(d => days[d]).join(", ")})`;
      }
      return label;
    default: return repeatSchedule;
  }
}

const colorMap: Record<string, { value: string; border: string; text: string }> = {
  blue: { value: "bg-blue-500", border: "border-blue-500/20", text: "text-blue-500" },
  green: { value: "bg-emerald-500", border: "border-emerald-500/20", text: "text-emerald-500" },
  purple: { value: "bg-violet-500", border: "border-violet-500/20", text: "text-violet-500" },
  rose: { value: "bg-rose-500", border: "border-rose-500/20", text: "text-rose-500" },
  amber: { value: "bg-amber-500", border: "border-amber-500/20", text: "text-amber-500" },
  slate: { value: "bg-slate-600", border: "border-slate-600/20", text: "text-slate-600" },
};

const iconMap: Record<string, any> = {
  pill: Pill,
  tablet: Tablets,
  liquid: Droplets,
  syringe: Syringe,
};

export default function RemindersPage() {
  const navigate = useNavigate();
  const { reminders, updateReminder, deleteReminder, doseLogs, isInitializing } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Sort: enabled first, then by time
  const sorted = useMemo(() => {
    return [...reminders].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.time.localeCompare(b.time);
    });
  }, [reminders]);

  // Today stats
  const enabledCount = reminders.filter((r) => r.enabled).length;
  const takenToday = doseLogs.filter(
    (l) =>
      l.action === "taken" &&
      new Date(l.actionTime).toDateString() === new Date().toDateString()
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

  return (
    <div className="px-4 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
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
          onClick={() => navigate("/reminders/new")}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/25"
        >
          <Plus size={16} />
          Add
        </motion.button>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <div className="p-3 rounded-2xl bg-primary/8 border border-primary/15 text-center">
          <p className="text-2xl font-bold text-primary">{reminders.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Total</p>
        </div>
        <div className="p-3 rounded-2xl bg-success/8 border border-success/15 text-center">
          <p className="text-2xl font-bold text-success">{enabledCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Active</p>
        </div>
        <div className="p-3 rounded-2xl bg-accent border border-border/50 text-center">
          <p className="text-2xl font-bold text-foreground">{takenToday}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Taken Today</p>
        </div>
      </motion.div>

      {/* Reminder List */}
      {isInitializing ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 w-full rounded-2xl bg-muted/40 animate-pulse" />
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
            <p className="text-base font-bold text-foreground mb-1">No reminders yet</p>
            <p className="text-sm text-muted-foreground max-w-[220px]">
              Add your first medicine reminder to get started.
            </p>
          </div>
          <Button
            onClick={() => navigate("/reminders/new")}
            className="rounded-2xl mt-2 gap-2"
            size="sm"
          >
            <Plus size={15} /> Add Reminder
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sorted.map((reminder) => {
              const actionToday = doseLogs.find(
                (l) =>
                  l.reminderId === reminder.id &&
                  new Date(l.actionTime).toDateString() === new Date().toDateString()
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
                        ? `${colorMap[reminder.color || "blue"]?.value || "bg-primary"} bg-opacity-10 ${colorMap[reminder.color || "blue"]?.text || "text-primary"}` 
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {(() => {
                      const IconComp = iconMap[reminder.icon || "pill"] || Pill;
                      return <IconComp size={20} />;
                    })()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-foreground leading-tight truncate">
                      {reminder.medicineName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Clock size={11} /> {reminder.time.split(",").join(", ")}
                      </span>
                      <span className="text-[11px] text-muted-foreground/40">·</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">{reminder.dose}</span>
                      <span className="text-[11px] text-muted-foreground/40">·</span>
                      <span className="text-[11px] font-semibold text-muted-foreground capitalize">
                        {repeatLabel(reminder)}
                      </span>
                    </div>

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
                      title={reminder.enabled ? "Pause reminder" : "Activate reminder"}
                    >
                      {reminder.enabled ? (
                        <ToggleRight size={28} className="text-primary" />
                      ) : (
                        <ToggleLeft size={28} className="text-muted-foreground" />
                      )}
                    </button>

                    <div className="flex gap-1.5">
                      {/* Edit */}
                      <button
                        onClick={() => navigate("/reminders/new", { 
                          state: { 
                            editId: reminder.id, 
                            medicineId: reminder.medicineId,
                            medicineName: reminder.medicineName,
                            dose: reminder.dose, 
                            time: reminder.time, 
                            repeat: reminder.repeatSchedule, 
                            repeatDays: reminder.repeatDays,
                            notes: reminder.notes,
                            color: reminder.color,
                            icon: reminder.icon
                          } 
                        })}
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
            Reminders fire as native notifications when the app is in the background on your device.
          </p>
        </motion.div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              This reminder will be permanently removed. Your dose history will not be affected.
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
