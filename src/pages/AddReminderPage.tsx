import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Pill, Syringe, Droplets, Tablets, Info, Check, UserRound, WifiOff, Package } from "@/lib/icons";
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
import { Bell } from "@/lib/icons";
import PermissionRequest from "@/components/PermissionRequest";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface LocationState {
  // Pre-fill from scan/results
  medicineName?: string;
  medicineId?: string;
  dose?: string;
  // Edit mode
  editId?: string;
  time?: string; // Comma-separated for frequency
  repeat?: "daily" | "weekly" | "once" | "custom";
  repeatDays?: number[];
  frequency?: number;
  notes?: string;
  enabled?: boolean;
  color?: string;
  icon?: string;
  // Family Hub context — whose schedule we're editing
  patientId?: string | null;
  patientName?: string | null;
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

  const { addReminder, updateReminder, addMedicine, updateMedicine, medicines, reminders, userProfile } = useApp();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isEditing = !!state?.editId;

  // Patient context passed from Family Hub
  const contextPatientId = state?.patientId ?? null;
  const contextPatientName = state?.patientName ?? null;

  // Filter medicine inventory to the active patient scope
  const scopedMedicines = useMemo(() => {
    return medicines.filter(m => {
      const pId = (m as any).patientId ?? null;
      if (contextPatientId === null) {
        return pId === null || pId === userProfile?.id;
      }
      return pId === contextPatientId;
    });
  }, [medicines, contextPatientId, userProfile?.id]);


  const [medicineId, setMedicineId] = useState<string | undefined>(state?.medicineId);
  const [medicineName, setMedicineName] = useState(state?.medicineName || "");
  const [dose, setDose] = useState(state?.dose || "");
  const [times, setTimes] = useState<string[]>(
    state?.time ? state.time.split(",") : ["08:00"]
  );
  const [repeat, setRepeat] = useState<"daily" | "weekly" | "once" | "custom">(
    state?.repeat || "daily"
  );
  const [repeatDays, setRepeatDays] = useState<number[]>(state?.repeatDays || []);
  const [notes, setNotes] = useState(state?.notes || "");
  const [color, setColor] = useState(state?.color || "blue");
  const [icon, setIcon] = useState(state?.icon || "pill");
  const [isSaving, setIsSaving] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const selectedMedicine = useMemo(() => {
    return scopedMedicines.find(m => m.id === medicineId);
  }, [scopedMedicines, medicineId]);

  const isAlreadyTracked = !!(selectedMedicine && selectedMedicine.currentQuantity !== undefined);

  // Med Vault stock tracking fields
  const [stockQty, setStockQty] = useState("");        // current pills on hand
  const [stockPerDose, setStockPerDose] = useState("1"); // pills per dose
  const [stockUnit, setStockUnit] = useState("tablets");  // unit type
  const [stockTotal, setStockTotal] = useState("");      // full pack size

  // Keep track of loaded medicine ID to prevent resetting stock inputs while manually typing
  const [prevMedicineId, setPrevMedicineId] = useState<string | undefined>(undefined);
  const [isEditingStock, setIsEditingStock] = useState(false);

  // Sync stock tracking fields when a medicine is selected or during initial load/edit
  useEffect(() => {
    if (medicineId !== prevMedicineId) {
      setIsEditingStock(false);
      if (medicineId) {
        const med = medicines.find((m) => m.id === medicineId);
        if (med) {
          setStockQty(med.currentQuantity !== undefined ? med.currentQuantity.toString() : "");
          setStockPerDose(med.dosagePerDose !== undefined ? med.dosagePerDose.toString() : "1");
          setStockUnit(med.unit || "tablets");
          setStockTotal(med.totalQuantity !== undefined ? med.totalQuantity.toString() : "");
        }
      } else {
        // Clear stock tracking fields only when switching back to manual entry
        setStockQty("");
        setStockPerDose("1");
        setStockUnit("tablets");
        setStockTotal("");
      }
      setPrevMedicineId(medicineId);
    }
  }, [medicineId, medicines, prevMedicineId]);

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

    const hasInvalidTime = times.some(t => {
      if (!t || t.trim() === "") return true;
      const parts = t.split(":");
      if (parts.length !== 2) return true;
      const [h, m] = parts.map(Number);
      return isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59;
    });

    if (hasInvalidTime || times.length === 0) {
      toast({
        title: "Invalid Time",
        description: "Please specify valid scheduled times (HH:MM format).",
        variant: "destructive",
      });
      return;
    }

    // Skip permission gate when offline — the reminder will be saved locally
    // and notifications are scheduled on-device via NativeAlarm regardless.
    if (Capacitor.isNativePlatform() && isOnline) {
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

      // If it's a new medicine (Manual Entry), add it to the cabinet first.
      // Pass contextPatientId explicitly so the medicine is scoped to the correct
      // patient even if selectedPatientId doesn't match (e.g., navigated from FamilyHub).
      if (!finalMedId && medicineName.trim()) {
        try {
          const stockFields: Record<string, unknown> = {};
          const parsedQty = parseFloat(stockQty);
          if (!isNaN(parsedQty) && parsedQty > 0) {
            stockFields.currentQuantity = parsedQty;
            stockFields.totalQuantity = parseFloat(stockTotal) || parsedQty;
            stockFields.dosagePerDose = parseFloat(stockPerDose) || 1;
            stockFields.unit = stockUnit;
          }
          const newMed = await addMedicine({
            name: medicineName.trim(),
            dosage: dose.trim(),
            icon: icon,
            color: color,
            ...stockFields,
          }, contextPatientId);
          finalMedId = newMed.id;
        } catch (e) {
          console.warn("Could not auto-add medicine to cabinet:", e);
          // Continue anyway, reminder will just be unlinked
        }
      } else if (finalMedId) {
        // Update existing medicine's stock fields if user provided them
        const parsedQty = parseFloat(stockQty);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          try {
            await updateMedicine(finalMedId, {
              currentQuantity: parsedQty,
              totalQuantity: parseFloat(stockTotal) || parsedQty,
              dosagePerDose: parseFloat(stockPerDose) || 1,
              unit: stockUnit,
            });
          } catch (e) {
            console.warn("Could not update medicine stock:", e);
          }
        }
      }

      if (isEditing && state?.editId) {
        await updateReminder(state.editId, {
          medicineId: finalMedId,
          medicineName: medicineName.trim(),
          dose: dose.trim(),
          time: times.join(","),
          repeatSchedule: repeat,
          repeatDays: repeat === "custom" || repeat === "weekly" ? repeatDays : undefined,
          notes: notes.trim() || undefined,
          enabled: state?.enabled !== undefined ? state.enabled : true,
          color,
          icon,
          // Preserve patient context on edit
          patientId: contextPatientId,
          patientName: contextPatientName,
        });
        toast({
          title: "Reminder updated",
          description: contextPatientName
            ? `For ${contextPatientName}: ${medicineName} @ ${times[0]}${times.length > 1 ? ` +${times.length - 1}` : ""}`
            : `${medicineName} @ ${times[0]}${times.length > 1 ? ` +${times.length - 1}` : ""}`,
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
          // Attach patient ownership for family member reminders
          patientId: contextPatientId,
          patientName: contextPatientName,
        });
        toast({
          title: t("reminders.created"),
          description: contextPatientName
            ? `For ${contextPatientName}: ${medicineName} @ ${times[0]}${times.length > 1 ? ` +${times.length - 1}` : ""}`
            : `${medicineName} @ ${times[0]}${times.length > 1 ? ` +${times.length - 1}` : ""}`,
        });

        // Ask for battery optimization exemption on Android after adding first reminder
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
          const hasRequested = await NativeService.preferences.get("has_requested_battery_exemption");
          if (!hasRequested) {
            await NativeService.preferences.set("has_requested_battery_exemption", "true");
            setTimeout(async () => {
              await NativeService.requestBatteryOptimizationExemption();
            }, 800);
          }
        }
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
        
        {!isOnline ? (
          <Badge variant="outline" className="rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5">
            <WifiOff size={11} /> Saving Locally
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-lg bg-primary/5 text-primary border-primary/20">
            <Info size={12} className="mr-1" /> Premium Experience
          </Badge>
        )}
      </div>

      {/* Patient Context Banner — shown when scheduling for a family member / client */}
      {contextPatientName && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mb-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-primary/10 border border-primary/25 shadow-sm"
        >
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <UserRound size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 leading-none mb-0.5">Scheduling for</p>
            <p className="text-sm font-black text-primary tracking-tight truncate">{contextPatientName}</p>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-primary/50 bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0">
            Family Hub
          </span>
        </motion.div>
      )}

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
        <p className="text-muted-foreground mt-1">
          {contextPatientName
            ? `Setting up a medication schedule for ${contextPatientName}.`
            : "Configure your medication schedule with precision."}
        </p>
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
                    const med = scopedMedicines.find(m => m.id === val);
                    if (med) {
                      setMedicineId(med.id);
                      setMedicineName(med.name);
                      setDose(med.dosage);

                      // Check if a reminder already exists for this medicine
                      const existingRem = reminders.find(r => r.medicineId === med.id);
                      if (existingRem && !isEditing) {
                        toast({
                          title: "Existing reminder found",
                          description: `You already have a reminder for ${med.name}. If you save this, you'll have two.`,
                        });
                      }
                    }
                  }
                }}
              >
                <SelectTrigger className="h-12 rounded-xl border-border/50 bg-muted/20">
                  <SelectValue placeholder={scopedMedicines.length > 0 ? "Select from inventory" : "No medicines yet — add manually"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual Entry</SelectItem>
                  {scopedMedicines.map(m => (
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
                {(["once", "daily", "weekly", "custom"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRepeat(r);
                      if (r !== "custom" && r !== "weekly" && times.length > 1) {
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

            {(repeat === "custom" || repeat === "weekly") && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="col-span-full space-y-4 pt-2"
              >
                {repeat === "custom" && (
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
                )}

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
        
        {/* Stock Tracking (Med Vault) Section */}
        <motion.section
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="premium-card space-y-6"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Stock Tracking (Med Vault)</h2>
            </div>
            {isAlreadyTracked && !isEditingStock && (
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-lg">
                Tracked
              </span>
            )}
          </div>

          {isAlreadyTracked && selectedMedicine && !isEditingStock ? (
            <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 dark:bg-teal-500/10 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-xl">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                      Stock Tracking Active
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Managed in Med Vault
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingStock(true)}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition-colors"
                >
                  Adjust Stock Settings
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Stock</p>
                  <p className="text-xl font-black text-foreground mt-0.5">
                    {selectedMedicine.currentQuantity} <span className="text-xs font-semibold text-muted-foreground">{selectedMedicine.unit || "units"}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Original Pack Size</p>
                  <p className="text-xl font-black text-foreground mt-0.5">
                    {selectedMedicine.totalQuantity || selectedMedicine.currentQuantity} <span className="text-xs font-semibold text-muted-foreground">{selectedMedicine.unit || "units"}</span>
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              {selectedMedicine.totalQuantity && selectedMedicine.totalQuantity > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="w-full h-2.5 rounded-full bg-muted/45 overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, ((selectedMedicine.currentQuantity || 0) / selectedMedicine.totalQuantity) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                    <span>{Math.round(((selectedMedicine.currentQuantity || 0) / selectedMedicine.totalQuantity) * 100)}% remaining</span>
                    <span>Dose size: {selectedMedicine.dosagePerDose || 1} {selectedMedicine.unit || "units"}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {isAlreadyTracked && isEditingStock && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2">
                    <Package size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Adjusting Stock Settings</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingStock(false)}
                    className="text-[10px] font-bold hover:underline"
                  >
                    Cancel Adjustments
                  </button>
                </div>
              )}

              {!isAlreadyTracked && selectedMedicine && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40 text-muted-foreground mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-2 bg-muted/60 text-muted-foreground rounded-xl">
                    <Package size={16} className="opacity-60" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-xs font-black uppercase tracking-wider">Stock Tracking Disabled</p>
                    <p className="text-[11px] font-medium opacity-90 mt-0.5 leading-relaxed">
                      This medication is not yet tracked in your Med Vault. 
                      Fill in the details below to enable automatic stock deduction when taking doses.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="stockQty" className="text-xs font-bold text-muted-foreground ml-1">
                    Total pills/units you have right now
                  </Label>
                  <Input
                    id="stockQty"
                    type="number"
                    inputMode="numeric"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    placeholder="Leave blank if not tracking stock"
                    className="h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stockPerDose" className="text-xs font-bold text-muted-foreground ml-1">
                    Pills/units per dose
                  </Label>
                  <Input
                    id="stockPerDose"
                    type="number"
                    inputMode="numeric"
                    value={stockPerDose}
                    onChange={(e) => setStockPerDose(e.target.value)}
                    placeholder="e.g. 1"
                    className="h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground ml-1">Unit</Label>
                  <Select value={stockUnit} onValueChange={setStockUnit}>
                    <SelectTrigger className="h-12 rounded-xl border-border/50 bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["tablets", "capsules", "ml", "puffs", "drops", "units"].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stockTotal" className="text-xs font-bold text-muted-foreground ml-1">
                    Total when full (original pack size)
                  </Label>
                  <Input
                    id="stockTotal"
                    type="number"
                    inputMode="numeric"
                    value={stockTotal}
                    onChange={(e) => setStockTotal(e.target.value)}
                    placeholder="e.g. 30"
                    className="h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-all"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic ml-1">
                Setting a stock count enables Med Vault tracking, which automatically reduces stock as you take doses.
              </p>
            </>
          )}
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", damping: 25, stiffness: 200 }}
          className="mt-8 flex justify-center w-full z-40"
        >
          <div className="w-full max-w-lg pointer-events-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-14 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-[0_20px_50px_rgba(0,122,255,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] group relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
              size="lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out opacity-20" />
              <Save size={18} className="mr-2 relative z-10" />
              <span className="relative z-10">
                {isSaving
                  ? "Saving Schedule..."
                  : isEditing
                  ? t("reminders.save_reminder", "Update Reminder")
                  : !isOnline
                  ? "Save Offline"
                  : t("reminders.save_reminder")}
              </span>
            </Button>
          </div>
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
