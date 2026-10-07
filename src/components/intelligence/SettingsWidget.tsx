import React from "react";
import { Settings, ShieldCheck } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";

export function SettingsWidget() {
  const { userProfile } = useApp();

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account Status</h4>
          <Settings size={14} className="text-primary" />
        </div>
        
        <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
             <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
               <ShieldCheck size={18} />
             </div>
             <div>
               <p className="text-xs font-semibold text-foreground tracking-tight">{userProfile?.name || "User"}</p>
               <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                 Profile Secured
               </p>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
}
