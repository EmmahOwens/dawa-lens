import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Package2, AlertTriangle, CheckCircle2, Sparkles, RefreshCw } from "@/lib/icons";
import { usePatientScope } from "@/hooks/usePatientScope";
import { calculateRefillStatus } from "@/services/refillService";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

export function MedVaultWidget() {
  const { t } = useTranslation();
  const { scopedMedicines, scopedReminders } = usePatientScope();
  const { openDawaGPTWithPrompt } = useApp();

  const trackedMeds = useMemo(() => {
    return scopedMedicines.filter(
      (m) => m.currentQuantity !== undefined || m.totalQuantity !== undefined
    );
  }, [scopedMedicines]);

  const statuses = useMemo(() => {
    return trackedMeds.map((m) => calculateRefillStatus(m, scopedReminders)).filter(Boolean);
  }, [trackedMeds, scopedReminders]);

  const criticalCount = useMemo(() => {
    return statuses.filter((s) => s?.isLow || s?.isOutOfStock).length;
  }, [statuses]);

  const warningCount = useMemo(() => {
    return statuses.filter((s) => s?.isWarning).length;
  }, [statuses]);

  const lowestSupplyMed = useMemo(() => {
    if (statuses.length === 0) return null;
    const sorted = [...statuses].sort((a, b) => {
      const dayA = a?.daysRemaining ?? 999;
      const dayB = b?.daysRemaining ?? 999;
      return dayA - dayB;
    });
    return sorted[0];
  }, [statuses]);

  return (
    <div className="space-y-8">
      {/* Vault Inventory Overview */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            Vault Inventory
          </h4>
          <Package2 size={14} className="text-teal-600 dark:text-teal-400" />
        </div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0 border border-teal-500/20">
              <span className="text-lg font-black text-teal-600 dark:text-teal-400">
                {trackedMeds.length}
              </span>
            </div>
            <div>
              <p className="text-[12px] font-black text-foreground uppercase tracking-tight">
                Tracked Medications
              </p>
              <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">
                {criticalCount > 0
                  ? `⚠️ ${criticalCount} need refill`
                  : warningCount > 0
                  ? `⚡ ${warningCount} running low`
                  : "All stocks healthy"}
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stock Health & Shortest Supply */}
      {lowestSupplyMed && (
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Supply Status
            </h4>
            {lowestSupplyMed.isLow || lowestSupplyMed.isOutOfStock ? (
              <AlertTriangle size={14} className="text-destructive animate-pulse" />
            ) : (
              <CheckCircle2 size={14} className="text-success" />
            )}
          </div>
          <motion.div
            whileHover={{ y: -4 }}
            className={`bg-background/40 backdrop-blur-sm rounded-[1.75rem] p-5 border shadow-sm relative overflow-hidden ${
              lowestSupplyMed.isLow || lowestSupplyMed.isOutOfStock
                ? "border-destructive/30 shadow-destructive/5"
                : lowestSupplyMed.isWarning
                ? "border-amber-500/30"
                : "border-border/50"
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Shortest Supply
                </span>
                <span
                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    lowestSupplyMed.isOutOfStock
                      ? "bg-destructive/15 text-destructive"
                      : lowestSupplyMed.isLow
                      ? "bg-destructive/15 text-destructive"
                      : lowestSupplyMed.isWarning
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-emerald-500/15 text-emerald-600"
                  }`}
                >
                  {lowestSupplyMed.isOutOfStock
                    ? "Out of Stock"
                    : lowestSupplyMed.isLow
                    ? "Critical Low"
                    : lowestSupplyMed.isWarning
                    ? "Low Stock"
                    : "In Stock"}
                </span>
              </div>
              <p className="text-sm font-black text-foreground truncate">
                {lowestSupplyMed.medicineName}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                <div>
                  <p className="text-[9px] uppercase font-bold text-muted-foreground">Doses Left</p>
                  <p className="text-xs font-black text-teal-600 dark:text-teal-400">
                    {lowestSupplyMed.dosesRemaining} doses
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-bold text-muted-foreground">Supply Left</p>
                  <p className="text-xs font-black text-foreground">
                    ~{lowestSupplyMed.daysRemaining ?? 0} days
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      )}

      {/* DawaGPT Quick Prompt */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            DawaGPT Stock Check
          </h4>
          <Sparkles size={14} className="text-teal-600" />
        </div>
        <button
          onClick={() => openDawaGPTWithPrompt("How many days and doses of meds do I have left in Med Vault?")}
          className="w-full text-left p-3.5 rounded-2xl bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/20 text-xs font-bold text-teal-700 dark:text-teal-300 transition-all flex items-center justify-between group active:scale-95"
        >
          <span>Ask DawaGPT about dose vs days supply</span>
          <Sparkles size={14} className="text-teal-600 group-hover:rotate-12 transition-transform shrink-0" />
        </button>
      </section>
    </div>
  );
}
