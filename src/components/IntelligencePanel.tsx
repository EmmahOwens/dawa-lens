import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, LayoutDashboard, Scan, Heart,
  History, Settings, Info, Sparkles, Bot
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AlertCircle } from "@/lib/icons";


const POPUP_PHRASES = [
  "Tap me! 👋",
  "Want to know about your health?",
  "Check drug interactions 💊",
  "How's your med supply?",
  "I'm your medical copilot!",
  "Ask me anything health-related",
  "Need a reminder set? 🔔",
  "Is it safe to mix those meds?",
  "Your AI health buddy is here!",
  "Let's talk about your wellness ✨",
];

function usePopupPhrase(phrases: string[], intervalMs = 3000) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length);
        setVisible(true);
      }, 400);
    }, intervalMs);
    return () => clearInterval(cycle);
  }, [phrases.length, intervalMs]);

  return { phrase: phrases[index], visible };
}


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
    isDawaGPTOpen, openDawaGPTWithPrompt, isOnline
  } = useApp();



  const handleLaunch = (prompt?: string) => {
    openDawaGPTWithPrompt(prompt || undefined);
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
            title={isOnline ? "Ask DawaGPT" : "DawaGPT is offline"}
            disabled={!isOnline}
            className="relative group w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
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
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-amber-500"}`} />
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

      {/* Pinned Bottom DawaGPT AI — Compact Icon with Animated Popups */}
      <DawaGPTMiniButton onLaunch={handleLaunch} isOnline={isOnline} />

    </aside>
  );
}

// ---------------------------------------------------------------------------
// DawaGPT Mini Button — animated icon-only compact section
// ---------------------------------------------------------------------------
function DawaGPTMiniButton({
  onLaunch,
  isOnline,
}: {
  onLaunch: () => void;
  isOnline: boolean;
}) {
  const { phrase, visible } = usePopupPhrase(POPUP_PHRASES, 3200);
  const [hovered, setHovered] = useState(false);

  return (
    <div className="px-4 pb-4 pt-2 border-t border-border/40 bg-background/80 dark:bg-card/60 backdrop-blur-2xl shrink-0 z-20">
      <div
        className="relative flex items-center justify-center py-3"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Floating popup phrase */}
        <AnimatePresence mode="wait">
          {visible && (
            <motion.div
              key={phrase}
              initial={{ opacity: 0, y: 8, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.88 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 pointer-events-none z-30"
            >
              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg shadow-primary/30 whitespace-nowrap border border-primary/30 backdrop-blur-sm">
                {phrase}
                {/* tail */}
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-1.5 overflow-hidden">
                  <span className="block w-2 h-2 bg-primary rotate-45 mx-auto -translate-y-1" />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The animated Bot icon button */}
        <motion.button
          onClick={() => onLaunch()}
          disabled={!isOnline}
          aria-label="Open DawaGPT AI"
          whileHover={{ scale: 1.12, rotate: [0, -6, 6, -4, 4, 0] }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary via-primary/90 to-primary/70 text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/35 hover:shadow-primary/50 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {/* Pulsing ring */}
          <motion.span
            className="absolute inset-0 rounded-2xl ring-2 ring-primary/40"
            animate={isOnline ? { scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] } : {}}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          />
          {/* Orbiting sparkle */}
          <motion.span
            className="absolute top-0.5 right-0.5 text-yellow-300"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          >
            <Sparkles size={10} />
          </motion.span>

          <motion.div
            animate={hovered ? { rotate: [0, -8, 8, 0], y: [0, -2, 0] } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Bot size={26} strokeWidth={2} />
          </motion.div>

          {/* Online dot */}
          <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-background flex items-center justify-center ${isOnline ? "bg-emerald-500" : "bg-amber-400"}`}>
            {isOnline && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            )}
          </span>
        </motion.button>
      </div>

      {/* Sub-label */}
      <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mt-1 select-none">
        DawaGPT AI
      </p>
    </div>
  );
}
