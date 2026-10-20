import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X,
  WifiOff,
  Pill,
  ShieldAlert,
  Package2,
  Bell,
  Camera,
  History,
  Users,
  Heart,
  Plane,
  FileText,
  Settings,
  ArrowRight,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";

interface DawaGPTOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActionCardItem {
  id: string;
  name: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  border: string;
  bg: string;
}

const ACTION_CARDS: ActionCardItem[] = [
  {
    id: "medications",
    name: "My Medications",
    description: "Active prescriptions & pills",
    path: "/medications",
    icon: Pill,
    color: "text-blue-500",
    border: "border-blue-500/20 hover:border-blue-500/40",
    bg: "bg-blue-500/10",
  },
  {
    id: "safety",
    name: "Safety Check",
    description: "Drug & food interactions",
    path: "/interactions",
    icon: ShieldAlert,
    color: "text-amber-500",
    border: "border-amber-500/20 hover:border-amber-500/40",
    bg: "bg-amber-500/10",
  },
  {
    id: "medvault",
    name: "Med Vault",
    description: "Inventory & refill tracking",
    path: "/medvault",
    icon: Package2,
    color: "text-emerald-500",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    bg: "bg-emerald-500/10",
  },
  {
    id: "reminders",
    name: "Reminders",
    description: "Daily alarms & schedules",
    path: "/reminders",
    icon: Bell,
    color: "text-orange-500",
    border: "border-orange-500/20 hover:border-orange-500/40",
    bg: "bg-orange-500/10",
  },
  {
    id: "scan",
    name: "Quick Scan",
    description: "On-device pill recognition",
    path: "/scan",
    icon: Camera,
    color: "text-cyan-500",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    bg: "bg-cyan-500/10",
  },
  {
    id: "history",
    name: "Dose History",
    description: "Adherence logs & streaks",
    path: "/history",
    icon: History,
    color: "text-sky-500",
    border: "border-sky-500/20 hover:border-sky-500/40",
    bg: "bg-sky-500/10",
  },
  {
    id: "family",
    name: "Family Hub",
    description: "Patient & dependent care",
    path: "/family",
    icon: Users,
    color: "text-teal-500",
    border: "border-teal-500/20 hover:border-teal-500/40",
    bg: "bg-teal-500/10",
  },
  {
    id: "wellness",
    name: "Wellness Hub",
    description: "Vitals, mood & symptom logs",
    path: "/wellness",
    icon: Heart,
    color: "text-rose-500",
    border: "border-rose-500/20 hover:border-rose-500/40",
    bg: "bg-rose-500/10",
  },
  {
    id: "travel",
    name: "Travel Companion",
    description: "DRA contacts & timezone shifts",
    path: "/travel",
    icon: Plane,
    color: "text-indigo-500",
    border: "border-indigo-500/20 hover:border-indigo-500/40",
    bg: "bg-indigo-500/10",
  },
  {
    id: "report",
    name: "Care Report",
    description: "Adherence analytics & PDF",
    path: "/report",
    icon: FileText,
    color: "text-violet-500",
    border: "border-violet-500/20 hover:border-violet-500/40",
    bg: "bg-violet-500/10",
  },
  {
    id: "settings",
    name: "Settings",
    description: "Profile, sync & preferences",
    path: "/settings",
    icon: Settings,
    color: "text-slate-500",
    border: "border-slate-500/20 hover:border-slate-500/40",
    bg: "bg-slate-500/10",
  },
];

export function DawaGPTOfflineModal({ isOpen, onClose }: DawaGPTOfflineModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    NativeService.haptics.impact(ImpactStyle.Light);
    onClose();
    navigate(path);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full max-w-xl bg-card border border-border/80 rounded-t-[28px] sm:rounded-[28px] shadow-2xl p-5 sm:p-6 overflow-hidden max-h-[90vh] flex flex-col z-10"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
                <WifiOff size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                  DawaGPT is Offline
                </h2>
                <p className="text-xs text-muted-foreground font-normal">
                  Internet connection required for conversational AI
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close offline modal"
              className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Subtitle Banner */}
          <div className="my-3 p-3 rounded-2xl bg-muted/40 border border-border/40 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground font-medium">All 11 local health tools remain fully functional offline.</strong> Tap any feature below to continue managing your care:
            </p>
          </div>

          {/* Quick Action Cards Grid (All 11 Features) */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 py-1 scrollbar-thin scrollbar-thumb-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACTION_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    onClick={() => handleNavigate(card.path)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${card.border} ${card.bg} text-left transition-all hover:scale-[1.01] active:scale-[0.99] group`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center shrink-0 ${card.color} shadow-xs group-hover:scale-105 transition-transform`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {card.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate font-normal">
                        {card.description}
                      </p>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Dismiss Button */}
          <div className="pt-3 border-t border-border/50 mt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full rounded-2xl h-11 text-xs font-semibold"
            >
              Dismiss
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default DawaGPTOfflineModal;
