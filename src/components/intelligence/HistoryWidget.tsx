import React from "react";
import { History, Activity } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { toDate } from "@/lib/utils";

export function HistoryWidget() {
  const { doseLogs } = useApp();
  const recentLogs = doseLogs.filter((l) => l.action !== "snoozed").slice(0, 5);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h4>
          <Activity size={14} className="text-primary" />
        </div>
        
        {recentLogs.length > 0 ? (
          <div className="space-y-2.5">
            {recentLogs.map((log) => (
              <div 
                key={log.id}
                className="bg-card border border-border rounded-[18px] p-4 flex items-center justify-between shadow-xs"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">{log.medicineName}</span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {toDate(log.actionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                  log.action === "taken" 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                    : log.action === "skipped" 
                      ? "bg-secondary text-muted-foreground border border-border" 
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}>
                  {log.action}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-[18px] p-6 text-center">
            <History size={20} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium text-muted-foreground">No recent logs recorded.</p>
          </div>
        )}
      </section>
    </div>
  );
}
