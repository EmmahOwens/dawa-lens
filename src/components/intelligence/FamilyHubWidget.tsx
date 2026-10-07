import React from "react";
import { Users, Activity } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";

export function FamilyHubWidget() {
  const { patients } = useApp();

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Family Network</h4>
          <Users size={14} className="text-primary" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-primary">
             <span className="font-semibold text-sm">{patients.length}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground tracking-tight">Active Profiles</p>
            <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
              Managing {patients.length} {patients.length === 1 ? "profile" : "dependents"}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Updates</h4>
          <Activity size={14} className="text-primary" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Select a family member to view specific insights and adherence records.
          </p>
        </div>
      </section>
    </div>
  );
}
