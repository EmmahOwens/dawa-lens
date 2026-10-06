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
      <aside className="w-[72px] border-l border-border bg-card/60 backdrop-blur-xl flex flex-col h-screen sticky top-0 overflow-hidden items-center py-6 transition-all duration-300 justify-between">
        <div className="flex flex-col items-center">
          <button
            onClick={() => setIsIntelligenceCollapsed(false)}
            aria-label="Expand intelligence panel"
            className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-foreground mb-8 transition-colors active:scale-95"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col gap-6 opacity-40 text-muted-foreground">
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
            className="relative w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            <Bot size={18} />
          </button>
          <Info size={16} className="text-muted-foreground/30 mb-2" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[360px] border-l border-border bg-card/60 backdrop-blur-xl flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-300 shadow-xs">

      {/* Header with Collapse Button */}
      <div className="p-4 px-5 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-border p-0.5 bg-card">
              <img src="/dawa-gpt.png" alt="Intelligence" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-background rounded-full flex items-center justify-center">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-tight text-foreground leading-none">Intelligence</h2>
            <span className="text-[10px] text-muted-foreground font-medium mt-0.5 block">Live Health Context</span>
          </div>
        </div>
        <button
          onClick={() => setIsIntelligenceCollapsed(true)}
          aria-label="Collapse panel"
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Main Scrollable Contextual Widgets Area */}
      <div className="p-5 space-y-5 overflow-y-auto flex-1 no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ErrorBoundary
              fallback={
                <div className="p-4 rounded-[18px] bg-destructive/5 border border-destructive/20 text-center">
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

  return (
    <div className="px-4 pb-4 pt-2 border-t border-border bg-card/80 backdrop-blur-xl shrink-0 z-20">
      <div className="relative flex items-center justify-center py-2">
        {/* Floating popup phrase */}
        <AnimatePresence mode="wait">
          {visible && (
            <motion.div
              key={phrase}
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 pointer-events-none z-30"
            >
              <div className="bg-foreground text-background text-[11px] font-medium px-3.5 py-1.5 rounded-full shadow-md whitespace-nowrap">
                {phrase}
                {/* tail */}
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-foreground rotate-45" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Action Blue Bot icon button */}
        <button
          onClick={() => onLaunch()}
          disabled={!isOnline}
          aria-label="Open DawaGPT AI"
          className="relative w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Bot size={22} />

          {/* Online dot */}
          <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background flex items-center justify-center ${isOnline ? "bg-emerald-500" : "bg-amber-400"}`} />
        </button>
      </div>

      {/* Sub-label */}
      <p className="text-center text-[10px] font-medium text-muted-foreground select-none">
        Ask DawaGPT
      </p>
    </div>
  );
}
