import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, Patient, Medicine, Reminder } from "@/contexts/AppContext";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  MoreVertical, 
  AlertCircle,
  Activity,
  Baby,
  UserRound,
  UserPlus,
  Pill,
  Bell,
  History as HistoryIcon,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  TrendingUp
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { toDate } from "@/lib/utils";
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

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
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
    doseLogs
  } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    relation: "",
    age: "",
    gender: "other" as "male" | "female" | "other"
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
    setFormData({ name: "", relation: "", age: "", gender: "other" });
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      relation: patient.relation || "",
      age: patient.age?.toString() || "",
      gender: patient.gender || "other"
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
          gender: formData.gender
        });
        toast({ title: "Profile updated", description: `${formData.name}'s details have been saved.` });
      } else {
        await addPatient({
          name: formData.name,
          relation: formData.relation,
          age: parseInt(formData.age) || undefined,
          gender: formData.gender
        });
        toast({ 
          title: isProfessionalMode ? "Client added!" : "Family member added!", 
          description: isProfessionalMode ? `${formData.name} has been added to your client list.` : `${formData.name} is now in your circle.` 
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
      toast({ title: "Profile removed", description: "The profile has been deleted successfully." });
      setPatientToDelete(null);
    } catch (err) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const currentSelection = selectedPatientId 
    ? patients.find(p => p.id === selectedPatientId)
    : { name: userProfile?.name || "Self", id: null, relation: "Primary User" };

  const memberStats = useMemo(() => {
    const today = new Date().toDateString();

    const getStats = (id: string | null) => {
      // Fix: treat both null and undefined as "owner" to match Firestore records
      // where patientId may be stored as null OR simply absent.
      const scopedMeds = medicines.filter(m => {
        const pId = (m as any).patientId ?? null;
        return id === null ? pId === null : pId === id;
      });

      const scopedRems = reminders.filter(r => {
        const pId = (r as any).patientId ?? null;
        return id === null ? pId === null : pId === id;
      });

      // Compute adherence: taken / (taken + missed) in last 30 days
      const scopedRemIds = new Set(scopedRems.map(r => r.id));
      const relevantLogs = doseLogs.filter(l => scopedRemIds.has(l.reminderId));
      const takenCount = relevantLogs.filter(l => l.action === "taken").length;
      const missedCount = relevantLogs.filter(l => l.action === "missed").length;
      const totalLogged = takenCount + missedCount;
      const adherenceRate = totalLogged > 0 ? Math.round((takenCount / totalLogged) * 100) : null;

      // Missed doses today
      const missedToday = doseLogs.filter(l =>
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

    const statsMap: Record<string, { meds: number; reminders: number; adherenceRate: number | null; missedToday: number }> = {};
    statsMap["self"] = getStats(null);
    patients.forEach(p => {
      statsMap[p.id] = getStats(p.id);
    });

    return statsMap;
  }, [medicines, reminders, doseLogs, patients]);

  const activeStats = selectedPatientId ? memberStats[selectedPatientId] : memberStats["self"];

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="px-4 pt-12 pb-24 min-h-screen bg-background">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {isProfessionalMode ? "Client Hub" : "Family Hub"}
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
              {patients.length + 1} Profiles Managed
            </p>
          </div>
          <button 
            onClick={handleOpenAdd}
            className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <UserPlus size={22} />
          </button>
        </div>
      </motion.div>

      {/* Active Member Detail Panel */}
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-10 p-6 rounded-[2.5rem] bg-card border-2 border-primary/20 shadow-2xl shadow-primary/5 relative overflow-hidden group"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                {(() => {
                  const pat = patients.find(p => p.id === selectedPatientId);
                  return pat && typeof pat.age === "number" && pat.age < 12 ? <Baby size={32} /> : <UserRound size={32} />;
                })()}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Managing Profile</p>
                <h2 className="text-2xl font-black tracking-tight text-foreground">{currentSelection.name}</h2>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {(currentSelection as any).relation || (isProfessionalMode ? "Client" : "Family")}
                </span>
              </div>
            </div>
            {selectedPatientId && (
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
                      <MoreVertical size={20} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[160px] shadow-2xl border-border/40">
                    <DropdownMenuItem 
                      className="rounded-xl p-3 focus:bg-primary/5 focus:text-primary cursor-pointer gap-3 font-bold text-xs"
                      onClick={() => handleOpenEdit(patients.find(p => p.id === selectedPatientId)!)}
                    >
                      <Edit2 size={16} /> Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="rounded-xl p-3 focus:bg-destructive/5 focus:text-destructive text-destructive cursor-pointer gap-3 font-bold text-xs"
                      onClick={() => setPatientToDelete(patients.find(p => p.id === selectedPatientId)!)}
                    >
                      <Trash2 size={16} /> Delete Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
          </div>

          {/* Quick Health Summary */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <Pill size={14} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Medicines</span>
              </div>
              <p className="text-2xl font-black text-foreground">{activeStats?.meds ?? 0}</p>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <Bell size={14} className="text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reminders</span>
              </div>
              <p className="text-2xl font-black text-foreground">{activeStats?.reminders ?? 0}</p>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Adherence</span>
              </div>
              <p className={`text-2xl font-black ${
                activeStats?.adherenceRate === null ? "text-muted-foreground" :
                activeStats.adherenceRate >= 80 ? "text-emerald-500" :
                activeStats.adherenceRate >= 50 ? "text-amber-500" : "text-destructive"
              }`}>
                {activeStats?.adherenceRate !== null && activeStats?.adherenceRate !== undefined
                  ? `${activeStats.adherenceRate}%`
                  : "—"}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className={activeStats?.missedToday ? "text-destructive" : "text-muted-foreground"} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Missed Today</span>
              </div>
              <p className={`text-2xl font-black ${activeStats?.missedToday ? "text-destructive" : "text-foreground"}`}>
                {activeStats?.missedToday ?? 0}
              </p>
            </div>
          </div>

          {/* Member Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={() => handleNavigate("/reminders")}
              className="rounded-2xl h-14 font-black uppercase text-[10px] tracking-widest gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-none"
            >
              <Bell size={14} /> View Reminders
            </Button>
            <Button 
              onClick={() => handleNavigate("/history")}
              className="rounded-2xl h-14 font-black uppercase text-[10px] tracking-widest gap-2 bg-secondary text-foreground hover:bg-secondary/80 border-none"
            >
              <HistoryIcon size={14} /> Health History
            </Button>
            <Button 
              onClick={() => navigate("/reminders/new", { state: { patientId: selectedPatientId, patientName: selectedPatientId ? patients.find(p => p.id === selectedPatientId)?.name : null } })}
              className="col-span-2 rounded-2xl h-14 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-primary/10"
            >
              <Plus size={16} /> Add Medication Schedule
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Circle Directory */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title mb-0">{isProfessionalMode ? "Client Directory" : "Circle Members"}</h3>
        </div>

        {patients.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-10 rounded-[2.5rem] border-2 border-dashed border-border/60 bg-secondary/20 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
              <Sparkles size={28} />
            </div>
            <h4 className="text-lg font-black tracking-tight mb-2">Expand Your Circle</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-8 px-4 opacity-70">
              Manage health schedules for your family, children, or clients in one unified dashboard.
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
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4"
          >
            {/* Main User Card */}
            <motion.div 
              variants={item}
              onClick={() => setSelectedPatientId(null)}
              className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer relative group ${
                selectedPatientId === null 
                  ? "border-primary bg-primary/5 shadow-xl shadow-primary/5" 
                  : "border-border/40 bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  selectedPatientId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-secondary text-muted-foreground"
                }`}>
                  <UserRound size={28} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black text-foreground tracking-tight leading-tight">
                      {userProfile?.name || "Primary User"}
                    </p>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-muted-foreground/20 text-muted-foreground">
                      Self
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                     <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest opacity-60">
                       {memberStats["self"]?.meds ?? 0} Meds • {memberStats["self"]?.reminders ?? 0} Reminders
                     </span>
                     {memberStats["self"]?.adherenceRate !== null && memberStats["self"]?.adherenceRate !== undefined && (
                       <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                         memberStats["self"].adherenceRate >= 80 ? "bg-emerald-500/10 text-emerald-600" :
                         memberStats["self"].adherenceRate >= 50 ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive"
                       }`}>{memberStats["self"].adherenceRate}%</span>
                     )}
                   </div>
                </div>
                <ChevronRight size={18} className={`text-muted-foreground transition-transform ${selectedPatientId === null ? "translate-x-1 text-primary" : "opacity-30"}`} />
              </div>
            </motion.div>

            {/* Patient Cards */}
            {patients.map((patient) => (
              <motion.div 
                key={patient.id}
                variants={item}
                className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer relative group ${
                  selectedPatientId === patient.id 
                    ? "border-primary bg-primary/5 shadow-xl shadow-primary/5" 
                    : "border-border/40 bg-card hover:border-primary/30"
                }`}
                onClick={() => setSelectedPatientId(patient.id)}
              >
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                    selectedPatientId === patient.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-secondary text-muted-foreground"
                  }`}>
                    {typeof patient.age === "number" && patient.age < 12 ? <Baby size={28} /> : <UserRound size={28} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-black text-foreground tracking-tight leading-tight">
                        {patient.name}
                      </p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-muted-foreground/20 text-muted-foreground">
                        {patient.relation || (isProfessionalMode ? "Client" : "Family")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest opacity-60">
                        {memberStats[patient.id]?.meds ?? 0} Meds • {memberStats[patient.id]?.reminders ?? 0} Reminders
                      </span>
                      {memberStats[patient.id]?.adherenceRate !== null && memberStats[patient.id]?.adherenceRate !== undefined && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          (memberStats[patient.id]?.adherenceRate ?? 0) >= 80 ? "bg-emerald-500/10 text-emerald-600" :
                          (memberStats[patient.id]?.adherenceRate ?? 0) >= 50 ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive"
                        }`}>{memberStats[patient.id].adherenceRate}%</span>
                      )}
                      {(memberStats[patient.id]?.missedToday ?? 0) > 0 && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-1">
                          <AlertTriangle size={8} /> {memberStats[patient.id].missedToday} missed today
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className={`text-muted-foreground transition-transform ${selectedPatientId === patient.id ? "translate-x-1 text-primary" : "opacity-30"}`} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* CHW Mode Teaser */}
      {!isProfessionalMode && patients.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-16 p-10 rounded-[2.5rem] bg-secondary/50 border border-border/40 text-center relative overflow-hidden"
        >
          <Activity size={36} className="text-primary/40 mx-auto mb-5" />
          <h4 className="text-sm font-black uppercase tracking-widest text-foreground mb-2">Need to manage more?</h4>
          <p className="text-xs text-muted-foreground leading-relaxed px-6 opacity-70 mb-6">
            Switch to Professional Mode in settings if you are a health worker or caregiver managing multiple clients.
          </p>
          <Button 
            variant="outline" 
            className="rounded-xl border-primary/20 text-primary font-bold text-[10px] uppercase tracking-widest"
            onClick={() => navigate("/settings")}
          >
            Visit Settings
          </Button>
        </motion.div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-[3rem] p-8 h-[85vh] border-none shadow-2xl">
          <SheetHeader className="text-left mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              {editingPatient ? <Edit2 size={24} /> : <UserPlus size={24} />}
            </div>
            <SheetTitle className="text-2xl font-black tracking-tight">
              {editingPatient ? "Edit Profile" : "Add to Circle"}
            </SheetTitle>
            <SheetDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-70">
              {editingPatient ? `Updating details for ${editingPatient.name}` : "Create a health profile for your family member."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
              <input 
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-16 px-6 rounded-2xl bg-secondary border-none outline-none focus:ring-2 ring-primary/20 transition-all font-bold tracking-tight text-lg"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Relation</label>
                <input 
                  value={formData.relation}
                  onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
                  className="w-full h-16 px-6 rounded-2xl bg-secondary border-none outline-none focus:ring-2 ring-primary/20 transition-all font-bold text-sm"
                  placeholder={isProfessionalMode ? "e.g. Client" : "e.g. Father"}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Age</label>
                <input 
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full h-16 px-6 rounded-2xl bg-secondary border-none outline-none focus:ring-2 ring-primary/20 transition-all font-bold text-sm"
                  placeholder="Years"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Gender</label>
              <div className="flex gap-3">
                {["male", "female", "other"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: g as any })}
                    className={`flex-1 h-14 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all border-2 ${
                      formData.gender === g ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-transparent border-border/40 text-muted-foreground"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <SheetFooter className="pt-8">
              <Button 
                type="submit" 
                className="w-full rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] h-16 shadow-2xl shadow-primary/20"
              >
                {editingPatient ? "Save Changes" : "Create Profile"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!patientToDelete} onOpenChange={(open) => !open && setPatientToDelete(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <AlertCircle size={24} />
            </div>
            <AlertDialogTitle className="text-2xl font-black tracking-tight">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              This will permanently delete the health profile for <span className="text-foreground font-bold">{patientToDelete?.name}</span>. 
              All associated medications and reminders for this profile will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-3">
            <AlertDialogCancel className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 bg-secondary border-none">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl shadow-destructive/20"
            >
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
