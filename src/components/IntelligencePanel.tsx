import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, LayoutDashboard, Scan, Heart,
  History, Settings, Info, Sparkles, Bot, Maximize2, Send, ArrowRight
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AlertCircle } from "@/lib/icons";
import { useTypewriterPlaceholder } from "@/hooks/useTypewriterPlaceholder";

const SAMPLE_PROMPTS = [
  "Does Panadol interact with Ibuprofen?",
  "Add a medicine reminder for 8:00 AM...",
  "Is it safe to take my pills with milk?",
  "How many days of meds do I have left?",
  "Log my morning dose of Metformin...",
  "What are the side effects of Amoxicillin?",
  "Can you help me build a healthy routine?"
];

const QUICK_PROMPTS = [
  { label: "Drug Safety", prompt: "Does Panadol interact with Ibuprofen?" },
  { label: "Add Reminder", prompt: "Add a medicine reminder" },
  { label: "Med Stock", prompt: "How many days of meds do I have left?" },
];

// Widgets
import { DashboardWidget } from "./intelligence/DashboardWidget";
import { ScanWidget } from "./intelligence/ScanWidget";
import { WellnessWidget } from "./intelligence/WellnessWidget";
import { MedDetailsWidget } from "./intelligence/MedDetailsWidget";
import { RemindersWidget } from "./intelligence/RemindersWidget";
import { HistoryWidget } from "./intelligence/HistoryWidget";
import { InteractionsWidget } from "./intelligence/InteractionsWidget";
import { FamilyHubWidget } from "./intelligence/FamilyHubWidget";
import { TravelWidget } from "./intelligence/TravelWidget";
import { ReportWidget } from "./intelligence/ReportWidget";
import { SettingsWidget } from "./intelligence/SettingsWidget";
import { MedVaultWidget } from "./intelligence/MedVaultWidget";

export function IntelligencePanel() {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    isIntelligenceCollapsed, setIsIntelligenceCollapsed,
    isDawaGPTOpen, openDawaGPTWithPrompt
  } = useApp();

  const [inputQuery, setInputQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const placeholder = useTypewriterPlaceholder(SAMPLE_PROMPTS, {
    isPaused: isFocused || inputQuery !== ""
  });

  const handleLaunch = (prompt?: string) => {
    const textToPass = (prompt || inputQuery).trim();
    openDawaGPTWithPrompt(textToPass || undefined);
    setInputQuery("");
  };

  const renderContextualWidget = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return <DashboardWidget />;
    if (path === "/scan" || path === "/results") return <ScanWidget />;
    if (path === "/wellness") return <WellnessWidget />;
    if (path.startsWith("/medicine/") || path === "/search") return <MedDetailsWidget />;
    if (path === "/reminders" || path === "/reminders/new") return <RemindersWidget />;
    if (path === "/medvault" || path === "/vault") return <MedVaultWidget />;
    if (path === "/history") return <HistoryWidget />;
    if (path === "/interactions") return <InteractionsWidget />;
    if (path === "/family") return <FamilyHubWidget />;
    if (path === "/travel") return <TravelWidget />;
    if (path === "/report") return <ReportWidget />;
    if (path === "/settings") return <SettingsWidget />;

    // Safety fallback
    return <DashboardWidget />;
  };

  if (isIntelligenceCollapsed) {
    return (
      <aside className="w-[70px] border-l border-border bg-sidebar-background flex flex-col h-screen sticky top-0 overflow-hidden items-center py-6 transition-all duration-500 justify-between">
        <div className="flex flex-col items-center">
          <button
            onClick={() => setIsIntelligenceCollapsed(false)}
            aria-label="Expand intelligence panel"
            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-8 hover:bg-primary/20 transition-colors active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col gap-7 opacity-40">
            <LayoutDashboard size={20} />
            <Scan size={20} />
            <Heart size={20} />
            <History size={20} />
            <Settings size={20} />
          </div>
        </div>

        {/* Collapsed quick launch button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => handleLaunch()}
            title="Ask DawaGPT"
            className="relative group w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
            <Bot size={20} className="group-hover:rotate-6 transition-transform" />
          </button>
          <Info size={16} className="text-muted-foreground/30 mb-2" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[360px] border-l border-white/10 bg-background/60 backdrop-blur-3xl backdrop-saturate-[2] flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-right-4 shadow-[-20px_0_40px_rgba(0,0,0,0.04)]">

      {/* Header with Collapse Button */}
      <div className="p-5 pb-3 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow-md border border-primary/20 p-0.5 bg-background">
              <img src="/dawa-gpt.png" alt="Intelligence" className="w-full h-full object-cover rounded-[calc(0.5rem-2px)]" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-background rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground leading-none">Intelligence</h2>
            <span className="text-[9px] text-primary/80 font-bold uppercase tracking-widest mt-0.5 block">Live Context</span>
          </div>
        </div>
        <button
          onClick={() => setIsIntelligenceCollapsed(true)}
          aria-label="Collapse panel"
          className="p-1.5 hover:bg-muted/80 rounded-full text-muted-foreground transition-all active:scale-90"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Main Scrollable Contextual Widgets Area */}
      <div className="p-5 space-y-6 overflow-y-auto flex-1 no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            <ErrorBoundary
              fallback={
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
                  <AlertCircle size={20} className="text-destructive mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">Widget Error</p>
                </div>
              }
            >
              {renderContextualWidget()}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pinned Bottom DawaGPT AI Command Deck */}
      <div className="p-4 border-t border-border/50 bg-background/80 dark:bg-card/60 backdrop-blur-2xl shrink-0 z-20">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.08] to-primary/[0.02] p-3.5 shadow-sm hover:border-primary/35 transition-all duration-300 group">
          
          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-inner">
                <Bot size={15} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black tracking-wide text-foreground">DawaGPT AI</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Medical Copilot</p>
              </div>
            </div>

            <button
              onClick={() => handleLaunch()}
              aria-label="Expand DawaGPT"
              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary-foreground hover:bg-primary transition-all duration-200 border border-primary/30 bg-primary/10 rounded-full px-2.5 py-1 active:scale-95 shadow-sm"
            >
              <Maximize2 size={10} />
              <span>Expand</span>
            </button>
          </div>

          {/* Interactive Trigger Input Bar */}
          <div 
            onClick={() => {
              if (!inputQuery) handleLaunch();
            }}
            className="flex items-center gap-2 bg-background/90 dark:bg-background/60 border border-border/70 rounded-xl p-1.5 pl-3 shadow-inner hover:border-primary/40 focus-within:border-primary/50 transition-all cursor-text"
          >
            <Sparkles size={13} className="text-primary/70 shrink-0" />
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLaunch(inputQuery);
                }
              }}
              placeholder={placeholder || "Ask DawaGPT anything..."}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-muted-foreground/60 min-w-0"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLaunch(inputQuery);
              }}
              aria-label="Send prompt"
              className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shrink-0 shadow-sm"
            >
              {inputQuery.trim() ? <Send size={12} /> : <ArrowRight size={12} />}
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleLaunch(item.prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-muted/40 hover:bg-primary/10 border border-border/50 hover:border-primary/30 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-all active:scale-95 shrink-0 shadow-xs"
              >
                {item.label}
              </button>
            ))}
          </div>

        </div>
      </div>

    </aside>
  );
}
