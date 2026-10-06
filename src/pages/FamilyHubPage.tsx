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

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

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
    conditions: "", // comma-separated string in form
    allergies: "", // comma-separated string in form
  });

  // Handle "openAdd" state from dashboard navigation
  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
      handleOpenAdd();
      // Clear state so it doesn't reopen on refresh
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

  const currentSelection = (selectedPatientId
    ? patients.find((p) => p.id === selectedPatientId)
    : null) || {
    name: userProfile?.name || "Self",
    id: null,
    relation: "Primary User",
  };

  const memberStats = useMemo(() => {
    const today = new Date().toDateString();

    const getStats = (id: string | null) => {
      // Fix: treat both null and undefined as "owner" to match Firestore records
      // where patientId may be stored as null OR simply absent.
      const scopedMeds = medicines.filter((m) => {
        const pId = (m as any).patientId ?? null;
        return id === null ? pId === null : pId === id;
      });

      const scopedRems = reminders.filter((r) => {
        const pId = (r as any).patientId ?? null;
        return id === null ? pId === null : pId === id;
      });

      // Compute adherence: taken / (taken + missed) in last 30 days
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

      // Missed doses today
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

  const activeStats = (selectedPatientId && memberStats[selectedPatientId])
    ? memberStats[selectedPatientId]
    : memberStats["self"];

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.022em] text-foreground">
              {isProfessionalMode ? "Client Hub" : "Family Hub"}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80 mt-1">
              {patients.length + 1} Profiles Managed
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="w-10 h-10 rounded-full bg-[#0066cc] dark:bg-[#0071e3] text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <UserPlus size={18} />
          </button>
        </div>
      </motion.div>

      {/* Mobile Profile Switcher Bar */}
      {patients.length > 0 && (
        <div className="sm:hidden mb-6">
          <Select
            value={selectedPatientId || "self"}
            onValueChange={(val) => {
              setSelectedPatientId(val === "self" ? null : val);
            }}
          >
            <SelectTrigger className="w-full h-11 rounded-full bg-card border border-border text-xs font-semibold">
              <SelectValue placeholder="Switch Profile..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self" className="text-xs font-semibold">
                👤 {userProfile?.name || "You (Primary Account)"}
              </SelectItem>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs font-semibold">
                  {p.relation ? `👥 ${p.name} (${p.relation})` : `👥 ${p.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Active Member Detail Panel - Apple Near-Black Tile 1 / Parchment */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-8 p-6 rounded-[18px] border border-border bg-[#f5f5f7] dark:bg-[#272729] relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[14px] bg-secondary flex items-center justify-center text-foreground border border-border">
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">
                  Managing Profile
                </p>
                <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.015em] text-foreground">
                  {currentSelection.name}
                </h2>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {(currentSelection as any).relation ||
                    (isProfessionalMode ? "Client" : "Family")}
                </span>
              </div>
            </div>
            {selectedPatientId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground">
                    <MoreVertical size={18} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-2xl p-2 min-w-[160px] border-border"
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

          {/* Quick Health Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3.5 rounded-[11px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <Pill size={13} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Medicines
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {activeStats?.meds ?? 0}
              </p>
            </div>
            <div className="p-3.5 rounded-[11px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <Bell size={13} className="text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Reminders
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {activeStats?.reminders ?? 0}
              </p>
            </div>
            <div className="p-3.5 rounded-[11px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={13} className="text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Adherence
                </span>
              </div>
              <p
                className={`text-xl font-bold ${
                  activeStats?.adherenceRate === null
                    ? "text-muted-foreground"
                    : activeStats.adherenceRate >= 80
                    ? "text-emerald-500"
                    : activeStats.adherenceRate >= 50
                    ? "text-amber-500"
                    : "text-destructive"
                }`}
              >
                {activeStats?.adherenceRate !== null &&
                activeStats?.adherenceRate !== undefined
                  ? `${activeStats.adherenceRate}%`
                  : "—"}
              </p>
            </div>
            <div className="p-3.5 rounded-[11px] bg-card border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle
                  size={13}
                  className={
                    activeStats?.missedToday
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Missed
                </span>
              </div>
              <p
                className={`text-xl font-bold ${
                  activeStats?.missedToday
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {activeStats?.missedToday ?? 0}
              </p>
            </div>
          </div>

          {/* Member Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleNavigate("/reminders")}
              className="rounded-full h-11 text-xs font-semibold gap-1.5 border-border active:scale-95"
            >
              <Bell size={13} /> View Reminders
            </Button>
            <Button
              variant="outline"
              onClick={() => handleNavigate("/history")}
              className="rounded-full h-11 text-xs font-semibold gap-1.5 border-border active:scale-95"
            >
              <HistoryIcon size={13} /> Health History
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
              className="col-span-2 rounded-full h-11 text-xs font-semibold gap-1.5 bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 active:scale-95"
            >
              <Plus size={15} /> Add Medication Schedule
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Circle Directory */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title mb-0">
            {isProfessionalMode ? "Client Directory" : "Circle Members"}
          </h3>
        </div>

        {patients.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-10 rounded-[2.5rem] border-2 border-dashed border-border/60 bg-secondary/20 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
              <Sparkles size={28} />
            </div>
            <h4 className="text-lg font-black tracking-tight mb-2">
              Expand Your Circle
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-8 px-4 opacity-70">
              Manage health schedules for your family, children, or clients in
              one unified dashboard.
            </p>
            <Button
              onClick={handleOpenAdd}
              className="rounded-2xl px-8 h-14 font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl"
            >
              <UserPlus size={16} /> Add First Member
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4"
          >
            {/* Main User Card */}
            <motion.div
              variants={item}
              onClick={() => setSelectedPatientId(null)}
              className={`p-5 rounded-[18px] border transition-all cursor-pointer relative group ${
                selectedPatientId === null
                  ? "border-[#0066cc] dark:border-[#2997ff] bg-primary/5"
                  : "border-border bg-card hover:border-foreground/20"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-[11px] flex items-center justify-center transition-all ${
                    selectedPatientId === null
                      ? "bg-[#0066cc] dark:bg-[#0071e3] text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <UserRound size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-foreground tracking-tight leading-tight">
                      {userProfile?.name || "Primary User"}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0 border-border text-muted-foreground"
                    >
                      Self
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tight">
                      {memberStats["self"]?.meds ?? 0} Meds •{" "}
                      {memberStats["self"]?.reminders ?? 0} Reminders
                    </span>
                    {memberStats["self"]?.adherenceRate !== null &&
                      memberStats["self"]?.adherenceRate !== undefined && (
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            memberStats["self"].adherenceRate >= 80
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {memberStats["self"].adherenceRate}%
                        </span>
                      )}
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-muted-foreground transition-transform ${
                    selectedPatientId === null
                      ? "translate-x-0.5 text-[#0066cc] dark:text-[#2997ff]"
                      : "opacity-40"
                  }`}
                />
              </div>
            </motion.div>

            {/* Patient Cards */}
            {patients.map((patient) => (
              <motion.div
                key={patient.id}
                variants={item}
                className={`p-5 rounded-[18px] border transition-all cursor-pointer relative group ${
                  selectedPatientId === patient.id
                    ? "border-[#0066cc] dark:border-[#2997ff] bg-primary/5"
                    : "border-border bg-card hover:border-foreground/20"
                }`}
                onClick={() => setSelectedPatientId(patient.id)}
              >
                <div className="flex items-center gap-4">
                  {(() => {
                    const colorDotMap: Record<string, string> = {
                      blue: "bg-blue-500/15 text-blue-500",
                      rose: "bg-rose-500/15 text-rose-500",
                      amber: "bg-amber-500/15 text-amber-500",
                      emerald: "bg-emerald-500/15 text-emerald-500",
                      violet: "bg-violet-500/15 text-violet-500",
                      slate: "bg-slate-500/15 text-slate-500",
                    };
                    const colorClass =
                      selectedPatientId === patient.id
                        ? "bg-[#0066cc] dark:bg-[#0071e3] text-white"
                        : patient.color && colorDotMap[patient.color]
                        ? colorDotMap[patient.color]
                        : "bg-secondary text-muted-foreground";
                    return (
                      <div
                        className={`w-12 h-12 rounded-[11px] flex items-center justify-center transition-all ${colorClass}`}
                      >
                        {typeof patient.age === "number" && patient.age < 12 ? (
                          <Baby size={24} />
                        ) : (
                          <UserRound size={24} />
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-bold text-foreground tracking-tight leading-tight">
                        {patient.name}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0 border-border text-muted-foreground"
                      >
                        {patient.relation ||
                          (isProfessionalMode ? "Client" : "Family")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tight">
                        {memberStats[patient.id]?.meds ?? 0} Meds •{" "}
                        {memberStats[patient.id]?.reminders ?? 0} Reminders
                      </span>
                      {memberStats[patient.id]?.adherenceRate !== null &&
                        memberStats[patient.id]?.adherenceRate !==
                          undefined && (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              (memberStats[patient.id]?.adherenceRate ?? 0) >= 80
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {memberStats[patient.id].adherenceRate}%
                          </span>
                        )}
                      {(memberStats[patient.id]?.missedToday ?? 0) > 0 && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-1">
                          <AlertTriangle size={8} />{" "}
                          {memberStats[patient.id].missedToday} missed
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`text-muted-foreground transition-transform ${
                      selectedPatientId === patient.id
                        ? "translate-x-1 text-primary"
                        : "opacity-30"
                    }`}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="bottom"
          className="w-full max-w-lg mx-auto rounded-t-3xl p-6 sm:p-8 max-h-[90dvh] border border-border/50 border-b-0 shadow-2xl overflow-y-auto no-scrollbar"
          {...sheetSwipe}
        >
          <div className="w-12 h-1.5 rounded-full bg-muted/70 hover:bg-muted mx-auto -mt-2 mb-8 transition-colors" />
          <SheetHeader className="text-left mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              {editingPatient ? <Edit2 size={24} /> : <UserPlus size={24} />}
            </div>
            <SheetTitle className="text-2xl font-black tracking-tight">
              {editingPatient ? "Edit Profile" : "Add to Circle"}
            </SheetTitle>
            <SheetDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-70">
              {editingPatient
                ? `Updating details for ${editingPatient.name}`
                : "Create a health profile for your family member."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-primary transition-colors font-medium text-sm"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Relation
                </label>
                <input
                  value={formData.relation}
                  onChange={(e) =>
                    setFormData({ ...formData, relation: e.target.value })
                  }
                  className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-primary transition-colors font-medium text-sm"
                  placeholder={
                    isProfessionalMode ? "e.g. Client" : "e.g. Father"
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
                  className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-primary transition-colors font-medium text-sm"
                  placeholder="Years"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Gender
              </label>
              <div className="flex gap-3">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, gender: g })
                    }
                    className={`flex-1 h-11 rounded-full font-semibold text-xs uppercase tracking-wider transition-all border active:scale-95 ${
                      formData.gender === g
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Color */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Profile Color
              </label>
              <div className="flex gap-2.5">
                {[
                  { key: "blue", dot: "bg-blue-500" },
                  { key: "rose", dot: "bg-rose-500" },
                  { key: "amber", dot: "bg-amber-500" },
                  { key: "emerald", dot: "bg-emerald-500" },
                  { key: "violet", dot: "bg-violet-500" },
                  { key: "slate", dot: "bg-slate-500" },
                ].map(({ key, dot }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: key })}
                    className={`w-8 h-8 rounded-full ${dot} transition-all border-2 ${
                      formData.color === key
                        ? "border-foreground scale-105 shadow-sm"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Profile Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Profile Type
              </label>
              <div className="flex gap-3">
                {(["family", "client"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    className={`flex-1 h-11 rounded-full font-semibold text-xs uppercase tracking-wider transition-all border active:scale-95 ${
                      formData.type === t
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {t === "family" ? "Family" : "Client"}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Conditions (optional)
              </label>
              <input
                value={formData.conditions}
                onChange={(e) =>
                  setFormData({ ...formData, conditions: e.target.value })
                }
                className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-primary transition-colors font-medium text-sm"
                placeholder="e.g. Hypertension, Diabetes"
              />
              <p className="text-[10px] text-muted-foreground ml-1">
                Separate multiple with commas
              </p>
            </div>

            {/* Allergies */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Allergies (optional)
              </label>
              <input
                value={formData.allergies}
                onChange={(e) =>
                  setFormData({ ...formData, allergies: e.target.value })
                }
                className="w-full h-11 px-4 rounded-full border border-border bg-card text-foreground outline-none focus:border-primary transition-colors font-medium text-sm"
                placeholder="e.g. Penicillin, Sulfa drugs"
              />
              <p className="text-[10px] text-muted-foreground ml-1">
                Separate multiple with commas
              </p>
            </div>

            <SheetFooter className="pt-6">
              <Button
                type="submit"
                className="w-full h-11 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform"
              >
                {editingPatient ? "Save Changes" : "Create Profile"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!patientToDelete}
        onOpenChange={(open) => !open && setPatientToDelete(null)}
      >
        <AlertDialogContent className="rounded-[20px] p-6 sm:p-7 border border-border bg-card shadow-2xl">
          <AlertDialogHeader>
            <div className="w-14 h-14 rounded-[16px] bg-[#f5f5f7] dark:bg-[#272729] border border-border text-destructive flex items-center justify-center mb-4">
              <AlertCircle size={26} />
            </div>
            <AlertDialogTitle className="text-xl font-bold tracking-[-0.022em] text-foreground">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will permanently delete the health profile for{" "}
              <span className="text-foreground font-semibold">
                {patientToDelete?.name}
              </span>
              . All associated medications and reminders for this profile will
              also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-2.5">
            <AlertDialogCancel className="rounded-full font-semibold text-xs h-11 border-border active:scale-95 transition-transform">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-full font-semibold text-xs h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95 transition-transform"
            >
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
