import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, ExternalLink } from "@/lib/icons";

interface FdaBoxedWarningBadgeProps {
  warning: string;
  drugName?: string;
  initiallyExpanded?: boolean;
  className?: string;
}

export const FdaBoxedWarningBadge: React.FC<FdaBoxedWarningBadgeProps> = ({
  warning,
  drugName,
  initiallyExpanded = false,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  if (!warning) return null;

  // Clean warning text (strip leading/trailing symbols or brackets)
  const cleanWarning = warning.replace(/^\[WARNING:?\]/i, "").trim();
  const previewText =
    cleanWarning.length > 140 && !isExpanded
      ? `${cleanWarning.slice(0, 140)}...`
      : cleanWarning;

  return (
    <div
      className={`rounded-2xl border-2 border-red-500/40 bg-gradient-to-br from-red-500/10 via-red-950/20 to-red-500/5 p-4 shadow-lg shadow-red-950/30 backdrop-blur-md transition-all ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-red-500/20 p-2.5 text-red-500 shrink-0 shadow-inner">
          <ShieldAlert size={22} className="animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-red-400 border border-red-500/30">
              <AlertTriangle size={12} /> FDA Boxed Warning
            </span>
            <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest">
              Highest FDA Tier
            </span>
          </div>

          <h4 className="text-sm font-black text-foreground tracking-tight mb-1">
            {drugName ? `Critical Safety Notice for ${drugName}` : "Mandatory Black Box Warning"}
          </h4>

          <p className="text-xs text-foreground/90 font-medium leading-relaxed mb-2">
            {previewText}
          </p>

          {cleanWarning.length > 140 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300 transition-colors focus:outline-none"
            >
              {isExpanded ? (
                <>
                  Show Less <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Read Full Clinical Warning <ChevronDown size={14} />
                </>
              )}
            </button>
          )}

          <div className="mt-3 pt-2 border-t border-red-500/20 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Source: US FDA Approved Drug Labeling</span>
            <span className="font-semibold text-red-400/90">Discuss with Doctor/Pharmacist</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FdaBoxedWarningBadge;
