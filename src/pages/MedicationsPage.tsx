import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import {
  Pill,
  Tablets,
  Droplets,
  Syringe,
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Save,
  Check,
  Info,
  X,
  PlusCircle,
  Package2,
  AlertTriangle,
  UserRound,
  MoreVertical,
  Clock,
  Search,
} from "@/lib/icons";
import { useApp, Medicine } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { calculateRefillStatus } from "@/services/refillService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ConfirmationDialog";

// ─── Constants ───────────────────────────────────────────────────────────────
export {
  type ColorTheme,
  COLOR_THEMES,
  COLOR_KEYS,
  COLORS,
  ICONS,
  iconMap,
  getMedicineTheme,
} from "@/lib/medicineTheme";
import {
  COLOR_THEMES,
  COLOR_KEYS,
  COLORS,
  ICONS,
  iconMap,
  getMedicineTheme,
} from "@/lib/medicineTheme";

const UNITS = ["tablets", "capsules", "ml", "puffs", "drops", "units"];

// Backward-compatible colorMap
const colorMap: Record<string, { ring: string; bg: string; text: string; border: string }> = Object.fromEntries(
  Object.entries(COLOR_THEMES).map(([k, v]) => [
    k,
    { ring: v.ring, bg: v.bgLight, text: v.text, border: v.border },
  ])
);

// ─── Add/Edit Sheet Component ───────────────────────────────────────────────

interface MedicineSheetProps {
  medicine?: Medicine | null; // null means adding
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

function MedicineSheet({ medicine, onClose, onSave }: MedicineSheetProps) {
  const isEditing = !!medicine;

  const [name, setName] = useState(medicine?.name ?? "");
  const [dosage, setDosage] = useState(medicine?.dosage ?? "");
  const [genericName, setGenericName] = useState(medicine?.genericName ?? "");
  const initialColor = medicine
    ? (medicine.color && COLOR_THEMES[medicine.color] ? medicine.color : getMedicineTheme(medicine).name)
    : "blue";
  const [color, setColor] = useState(initialColor);
  const [icon, setIcon] = useState(medicine?.icon ?? "pill");
  const [notes, setNotes] = useState(medicine?.notes ?? "");

  // Stock tracking states
  const [trackStock, setTrackStock] = useState(medicine?.currentQuantity !== undefined);
  const [qty, setQty] = useState(medicine?.currentQuantity?.toString() ?? "");
  const [perDose, setPerDose] = useState(medicine?.dosagePerDose?.toString() ?? "1");
  const [frequencyPerDay, setFrequencyPerDay] = useState(medicine?.frequencyPerDay?.toString() ?? "1");
  const [total, setTotal] = useState(medicine?.totalQuantity?.toString() ?? "");
  const [unit, setUnit] = useState(medicine?.unit ?? "tablets");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const parsedQty = parseFloat(qty);
  const parsedTotal = parseFloat(total);
  const parsedPerDose = parseFloat(perDose) || 1;
  const parsedFreq = parseFloat(frequencyPerDay) || 1;
  const isOverCapacity =
    trackStock && !isNaN(parsedQty) && !isNaN(parsedTotal) && parsedTotal > 0 && parsedQty > parsedTotal;
  const isNegativeQty = trackStock && !isNaN(parsedQty) && parsedQty < 0;
  const isStockInvalid = trackStock && (isNaN(parsedQty) || isOverCapacity || isNegativeQty);

  const handleSave = async () => {
    if (!name.trim() || !dosage.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in medicine name and dosage.",
        variant: "destructive",
      });
      return;
    }

    if (trackStock && isOverCapacity) {
      toast({
        title: "Invalid Stock",
        description: "Stock on hand cannot exceed total pack size.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const stockFields: Record<string, any> = {};
      if (trackStock) {
        if (!isNaN(parsedQty) && parsedQty >= 0) {
          stockFields.currentQuantity = parsedQty;
          stockFields.totalQuantity = !isNaN(parsedTotal) && parsedTotal > 0 ? parsedTotal : parsedQty;
          stockFields.dosagePerDose = parsedPerDose;
          stockFields.frequencyPerDay = parsedFreq;
          stockFields.unit = unit;
        }
      }

      await onSave({
        name: name.trim(),
        dosage: dosage.trim(),
        genericName: genericName.trim() || undefined,
        color,
        icon,
        notes: notes.trim() || undefined,
        frequencyPerDay: parsedFreq,
        ...stockFields,
        // If trackStock is false, we explicitly set these to undefined so they get filtered out
        ...(!trackStock && {
          currentQuantity: undefined,
          totalQuantity: undefined,
          dosagePerDose: undefined,
          unit: undefined,
        }),
      });
      onClose();
    } catch (e) {
      toast({
        title: "Error saving medication",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const swipe = useSwipeToDismiss(onClose);

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full max-w-xl bg-card rounded-t-[28px] md:rounded-[24px] shadow-2xl border border-border max-h-[92dvh] flex flex-col overflow-hidden"
      >
        {/* Drag handle — swipe this area to dismiss */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.3 }}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 80) onClose();
          }}
          className="flex-shrink-0 pt-4 pb-2 px-6 cursor-grab active:cursor-grabbing touch-pan-x"
          {...swipe}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/40 mx-auto transition-colors" />
        </motion.div>
        {/* Scrollable form body */}
        <div className="overflow-y-auto no-scrollbar touch-auto flex-1 px-6 pb-10">
        
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold tracking-[-0.022em] text-foreground">
            {isEditing ? "Edit Medication" : "Add Medication"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border hover:bg-muted/60 text-muted-foreground flex items-center justify-center transition-all active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Section: Basic Info */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Medicine Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ibuprofen, Paracetamol"
                className="h-11 rounded-full border-border bg-card text-foreground text-sm focus:border-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dosage" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Strength / Dosage Description
                </Label>
                <Input
                  id="dosage"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g. 500mg, 10ml, 1 tablet"
                  className="h-11 rounded-full border-border bg-card text-sm focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="genericName" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Generic Name (Optional)
                </Label>
                <Input
                  id="genericName"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  placeholder="e.g. Acetaminophen"
                  className="h-11 rounded-full border-border bg-card text-sm focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Desktop dosage presets */}
            <div className="hidden sm:flex flex-wrap gap-2 pt-1">
              {["500mg", "250mg", "1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDosage(d)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                    dosage === d 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "bg-muted/40 border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Mobile dosage preset dropdown */}
            <div className="sm:hidden pt-1">
              <Select
                value={["500mg", "250mg", "1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].includes(dosage) ? dosage : ""}
                onValueChange={(val) => setDosage(val)}
              >
                <SelectTrigger className="w-full h-11 rounded-full text-xs bg-card border-border">
                  <SelectValue placeholder="Quick dosage preset..." />
                </SelectTrigger>
                <SelectContent className="rounded-[18px] border-border bg-card">
                  {["500mg", "250mg", "1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].map((d) => (
                    <SelectItem key={d} value={d} className="text-xs">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section: Frequency (Doses per Day) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <Label htmlFor="frequencyPerDay" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Daily Frequency (Times / Doses Taken per Day)
              </Label>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                {parsedFreq} dose{parsedFreq !== 1 ? "s" : ""}/day
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "1x / day", sub: "Once daily", value: 1 },
                { label: "2x / day", sub: "Twice daily", value: 2 },
                { label: "3x / day", sub: "3 times/day", value: 3 },
                { label: "4x / day", sub: "4 times/day", value: 4 },
              ].map((preset) => (
                <button
                  type="button"
                  key={preset.value}
                  onClick={() => setFrequencyPerDay(preset.value.toString())}
                  className={`p-2.5 rounded-[14px] text-center border transition-all active:scale-95 ${
                    parsedFreq === preset.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="block text-xs font-bold leading-tight">{preset.label}</span>
                  <span className="block text-[9px] opacity-75 leading-none mt-0.5">{preset.sub}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground font-medium flex-shrink-0">Custom times per day:</span>
              <Input
                id="frequencyPerDay"
                type="number"
                inputMode="numeric"
                min="1"
                max="24"
                value={frequencyPerDay}
                onChange={(e) => setFrequencyPerDay(e.target.value)}
                placeholder="e.g. 1"
                className="h-10 w-24 rounded-full text-center font-semibold text-xs"
              />
              <span className="text-xs text-muted-foreground">times a day</span>
            </div>
          </div>

          {/* Section: Color Theme & Icon Picker */}
          <div className="space-y-4 pt-3 border-t border-border">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Medication Theme Color
                </Label>
                <span className="text-xs font-bold capitalize text-foreground">
                  {COLOR_THEMES[color]?.label || color}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {COLOR_KEYS.map((k) => {
                  const t = COLOR_THEMES[k];
                  const isSelected = color === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setColor(k)}
                      className={`group flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all active:scale-95 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${t.gradient} relative flex items-center justify-center shadow-xs transition-transform group-hover:scale-105`}
                      >
                        {isSelected && <Check size={14} className="text-white drop-shadow-sm" />}
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground leading-none">
                        {t.label.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Medication Icon
              </Label>
              <div className="flex gap-3">
                {ICONS.map((i) => {
                  const IconComp = i.icon;
                  const isSelected = icon === i.name;
                  return (
                    <button
                      key={i.name}
                      type="button"
                      onClick={() => setIcon(i.name)}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                          : "bg-muted/40 border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <IconComp size={20} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Visual Card Preview */}
            <div className="pt-2">
              {(() => {
                const previewTheme = COLOR_THEMES[color] || COLOR_THEMES.blue;
                const PreviewIconComp = iconMap[icon] || Pill;
                return (
                  <div className={`p-4 rounded-[20px] border ${previewTheme.border} bg-card relative overflow-hidden shadow-xs`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${previewTheme.bgGlow} pointer-events-none`} />
                    <div className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full ${previewTheme.accentBar}`} />
                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${previewTheme.gradient} text-white flex items-center justify-center shadow-md shadow-black/10 shrink-0 border border-white/20`}>
                          <PreviewIconComp className="size-5.5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground truncate">
                              {name.trim() || "Medicine Name"}
                            </p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${previewTheme.bgLight} ${previewTheme.text} border ${previewTheme.border}`}>
                              {dosage.trim() || "Dosage"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground italic truncate mt-0.5">
                            {genericName.trim() || "Live Appearance Preview"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                        Preview
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Section: Stock Tracking Toggle */}
          <div className="pt-4 border-t border-border space-y-4">
            <div className="flex items-center justify-between bg-muted/20 border border-border p-4 rounded-[18px]">
              <div>
                <Label className="text-sm font-semibold text-foreground block">Track Stock (Link to Med Vault)</Label>
                <span className="text-xs text-muted-foreground">Keep track of pill quantity and receive refill notices.</span>
              </div>
              <button
                type="button"
                onClick={() => setTrackStock(!trackStock)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  trackStock ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    trackStock ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <AnimatePresence>
              {trackStock && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-2 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="qty" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Pills / Stock on Hand
                      </Label>
                      <Input
                        id="qty"
                        type="number"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="e.g. 30"
                        className="h-11 rounded-full text-sm font-semibold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit</Label>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger className="h-11 rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-[18px] border-border bg-card">
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="perDose" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Units per dose
                      </Label>
                      <Input
                        id="perDose"
                        type="number"
                        inputMode="numeric"
                        value={perDose}
                        onChange={(e) => setPerDose(e.target.value)}
                        placeholder="e.g. 1"
                        className="h-11 rounded-full font-semibold text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="total" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Total pack size
                      </Label>
                      <Input
                        id="total"
                        type="number"
                        inputMode="numeric"
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                        placeholder="e.g. 60"
                        className={`h-11 rounded-full font-semibold text-sm ${
                          isOverCapacity ? "border-destructive focus-visible:ring-destructive" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Live Doses vs Days Breakdown Preview */}
                  {!isNaN(parsedQty) && parsedQty >= 0 && (
                    <div className="p-4 rounded-[18px] bg-muted/30 border border-border text-foreground space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>Daily Intake Rate:</span>
                        <span className="text-muted-foreground">
                          {(parsedPerDose * parsedFreq).toFixed(
                            Number.isInteger(parsedPerDose * parsedFreq) ? 0 : 1
                          )}{" "}
                          {unit}/day ({parsedPerDose} {unit}/dose × {parsedFreq} {parsedFreq === 1 ? "dose" : "doses"}/day)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                        <div className="bg-card p-3 rounded-[14px] border border-border">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Doses in Stock</p>
                          <p className="text-lg font-bold text-foreground mt-0.5">
                            {Math.floor(parsedQty / parsedPerDose)} <span className="text-xs font-semibold text-muted-foreground">doses</span>
                          </p>
                        </div>
                        <div className="bg-card p-3 rounded-[14px] border border-border">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Days of Supply</p>
                          <p className="text-lg font-bold text-foreground mt-0.5">
                            ~{Math.floor(parsedQty / (parsedPerDose * parsedFreq))} <span className="text-xs font-semibold text-muted-foreground">days</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isOverCapacity && (
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                      <AlertTriangle className="size-3.5 flex-shrink-0" />
                      Stock on hand ({parsedQty}) cannot exceed total pack size ({parsedTotal}).
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Section: Notes */}
          <div className="space-y-1.5 pt-3 border-t border-border">
            <Label htmlFor="notes" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
              Medication Notes (Optional)
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Take with food, keep refrigerated"
              className="h-11 rounded-full border-border bg-card text-sm focus:border-primary transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-full h-11 border-border font-semibold text-xs active:scale-95 transition-transform">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !dosage.trim() || (trackStock && isStockInvalid)}
            className="flex-1 rounded-full h-11 font-semibold text-xs bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform"
          >
            {isSaving ? "Saving…" : isEditing ? "Update Medication" : "Save Medication"}
          </Button>
        </div>
        </div>{/* end scrollable body */}
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─── Main Medications Page Component ───────────────────────────────────────

export default function MedicationsPage() {
  const navigate = useNavigate();
  const { addMedicine, updateMedicine, deleteMedicine, isInitializing } = useApp();
  const { resolvedPatient, scopedMedicines, scopedReminders } = usePatientScope();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
  const [filter, setFilter] = useState<"all" | "in-stock" | "low-stock" | "untracked">("all");

  // Summary statistics for inventory
  const stats = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let untracked = 0;

    scopedMedicines.forEach((med) => {
      if (med.currentQuantity === undefined) {
        untracked++;
      } else {
        const refill = calculateRefillStatus(med, scopedReminders);
        if (med.currentQuantity === 0 || refill?.isLow || refill?.isWarning) {
          lowStock++;
        } else {
          inStock++;
        }
      }
    });

    return { total: scopedMedicines.length, inStock, lowStock, untracked };
  }, [scopedMedicines, scopedReminders]);

  // Filter list by search query and active tab
  const filteredMedicines = useMemo(() => {
    return scopedMedicines.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesGeneric = m.genericName?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesGeneric) return false;
      }

      if (filter === "in-stock") {
        if (m.currentQuantity === undefined) return false;
        const refill = calculateRefillStatus(m, scopedReminders);
        return m.currentQuantity > 0 && !refill?.isLow && !refill?.isWarning;
      }
      if (filter === "low-stock") {
        if (m.currentQuantity === undefined) return false;
        const refill = calculateRefillStatus(m, scopedReminders);
        return m.currentQuantity === 0 || refill?.isLow || refill?.isWarning;
      }
      if (filter === "untracked") {
        return m.currentQuantity === undefined;
      }
      return true;
    });
  }, [scopedMedicines, searchQuery, filter, scopedReminders]);

  const handleSaveMedicine = async (formData: any) => {
    if (selectedMed) {
      // Editing
      try {
        await updateMedicine(selectedMed.id, formData);
        toast({
          title: "Medication updated",
          description: `${formData.name} details saved.`,
        });
      } catch (e) {
        toast({
          title: "Failed to update",
          variant: "destructive",
        });
      }
    } else {
      // Adding
      try {
        await addMedicine(formData, resolvedPatient.id);
        toast({
          title: "Medication added",
          description: `${formData.name} added to your cabinet.`,
        });
      } catch (e) {
        toast({
          title: "Failed to add",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMedicine(deleteTarget.id);
      toast({
        title: "Medication deleted",
        description: `${deleteTarget.name} has been removed.`,
      });
      setDeleteTarget(null);
    } catch {
      toast({
        title: "Failed to delete medication",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full bg-muted/60 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all shadow-xs"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-foreground leading-none">
              Medications
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">
              Prescription Inventory · {scopedMedicines.length} Saved
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedMed(null);
            setIsSheetOpen(true);
          }}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-5 py-2.5 rounded-full text-[13px] font-semibold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-blue-500/25"
        >
          <Plus size={15} /> Add Medicine
        </button>
      </div>

      {/* Patient Scoped Context Banner */}
      {!resolvedPatient.isOwner && resolvedPatient.name && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm"
        >
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <UserRound size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 leading-none mb-0.5">Viewing Cabinet For</p>
            <p className="text-sm font-black text-primary tracking-tight truncate">{resolvedPatient.name}</p>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-primary/50 bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0">
            Family Hub
          </span>
        </motion.div>
      )}

      {/* Quick Navigation Panel */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => navigate("/medvault")}
          className="group relative overflow-hidden flex items-center justify-between p-4 rounded-[20px] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.03] to-card hover:border-emerald-500/45 hover:shadow-md hover:shadow-emerald-500/10 transition-all text-left active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              <Package2 size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[14px] text-foreground leading-tight">Med Vault</span>
              </div>
              <span className="text-[12px] text-muted-foreground block truncate mt-0.5">Track pill supply & refills</span>
            </div>
          </div>
        </button>
        <button
          onClick={() => navigate("/reminders/new")}
          className="group relative overflow-hidden flex items-center justify-between p-4 rounded-[20px] border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.08] via-blue-500/[0.03] to-card hover:border-indigo-500/45 hover:shadow-md hover:shadow-indigo-500/10 transition-all text-left active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <PlusCircle size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[14px] text-foreground leading-tight">Add Reminder</span>
              </div>
              <span className="text-[12px] text-muted-foreground block truncate mt-0.5">Schedule dose & alerts</span>
            </div>
          </div>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search saved medications or generic names..."
          className="h-11 rounded-full border-border/80 bg-card/90 pl-11 pr-10 text-[14px] focus:border-primary shadow-xs transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter / Inventory Status Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
        {[
          { id: "all", label: "All", count: stats.total },
          { id: "in-stock", label: "In Stock", count: stats.inStock, dot: "bg-emerald-500" },
          { id: "low-stock", label: "Low / Out", count: stats.lowStock, dot: "bg-amber-500", pulse: stats.lowStock > 0 },
          { id: "untracked", label: "Untracked", count: stats.untracked, dot: "bg-slate-400" },
        ].map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {tab.dot && (
                <span
                  className={`size-2 rounded-full ${tab.dot} ${
                    tab.pulse && !isActive ? "animate-pulse" : ""
                  }`}
                />
              )}
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Medications List */}
      {isInitializing ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-3xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filteredMedicines.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 rounded-[2rem] border border-dashed border-border/50 bg-accent/10 text-center gap-4 px-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Pill size={28} />
          </div>
          <div>
            <p className="text-base font-black text-foreground mb-1">
              {searchQuery ? "No matches found" : "Medicine cabinet is empty"}
            </p>
            <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
              {searchQuery
                ? "Try searching for a different name or spelling."
                : `Add medications for ${resolvedPatient.name} to view them here and track stock.`}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => {
                setSelectedMed(null);
                setIsSheetOpen(true);
              }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 mt-1"
            >
              <Plus size={14} /> Add First Medicine
            </button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-4">
          {filteredMedicines.map((med) => {
            const theme = getMedicineTheme(med);
            const IconComp = iconMap[med.icon || "pill"] || Pill;

            // Refill / Stock Details
            const isTracked = med.currentQuantity !== undefined;
            const refillStatus = calculateRefillStatus(med, scopedReminders);
            const isOutOfStock = med.currentQuantity === 0;

            const stockCountText = isTracked
              ? `${med.currentQuantity} ${med.unit || "units"} left`
              : "Stock not tracked";

            const badgeCls = !isTracked
              ? "bg-muted/70 text-muted-foreground border-border/50"
              : isOutOfStock
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
              : refillStatus?.isLow
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
              : refillStatus?.isWarning
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";

            const badgeDotCls = !isTracked
              ? "bg-slate-400"
              : isOutOfStock || refillStatus?.isLow
              ? "bg-rose-500"
              : refillStatus?.isWarning
              ? "bg-amber-500"
              : "bg-emerald-500";

            const badgeText = !isTracked
              ? "Untracked"
              : isOutOfStock
              ? "Out of Stock"
              : refillStatus?.isLow
              ? "Critical Stock"
              : refillStatus?.isWarning
              ? "Low Stock"
              : "In Stock";

            const stockPercentage =
              isTracked && med.totalQuantity && med.totalQuantity > 0
                ? Math.min(100, Math.max(0, Math.round(((med.currentQuantity ?? 0) / med.totalQuantity) * 100)))
                : null;

            return (
              <motion.div
                key={med.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`group relative overflow-hidden rounded-[22px] border ${theme.border} bg-card p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/25 ${theme.borderHover}`}
              >
                {/* Soft ambient gradient wash */}
                <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGlow} pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity`} />

                {/* Vertical accent strip on left border */}
                <div className={`absolute left-0 top-3 bottom-3 w-1.25 rounded-r-full ${theme.accentBar} opacity-90`} />

                <div className="relative z-10 flex items-start justify-between gap-3.5">
                  {/* Left Side: Avatar & Information */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Vibrant Gradient Icon Avatar */}
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${theme.gradient} text-white shadow-md shadow-black/10 border border-white/20 group-hover:scale-105 transition-transform duration-200`}
                    >
                      <IconComp className="size-6 text-white" />
                    </div>

                    <div className="min-w-0 pt-0.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[16px] font-bold tracking-tight text-foreground leading-tight truncate">
                          {med.name}
                        </h3>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${theme.bgLight} ${theme.text} border ${theme.border}`}>
                          {med.dosage}
                        </span>
                      </div>

                      {med.genericName && (
                        <p className="text-[12px] text-muted-foreground/80 italic truncate mt-0.5">
                          {med.genericName}
                        </p>
                      )}

                      {med.notes && (
                        <div className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 w-fit flex items-center gap-1.5 shadow-xs">
                          <span>💡</span>
                          <span className="truncate max-w-[200px] sm:max-w-[340px]">{med.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Status Badge & Stock */}
                  <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeCls} flex items-center gap-1.5 shadow-xs`}>
                      <span
                        className={`size-1.5 rounded-full ${badgeDotCls} ${
                          refillStatus?.isLow || isOutOfStock ? "animate-pulse" : ""
                        }`}
                      />
                      {badgeText}
                    </span>
                    <span className="text-[11px] font-bold text-foreground">
                      {stockCountText}
                    </span>
                  </div>
                </div>

                {/* Stock Level Progress Bar if tracked */}
                {stockPercentage !== null && (
                  <div className="relative z-10 mt-3 pt-0.5">
                    <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOutOfStock || refillStatus?.isLow
                            ? "bg-rose-500"
                            : refillStatus?.isWarning
                            ? "bg-amber-500"
                            : theme.accentBar
                        }`}
                        style={{ width: `${Math.max(4, stockPercentage)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Row Actions & Supply Meta */}
                <div className="relative z-10 mt-3.5 pt-3 border-t border-border/40 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {!isTracked ? (
                      <button
                        onClick={() => {
                          setSelectedMed(med);
                          setIsSheetOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <Package2 size={13} />
                        <span>Enable Stock Tracker</span>
                      </button>
                    ) : refillStatus?.daysRemaining !== null ? (
                      <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                        <Clock size={12} className="text-muted-foreground" />
                        <span>
                          {refillStatus.dosesRemaining !== null ? `${refillStatus.dosesRemaining} doses · ` : ""}
                          ~{refillStatus.daysRemaining} days left
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] italic text-muted-foreground">No active schedule</span>
                    )}
                  </div>

                  {/* Desktop action buttons */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedMed(med);
                        setIsSheetOpen(true);
                      }}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/40 transition-all active:scale-90"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(med)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 border border-border/40 transition-all active:scale-90"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Mobile 3-dots DropdownMenu */}
                  <div className="sm:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/40 transition-all active:scale-90 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          aria-label="Medication options"
                        >
                          <MoreVertical size={15} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedMed(med);
                            setIsSheetOpen(true);
                          }}
                          className="text-xs font-semibold gap-2 py-2"
                        >
                          <Edit2 size={14} />
                          <span>Edit Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedMed(med);
                            setIsSheetOpen(true);
                          }}
                          className="text-xs font-semibold gap-2 py-2"
                        >
                          <Package2 size={14} />
                          <span>{isTracked ? "Adjust Stock Tracking" : "Enable Stock Tracker"}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(med)}
                          className="text-xs font-semibold gap-2 py-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 size={14} />
                          <span>Delete Medication</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Sheets & Dialogs */}
      <AnimatePresence>
        {isSheetOpen && (
          <MedicineSheet
            medicine={selectedMed}
            onClose={() => {
              setIsSheetOpen(false);
              setSelectedMed(null);
            }}
            onSave={handleSaveMedicine}
          />
        )}
      </AnimatePresence>

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Medication?"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This will remove it from your inventory and stock trackers. Reminders linked to it will remain but won't point to stock records.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
