import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface LocationState {
  // Pre-fill from scan/results
  medicineName?: string;
  dose?: string;
  // Edit mode
  editId?: string;
  time?: string;
  repeat?: "daily" | "weekly" | "once" | "custom";
  notes?: string;
}

export default function AddReminderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const { addReminder, updateReminder } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isEditing = !!state?.editId;

  const [medicineName, setMedicineName] = useState(state?.medicineName || "");
  const [dose, setDose] = useState(state?.dose || "");
  const [time, setTime] = useState(state?.time || "08:00");
  const [repeat, setRepeat] = useState<"daily" | "weekly" | "once" | "custom">(
    state?.repeat || "daily"
  );
  const [notes, setNotes] = useState(state?.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!medicineName.trim() || !dose.trim()) {
      toast({
        title: t("reminders.missing_fields"),
        description: t("reminders.missing_fields_desc"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && state?.editId) {
        await updateReminder(state.editId, {
          medicineName: medicineName.trim(),
          dose: dose.trim(),
          time,
          repeatSchedule: repeat,
          notes: notes.trim() || undefined,
        });
        toast({
          title: "Reminder updated",
          description: `${medicineName} @ ${time}`,
        });
      } else {
        await addReminder({
          medicineName: medicineName.trim(),
          dose: dose.trim(),
          time,
          repeatSchedule: repeat,
          notes: notes.trim() || undefined,
          enabled: true,
        });
        toast({
          title: t("reminders.created"),
          description: `${medicineName} @ ${time}`,
        });
      }
      navigate("/reminders");
    } catch {
      toast({
        title: "Failed to save reminder",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-foreground mb-8 tracking-tight"
      >
        {isEditing
          ? t("reminders.edit_title", "Edit Reminder")
          : t("reminders.add_title")}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="premium-card space-y-6"
      >
        <div>
          <Label
            htmlFor="medName"
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1"
          >
            {t("reminders.med_name")}
          </Label>
          <Input
            id="medName"
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
            placeholder={t("reminders.med_name_placeholder")}
            className="mt-2 h-11 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-colors"
          />
        </div>

        <div>
          <Label
            htmlFor="dose"
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1"
          >
            {t("reminders.dose")}
          </Label>
          <Input
            id="dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder={t("reminders.dose_placeholder")}
            className="mt-2 h-11 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-colors"
          />
        </div>

        <div>
          <Label
            htmlFor="time"
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1"
          >
            {t("reminders.time")}
          </Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-2 h-11 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-colors"
          />
        </div>

        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            {t("reminders.repeat")}
          </Label>
          <Select value={repeat} onValueChange={(v) => setRepeat(v as any)}>
            <SelectTrigger className="mt-2 h-11 rounded-xl border-border/50 bg-muted/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="once">{t("reminders.once")}</SelectItem>
              <SelectItem value="daily">{t("reminders.daily")}</SelectItem>
              <SelectItem value="weekly">{t("reminders.weekly")}</SelectItem>
              <SelectItem value="custom">{t("reminders.custom")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label
            htmlFor="notes"
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1"
          >
            {t("reminders.notes")}
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("reminders.notes_placeholder")}
            className="mt-2 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-colors"
            rows={3}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/10"
          size="lg"
        >
          <Save size={16} className="mr-2" />
          {isSaving
            ? "Saving…"
            : isEditing
            ? t("reminders.save_reminder", "Update Reminder")
            : t("reminders.save_reminder")}
        </Button>
      </motion.div>
    </div>
  );
}
