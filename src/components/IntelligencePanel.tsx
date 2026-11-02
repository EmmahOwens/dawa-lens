import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, LayoutDashboard, Scan, Heart,
  History, Settings, Info, Sparkles, Bot, AlertCircle
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


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
            className="relative w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center shadow-xs hover:border-primary/50 hover:shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            <img
              src="/dawa-gpt.webp"
              alt="DawaGPT"
              className="w-full h-full object-contain p-1 rounded-full transition-transform group-hover:scale-105"
            />
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
              <img src="/dawa-gpt.webp" alt="Intelligence" className="w-full h-full object-cover rounded-full" />
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

      {/* Pinned Bottom DawaGPT AI — Compact Card */}
      <DawaGPTMiniButton onLaunch={handleLaunch} isOnline={isOnline} />

    </aside>
  );
}

// ---------------------------------------------------------------------------
// DawaGPT Footer Card — compact card matching the account section design
// ---------------------------------------------------------------------------
function DawaGPTMiniButton({
  onLaunch,
  isOnline,
}: {
  onLaunch: () => void;
  isOnline: boolean;
}) {
  return (
    <div className="p-3 border-t border-border bg-card/80 backdrop-blur-xl shrink-0 z-20">
      <button
        onClick={() => onLaunch()}
        disabled={!isOnline}
        aria-label="Open DawaGPT AI"
        className="w-full flex items-center gap-2.5 rounded-2xl p-2 bg-card border border-border hover:border-primary/50 hover:bg-muted/40 transition-all text-left shadow-xs active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
      >
        <div className="relative shrink-0">
          <Avatar className="h-7 w-7 border border-border bg-card">
            <AvatarImage src="/dawa-gpt.webp" alt="DawaGPT" className="p-0.5 object-contain" />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-[11px]">
              D
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${
              isOnline ? "bg-emerald-500" : "bg-amber-400"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
          <div className="min-w-0">
            <p className="text-[12px] font-medium truncate text-foreground group-hover:text-primary transition-colors">
              DawaGPT
            </p>
            <div className="flex items-center gap-1">
              <Sparkles size={10} className="text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">
                {isOnline ? "AI Health Copilot" : "Offline"}
              </span>
            </div>
          </div>
          <div className="shrink-0 p-1 text-muted-foreground group-hover:text-primary rounded-lg transition-colors">
            <Bot size={14} />
          </div>
        </div>
      </button>
    </div>
  );
}
