import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function AddReminderPage() {
  const navigate = useNavigate();
  const { addReminder } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [medicineName, setMedicineName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("08:00");
  const [repeat, setRepeat] = useState<"daily" | "weekly" | "once" | "custom">("daily");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (!medicineName.trim() || !dose.trim()) {
      toast({ 
        title: t("reminders.missing_fields"), 
        description: t("reminders.missing_fields_desc"), 
        variant: "destructive" 
      });
      return;
    }
    addReminder({
      medicineName: medicineName.trim(),
      dose: dose.trim(),
      time,
      repeatSchedule: repeat,
      notes: notes.trim() || undefined,
      enabled: true,
    });
    toast({ title: t("reminders.created"), description: `${medicineName} @ ${time}` });
    navigate("/");
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-foreground mb-6"
      >
        {t("reminders.add_title")}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-5"
      >
        <div>
          <Label htmlFor="medName">{t("reminders.med_name")}</Label>
          <Input
            id="medName"
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
            placeholder={t("reminders.med_name_placeholder")}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="dose">{t("reminders.dose")}</Label>
          <Input
            id="dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder={t("reminders.dose_placeholder")}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="time">{t("reminders.time")}</Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>{t("reminders.repeat")}</Label>
          <Select value={repeat} onValueChange={(v) => setRepeat(v as any)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">{t("reminders.once")}</SelectItem>
              <SelectItem value="daily">{t("reminders.daily")}</SelectItem>
              <SelectItem value="weekly">{t("reminders.weekly")}</SelectItem>
              <SelectItem value="custom">{t("reminders.custom")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">{t("reminders.notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("reminders.notes_placeholder")}
            className="mt-1.5"
            rows={3}
          />
        </div>

        <Button onClick={handleSave} className="w-full" size="lg">
          <Save size={16} className="mr-2" /> {t("reminders.save_reminder")}
        </Button>
      </motion.div>
    </div>
  );
}
