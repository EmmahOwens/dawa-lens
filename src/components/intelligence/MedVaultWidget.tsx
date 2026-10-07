import React, { useMemo } from "react";
import { Package2, AlertTriangle, CheckCircle2, Sparkles } from "@/lib/icons";
import { usePatientScope } from "@/hooks/usePatientScope";
import { calculateRefillStatus } from "@/services/refillService";
import { useApp } from "@/contexts/AppContext";

export function MedVaultWidget() {
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
    <div className="space-y-6">
      {/* Vault Inventory Overview */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vault Inventory
          </h4>
          <Package2 size={14} className="text-primary" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-primary">
              <span className="text-base font-semibold">
                {trackedMeds.length}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground tracking-tight">
                Tracked Medications
              </p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                {criticalCount > 0
                  ? `${criticalCount} need refill`
                  : warningCount > 0
                  ? `${warningCount} running low`
                  : "All stocks healthy"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stock Health & Shortest Supply */}
      {lowestSupplyMed && (
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Supply Status
            </h4>
            {lowestSupplyMed.isLow || lowestSupplyMed.isOutOfStock ? (
              <AlertTriangle size={14} className="text-destructive" />
            ) : (
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div
            className={`bg-card rounded-[18px] p-5 border shadow-xs ${
              lowestSupplyMed.isLow || lowestSupplyMed.isOutOfStock
                ? "border-destructive/30"
                : lowestSupplyMed.isWarning
                ? "border-amber-500/30"
                : "border-border"
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Shortest Supply
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    lowestSupplyMed.isOutOfStock
                      ? "bg-destructive/15 text-destructive"
                      : lowestSupplyMed.isLow
                      ? "bg-destructive/15 text-destructive"
                      : lowestSupplyMed.isWarning
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
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
              <p className="text-sm font-semibold text-foreground truncate">
                {lowestSupplyMed.medicineName}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">Doses Left</p>
                  <p className="text-xs font-semibold text-primary mt-0.5">
                    {lowestSupplyMed.dosesRemaining} doses
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">Supply Left</p>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    ~{lowestSupplyMed.daysRemaining ?? 0} days
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* DawaGPT Quick Prompt */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            DawaGPT Stock Check
          </h4>
          <Sparkles size={14} className="text-primary" />
        </div>
        <button
          onClick={() => openDawaGPTWithPrompt("How many days and doses of meds do I have left in Med Vault?")}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground transition-transform active:scale-95 flex items-center justify-between"
        >
          <span>Ask DawaGPT about supply</span>
          <Sparkles size={14} className="text-primary shrink-0" />
        </button>
      </section>
    </div>
  );
}
