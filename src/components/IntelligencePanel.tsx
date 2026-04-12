import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, ChevronRight, ChevronLeft, LayoutDashboard, Scan, Heart, 
  History, Settings, Info, Sparkles, Activity, ShieldAlert, CheckCircle2, Clock 
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { checkConditionSafety } from "@/services/conditionInteractionService";
import { Button } from "./ui/button";
import { DashboardWidget } from "./intelligence/DashboardWidget";
import { ScanWidget } from "./intelligence/ScanWidget";
import { WellnessWidget } from "./intelligence/WellnessWidget";
import { MedDetailsWidget } from "./intelligence/MedDetailsWidget";

export function IntelligencePanel() {
  const { t } = useTranslation();
  const location = useLocation();
  const { medicines, userProfile, doseLogs, reminders, isIntelligenceCollapsed, setIsIntelligenceCollapsed, isDawaGPTOpen } = useApp();
  const [miniChatInput, setMiniChatInput] = useState("");
  
  const lastMed = medicines.length > 0 ? medicines[medicines.length - 1] : null;
  const safetyWarnings = lastMed && userProfile 
    ? checkConditionSafety(lastMed.name, lastMed.genericName, []) 
    : [];

  const todayLogs = doseLogs.filter(log => {
      const logDate = new Date(log.actionTime).toDateString();
      const today = new Date().toDateString();
      return logDate === today && log.action === "taken";
  });

  const adherenceRate = reminders.length > 0 ? Math.round((todayLogs.length / reminders.length) * 100) : 0;

  // Route-based widget selection
  const renderContextualWidget = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return <DashboardWidget />;
    if (path === "/scan" || path === "/results") return <ScanWidget />;
    if (path === "/wellness") return <WellnessWidget />;
    if (path.startsWith("/medicine/")) return <MedDetailsWidget />;
    
    // Default fallback (original content)
    return (
      <div className="space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Intelligence.snapshot")}</h3>
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
                <span className="absolute text-[10px] font-black">{adherenceRate}%</span>
              </div>
              <div>
                <p className="text-xs font-black text-foreground uppercase tracking-tight">{t("Intelligence.adherence")}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 mt-0.5">{todayLogs.length} / {reminders.length} {t("Intelligence.doses_taken")}</p>
              </div>
            </div>
          </motion.div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Intelligence.watchdog")}</h3>
            <ShieldAlert size={14} className={safetyWarnings.length > 0 ? "text-destructive" : "text-success"} />
          </div>
          {safetyWarnings.length > 0 ? (
            <div className="space-y-3">
              {safetyWarnings.map((warning, i) => (
                <div key={i} className="bg-destructive/5 border border-destructive/20 rounded-[1.5rem] p-4 flex gap-3 italic">
                  <ShieldAlert size={14} className="text-destructive shrink-0" />
                  <p className="text-[10px] leading-relaxed text-destructive/90 font-medium">{warning.warning}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-success/5 border border-success/20 rounded-[1.5rem] p-4 flex items-center gap-3">
              <CheckCircle2 size={14} className="text-success shrink-0" />
              <p className="text-[10px] text-success/90 font-black uppercase tracking-widest">{t("Intelligence.no_interactions")}</p>
            </div>
          )}
        </section>
      </div>
    );
  };

  const hideGPTMini = location.pathname === "/scan" || location.pathname === "/settings" || isDawaGPTOpen;

  if (isIntelligenceCollapsed) {
    return (
      <aside className="w-[70px] border-l border-border bg-sidebar-background flex flex-col h-screen sticky top-0 overflow-hidden items-center py-6 transition-all duration-500">
        <button 
          onClick={() => setIsIntelligenceCollapsed(false)}
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-10 hover:bg-primary/20 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 flex flex-col gap-8 opacity-40">
           <LayoutDashboard size={20} />
           <Scan size={20} />
           <Heart size={20} />
           <History size={20} />
           <Settings size={20} />
        </div>
        <div className="p-4">
           <Info size={16} className="text-muted-foreground/30" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] border-l border-border bg-sidebar-background flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-right-4">
      
      {/* Header with Collapse Button */}
      <div className="p-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Sparkles size={16} className="text-primary animate-pulse" />
           <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Intelligence</h2>
        </div>
        <button 
          onClick={() => setIsIntelligenceCollapsed(true)}
          className="p-1.5 hover:bg-muted rounded-full text-muted-foreground transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="p-6 space-y-8 overflow-y-auto flex-1 no-scrollbar">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderContextualWidget()}
          </motion.div>
        </AnimatePresence>

        {/* Section: Dawa-GPT Mini (Conditional) */}
        <AnimatePresence>
          {!hideGPTMini && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col min-h-0 pt-4 border-t border-border/50"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dawa-GPT Mini</h3>
                <Sparkles size={12} className="text-primary" />
              </div>
              <div className="bg-muted/30 rounded-[2rem] border border-border p-4 flex flex-col h-[260px] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sparkles size={80} />
                </div>
                <div className="flex-1 overflow-y-auto mb-4 space-y-3 no-scrollbar z-10">
                    <div className="bg-background rounded-2xl rounded-tl-none p-3 text-[11px] border border-border/30 shadow-sm leading-relaxed">
                      I'm watching your active medication for safety. Ask me anything!
                    </div>
                </div>
                <div className="flex gap-2 z-10">
                    <input 
                      type="text" 
                      value={miniChatInput}
                      onChange={(e) => setMiniChatInput(e.target.value)}
                      placeholder="Ask GPT..." 
                      className="flex-1 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 text-[11px] border-none outline-none ring-1 ring-border focus:ring-primary/40 transition-all"
                    />
                    <Button 
                      size="icon" 
                      onClick={() => setMiniChatInput("")}
                      className="rounded-full w-8 h-8 shrink-0 bg-primary shadow-lg shadow-primary/20"
                    >
                      <Send size={10} />
                    </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </div>
      
      {/* Footer Branding */}
      <div className="p-4 border-t border-border/50 text-center bg-muted/10">
         <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Medical Intelligence Core v2.4</p>
      </div>
    </aside>
  );
}
