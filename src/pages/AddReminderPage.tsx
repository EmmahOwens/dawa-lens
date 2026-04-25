import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Pill, Syringe, Droplets, Tablets, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { Bell } from "lucide-react";
import PermissionRequest from "@/components/PermissionRequest";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";

interface LocationState {
  // Pre-fill from scan/results
  medicineName?: string;
  medicineId?: string;
  dose?: string;
  // Edit mode
  editId?: string;
  time?: string; // Comma-separated for frequency
  repeat?: "daily" | "once" | "custom";
  repeatDays?: number[];
  frequency?: number;
  notes?: string;
  color?: string;
  icon?: string;
}

const COLORS = [
  { name: "blue", value: "bg-blue-500", border: "border-blue-500/20", text: "text-blue-500" },
  { name: "green", value: "bg-emerald-500", border: "border-emerald-500/20", text: "text-emerald-500" },
  { name: "purple", value: "bg-violet-500", border: "border-violet-500/20", text: "text-violet-500" },
  { name: "rose", value: "bg-rose-500", border: "border-rose-500/20", text: "text-rose-500" },
  { name: "amber", value: "bg-amber-500", border: "border-amber-500/20", text: "text-amber-500" },
  { name: "slate", value: "bg-slate-600", border: "border-slate-600/20", text: "text-slate-600" },
];

const ICONS = [
  { name: "pill", icon: Pill },
  { name: "tablet", icon: Tablets },
  { name: "liquid", icon: Droplets },
  { name: "syringe", icon: Syringe },
];

export default function AddReminderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const { addReminder, updateReminder, addMedicine, medicines } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isEditing = !!state?.editId;

  const [medicineId, setMedicineId] = useState<string | undefined>(state?.medicineId);
  const [medicineName, setMedicineName] = useState(state?.medicineName || "");
  const [dose, setDose] = useState(state?.dose || "");
  const [times, setTimes] = useState<string[]>(
    state?.time ? state.time.split(",") : ["08:00"]
  );
  const [repeat, setRepeat] = useState<"daily" | "once" | "custom">(
    state?.repeat || "daily"
  );
  const [repeatDays, setRepeatDays] = useState<number[]>(state?.repeatDays || []);
  const [notes, setNotes] = useState(state?.notes || "");
  const [color, setColor] = useState(state?.color || "blue");
  const [icon, setIcon] = useState(state?.icon || "pill");
  const [isSaving, setIsSaving] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const toggleDay = (day: number) => {
    setRepeatDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const distributeTimes = (startTime: string, freq: number) => {
    const [h, m] = startTime.split(":").map(Number);
    const intervalHours = 24 / freq;
    const newTimes = [];
    for (let i = 0; i < freq; i++) {
      const totalMinutes = Math.round((h * 60 + m + i * intervalHours * 60)) % (24 * 60);
      const newH = Math.floor(totalMinutes / 60);
      const newM = Math.floor(totalMinutes % 60);
      newTimes.push(`${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`);
    }
    return newTimes;
  };

  const handleFrequencyChange = (freq: number) => {
    setTimes(distributeTimes(times[0] || "08:00", freq));
  };

  const handleSave = async () => {
    if (!medicineName.trim() || !dose.trim()) {
      toast({
        title: t("reminders.missing_fields"),
        description: t("reminders.missing_fields_desc"),
        variant: "destructive",
      });
      return;
    }

    // Check notification permissions on native
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        setShowPermissionModal(true);
        return; // Stop and show modal
      }
    }

    await executeSave();
  };

  const handleRequestPermission = async () => {
    NativeService.haptics.impact(ImpactStyle.Heavy);
    try {
      const req = await LocalNotifications.requestPermissions();
      setShowPermissionModal(false);
      if (req.display === 'granted') {
        await executeSave();
      } else {
        toast({
          title: "Notifications Disabled",
          description: "We'll save the reminder, but you won't get notifications until enabled in settings.",
          variant: "destructive",
        });
        await executeSave();
      }
    } catch (e) {
      console.error("Permission request failed:", e);
      setShowPermissionModal(false);
      await executeSave();
    }
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      let finalMedId = medicineId;

      // If it's a new medicine (Manual Entry), add it to the cabinet first
      if (!finalMedId && medicineName.trim()) {
        try {
          const newMed = await addMedicine({
            name: medicineName.trim(),
            dosage: dose.trim(),
            icon: icon,
            color: color,
          });
          finalMedId = newMed.id;
        } catch (e) {
          console.warn("Could not auto-add medicine to cabinet:", e);
          // Continue anyway, reminder will just be unlinked
        }
      }

      if (isEditing && state?.editId) {
        await updateReminder(state.editId, {
          medicineId: finalMedId,
          medicineName: medicineName.trim(),
          dose: dose.trim(),
          time: times.join(","),
          repeatSchedule: repeat,
          repeatDays: repeat === "custom" ? repeatDays : undefined,
          notes: notes.trim() || undefined,
          color,
          icon,
        });
        toast({
          title: "Reminder updated",
          description: `${medicineName} @ ${times[0]}${times.length > 1 ? ` +${times.length - 1}` : ""}`,
        });
      } else {
        await addReminder({
          medicineId: finalMedId,
          medicineName: medicineName.trim(),
          dose: dose.trim(),
          time: times.join(","),
          repeatSchedule: repeat,
          repeatDays: repeat === "custom" ? repeatDays : undefined,
          notes: notes.trim() || undefined,
          enabled: true,
          color,
          icon,
        });
        toast({
          title: t("reminders.created"),
          description: `${medicineName} @ ${times[0]}${times.length > 1 ? ` +${times.length - 1}` : ""}`,
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
    <div className="px-4 pt-6 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> {t("common.back")}
        </button>
        
        <Badge variant="outline" className="rounded-lg bg-primary/5 text-primary border-primary/20">
          <Info size={12} className="mr-1" /> Premium Experience
        </Badge>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {isEditing
            ? t("reminders.edit_title", "Edit Reminder")
            : t("reminders.add_title")}
        </h1>
        <p className="text-muted-foreground mt-1">Configure your medication schedule with precision.</p>
      </motion.div>

      {/* Live Preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 ml-1">Live Preview</p>
        <div className={`relative flex items-center gap-4 p-4 rounded-2xl border bg-card shadow-lg transition-all duration-500 ${COLORS.find(c => c.name === color)?.border || 'border-border/50'}`}>
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-500 ${COLORS.find(c => c.name === color)?.value || 'bg-primary'} bg-opacity-10 ${COLORS.find(c => c.name === color)?.text || 'text-primary'}`}>
            {(() => {
              const IconComp = ICONS.find(i => i.name === icon)?.icon || Pill;
              return <IconComp size={24} />;
            })()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-foreground leading-tight truncate">
              {medicineName || "Medicine Name"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-muted-foreground">{dose || "Dose"}</span>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-xs font-semibold text-muted-foreground">{times.join(", ")}</span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className={`w-3 h-3 rounded-full ${COLORS.find(c => c.name === color)?.value || 'bg-primary'} animate-pulse`} />
          </div>
        </div>
      </motion.div>

      <div className="space-y-8">
        {/* Medication Info Section */}
        <motion.section
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="premium-card space-y-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Medication Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground ml-1">
                Link to Inventory (Optional)
              </Label>
              <Select
                value={medicineId || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setMedicineId(undefined);
                  } else {
                    const med = medicines.find(m => m.id === val);
                    if (med) {
                      setMedicineId(med.id);
                      setMedicineName(med.name);
                      setDose(med.dosage);
                    }
                  }
                }}
              >
                <SelectTrigger className="h-12 rounded-xl border-border/50 bg-muted/20">
                  <SelectValue placeholder="Select from your medicines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual Entry</SelectItem>
                  {medicines.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medName" className="text-xs font-bold text-muted-foreground ml-1">
                {t("reminders.med_name")}
              </Label>
              <Input
                id="medName"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                placeholder={t("reminders.med_name_placeholder")}
                className="h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dose" className="text-xs font-bold text-muted-foreground ml-1">
                {t("reminders.dose")}
              </Label>
              <div className="space-y-3">
                <Input
                  id="dose"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder={t("reminders.dose_placeholder")}
                  className="h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-all"
                />
                <div className="flex flex-wrap gap-2">
                  {["1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDose(d)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        dose === d ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {/* Color Picker */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-muted-foreground ml-1">Reminder Color</Label>
              <div className="flex gap-3">
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.name)}
                    className={`w-8 h-8 rounded-full ${c.value} transition-all relative ${
                      color === c.name ? "ring-2 ring-primary ring-offset-2 scale-110 shadow-lg" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {color === c.name && <Check size={14} className="text-white absolute inset-0 m-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-muted-foreground ml-1">Medication Icon</Label>
              <div className="flex gap-3">
                {ICONS.map((i) => {
                  const IconComp = i.icon;
                  return (
                    <button
                      key={i.name}
                      onClick={() => setIcon(i.name)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        icon === i.name ? "bg-primary text-primary-foreground shadow-md scale-105" : "bg-muted text-muted-foreground hover:bg-muted-foreground/10"
                      }`}
                    >
                      <IconComp size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Schedule Section */}
        <motion.section
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="premium-card space-y-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Schedule & Timing</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="time" className="text-xs font-bold text-muted-foreground ml-1">
                {repeat === "custom" ? "Scheduled Times" : t("reminders.time")}
              </Label>
              <div className="space-y-3">
                {times.map((t, idx) => (
                  <Input
                    key={idx}
                    type="time"
                    value={t}
                    onChange={(e) => {
                      const newTime = e.target.value;
                      if (idx === 0 && repeat === "custom") {
                        // Re-distribute based on new start time
                        setTimes(distributeTimes(newTime, times.length));
                      } else {
                        const newTimes = [...times];
                        newTimes[idx] = newTime;
                        setTimes(newTimes);
                      }
                    }}
                    className="h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-all font-medium text-lg"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground ml-1">
                {t("reminders.repeat")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {(["once", "daily", "custom"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRepeat(r);
                      if (r !== "custom" && times.length > 1) {
                        setTimes([times[0]]);
                      }
                    }}
                    className={`flex-1 min-w-[80px] px-3 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      repeat === r 
                        ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                        : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {t(`reminders.${r}`)}
                  </button>
                ))}
              </div>
            </div>

            {repeat === "custom" && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="col-span-full space-y-4 pt-2"
              >
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground ml-1">Frequency (Times per day)</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map((f) => (
                      <button
                        key={f}
                        onClick={() => handleFrequencyChange(f)}
                        className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all border ${
                          times.length === f
                            ? "bg-primary border-primary text-primary-foreground shadow-md"
                            : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        {f}x
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground ml-1 italic">
                    Example: 2 pills taken 3 times a day
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground ml-1">Repeat on Days</Label>
                  <div className="flex justify-between gap-2">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                      <button
                        key={`${day}-${i}`}
                        onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-full text-xs font-bold transition-all border ${
                          repeatDays.includes(i)
                            ? "bg-primary border-primary text-primary-foreground shadow-md scale-110"
                            : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* Notes Section */}
        <motion.section
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="premium-card space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{t("reminders.notes")}</h2>
          </div>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("reminders.notes_placeholder")}
            className="min-h-[100px] rounded-2xl border-border/50 bg-muted/20 focus:bg-background transition-all resize-none p-4"
          />
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-[calc(105px+env(safe-area-inset-bottom))] left-0 right-0 p-4 bg-background/70 backdrop-blur-[10px] backdrop-saturate-[180%] border-t border-border/50 z-40 flex justify-center md:static md:bottom-auto md:bg-transparent md:border-0 md:p-0 md:backdrop-filter-none"
        >
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full max-w-lg h-14 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-xl shadow-primary/20 group relative overflow-hidden"
            size="lg"
          >
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            <Save size={18} className="mr-2" />
            {isSaving
              ? "Saving Schedule..."
              : isEditing
              ? t("reminders.save_reminder", "Update Reminder")
              : t("reminders.save_reminder")}
          </Button>
        </motion.div>
      </div>

      <PermissionRequest
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onConfirm={handleRequestPermission}
        title="Stay Notified"
        description="We need notification access to remind you exactly when to take your medication."
        icon={Bell}
        permissionName="Notifications"
      />
    </div>
  );
}
