import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, Patient, Medicine, Reminder } from "@/contexts/AppContext";
import {
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  AlertCircle,
  Baby,
  UserRound,
  UserPlus,
  Pill,
  Bell,
  History as HistoryIcon,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Activity,
  Heart,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { toDate } from "@/lib/utils";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

/**
 * Apple Design System Palette for Family / Care Profiles
 * Conforms strictly to DESIGN.md:
 * - Single Action Blue (#0066cc / #2997ff) for primary interactive actions
 * - Curated Apple Health / SF Symbols pastel hues for profile identity
 * - No decorative gradients, no shadows on chrome, flat hairline borders
 */
export const PROFILE_COLOR_PALETTE: Record<
  string,
  {
    name: string;
    dot: string;
    bgLight: string;
    border: string;
    text: string;
    badge: string;
    solid: string;
    ring: string;
    accentBar: string;
  }
> = {
  blue: {
    name: "Action Blue",
    dot: "bg-[#0066cc] dark:bg-[#2997ff]",
    bgLight: "bg-[#0066cc]/[0.08] dark:bg-[#2997ff]/[0.12]",
    border: "border-[#0066cc]/30 dark:border-[#2997ff]/35",
    text: "text-[#0066cc] dark:text-[#2997ff]",
    badge: "bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] border-[#0066cc]/25",
    solid: "bg-[#0066cc] dark:bg-[#0071e3] text-white",
    ring: "ring-[#0066cc] dark:ring-[#2997ff]",
    accentBar: "bg-[#0066cc] dark:bg-[#2997ff]",
  },
  emerald: {
    name: "Health Green",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    bgLight: "bg-emerald-500/[0.08] dark:bg-emerald-400/[0.12]",
    border: "border-emerald-500/30 dark:border-emerald-400/35",
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    solid: "bg-emerald-600 dark:bg-emerald-500 text-white",
    ring: "ring-emerald-500 dark:ring-emerald-400",
    accentBar: "bg-emerald-500 dark:bg-emerald-400",
  },
  rose: {
    name: "Coral Rose",
    dot: "bg-rose-500 dark:bg-rose-400",
    bgLight: "bg-rose-500/[0.08] dark:bg-rose-400/[0.12]",
    border: "border-rose-500/30 dark:border-rose-400/35",
    text: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
    solid: "bg-rose-600 dark:bg-rose-500 text-white",
    ring: "ring-rose-500 dark:ring-rose-400",
    accentBar: "bg-rose-500 dark:bg-rose-400",
  },
  amber: {
    name: "Warm Amber",
    dot: "bg-amber-500 dark:bg-amber-400",
    bgLight: "bg-amber-500/[0.08] dark:bg-amber-400/[0.12]",
    border: "border-amber-500/30 dark:border-amber-400/35",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
    solid: "bg-amber-600 dark:bg-amber-500 text-white",
    ring: "ring-amber-500 dark:ring-amber-400",
    accentBar: "bg-amber-500 dark:bg-amber-400",
  },
  violet: {
    name: "Royal Violet",
    dot: "bg-violet-500 dark:bg-violet-400",
    bgLight: "bg-violet-500/[0.08] dark:bg-violet-400/[0.12]",
    border: "border-violet-500/30 dark:border-violet-400/35",
    text: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25",
    solid: "bg-violet-600 dark:bg-violet-500 text-white",
    ring: "ring-violet-500 dark:ring-violet-400",
    accentBar: "bg-violet-500 dark:bg-violet-400",
  },
  teal: {
    name: "Pacific Teal",
    dot: "bg-teal-500 dark:bg-teal-400",
    bgLight: "bg-teal-500/[0.08] dark:bg-teal-400/[0.12]",
    border: "border-teal-500/30 dark:border-teal-400/35",
    text: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25",
    solid: "bg-teal-600 dark:bg-teal-500 text-white",
    ring: "ring-teal-500 dark:ring-teal-400",
    accentBar: "bg-teal-500 dark:bg-teal-400",
  },
  indigo: {
    name: "Royal Indigo",
    dot: "bg-indigo-500 dark:bg-indigo-400",
    bgLight: "bg-indigo-500/[0.08] dark:bg-indigo-400/[0.12]",
    border: "border-indigo-500/30 dark:border-indigo-400/35",
    text: "text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
    solid: "bg-indigo-600 dark:bg-indigo-500 text-white",
    ring: "ring-indigo-500 dark:ring-indigo-400",
    accentBar: "bg-indigo-500 dark:bg-indigo-400",
  },
  slate: {
    name: "Refined Slate",
    dot: "bg-slate-500 dark:bg-slate-400",
    bgLight: "bg-slate-500/[0.08] dark:bg-slate-400/[0.12]",
    border: "border-slate-500/30 dark:border-slate-400/35",
    text: "text-slate-600 dark:text-slate-400",
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25",
    solid: "bg-slate-600 dark:bg-slate-500 text-white",
    ring: "ring-slate-500 dark:ring-slate-400",
    accentBar: "bg-slate-500 dark:bg-slate-400",
  },
};

const DEFAULT_COLOR_KEY = "blue";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function FamilyHubPage() {
  const {
    patients,
    addPatient,
    updatePatient,
    deletePatient,
    setSelectedPatientId,
    selectedPatientId,
    userProfile,
    isProfessionalMode,
    medicines,
    reminders,
    doseLogs,
  } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const sheetSwipe = useSwipeToDismiss(() => setIsSheetOpen(false));

  const [formData, setFormData] = useState({
    name: "",
    relation: "",
    age: "",
    gender: "male" as "male" | "female",
    type: "family" as "family" | "client",
    color: "blue" as string,
    conditions: "",
    allergies: "",
  });

  // Handle "openAdd" state from dashboard navigation
  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
      handleOpenAdd();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleOpenAdd = () => {
    setEditingPatient(null);
    const initialType = isProfessionalMode ? "client" : "family";
    setFormData({
      name: "",
      relation: "",
      age: "",
      gender: "male",
      type: initialType,
      color: "blue",
      conditions: "",
      allergies: "",
    });
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (patient: Patient) => {
    setEditingPatient(patient);
    const resolvedType = patient.type ?? (isProfessionalMode ? "client" : "family");
    const resolvedGender = patient.gender === "female" ? "female" : "male";
    setFormData({
      name: patient.name,
      relation: patient.relation || "",
      age: patient.age?.toString() || "",
      gender: resolvedGender,
      type: resolvedType,
      color: patient.color ?? "blue",
      conditions: patient.conditions?.join(", ") ?? "",
      allergies: patient.allergies?.join(", ") ?? "",
    });
    setIsSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      if (editingPatient) {
        await updatePatient(editingPatient.id, {
          name: formData.name,
          relation: formData.relation,
          age: parseInt(formData.age) || undefined,
          gender: formData.gender,
          type: formData.type,
          color: formData.color || undefined,
          conditions: formData.conditions
            ? formData.conditions
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          allergies: formData.allergies
            ? formData.allergies
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        });
        toast({
          title: "Profile updated",
          description: `${formData.name}'s details have been saved.`,
        });
      } else {
        await addPatient({
          name: formData.name,
          relation: formData.relation,
          age: parseInt(formData.age) || undefined,
          gender: formData.gender,
          type: formData.type,
          color: formData.color || undefined,
          conditions: formData.conditions
            ? formData.conditions
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          allergies: formData.allergies
            ? formData.allergies
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        });
        toast({
          title: isProfessionalMode ? "Client added!" : "Family member added!",
          description: isProfessionalMode
            ? `${formData.name} has been added to your client list.`
            : `${formData.name} is now in your circle.`,
        });
      }
      setIsSheetOpen(false);
    } catch (err) {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!patientToDelete) return;
    try {
      await deletePatient(patientToDelete.id);
      toast({
        title: "Profile removed",
        description: "The profile has been deleted successfully.",
      });
      setPatientToDelete(null);
    } catch (err) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  // Compute detailed per-member and circle-wide statistics
  const memberStats = useMemo(() => {
    const today = new Date().toDateString();

    const getStats = (id: string | null) => {
      const scopedMeds = medicines.filter((m) => {
        const pId = (m as any).patientId ?? null;
        return id === null ? pId === null : pId === id;
      });

      const scopedRems = reminders.filter((r) => {
        const pId = (r as any).patientId ?? null;
        return id === null ? pId === null : pId === id;
      });

      const scopedRemIds = new Set(scopedRems.map((r) => r.id));
      const relevantLogs = doseLogs.filter((l) =>
        scopedRemIds.has(l.reminderId)
      );
      const takenCount = relevantLogs.filter(
        (l) => l.action === "taken"
      ).length;
      const missedCount = relevantLogs.filter(
        (l) => l.action === "missed"
      ).length;
      const totalLogged = takenCount + missedCount;
      const adherenceRate =
        totalLogged > 0 ? Math.round((takenCount / totalLogged) * 100) : null;

      const missedToday = doseLogs.filter(
        (l) =>
          scopedRemIds.has(l.reminderId) &&
          l.action === "missed" &&
          toDate(l.actionTime).toDateString() === today
      ).length;

      return {
        meds: scopedMeds.length,
        reminders: scopedRems.length,
        adherenceRate,
        missedToday,
      };
    };

    const statsMap: Record<
      string,
      {
        meds: number;
        reminders: number;
        adherenceRate: number | null;
        missedToday: number;
      }
    > = {};

    statsMap["self"] = getStats(null);
    patients.forEach((p) => {
      statsMap[p.id] = getStats(p.id);
    });

    return statsMap;
  }, [medicines, reminders, doseLogs, patients]);

  // Overall circle pulse metrics
  const circleOverview = useMemo(() => {
    let totalMeds = 0;
    let totalReminders = 0;
    let totalMissedToday = 0;
    const rates: number[] = [];

    Object.values(memberStats).forEach((s) => {
      totalMeds += s.meds;
      totalReminders += s.reminders;
      totalMissedToday += s.missedToday;
      if (s.adherenceRate !== null) {
        rates.push(s.adherenceRate);
      }
    });

    const averageAdherence =
      rates.length > 0
        ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
        : null;

    return {
      totalProfiles: patients.length + 1,
      totalMeds,
      totalReminders,
      totalMissedToday,
      averageAdherence,
    };
  }, [memberStats, patients]);

  const activePatient = selectedPatientId
    ? patients.find((p) => p.id === selectedPatientId) || null
    : null;

  const currentSelection = activePatient || {
    name: userProfile?.name || "Self",
    id: null,
    relation: "Primary User",
    color: "blue",
    age: undefined,
    gender: "male",
    type: "family" as const,
    conditions: [] as string[],
    allergies: [] as string[],
  };

  const activeStats = (selectedPatientId && memberStats[selectedPatientId])
    ? memberStats[selectedPatientId]
    : memberStats["self"];

  // Active theme color scheme
  const activeColorKey = selectedPatientId === null
    ? "blue"
    : (activePatient?.color || DEFAULT_COLOR_KEY);
  const activeScheme = PROFILE_COLOR_PALETTE[activeColorKey] || PROFILE_COLOR_PALETTE.blue;

  const getStatusColor = (status: { adherenceRate: number | null; missedToday: number }) => {
    if (status.missedToday > 0) return "destructive";
    if (status.adherenceRate === null) return "neutral";
    if (status.adherenceRate >= 80) return "green";
    if (status.adherenceRate >= 50) return "amber";
    return "destructive";
  };

  return (
    <div className="w-full pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.022em] text-foreground">
              {isProfessionalMode ? "Client Hub" : "Family Hub"}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80 mt-1">
              {circleOverview.totalProfiles} Profiles Active • Caregiver Circle
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="w-10 h-10 rounded-full bg-[#0066cc] dark:bg-[#0071e3] text-white flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Add new profile"
          >
            <UserPlus size={18} />
          </button>
        </div>
      </motion.div>

      {/* Circle Health Pulse Overview Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5"
      >
        <div className="p-3.5 rounded-[14px] bg-[#fafafc] dark:bg-[#272729] border border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shrink-0">
            <UserRound size={17} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Circle
            </p>
            <p className="text-base font-bold text-foreground leading-tight">
              {circleOverview.totalProfiles} {circleOverview.totalProfiles === 1 ? "Profile" : "Profiles"}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-[14px] bg-[#fafafc] dark:bg-[#272729] border border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shrink-0">
            <Pill size={17} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Medications
            </p>
            <p className="text-base font-bold text-foreground leading-tight">
              {circleOverview.totalMeds} Active
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-[14px] bg-[#fafafc] dark:bg-[#272729] border border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp size={17} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Circle Rate
            </p>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
              {circleOverview.averageAdherence !== null ? `${circleOverview.averageAdherence}%` : "—"}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-[14px] bg-[#fafafc] dark:bg-[#272729] border border-border flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            circleOverview.totalMissedToday > 0
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}>
            <AlertTriangle size={17} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Missed Today
            </p>
            <p className={`text-base font-bold leading-tight ${
              circleOverview.totalMissedToday > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            }`}>
              {circleOverview.totalMissedToday}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Circle of Care - Horizontal Avatar Switcher Strip */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Circle of Care Switcher
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            Tap to select profile
          </span>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {/* Host / Self Avatar */}
          <button
            onClick={() => setSelectedPatientId(null)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group active:scale-95 transition-transform"
          >
            <div
              className={`relative w-12 h-12 rounded-full p-0.5 transition-all ${
                selectedPatientId === null
                  ? "ring-2 ring-[#0066cc] dark:ring-[#2997ff] ring-offset-2 ring-offset-background scale-105"
                  : "opacity-80 group-hover:opacity-100"
              }`}
            >
              <div className="w-full h-full rounded-full bg-[#0066cc] dark:bg-[#0071e3] text-white flex items-center justify-center font-bold text-sm">
                {(userProfile?.name || "You").charAt(0).toUpperCase()}
              </div>
              <div
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${
                  memberStats["self"]?.missedToday > 0
                    ? "bg-rose-500"
                    : (memberStats["self"]?.adherenceRate ?? 0) >= 80
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/50"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-bold tracking-tight truncate max-w-[56px] ${
                selectedPatientId === null ? "text-[#0066cc] dark:text-[#2997ff]" : "text-muted-foreground"
              }`}
            >
              You
            </span>
          </button>

          {/* Patient Avatars with Custom Color Badges */}
          {patients.map((p) => {
            const pScheme = PROFILE_COLOR_PALETTE[p.color || DEFAULT_COLOR_KEY] || PROFILE_COLOR_PALETTE.blue;
            const pStats = memberStats[p.id];
            const isSelected = selectedPatientId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group active:scale-95 transition-transform"
              >
                <div
                  className={`relative w-12 h-12 rounded-full p-0.5 transition-all ${
                    isSelected
                      ? `ring-2 ${pScheme.ring} ring-offset-2 ring-offset-background scale-105`
                      : "opacity-80 group-hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-full ${pScheme.solid} flex items-center justify-center font-bold text-sm shadow-xs`}
                  >
                    {typeof p.age === "number" && p.age < 12 ? (
                      <Baby size={18} />
                    ) : (
                      (p.name || "P").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${
                      (pStats?.missedToday ?? 0) > 0
                        ? "bg-rose-500"
                        : (pStats?.adherenceRate ?? 0) >= 80
                        ? "bg-emerald-500"
                        : (pStats?.adherenceRate ?? 0) >= 50
                        ? "bg-amber-500"
                        : "bg-muted-foreground/50"
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] font-bold tracking-tight truncate max-w-[64px] ${
                    isSelected ? pScheme.text : "text-muted-foreground"
                  }`}
                >
                  {p.name.split(" ")[0]}
                </span>
              </button>
            );
          })}

          {/* Add Member Shortcut Button */}
          <button
            onClick={handleOpenAdd}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity active:scale-95"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-border hover:border-[#0066cc] dark:hover:border-[#2997ff] flex items-center justify-center text-muted-foreground hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors">
              <Plus size={18} />
            </div>
            <span className="text-[10px] font-bold tracking-tight text-muted-foreground">
              Add
            </span>
          </button>
        </div>
      </div>

      {/* Active Member Spotlight Hero Card */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-8 rounded-[18px] border border-border bg-[#fafafc] dark:bg-[#272729] relative overflow-hidden transition-colors"
      >
        {/* Accent Top Color Bar */}
        <div className={`h-1.5 w-full ${activeScheme.accentBar}`} />

        <div className="p-6 relative z-10">
          {/* Profile Header Row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-[16px] ${activeScheme.solid} flex items-center justify-center shadow-xs shrink-0`}
              >
                {(() => {
                  const pat = patients.find((p) => p.id === selectedPatientId);
                  return pat && typeof pat.age === "number" && pat.age < 12 ? (
                    <Baby size={28} />
                  ) : (
                    <UserRound size={28} />
                  );
                })()}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeScheme.dot}`} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${activeScheme.text}`}>
                    Managing Active Profile
                  </p>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.015em] text-foreground">
                  {currentSelection.name}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${activeScheme.badge}`}>
                    {(currentSelection as any).relation || (isProfessionalMode ? "Client" : "Family")}
                  </span>
                  {(currentSelection as any).age && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground">
                      {(currentSelection as any).age} yrs • {(currentSelection as any).gender || "male"}
                    </span>
                  )}
                  {selectedPatientId === null && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground">
                      Host Account
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selectedPatientId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground active:scale-95">
                    <MoreVertical size={18} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-2xl p-2 min-w-[160px] border-border bg-card"
                >
                  <DropdownMenuItem
                    className="rounded-xl p-2.5 focus:bg-primary/5 focus:text-primary cursor-pointer gap-2 font-semibold text-xs"
                    onClick={() => {
                      const p = patients.find((p) => p.id === selectedPatientId);
                      if (p) handleOpenEdit(p);
                    }}
                  >
                    <Edit2 size={14} /> Edit Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-xl p-2.5 focus:bg-destructive/5 focus:text-destructive text-destructive cursor-pointer gap-2 font-semibold text-xs"
                    onClick={() => {
                      const p = patients.find((p) => p.id === selectedPatientId);
                      if (p) setPatientToDelete(p);
                    }}
                  >
                    <Trash2 size={14} /> Delete Profile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Clinical Profile Chips: Chronic Conditions & Allergies */}
          {activePatient && ((activePatient.conditions && activePatient.conditions.length > 0) || (activePatient.allergies && activePatient.allergies.length > 0)) && (
            <div className="mb-5 p-3 rounded-[12px] bg-card border border-border flex flex-wrap gap-2 items-center">
              {activePatient.conditions && activePatient.conditions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Activity size={12} className="text-violet-500" /> Conditions:
                  </span>
                  {activePatient.conditions.map((c, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {activePatient.allergies && activePatient.allergies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 ml-0 sm:ml-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <AlertTriangle size={12} className="text-rose-500" /> Allergies:
                  </span>
                  {activePatient.allergies.map((a, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4 Semantic Health Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {/* Medicines Count */}
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center">
                  <Pill size={11} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Medicines
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {activeStats?.meds ?? 0}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                Prescriptions active
              </p>
            </div>

            {/* Reminders Count */}
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Bell size={11} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Reminders
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {activeStats?.reminders ?? 0}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                Daily alerts set
              </p>
            </div>

            {/* Adherence Rate */}
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp size={11} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Adherence
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p
                  className={`text-2xl font-bold ${
                    activeStats?.adherenceRate === null
                      ? "text-muted-foreground"
                      : activeStats.adherenceRate >= 80
                      ? "text-emerald-600 dark:text-emerald-400"
                      : activeStats.adherenceRate >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {activeStats?.adherenceRate !== null &&
                  activeStats?.adherenceRate !== undefined
                    ? `${activeStats.adherenceRate}%`
                    : "—"}
                </p>
              </div>
              {/* Apple Health-inspired Adherence Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    activeStats?.adherenceRate === null
                      ? "bg-transparent"
                      : activeStats.adherenceRate >= 80
                      ? "bg-emerald-500"
                      : activeStats.adherenceRate >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${activeStats?.adherenceRate ?? 0}%` }}
                />
              </div>
            </div>

            {/* Missed Today */}
            <div className="p-3.5 rounded-[14px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    activeStats?.missedToday
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <AlertTriangle size={11} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Missed
                </span>
              </div>
              <p
                className={`text-2xl font-bold ${
                  activeStats?.missedToday
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-foreground"
                }`}
              >
                {activeStats?.missedToday ?? 0}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                {activeStats?.missedToday ? "Attention needed" : "All taken today"}
              </p>
            </div>
          </div>

          {/* Action CTAs strictly conforming to DESIGN.md pill grammar */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/reminders")}
              className="rounded-full h-11 text-xs font-semibold gap-1.5 border-border bg-card text-foreground hover:bg-secondary active:scale-95 transition-transform"
            >
              <Bell size={13} className="text-[#0066cc] dark:text-[#2997ff]" /> View Reminders
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/history")}
              className="rounded-full h-11 text-xs font-semibold gap-1.5 border-border bg-card text-foreground hover:bg-secondary active:scale-95 transition-transform"
            >
              <HistoryIcon size={13} className="text-[#0066cc] dark:text-[#2997ff]" /> Health History
            </Button>
            <Button
              onClick={() =>
                navigate("/reminders/new", {
                  state: {
                    patientId: selectedPatientId,
                    patientName: selectedPatientId
                      ? patients.find((p) => p.id === selectedPatientId)?.name
                      : null,
                  },
                })
              }
              className="col-span-2 rounded-full h-12 text-xs font-semibold gap-1.5 bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 active:scale-95 transition-transform shadow-none border-0"
            >
              <Plus size={16} /> Add Medication Schedule
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Circle Directory */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title mb-0">
            {isProfessionalMode ? "Client Directory" : "Circle Members"}
          </h3>
          <span className="text-xs font-semibold text-muted-foreground">
            {patients.length + 1} Managed
          </span>
        </div>

        {patients.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-[18px] border border-dashed border-border bg-[#fafafc] dark:bg-[#272729] text-center"
          >
            <div className="w-14 h-14 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/15 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] mx-auto mb-4">
              <Sparkles size={24} />
            </div>
            <h4 className="text-lg font-bold tracking-tight mb-1 text-foreground">
              Expand Your Circle
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6 px-4 max-w-sm mx-auto">
              Manage health schedules, medications, and adherence alerts for your family or clients in one synchronized hub.
            </p>
            <Button
              onClick={handleOpenAdd}
              className="rounded-full px-6 h-11 text-xs font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white active:scale-95 gap-2"
            >
              <UserPlus size={15} /> Add First Member
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-3"
          >
            {/* Host Account Card */}
            <motion.div
              variants={item}
              onClick={() => setSelectedPatientId(null)}
              className={`p-4 sm:p-5 rounded-[18px] border transition-all cursor-pointer relative ${
                selectedPatientId === null
                  ? "border-[#0066cc] dark:border-[#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.08]"
                  : "border-border bg-card hover:border-foreground/20"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-base transition-all ${
                    selectedPatientId === null
                      ? "bg-[#0066cc] dark:bg-[#0071e3] text-white"
                      : "bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff]"
                  }`}
                >
                  <UserRound size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-foreground tracking-tight truncate">
                      {userProfile?.name || "You (Primary Account)"}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#0066cc]/25 bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] shrink-0">
                      Primary User
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {memberStats["self"]?.meds ?? 0} Meds • {memberStats["self"]?.reminders ?? 0} Reminders
                    </span>
                    {memberStats["self"]?.adherenceRate !== null &&
                      memberStats["self"]?.adherenceRate !== undefined && (
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            memberStats["self"].adherenceRate >= 80
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {memberStats["self"].adherenceRate}% Adherence
                        </span>
                      )}
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`transition-transform shrink-0 ${
                    selectedPatientId === null
                      ? "translate-x-0.5 text-[#0066cc] dark:text-[#2997ff]"
                      : "text-muted-foreground opacity-40"
                  }`}
                />
              </div>
            </motion.div>

            {/* Individual Patient Cards with Unique Color Identity */}
            {patients.map((patient) => {
              const pScheme = PROFILE_COLOR_PALETTE[patient.color || DEFAULT_COLOR_KEY] || PROFILE_COLOR_PALETTE.blue;
              const pStats = memberStats[patient.id];
              const isSelected = selectedPatientId === patient.id;

              return (
                <motion.div
                  key={patient.id}
                  variants={item}
                  className={`p-4 sm:p-5 rounded-[18px] border transition-all cursor-pointer relative ${
                    isSelected
                      ? `${pScheme.border} ${pScheme.bgLight}`
                      : "border-border bg-card hover:border-foreground/20"
                  }`}
                  onClick={() => setSelectedPatientId(patient.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-base transition-all ${
                        isSelected
                          ? `${pScheme.solid} shadow-xs`
                          : `${pScheme.bgLight} ${pScheme.text} border ${pScheme.border}`
                      }`}
                    >
                      {typeof patient.age === "number" && patient.age < 12 ? (
                        <Baby size={22} />
                      ) : (
                        <UserRound size={22} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <p className="text-base font-bold text-foreground tracking-tight truncate">
                            {patient.name}
                          </p>
                          {patient.age && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              ({patient.age} yrs)
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${pScheme.badge} shrink-0`}>
                          {patient.relation || (isProfessionalMode ? "Client" : "Family")}
                        </span>
                      </div>

                      {/* Clinical Badges Preview (Conditions & Allergies) */}
                      {((patient.conditions && patient.conditions.length > 0) || (patient.allergies && patient.allergies.length > 0)) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {patient.conditions?.slice(0, 2).map((c, i) => (
                            <span
                              key={i}
                              className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20"
                            >
                              {c}
                            </span>
                          ))}
                          {patient.allergies?.slice(0, 2).map((a, i) => (
                            <span
                              key={i}
                              className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                            >
                              Allergy: {a}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {pStats?.meds ?? 0} Meds • {pStats?.reminders ?? 0} Reminders
                        </span>
                        {pStats?.adherenceRate !== null && pStats?.adherenceRate !== undefined && (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              pStats.adherenceRate >= 80
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : pStats.adherenceRate >= 50
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {pStats.adherenceRate}% Adherence
                          </span>
                        )}
                        {(pStats?.missedToday ?? 0) > 0 && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                            <AlertTriangle size={8} /> {pStats.missedToday} missed today
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`transition-transform shrink-0 ${
                        isSelected ? `translate-x-0.5 ${pScheme.text}` : "text-muted-foreground opacity-40"
                      }`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Add / Edit Profile Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="bottom"
          className="w-full max-w-lg mx-auto rounded-t-3xl p-6 sm:p-8 max-h-[90dvh] border border-border border-b-0 shadow-2xl overflow-y-auto no-scrollbar bg-background"
          {...sheetSwipe}
        >
          <div className="w-12 h-1.5 rounded-full bg-muted/70 hover:bg-muted mx-auto -mt-2 mb-6 transition-colors" />
          <SheetHeader className="text-left mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-12 h-12 rounded-2xl ${
                  (PROFILE_COLOR_PALETTE[formData.color] || PROFILE_COLOR_PALETTE.blue).solid
                } flex items-center justify-center text-white shadow-xs`}
              >
                {editingPatient ? <Edit2 size={22} /> : <UserPlus size={22} />}
              </div>
              <div>
                <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                  {editingPatient ? "Edit Profile" : "Add to Circle"}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {editingPatient
                    ? `Updating details for ${editingPatient.name}`
                    : "Create a distinct health profile for your family member."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Color Palette Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Profile Signature Color
                </label>
                <span className="text-[11px] font-semibold text-foreground capitalize">
                  {PROFILE_COLOR_PALETTE[formData.color]?.name || formData.color}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {Object.entries(PROFILE_COLOR_PALETTE).map(([key, item]) => {
                  const isSelected = formData.color === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: key })}
                      className={`h-11 rounded-[12px] flex items-center gap-2 px-2.5 transition-all border ${
                        isSelected
                          ? `${item.border} ${item.bgLight} ${item.text} font-bold ring-2 ${item.ring}`
                          : "border-border bg-card text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${item.dot} shrink-0`} />
                      <span className="text-xs truncate">{item.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Full Name
              </label>
              <input
                autoFocus
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-[#0066cc] dark:focus:border-[#2997ff] transition-colors font-medium text-sm"
                placeholder="e.g. John Doe"
              />
            </div>

            {/* Relation & Age */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Relation
                </label>
                <input
                  value={formData.relation}
                  onChange={(e) =>
                    setFormData({ ...formData, relation: e.target.value })
                  }
                  className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-[#0066cc] dark:focus:border-[#2997ff] transition-colors font-medium text-sm"
                  placeholder={
                    isProfessionalMode ? "e.g. Client" : "e.g. Mother, Son"
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Age
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-[#0066cc] dark:focus:border-[#2997ff] transition-colors font-medium text-sm"
                  placeholder="Years"
                />
              </div>
            </div>

            {/* Gender Segmented Control */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Gender
              </label>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, gender: g })
                    }
                    className={`flex-1 h-10 rounded-full font-semibold text-xs uppercase tracking-wider transition-all border active:scale-95 ${
                      formData.gender === g
                        ? "bg-[#0066cc] dark:bg-[#0071e3] border-[#0066cc] text-white shadow-xs"
                        : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Type Toggle */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Profile Type
              </label>
              <div className="flex gap-2">
                {(["family", "client"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    className={`flex-1 h-10 rounded-full font-semibold text-xs uppercase tracking-wider transition-all border active:scale-95 ${
                      formData.type === t
                        ? "bg-[#0066cc] dark:bg-[#0071e3] border-[#0066cc] text-white shadow-xs"
                        : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {t === "family" ? "Family Circle" : "Care Client"}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Chronic Conditions (optional)
              </label>
              <input
                value={formData.conditions}
                onChange={(e) =>
                  setFormData({ ...formData, conditions: e.target.value })
                }
                className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-[#0066cc] dark:focus:border-[#2997ff] transition-colors font-medium text-sm"
                placeholder="e.g. Hypertension, Asthma"
              />
              <p className="text-[10px] text-muted-foreground ml-2">
                Separate multiple conditions with commas
              </p>
            </div>

            {/* Allergies */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Known Drug/Food Allergies (optional)
              </label>
              <input
                value={formData.allergies}
                onChange={(e) =>
                  setFormData({ ...formData, allergies: e.target.value })
                }
                className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-[#0066cc] dark:focus:border-[#2997ff] transition-colors font-medium text-sm"
                placeholder="e.g. Penicillin, Peanuts"
              />
              <p className="text-[10px] text-muted-foreground ml-2">
                Separate multiple allergies with commas
              </p>
            </div>

            <SheetFooter className="pt-4">
              <Button
                type="submit"
                className="w-full h-12 rounded-full text-xs font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 active:scale-95 transition-transform"
              >
                {editingPatient ? "Save Profile Changes" : "Create Profile"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!patientToDelete}
        onOpenChange={(open) => !open && setPatientToDelete(null)}
      >
        <AlertDialogContent className="rounded-[20px] p-6 sm:p-7 border border-border bg-card shadow-2xl">
          <AlertDialogHeader>
            <div className="w-14 h-14 rounded-[16px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <AlertCircle size={26} />
            </div>
            <AlertDialogTitle className="text-xl font-bold tracking-[-0.022em] text-foreground">
              Delete Health Profile?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will permanently delete the profile for{" "}
              <span className="text-foreground font-semibold">
                {patientToDelete?.name}
              </span>
              . Associated reminders and medication schedules for this profile will also be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-2.5">
            <AlertDialogCancel className="rounded-full font-semibold text-xs h-11 border-border active:scale-95 transition-transform">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-full font-semibold text-xs h-11 bg-rose-600 hover:bg-rose-700 text-white active:scale-95 transition-transform"
            >
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
