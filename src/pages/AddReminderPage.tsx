import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Save, Pill, Syringe, Droplets, Tablets, Info, Check, UserRound, WifiOff, Package, AlertTriangle } from "@/lib/icons";
import {
  EDITORIAL_EASE,
  EditorialEyebrow,
} from "@/components/editorial/EditorialPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppleTimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
  {
    name: "blue",
    value: "bg-blue-500",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    tint: "from-blue-50/90 via-card to-sky-50/40 dark:from-blue-950/45 dark:via-card dark:to-sky-950/20",
    iconBg: "bg-blue-500/15 border-blue-500/25",
  },
  {
    name: "green",
    value: "bg-emerald-500",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    tint: "from-emerald-50/90 via-card to-teal-50/40 dark:from-emerald-950/45 dark:via-card dark:to-teal-950/20",
    iconBg: "bg-emerald-500/15 border-emerald-500/25",
  },
  {
    name: "purple",
    value: "bg-violet-500",
    border: "border-violet-500/30",
    text: "text-violet-600 dark:text-violet-400",
    tint: "from-violet-50/90 via-card to-indigo-50/40 dark:from-violet-950/45 dark:via-card dark:to-indigo-950/20",
    iconBg: "bg-violet-500/15 border-violet-500/25",
  },
  {
    name: "rose",
    value: "bg-rose-500",
    border: "border-rose-500/30",
    text: "text-rose-600 dark:text-rose-400",
    tint: "from-rose-50/90 via-card to-pink-50/40 dark:from-rose-950/45 dark:via-card dark:to-pink-950/20",
    iconBg: "bg-rose-500/15 border-rose-500/25",
  },
  {
    name: "amber",
    value: "bg-amber-500",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    tint: "from-amber-50/90 via-card to-orange-50/40 dark:from-amber-950/45 dark:via-card dark:to-orange-950/20",
    iconBg: "bg-amber-500/15 border-amber-500/25",
  },
  {
    name: "slate",
    value: "bg-slate-600",
    border: "border-slate-500/30",
    text: "text-slate-600 dark:text-slate-300",
    tint: "from-slate-100/90 via-card to-slate-50/40 dark:from-slate-900/55 dark:via-card dark:to-slate-950/25",
    iconBg: "bg-slate-500/15 border-slate-500/25",
  },
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
  const [repeat, setRepeat] = useState<"daily" | "weekly" | "once" | "custom">(() => {
    if (state?.repeat) {
      if (state.repeat === "daily" && state.time && state.time.split(",").length > 1) {
        return "custom";
      }
      return state.repeat;
    }
    if (state?.time && state.time.split(",").length > 1) {
      return "custom";
    }
    return "daily";
  });

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

  const parsedStockQty = parseFloat(stockQty);
  const parsedStockTotal = parseFloat(stockTotal);
  const isStockOverCapacity =
    !isNaN(parsedStockQty) && !isNaN(parsedStockTotal) && parsedStockTotal > 0 && parsedStockQty > parsedStockTotal;
  const isStockNegativeQty = !isNaN(parsedStockQty) && parsedStockQty < 0;

  // Keep track of loaded medicine ID to prevent resetting stock inputs while manually typing
  const [prevMedicineId, setPrevMedicineId] = useState<string | undefined>(
    isEditing ? state?.medicineId : undefined
  );
  const [isEditingStock, setIsEditingStock] = useState(false);

  // Sync stock tracking fields and frequency when a medicine is selected or during initial load/edit
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
          if (med.frequencyPerDay && med.frequencyPerDay > 0) {
            if (med.frequencyPerDay > 1) {
              setRepeat("custom");
            } else {
              setRepeat("daily");
            }
            setTimes(distributeTimes(times[0] || "08:00", med.frequencyPerDay));
          }
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
  }, [medicineId, medicines, prevMedicineId, times]);

  // Auto-link to inventory if medicineName passed from scanner/info page matches a vault medication
  useEffect(() => {
    if (!isEditing && !medicineId && state?.medicineName && scopedMedicines.length > 0) {
      const matched = scopedMedicines.find(
        (m) => m.name.toLowerCase() === state.medicineName?.trim().toLowerCase()
      );
      if (matched) {
        setMedicineId(matched.id);
        if (matched.dosage && !dose) {
          setDose(matched.dosage);
        }
      }
    }
  }, [scopedMedicines, isEditing, medicineId, state?.medicineName, dose]);

  const distributeTimes = (startTime: string, freq: number) => {
    if (!startTime || !startTime.includes(":")) return times;
    const [hStr, mStr] = startTime.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (isNaN(h) || isNaN(m)) return times;
    const intervalHours = 24 / Math.max(1, freq);
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

    if (isStockOverCapacity) {
      toast({
        title: "Invalid Stock",
        description: "Remaining pills cannot exceed total pack size.",
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
          if (!isNaN(parsedQty) && parsedQty >= 0) {
            stockFields.currentQuantity = parsedQty;
            stockFields.totalQuantity = !isNaN(parsedStockTotal) && parsedStockTotal > 0 ? parsedStockTotal : parsedQty;
            stockFields.dosagePerDose = parseFloat(stockPerDose) || 1;
            stockFields.frequencyPerDay = times.length || 1;
            stockFields.unit = stockUnit;
          }
          const newMed = await addMedicine({
            name: medicineName.trim(),
            dosage: dose.trim(),
            icon: icon,
            color: color,
            frequencyPerDay: times.length || 1,
            ...stockFields,
          }, contextPatientId);
          finalMedId = newMed.id;
        } catch (e) {
          console.warn("Could not auto-add medicine to cabinet:", e);
          // Continue anyway, reminder will just be unlinked
        }
      } else if (finalMedId) {
        // Update existing medicine's stock fields and frequency
        const parsedQty = parseFloat(stockQty);
        try {
          const updates: Record<string, unknown> = {
            frequencyPerDay: times.length || 1,
          };
          if (!isNaN(parsedQty) && parsedQty >= 0) {
            updates.currentQuantity = parsedQty;
            updates.totalQuantity = !isNaN(parsedStockTotal) && parsedStockTotal > 0 ? parsedStockTotal : parsedQty;
            updates.dosagePerDose = parseFloat(stockPerDose) || 1;
            updates.unit = stockUnit;
          }
          await updateMedicine(finalMedId, updates);
        } catch (e) {
          console.warn("Could not update medicine stock/frequency:", e);
        }
      }

      if (isEditing && state?.editId) {
        await updateReminder(state.editId, {
          medicineId: finalMedId,
          medicineName: medicineName.trim(),
          dose: dose.trim(),
          time: times.join(","),
          repeatSchedule: repeat,
          repeatDays: undefined,
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
          repeatDays: undefined,
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

        // Verify battery optimization exemption on Android
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
          const isIgnored = await NativeService.isBatteryOptimizationIgnored();
          if (!isIgnored) {
            setTimeout(async () => {
              await NativeService.requestBatteryOptimizationExemption();
            }, 600);
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

  const activeColorCfg = COLORS.find((c) => c.name === color) || COLORS[0];

  return (
    <div className="w-full pt-2 sm:pt-4 pb-12">
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-border/80 bg-card hover:bg-secondary text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} /> {t("common.back")}
        </button>

        {!isOnline && (
          <Badge variant="outline" className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1">
            <WifiOff size={11} /> Saving Locally
          </Badge>
        )}
      </div>

      {/* Patient Context Banner — shown when scheduling for a family member / client */}
      {contextPatientName && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 px-5 py-3.5 rounded-[20px] bg-primary/[0.08] border border-primary/25"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">
            <UserRound size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="editorial-mono text-[9.5px] text-primary/80 leading-none mb-1">Scheduling For</p>
            <p className="text-[15px] font-medium text-foreground tracking-tight truncate">{contextPatientName}</p>
          </div>
          <span className="editorial-mono text-[9.5px] text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full flex-shrink-0">
            Family Hub
          </span>
        </motion.div>
      )}

      {/* Editorial Header + Color-Reactive Live Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
        className="editorial-card p-6 sm:p-7 mb-6"
      >
        <EditorialEyebrow
          index="01"
          label={isEditing ? "Schedule Studio · Edit" : "Schedule Studio · New"}
          dotColor="bg-primary"
          className="mb-2"
        />
        <h1 className="editorial-display text-[30px] sm:text-[38px] font-medium text-foreground leading-[1.02] mb-2">
          {isEditing ? (
            <>
              Edit{" "}
              <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                reminder.
              </em>
            </>
          ) : (
            <>
              Add{" "}
              <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                reminder.
              </em>
            </>
          )}
        </h1>
        <p className="text-[13.5px] text-muted-foreground max-w-lg">
          {contextPatientName
            ? `Setting up a medication schedule for ${contextPatientName}.`
            : "Configure your medication schedule, interval timing, and refill vault tracking with precision."}
        </p>

        {/* Color-Reactive Bento Live Preview */}
        <div className="mt-6 pt-5 border-t border-border/65">
          <p className="editorial-mono text-[9.5px] text-muted-foreground mb-2.5">
            Live Schedule Preview
          </p>
          <div
            className={`editorial-bento relative flex items-center gap-4 p-4 sm:p-5 bg-gradient-to-br ${activeColorCfg.tint} ${activeColorCfg.border}`}
          >
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors ${activeColorCfg.iconBg} ${activeColorCfg.text}`}
            >
              {(() => {
                const IconComp = ICONS.find((i) => i.name === icon)?.icon || Pill;
                return <IconComp size={22} />;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16.5px] font-medium text-foreground leading-tight truncate">
                {medicineName || "Medicine Name"}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full border ${activeColorCfg.iconBg} ${activeColorCfg.text}`}>
                  {dose || "Dose"}
                </span>
                <span className="editorial-mono editorial-tabular text-[11px] text-muted-foreground">
                  {times.join(" · ")}
                </span>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className={`w-3 h-3 rounded-full ${activeColorCfg.value} shadow-sm`} />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-6">
        {/* Medication Info Section */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: EDITORIAL_EASE }}
          className="editorial-card p-6 sm:p-7 space-y-6"
        >
          <EditorialEyebrow
            index="02"
            label="Medication Details"
            dotColor="bg-blue-500"
          />

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
                      if (med.icon) setIcon(med.icon);
                      if (med.color) setColor(med.color);

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
                {/* Desktop dosage presets */}
                <div className="hidden sm:flex flex-wrap gap-2">
                  {["1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDose(d)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        dose === d ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {/* Mobile dosage preset dropdown */}
                <div className="sm:hidden">
                  <Select
                    value={["1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].includes(dose) ? dose : ""}
                    onValueChange={(val) => setDose(val)}
                  >
                    <SelectTrigger className="w-full h-10 rounded-xl text-xs bg-muted/20 border-border/50">
                      <SelectValue placeholder="Quick dose presets..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].map((d) => (
                        <SelectItem key={d} value={d} className="text-xs">
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: EDITORIAL_EASE }}
          className="editorial-card p-6 sm:p-7 space-y-6"
        >
          <EditorialEyebrow
            index="03"
            label="Schedule & Timing"
            dotColor="bg-indigo-500"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="time" className="text-xs font-bold text-muted-foreground ml-1">
                {repeat === "custom" ? "Scheduled Times" : t("reminders.time")}
              </Label>
              <div className="space-y-3">
                {times.map((t, idx) => (
                  <AppleTimePicker
                    key={idx}
                    value={t}
                    onChange={(newTime) => {
                      if (!newTime) {
                        const newTimes = [...times];
                        newTimes[idx] = "";
                        setTimes(newTimes);
                        return;
                      }
                      if (idx === 0 && (times.length > 1 || repeat === "custom")) {
                        // Re-distribute based on new start time to maintain equal spacing
                        setTimes(distributeTimes(newTime, times.length));
                      } else {
                        const newTimes = [...times];
                        newTimes[idx] = newTime;
                        setTimes(newTimes);
                      }
                    }}
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
                  {/* Desktop frequency row */}
                  <div className="hidden sm:flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map((f) => (
                      <button
                        key={f}
                        type="button"
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

                  {/* Mobile frequency dropdown */}
                  <div className="sm:hidden">
                    <Select
                      value={times.length.toString()}
                      onValueChange={(val) => handleFrequencyChange(parseInt(val, 10))}
                    >
                      <SelectTrigger className="w-full h-11 rounded-xl text-xs font-bold bg-muted/20 border-border/50">
                        <SelectValue placeholder="Select times per day" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((f) => (
                          <SelectItem key={f} value={f.toString()} className="text-xs font-semibold">
                            {f}x per day ({f} {f === 1 ? "dose" : "doses"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground ml-1 italic">
                    Example: 2 pills taken 3 times a day
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.section>
        
        {/* Stock Tracking (Med Vault) Section */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: EDITORIAL_EASE }}
          className="editorial-card p-6 sm:p-7 space-y-6"
        >
          <div className="flex items-center justify-between gap-2">
            <EditorialEyebrow
              index="04"
              label="Stock Tracking · Med Vault"
              dotColor="bg-teal-500"
            />
            {isAlreadyTracked && !isEditingStock && (
              <span className="editorial-mono text-[9.5px] text-teal-600 dark:text-teal-400 bg-teal-500/10 border border-teal-500/25 px-2.5 py-1 rounded-full">
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
                    <span>
                      {Math.floor((selectedMedicine.currentQuantity || 0) / (selectedMedicine.dosagePerDose || 1))} doses (~{Math.floor((selectedMedicine.currentQuantity || 0) / ((selectedMedicine.dosagePerDose || 1) * Math.max(1, times.length)))} days at {times.length}x/day)
                    </span>
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
                    className={`h-12 rounded-xl border-border/50 bg-muted/20 focus:bg-background transition-all ${
                      isStockOverCapacity ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Live Doses vs Days Breakdown Preview in Add Reminder */}
              {!isNaN(parsedStockQty) && parsedStockQty >= 0 && (
                <div className="p-3.5 rounded-2xl neu-inset border-teal-500/20 text-foreground space-y-1.5 mt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-teal-800 dark:text-teal-300">
                    <span>Daily Intake:</span>
                    <span>
                      {((parseFloat(stockPerDose) || 1) * times.length).toFixed(
                        Number.isInteger((parseFloat(stockPerDose) || 1) * times.length) ? 0 : 1
                      )}{" "}
                      {stockUnit}/day ({parseFloat(stockPerDose) || 1} {stockUnit}/dose × {times.length} {times.length === 1 ? "dose" : "doses"}/day)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-teal-500/20">
                    <div className="neu-surface p-2 rounded-xl border-teal-500/15">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Doses on Hand</p>
                      <p className="text-base font-black text-teal-600 dark:text-teal-400 mt-0.5">
                        {Math.floor(parsedStockQty / (parseFloat(stockPerDose) || 1))} <span className="text-xs font-semibold text-muted-foreground">doses</span>
                      </p>
                    </div>
                    <div className="neu-surface p-2 rounded-xl border-teal-500/15">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Days of Supply</p>
                      <p className="text-base font-black text-teal-600 dark:text-teal-400 mt-0.5">
                        ~{Math.floor(parsedStockQty / ((parseFloat(stockPerDose) || 1) * Math.max(1, times.length)))} <span className="text-xs font-semibold text-muted-foreground">days</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {isStockOverCapacity && (
                <p className="text-xs font-semibold text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <AlertTriangle className="size-3.5 flex-shrink-0" />
                  Remaining pills ({parsedStockQty}) cannot exceed total capacity ({parsedStockTotal}).
                </p>
              )}
              <p className="text-[10px] text-muted-foreground italic ml-1">
                Setting a stock count enables Med Vault tracking, which automatically reduces stock as you take doses.
              </p>
            </>
          )}
        </motion.section>

        {/* Notes Section */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2, ease: EDITORIAL_EASE }}
          className="editorial-card p-6 sm:p-7 space-y-4"
        >
          <EditorialEyebrow
            index="05"
            label={t("reminders.notes")}
            dotColor="bg-amber-500"
          />
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("reminders.notes_placeholder")}
            className="min-h-[104px] rounded-2xl border-border/70 bg-secondary/50 focus:bg-card transition-all resize-none p-4"
          />
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45, ease: EDITORIAL_EASE }}
          className="pt-2 flex justify-center w-full z-40"
        >
          <div className="w-full max-w-lg pointer-events-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-editorial-roll w-full h-12 sm:h-[52px] pl-6 pr-2.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25 text-[15px] font-medium justify-between disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2.5">
                <Save size={17} />
                <span>
                  {isSaving
                    ? "Saving Schedule..."
                    : isEditing
                    ? t("reminders.save_reminder", "Update Reminder")
                    : !isOnline
                    ? "Save Offline"
                    : t("reminders.save_reminder")}
                </span>
              </span>
              <span className="roll-chip w-8 h-8 bg-white text-primary">
                <ArrowRight size={14} />
              </span>
            </button>
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
