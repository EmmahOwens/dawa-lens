import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Package2,
  Plus,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Pill,
  Syringe,
  Droplets,
  Tablets,
  ChevronRight,
  Info,
} from "@/lib/icons";
import { useApp, Medicine } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { calculateRefillStatus } from "@/services/refillService";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UNITS = ["tablets", "capsules", "ml", "puffs", "drops", "units"];

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

/** Animated circular SVG progress ring */
function StockRing({
  current,
  total,
  size = 80,
  strokeWidth = 6,
  color = "#3b82f6",
  critical = false,
  warning = false,
}: {
  current: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  critical?: boolean;
  warning?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const dashoffset = circumference * (1 - pct);

  const ringColor = critical ? "#ef4444" : warning ? "#f59e0b" : color;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      {/* Progress */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: dashoffset }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      />
    </svg>
  );
}

// ─── Refill Sheet ─────────────────────────────────────────────────────────────

interface RefillSheetProps {
  medicine: Medicine;
  onClose: () => void;
  onSave: (qty: number, unit: string, perDose: number, total: number) => Promise<void>;
}

function RefillSheet({ medicine, onClose, onSave }: RefillSheetProps) {
  const [qty, setQty] = useState(medicine.currentQuantity?.toString() ?? "");
  const [perDose, setPerDose] = useState(medicine.dosagePerDose?.toString() ?? "1");
  const [total, setTotal] = useState(medicine.totalQuantity?.toString() ?? "");
  const [unit, setUnit] = useState(medicine.unit ?? "tablets");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const parsedQty = parseFloat(qty);
    if (isNaN(parsedQty) || parsedQty < 0) return;
    setIsSaving(true);
    try {
      await onSave(parsedQty, unit, parseFloat(perDose) || 1, parseFloat(total) || parsedQty);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full max-w-lg bg-card rounded-t-3xl p-6 pb-10 shadow-2xl border border-border/50"
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-6" />
        <h3 className="text-xl font-black tracking-tight mb-1">Update Stock</h3>
        <p className="text-xs text-muted-foreground mb-6">
          {medicine.name} · Current: {medicine.currentQuantity ?? "—"} {medicine.unit ?? "units"}
        </p>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground">
              Pills you have right now
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 30"
              className="h-12 rounded-xl text-lg font-bold"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">
                Pills per dose
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={perDose}
                onChange={(e) => setPerDose(e.target.value)}
                placeholder="1"
                className="h-12 rounded-xl font-bold"
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
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground">
              Total when full (original pack size)
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="e.g. 60"
              className="h-12 rounded-xl font-bold"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-12">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !qty}
            className="flex-1 rounded-xl h-12 font-bold"
          >
            {isSaving ? "Saving…" : "Save Stock"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Stock Card ───────────────────────────────────────────────────────────────

interface StockCardProps {
  medicine: Medicine;
  daysRemaining: number | null;
  isLow: boolean;
  isWarning: boolean;
  isOutOfStock: boolean;
  onRefill: () => void;
}

function StockCard({ medicine, daysRemaining, isLow, isWarning, isOutOfStock, onRefill }: StockCardProps) {
  const colors = colorMap[medicine.color || "blue"] || colorMap.blue;
  const IconComp = iconMap[medicine.icon || "pill"] || Pill;
  const total = medicine.totalQuantity || medicine.currentQuantity || 1;
  const current = medicine.currentQuantity ?? 0;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const statusLabel = isOutOfStock
    ? { text: "Out of Stock", cls: "bg-red-500/15 text-red-500 border-red-500/30" }
    : isLow
    ? { text: "Critical — Refill Now", cls: "bg-red-500/15 text-red-500 border-red-500/30 animate-pulse" }
    : isWarning
    ? { text: "Low Stock", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" }
    : { text: "In Stock", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative overflow-hidden rounded-3xl border bg-card p-5 shadow-sm transition-all ${
        isLow || isOutOfStock
          ? "border-red-500/30 shadow-red-500/5"
          : isWarning
          ? "border-amber-500/30"
          : "border-border/50"
      }`}
    >
      {/* Critical pulse glow */}
      {(isLow || isOutOfStock) && (
        <div className="absolute inset-0 rounded-3xl border-2 border-red-500/20 animate-pulse pointer-events-none" />
      )}

      <div className="flex items-start gap-4">
        {/* Progress Ring */}
        <div className="relative flex-shrink-0">
          <StockRing
            current={current}
            total={total}
            size={76}
            strokeWidth={6}
            color={colors.ring}
            critical={isLow || isOutOfStock}
            warning={isWarning}
          />
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text}`}>
              <IconComp className="size-4" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-black tracking-tight text-foreground leading-tight truncate">
                {medicine.name}
              </p>
              {medicine.genericName && (
                <p className="text-[10px] text-muted-foreground truncate">{medicine.genericName}</p>
              )}
            </div>
            <span className={`flex-shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusLabel.cls}`}>
              {statusLabel.text}
            </span>
          </div>

          {/* Pill count */}
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-3xl font-black leading-none ${isLow || isOutOfStock ? "text-red-500" : isWarning ? "text-amber-500" : "text-foreground"}`}>
              {current}
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {medicine.unit || "units"} left
            </span>
            <span className="text-xs text-muted-foreground/50 ml-0.5">({pct}%)</span>
          </div>

          {/* Days remaining */}
          {daysRemaining !== null && (
            <div className="mt-1.5 flex items-center gap-3">
              <p className={`text-[11px] font-bold ${isLow || isOutOfStock ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground"}`}>
                {isOutOfStock
                  ? "⛔ No doses left"
                  : `~${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
              </p>
              {medicine.dosagePerDose && (
                <span className="text-[10px] text-muted-foreground/60">
                  · {medicine.dosagePerDose} {medicine.unit || "unit"}/dose
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Refill button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={onRefill}
          className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
            isLow || isOutOfStock
              ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20"
              : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
          }`}
        >
          <RefreshCw className="size-3" />
          Refill
        </button>
      </div>
    </motion.div>
  );
}

// ─── Untracked Card ───────────────────────────────────────────────────────────

function UntrackedCard({ medicine, onSetup }: { medicine: Medicine; onSetup: () => void }) {
  const colors = colorMap[medicine.color || "blue"] || colorMap.blue;
  const IconComp = iconMap[medicine.icon || "pill"] || Pill;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-4 rounded-2xl border bg-muted/20 ${colors.border} transition-all`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text}`}>
        <IconComp className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{medicine.name}</p>
        <p className="text-[10px] text-muted-foreground">Stock not tracked</p>
      </div>
      <button
        onClick={onSetup}
        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-xl flex-shrink-0 transition-all active:scale-95"
      >
        Track <ChevronRight className="size-3" />
      </button>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export default function MedVaultPage() {
  const navigate = useNavigate();
  const { updateMedicine, isInitializing } = useApp();
  const { scopedMedicines, scopedReminders } = usePatientScope();
  const { toast } = useToast();

  const [refillTarget, setRefillTarget] = useState<Medicine | null>(null);

  // Compute refill status for all medicines
  const medicineStatuses = useMemo(() => {
    return scopedMedicines.map((med) => {
      const status = calculateRefillStatus(med, scopedReminders);
      return { medicine: med, status };
    });
  }, [scopedMedicines, scopedReminders]);

  // Split: tracked (has currentQuantity) vs untracked
  const tracked = medicineStatuses.filter(
    ({ medicine }) => medicine.currentQuantity !== undefined
  );
  const untracked = medicineStatuses.filter(
    ({ medicine }) => medicine.currentQuantity === undefined
  );

  // Summary stats
  const totalTablets = tracked.reduce(
    (sum, { medicine }) => sum + (medicine.currentQuantity ?? 0),
    0
  );
  const criticalCount = tracked.filter(
    ({ status }) => status && status.isLow
  ).length;
  const warningCount = tracked.filter(
    ({ status }) => status && status.isWarning
  ).length;

  const handleRefillSave = async (
    qty: number,
    unit: string,
    perDose: number,
    total: number
  ) => {
    if (!refillTarget) return;
    try {
      await updateMedicine(refillTarget.id, {
        currentQuantity: qty,
        totalQuantity: total,
        dosagePerDose: perDose,
        unit,
      });
      toast({
        title: "Stock updated ✅",
        description: `${refillTarget.name}: ${qty} ${unit} logged.`,
      });
    } catch {
      toast({
        title: "Failed to update stock",
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
              Med Vault
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              Your pill stock tracker
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/medications")}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary px-3 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
        >
          <Pill className="size-3.5" />
          <span>Medications</span>
        </button>
      </motion.div>

      {/* Hero Stats */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-[2rem] p-6 mb-8 bg-gradient-to-br from-teal-600 via-cyan-600 to-emerald-500 text-white shadow-2xl shadow-teal-500/20"
      >
        {/* Background deco */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-black/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/10">
              <Package2 size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
              Stock Overview
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-black leading-none">{tracked.length}</p>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mt-1">
                Tracked
              </p>
            </div>
            <div>
              <p className="text-3xl font-black leading-none">{totalTablets}</p>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mt-1">
                Total Units
              </p>
            </div>
            <div>
              <p className={`text-3xl font-black leading-none ${criticalCount > 0 ? "text-red-300" : "text-white"}`}>
                {criticalCount}
              </p>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mt-1">
                Critical
              </p>
            </div>
          </div>

          {(criticalCount > 0 || warningCount > 0) && (
            <div className="mt-4 flex items-center gap-2 text-[11px] font-bold bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 w-fit">
              <AlertTriangle size={12} className={criticalCount > 0 ? "text-red-300" : "text-amber-300"} />
              {criticalCount > 0
                ? `${criticalCount} medicine${criticalCount > 1 ? "s" : ""} critically low — refill now!`
                : `${warningCount} medicine${warningCount > 1 ? "s" : ""} running low`}
            </div>
          )}
        </div>
      </motion.div>

      {/* Loading */}
      {isInitializing ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-3xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : tracked.length === 0 && untracked.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-border/50 bg-accent/10 text-center gap-4 px-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-500">
            <Package2 size={28} />
          </div>
          <div>
            <p className="text-base font-black text-foreground mb-1">Med Vault is empty</p>
            <p className="text-sm text-muted-foreground max-w-[240px]">
              Add your medicines with pill counts to start tracking your stock.
            </p>
          </div>
          <button
            onClick={() => navigate("/medications")}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-teal-500/20 mt-1"
          >
            <Plus size={14} /> Manage Medications
          </button>
        </motion.div>
      ) : (
        <>
          {/* Tracked medicines */}
          {tracked.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <CheckCircle size={12} className="text-teal-500" />
                Tracked ({tracked.length})
              </h2>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-4"
              >
                <AnimatePresence>
                  {/* Critical first, then warning, then OK */}
                  {[...tracked]
                    .sort((a, b) => {
                      const getOrder = (item: typeof a) => {
                        if ((item.medicine.currentQuantity ?? 0) === 0) return 0;
                        if (item.status?.isLow) return 1;
                        if (item.status?.isWarning) return 2;
                        return 3;
                      };
                      const orderA = getOrder(a);
                      const orderB = getOrder(b);
                      if (orderA !== orderB) return orderA - orderB;
                      // Sub-sort by quantity ascending
                      return (a.medicine.currentQuantity ?? 0) - (b.medicine.currentQuantity ?? 0);
                    })
                    .map(({ medicine, status }) => {
                      const days = status?.daysRemaining ?? null;
                      const isCritical = status?.isLow ?? false;
                      const isWarn = status?.isWarning ?? false;
                      const isOut = (medicine.currentQuantity ?? 0) === 0;
                      return (
                        <StockCard
                          key={medicine.id}
                          medicine={medicine}
                          daysRemaining={days}
                          isLow={isCritical}
                          isWarning={isWarn}
                          isOutOfStock={isOut}
                          onRefill={() => setRefillTarget(medicine)}
                        />
                      );
                    })}
                </AnimatePresence>
              </motion.div>
            </div>
          )}

          {/* Untracked medicines */}
          {untracked.length > 0 && (
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Info size={12} />
                Not Tracked ({untracked.length})
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Add pill counts to these medicines to enable Med Vault tracking.
              </p>
              <div className="space-y-2">
                {untracked.map(({ medicine }) => (
                  <UntrackedCard
                    key={medicine.id}
                    medicine={medicine}
                    onSetup={() => setRefillTarget(medicine)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Info footer */}
      {(tracked.length > 0 || untracked.length > 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 rounded-2xl bg-teal-500/5 border border-teal-500/15 flex items-start gap-3"
        >
          <Package2 size={15} className="text-teal-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Med Vault automatically decreases your pill count each time you log a
            dose. You'll get a notification when you have 2 days of supply left.
          </p>
        </motion.div>
      )}

      {/* Refill Sheet */}
      <AnimatePresence>
        {refillTarget && (
          <RefillSheet
            medicine={refillTarget}
            onClose={() => setRefillTarget(null)}
            onSave={handleRefillSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
