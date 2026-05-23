/**
 * PatientContextBanner
 *
 * Shown whenever the user is viewing a family member's or client's profile
 * (selectedPatientId !== null). Provides a persistent visual cue and a
 * one-tap "Exit" button to return to the host's own profile.
 */

import { AnimatePresence, motion } from "framer-motion";
import { X } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";

/** Maps patient color keys to Tailwind class bundles */
const COLOR_SCHEMES: Record<
  string,
  { bg: string; border: string; text: string; dot: string; exit: string }
> = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/25",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    exit: "hover:bg-blue-500/20",
  },
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/25",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
    exit: "hover:bg-rose-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    exit: "hover:bg-amber-500/20",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    exit: "hover:bg-emerald-500/20",
  },
  violet: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/25",
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
    exit: "hover:bg-violet-500/20",
  },
  slate: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/25",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-500",
    exit: "hover:bg-slate-500/20",
  },
};

const DEFAULT_SCHEME = {
  bg: "bg-primary/10",
  border: "border-primary/25",
  text: "text-primary",
  dot: "bg-primary",
  exit: "hover:bg-primary/20",
};

export function PatientContextBanner() {
  const { selectedPatientId, setSelectedPatientId } = useApp();
  const { resolvedPatient } = usePatientScope();

  // Only render when viewing a managed patient
  if (!selectedPatientId) return null;

  const scheme =
    resolvedPatient.color && COLOR_SCHEMES[resolvedPatient.color]
      ? COLOR_SCHEMES[resolvedPatient.color]
      : DEFAULT_SCHEME;

  // Up to 2 initials from the name
  const initials = resolvedPatient.name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const typeBadge = resolvedPatient.type === "client" ? "Client" : "Family";

  return (
    <AnimatePresence>
      <motion.div
        key="patient-banner"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div
          className={`flex items-center justify-between px-4 py-2 border-b ${scheme.bg} ${scheme.border}`}
        >
          {/* Left: avatar + name info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-full ${scheme.dot} flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 shadow-sm`}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${scheme.text} truncate leading-tight`}
              >
                Viewing {resolvedPatient.name}&apos;s Profile
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 leading-tight">
                {typeBadge}
                {resolvedPatient.relation
                  ? ` · ${resolvedPatient.relation}`
                  : ""}
                {resolvedPatient.age ? ` · ${resolvedPatient.age} yrs` : ""}
              </p>
            </div>
          </div>

          {/* Right: exit button */}
          <button
            onClick={() => setSelectedPatientId(null)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${scheme.text} ${scheme.bg} border ${scheme.border} ${scheme.exit} flex-shrink-0`}
          >
            <X size={10} />
            Exit
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
