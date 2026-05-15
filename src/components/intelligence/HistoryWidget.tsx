import React from "react";
import { motion } from "framer-motion";
import { History, Activity } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

export function HistoryWidget() {
  const { doseLogs } = useApp();
  const recentLogs = doseLogs.slice(0, 5);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Recent Activity</h4>
          <Activity size={14} className="text-primary" />
        </div>
        
        {recentLogs.length > 0 ? (
          <div className="space-y-3">
            {recentLogs.map((log, i) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex flex-col">
                  <span className="text-[12px] font-black">{log.medicineName}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">
                    {new Date(log.actionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  log.action === "taken" 
                    ? "bg-success/10 text-success border border-success/20" 
                    : log.action === "skipped" 
                      ? "bg-muted text-muted-foreground border border-border/50" 
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}>
                  {log.action}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6 text-center">
            <History size={24} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-[11px] font-medium text-muted-foreground">No recent logs found.</p>
          </div>
        )}
      </section>
    </div>
  );
}
