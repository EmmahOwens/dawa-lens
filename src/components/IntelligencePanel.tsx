import React from "react";
import { motion } from "framer-motion";
import { Activity, ShieldAlert, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { checkConditionSafety } from "@/services/conditionInteractionService";
import { ChatMessage, generateDawaGPTResponse } from "@/services/aiAssistantService";
import { Button } from "./ui/button";
import { Send } from "lucide-react";

export function IntelligencePanel() {
  const { t } = useTranslation();
  const { medicines, userProfile, doseLogs, reminders } = useApp();
  
  const lastMed = medicines.length > 0 ? medicines[medicines.length - 1] : null;
  const safetyWarnings = lastMed && userProfile 
    ? checkConditionSafety(lastMed.name, lastMed.genericName, []) // Simplified for now
    : [];

  const todayLogs = doseLogs.filter(log => {
      const logDate = new Date(log.actionTime).toDateString();
      const today = new Date().toDateString();
      return logDate === today && log.action === "taken";
  });

  const adherenceRate = reminders.length > 0 ? Math.round((todayLogs.length / reminders.length) * 100) : 0;

  return (
    <aside className="w-[340px] border-l border-border bg-sidebar-background flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="p-6 space-y-8 overflow-y-auto flex-1 no-scrollbar">
        
        {/* Section 1: Health Snapshot */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Intelligence.snapshot")}</h3>
            <Activity size={14} className="text-primary" />
          </div>
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-card rounded-[2rem] p-6 border border-border shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                  <motion.circle 
                    cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" 
                    strokeDasharray={2 * Math.PI * 28}
                    initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - adherenceRate / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="text-primary" 
                  />
                </svg>
                <span className="absolute text-xs font-bold">{adherenceRate}%</span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{t("Intelligence.adherence")}</p>
                <p className="text-[10px] text-muted-foreground">{todayLogs.length} / {reminders.length} {t("Intelligence.doses_taken")}</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <CheckCircle2 size={48} />
            </div>
          </motion.div>
        </section>

        {/* Section 2: Interaction Watchdog */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Intelligence.watchdog")}</h3>
            <ShieldAlert size={14} className={safetyWarnings.length > 0 ? "text-destructive" : "text-success"} />
          </div>
          
          {safetyWarnings.length > 0 ? (
            <div className="space-y-3">
              {safetyWarnings.map((warning, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-destructive/5 border border-destructive/20 rounded-[1.5rem] p-4 flex gap-3"
                >
                  <ShieldAlert size={16} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed text-destructive/90">{warning.warning}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-success/5 border border-success/20 rounded-[1.5rem] p-4 flex items-center gap-3">
              <CheckCircle2 size={16} className="text-success shrink-0" />
              <p className="text-xs text-success/90 font-medium">{t("Intelligence.no_interactions")}</p>
            </div>
          )}
        </section>

        {/* Section 3: Dawa-GPT Mini */}
        <section className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dawa-GPT Mini</h3>
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="bg-muted/30 rounded-[2rem] border border-border p-4 flex flex-col h-[300px]">
             <div className="flex-1 overflow-y-auto mb-4 space-y-3 no-scrollbar">
                <div className="bg-background rounded-2xl rounded-tl-none p-3 text-xs border border-border/50">
                  <p className="leading-relaxed">I'm watching your active medication for safety. Ask me anything!</p>
                </div>
                {lastMed && (
                  <div className="bg-primary/5 rounded-2xl p-2 text-[10px] border border-primary/20 italic text-center">
                    Context: {lastMed.name}
                  </div>
                )}
             </div>
             <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ask GPT..." 
                  className="flex-1 bg-background rounded-full px-4 py-2 text-xs border-none outline-none ring-1 ring-border focus:ring-primary/40 transition-all"
                />
                <Button size="icon" className="rounded-full w-8 h-8 shrink-0">
                  <Send size={12} />
                </Button>
             </div>
          </div>
        </section>

      </div>
      
      {/* Footer Branding */}
      <div className="p-4 border-t border-border/50 text-center">
         <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Medical Intelligence Core v2.0</p>
      </div>
    </aside>
  );
}
