import React from "react";
import { motion } from "framer-motion";
import { Bot, ArrowRight, Sparkles, ShieldAlert } from "@/lib/icons";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";

export interface MobileWatchdogResolveButtonProps {
  onClick: () => void;
  conflictCount?: number;
  label?: string;
  variant?: "card" | "floating" | "compact";
  className?: string;
  isCritical?: boolean;
}

/**
 * Mobile-optimized equivalent of the Global Watchdog "Ask DawaGPT to Resolve" action.
 * Engineered with 48px+ touch targets, native haptics, spring animations, and glow effects.
 */
export const MobileWatchdogResolveButton: React.FC<MobileWatchdogResolveButtonProps> = ({
  onClick,
  conflictCount,
  label = "Ask DawaGPT to Resolve",
  variant = "card",
  className = "",
  isCritical = true,
}) => {
  const handleClick = () => {
    NativeService.haptics.impact(isCritical ? ImpactStyle.Heavy : ImpactStyle.Medium);
    onClick();
  };

  // ─── 1. FLOATING BOTTOM DOCK VARIANT ───
  if (variant === "floating") {
    return (
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className={`fixed bottom-[5.5rem] left-4 right-4 z-40 max-w-md mx-auto pointer-events-auto ${className}`}
      >
        <button
          onClick={handleClick}
          type="button"
          aria-label={label}
          className={`w-full h-14 px-5 rounded-2xl flex items-center justify-between shadow-xl transition-all active:scale-[0.98] select-none touch-manipulation border backdrop-blur-xl ${
            isCritical
              ? "bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white border-red-400/40 shadow-[0_8px_25px_rgba(239,68,68,0.45)]"
              : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white border-amber-300/40 shadow-[0_8px_25px_rgba(245,158,11,0.4)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner shrink-0">
              <Bot size={20} className="animate-pulse" />
            </div>
            <div className="text-left leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                  {isCritical ? "Watchdog Alert" : "Safety Alert"}
                </span>
                {typeof conflictCount === "number" && conflictCount > 0 && (
                  <span className="bg-black/25 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {conflictCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-black tracking-tight drop-shadow-sm">
                {label}
              </span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <ArrowRight size={16} className="text-white" />
          </div>
        </button>
      </motion.div>
    );
  }

  // ─── 2. COMPACT HEADER PILL VARIANT ───
  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        type="button"
        aria-label={label}
        className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95 shadow-md touch-manipulation ${
          isCritical
            ? "bg-red-600 hover:bg-red-500 shadow-red-600/30"
            : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30"
        } ${className}`}
      >
        <Bot size={15} />
        <span>{label}</span>
        <ArrowRight size={12} />
      </button>
    );
  }

  // ─── 3. CARD / INLINE TOUCH VARIANT (DEFAULT) ───
  return (
    <button
      onClick={handleClick}
      type="button"
      aria-label={label}
      className={`w-full min-h-[48px] py-3 px-4 rounded-xl text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] select-none touch-manipulation shadow-md ${
        isCritical
          ? "bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 border border-red-400/30 shadow-[0_4px_16px_rgba(239,68,68,0.35)]"
          : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 border border-amber-300/30 shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
      } ${className}`}
    >
      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
        <Bot size={15} className="text-white" />
      </div>
      <span className="tracking-wide">{label}</span>
      <ArrowRight size={14} className="text-white/80 shrink-0 ml-0.5" />
    </button>
  );
};

export default MobileWatchdogResolveButton;
