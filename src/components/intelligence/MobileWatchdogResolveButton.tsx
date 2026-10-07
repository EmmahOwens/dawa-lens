import React from "react";
import { motion } from "framer-motion";
import { Bot, ArrowRight } from "@/lib/icons";
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
 * Mobile-optimized Watchdog resolution button.
 * Follows Apple HIG: 44px min touch target, pill geometry, solid semantic fill, active scale.
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
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed bottom-[5.5rem] left-4 right-4 z-40 max-w-md mx-auto pointer-events-auto ${className}`}
      >
        <button
          onClick={handleClick}
          type="button"
          aria-label={label}
          className={`w-full min-h-[48px] px-5 rounded-full flex items-center justify-between border shadow-lg transition-transform active:scale-95 select-none touch-manipulation backdrop-blur-xl ${
            isCritical
              ? "bg-destructive text-destructive-foreground border-destructive/30"
              : "bg-amber-600 text-white border-amber-500/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="text-left leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                  {isCritical ? "Watchdog Alert" : "Safety Alert"}
                </span>
                {typeof conflictCount === "number" && conflictCount > 0 && (
                  <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    {conflictCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tracking-tight">
                {label}
              </span>
            </div>
          </div>

          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <ArrowRight size={14} className="text-white" />
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
        className={`inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-semibold text-white transition-transform active:scale-95 shadow-sm touch-manipulation ${
          isCritical
            ? "bg-destructive hover:bg-destructive/90"
            : "bg-amber-600 hover:bg-amber-500"
        } ${className}`}
      >
        <Bot size={14} />
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
      className={`w-full min-h-[44px] py-2.5 px-4 rounded-full text-white text-xs font-semibold flex items-center justify-center gap-2 transition-transform duration-150 active:scale-95 select-none touch-manipulation shadow-sm ${
        isCritical
          ? "bg-destructive hover:bg-destructive/90 border border-destructive/30"
          : "bg-amber-600 hover:bg-amber-500 border border-amber-500/30"
      } ${className}`}
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
        <Bot size={13} className="text-white" />
      </div>
      <span className="tracking-tight">{label}</span>
      <ArrowRight size={13} className="text-white/80 shrink-0 ml-0.5" />
    </button>
  );
};

export default MobileWatchdogResolveButton;
