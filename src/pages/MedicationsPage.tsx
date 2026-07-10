import { useState, useMemo } from "react";
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
import ConfirmationDialog from "@/components/ConfirmationDialog";

// ─── Constants ───────────────────────────────────────────────────────────────

const UNITS = ["tablets", "capsules", "ml", "puffs", "drops", "units"];

const COLORS = [
  { name: "blue", value: "bg-blue-500", border: "border-blue-500/20", text: "text-blue-500", bgLight: "bg-blue-500/10" },
  { name: "green", value: "bg-emerald-500", border: "border-emerald-500/20", text: "text-emerald-500", bgLight: "bg-emerald-500/10" },
  { name: "purple", value: "bg-violet-500", border: "border-violet-500/20", text: "text-violet-500", bgLight: "bg-violet-500/10" },
  { name: "rose", value: "bg-rose-500", border: "border-rose-500/20", text: "text-rose-500", bgLight: "bg-rose-500/10" },
  { name: "amber", value: "bg-amber-500", border: "border-amber-500/20", text: "text-amber-500", bgLight: "bg-amber-500/10" },
  { name: "slate", value: "bg-slate-600", border: "border-slate-600/20", text: "text-slate-600", bgLight: "bg-slate-600/10" },
];

const ICONS = [
  { name: "pill", icon: Pill },
  { name: "tablet", icon: Tablets },
  { name: "liquid", icon: Droplets },
  { name: "syringe", icon: Syringe },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  pill: Pill,
  tablet: Tablets,
  liquid: Droplets,
  syringe: Syringe,
};

const colorMap: Record<string, { ring: string; bg: string; text: string; border: string }> = {
  blue: { ring: "#3b82f6", bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
  green: { ring: "#10b981", bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
  purple: { ring: "#8b5cf6", bg: "bg-violet-500/10", text: "text-violet-500", border: "border-violet-500/20" },
  rose: { ring: "#f43f5e", bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/20" },
  amber: { ring: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20" },
  slate: { ring: "#64748b", bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/20" },
};

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
  const [color, setColor] = useState(medicine?.color ?? "blue");
  const [icon, setIcon] = useState(medicine?.icon ?? "pill");
  const [notes, setNotes] = useState(medicine?.notes ?? "");

  // Stock tracking states
  const [trackStock, setTrackStock] = useState(medicine?.currentQuantity !== undefined);
  const [qty, setQty] = useState(medicine?.currentQuantity?.toString() ?? "");
  const [perDose, setPerDose] = useState(medicine?.dosagePerDose?.toString() ?? "1");
  const [total, setTotal] = useState(medicine?.totalQuantity?.toString() ?? "");
  const [unit, setUnit] = useState(medicine?.unit ?? "tablets");

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim() || !dosage.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in medicine name and dosage.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const stockFields: Record<string, any> = {};
      if (trackStock) {
        const parsedQty = parseFloat(qty);
        if (!isNaN(parsedQty)) {
          stockFields.currentQuantity = parsedQty;
          stockFields.totalQuantity = parseFloat(total) || parsedQty;
          stockFields.dosagePerDose = parseFloat(perDose) || 1;
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
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.3 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 80) onClose();
        }}
        className="w-full max-w-xl bg-card rounded-t-[2.5rem] p-6 pb-12 shadow-2xl border border-border/50 max-h-[92vh] overflow-y-auto no-scrollbar cursor-grab active:cursor-grabbing touch-pan-x"
        {...swipe}
      >
        <div className="w-12 h-1.5 rounded-full bg-muted/70 hover:bg-muted mx-auto mb-6 transition-colors" />
        
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black tracking-tight">
            {isEditing ? "Edit Medication" : "Add Medication"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Section: Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold text-muted-foreground ml-1">
                Medicine Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ibuprofen, Paracetamol"
                className="h-12 rounded-xl border-border/50 bg-muted/20 text-foreground text-sm focus:bg-background transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dosage" className="text-xs font-bold text-muted-foreground ml-1">
                  Strength / Dosage Description
                </Label>
                <Input
                  id="dosage"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g. 500mg, 10ml, 1 tablet"
                  className="h-12 rounded-xl border-border/50 bg-muted/20 text-sm focus:bg-background transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="genericName" className="text-xs font-bold text-muted-foreground ml-1">
                  Generic Name (Optional)
                </Label>
                <Input
                  id="genericName"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  placeholder="e.g. Acetaminophen"
                  className="h-12 rounded-xl border-border/50 bg-muted/20 text-sm focus:bg-background transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {["500mg", "250mg", "1 Pill", "2 Pills", "5ml", "10ml", "1 Puff"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDosage(d)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    dosage === d 
                      ? "bg-primary text-primary-foreground shadow-md scale-105" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Color & Icon Picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/40">
            <div className="space-y-3">
              <Label className="text-xs font-bold text-muted-foreground ml-1">Medication Theme Color</Label>
              <div className="flex gap-2.5">
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

          {/* Section: Stock Tracking Toggle */}
          <div className="pt-4 border-t border-border/40 space-y-4">
            <div className="flex items-center justify-between bg-muted/20 border border-border/40 p-4 rounded-2xl">
              <div>
                <Label className="text-sm font-bold text-foreground block">Track Stock (Link to Med Vault)</Label>
                <span className="text-[10px] text-muted-foreground">Keep track of pill quantity and receive refill notices.</span>
              </div>
              <button
                type="button"
                onClick={() => setTrackStock(!trackStock)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  trackStock ? "bg-teal-500" : "bg-muted-foreground/30"
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
                    <div className="space-y-2">
                      <Label htmlFor="qty" className="text-xs font-bold text-muted-foreground">
                        Pills / Stock on Hand
                      </Label>
                      <Input
                        id="qty"
                        type="number"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="e.g. 30"
                        className="h-12 rounded-xl text-base font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Unit</Label>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="perDose" className="text-xs font-bold text-muted-foreground">
                        Units per dose
                      </Label>
                      <Input
                        id="perDose"
                        type="number"
                        inputMode="numeric"
                        value={perDose}
                        onChange={(e) => setPerDose(e.target.value)}
                        placeholder="e.g. 1"
                        className="h-12 rounded-xl font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total" className="text-xs font-bold text-muted-foreground">
                        Total pack size
                      </Label>
                      <Input
                        id="total"
                        type="number"
                        inputMode="numeric"
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                        placeholder="e.g. 60"
                        className="h-12 rounded-xl font-bold"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Section: Notes */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <Label htmlFor="notes" className="text-xs font-bold text-muted-foreground ml-1">
              Medication Notes (Optional)
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Take with food, keep refrigerated"
              className="h-12 rounded-xl border-border/50 bg-muted/20 text-sm focus:bg-background transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-12">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-xl h-12 font-bold"
          >
            {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Add Medication"}
          </Button>
        </div>
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

  // Filter list by search query
  const filteredMedicines = useMemo(() => {
    return scopedMedicines.filter((m) => {
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        (m.genericName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [scopedMedicines, searchQuery]);

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
    <div className="px-4 pt-8 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground leading-none">
              Medications
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              Prescription Inventory
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedMed(null);
            setIsSheetOpen(true);
          }}
          className="flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          <Plus size={14} /> Add Medicine
        </button>
      </motion.div>

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

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search saved medications..."
          className="h-12 rounded-2xl border-border/50 bg-muted/20 px-4 focus:bg-background transition-all"
        />
      </div>

      {/* Quick Navigation Panel */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => navigate("/medvault")}
          className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-card hover:border-teal-500/30 transition-all text-left shadow-sm active:scale-98"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-teal-500/10 text-teal-500 rounded-xl">
              <Package2 size={16} />
            </div>
            <div>
              <span className="font-extrabold text-xs text-foreground block leading-tight">Med Vault</span>
              <span className="text-[9px] text-muted-foreground block leading-none mt-0.5">Check pill stock</span>
            </div>
          </div>
        </button>
        <button
          onClick={() => navigate("/reminders/new")}
          className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/30 transition-all text-left shadow-sm active:scale-98"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <PlusCircle size={16} />
            </div>
            <div>
              <span className="font-extrabold text-xs text-foreground block leading-tight">Add Reminder</span>
              <span className="text-[9px] text-muted-foreground block leading-none mt-0.5">Schedule a dose</span>
            </div>
          </div>
        </button>
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
            const colors = colorMap[med.color || "blue"] || colorMap.blue;
            const IconComp = iconMap[med.icon || "pill"] || Pill;

            // Refill / Stock Details
            const isTracked = med.currentQuantity !== undefined;
            const refillStatus = calculateRefillStatus(med, scopedReminders);
            const isOutOfStock = med.currentQuantity === 0;

            const stockText = isTracked
              ? `${med.currentQuantity} ${med.unit || "units"} left`
              : "Stock not tracked";

            const badgeCls = !isTracked
              ? "bg-muted/50 text-muted-foreground border-border/40"
              : isOutOfStock
              ? "bg-red-500/15 text-red-500 border-red-500/30"
              : refillStatus?.isLow
              ? "bg-red-500/15 text-red-500 border-red-500/30 animate-pulse"
              : refillStatus?.isWarning
              ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
              : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";

            const badgeText = !isTracked
              ? "Untracked"
              : isOutOfStock
              ? "Out of Stock"
              : refillStatus?.isLow
              ? "Critical Stock"
              : refillStatus?.isWarning
              ? "Low Stock"
              : "In Stock";

            return (
              <motion.div
                key={med.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-3xl border bg-card p-4 shadow-sm transition-all border-border/50 hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left Side: Icon & Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text} border ${colors.border}`}>
                      <IconComp className="size-5" />
                    </div>

                    <div className="min-w-0 pt-0.5">
                      <h4 className="text-base font-black tracking-tight text-foreground leading-tight truncate">
                        {med.name}
                      </h4>
                      <p className="text-xs font-bold text-muted-foreground mt-0.5">{med.dosage}</p>
                      {med.genericName && (
                        <p className="text-[10px] text-muted-foreground/60 italic truncate mt-0.5">
                          {med.genericName}
                        </p>
                      )}
                      {med.notes && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 bg-muted/30 px-2 py-0.5 rounded border border-border/20 w-fit">
                          💡 {med.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Status Badge */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeCls}`}>
                      {badgeText}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {stockText}
                    </span>
                  </div>
                </div>

                {/* Bottom Row Actions */}
                <div className="mt-4 pt-3 border-t border-border/30 flex justify-between items-center">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {!isTracked ? (
                      <button
                        onClick={() => {
                          setSelectedMed(med);
                          setIsSheetOpen(true);
                        }}
                        className="text-primary hover:underline font-bold"
                      >
                        Enable Stock Tracker
                      </button>
                    ) : refillStatus?.daysRemaining !== null ? (
                      <span className="font-semibold text-muted-foreground/80">
                        ~{refillStatus.daysRemaining} days of supply remaining
                      </span>
                    ) : (
                      <span className="text-[9px] italic">No reminders scheduled</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedMed(med);
                        setIsSheetOpen(true);
                      }}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50 transition-all active:scale-90"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(med)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border/50 transition-all active:scale-90"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
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
