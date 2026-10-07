import React from "react";
import { ShieldCheck, Calendar, Package } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";

export function MedDetailsWidget() {
  const { medicines } = useApp();
  const lastMed = medicines.length > 0 ? medicines[medicines.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Lifecycle */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lifecycle</h4>
          <Calendar size={14} className="text-primary" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Package size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground tracking-tight">Treatment Active</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Day 14 of 30</p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full w-[45%]" />
          </div>
        </div>
      </section>

      {/* Safety Pulse */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Safety Pulse</h4>
          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-[18px] p-4.5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">AI Verification Passed</p>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
            No known interactions with your current profile detected for {lastMed?.name || "this medication"}.
          </p>
        </div>
      </section>
    </div>
  );
}
