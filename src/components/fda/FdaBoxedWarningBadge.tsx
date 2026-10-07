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
      className={`rounded-[18px] border border-destructive/30 bg-destructive/5 p-4.5 transition-all ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="rounded-full bg-destructive/10 border border-destructive/20 w-10 h-10 flex items-center justify-center text-destructive shrink-0">
          <ShieldAlert size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive border border-destructive/20">
              <AlertTriangle size={12} /> FDA Boxed Warning
            </span>
            <span className="text-[10px] font-semibold text-destructive/80 uppercase tracking-wider">
              Highest FDA Tier
            </span>
          </div>

          <h4 className="text-xs font-semibold text-foreground tracking-tight mb-1">
            {drugName ? `Critical Safety Notice for ${drugName}` : "Mandatory Black Box Warning"}
          </h4>

          <p className="text-xs text-foreground/80 font-normal leading-relaxed mb-2">
            {previewText}
          </p>

          {cleanWarning.length > 140 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline transition-colors focus:outline-none"
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

          <div className="mt-3 pt-2.5 border-t border-destructive/15 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Source: US FDA Approved Drug Labeling</span>
            <span className="font-semibold text-destructive">Consult Doctor / Pharmacist</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FdaBoxedWarningBadge;
