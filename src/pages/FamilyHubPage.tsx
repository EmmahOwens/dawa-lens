import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useApp, Patient } from "@/contexts/AppContext";
import { 
  Plus, 
  Users, 
  User, 
  ArrowRight, 
  Trash2, 
  Heart, 
  ShieldCheck, 
  Edit2, 
  MoreVertical, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Baby,
  UserRound,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
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
  } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const currentSelectionName = selectedPatientId 
    ? patients.find(p => p.id === selectedPatientId)?.name 
    : userProfile?.name || "Self";

  // Calculate some basic stats
  const stats = useMemo(() => {
    return {
      totalMembers: patients.length + 1,
      professionalContext: isProfessionalMode
    };
  }, [patients.length, isProfessionalMode]);

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
              {stats.totalMembers} Profiles Managed
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

      {/* Active Selection Hero */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-10 p-8 rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground relative overflow-hidden shadow-2xl shadow-primary/20 group"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
           {isProfessionalMode ? <Users size={120} /> : <Heart size={120} />}
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/60 mb-2">Active Context</p>
          <h2 className="text-3xl font-black mb-6 tracking-tight">{currentSelectionName}</h2>
          <Button 
            variant="secondary" 
            size="sm" 
            className="rounded-2xl px-6 bg-white text-primary font-black uppercase tracking-widest text-[10px] h-12 shadow-xl"
            onClick={() => navigate("/")}
          >
            Go to Dashboard <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </motion.div>

      {/* Members Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title mb-0">{isProfessionalMode ? "Client Directory" : "Circle Members"}</h3>
        </div>

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
                selectedPatientId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              }`}>
                <UserRound size={28} />
              </div>
              <div className="flex-1">
                <p className="text-lg font-black text-foreground tracking-tight leading-tight">
                  {userProfile?.name || "Primary User"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest opacity-60">
                    {isProfessionalMode ? "My Profile" : "Account Owner"}
                  </span>
                  {selectedPatientId === null && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[8px] font-black uppercase tracking-tighter">
                      <CheckCircle2 size={10} /> Active
                    </div>
                  )}
                </div>
              </div>
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
                  selectedPatientId === patient.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                }`}>
                  {patient.age && patient.age < 12 ? <Baby size={28} /> : <UserRound size={28} />}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-black text-foreground tracking-tight leading-tight">
                    {patient.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest opacity-60">
                      {patient.relation || (isProfessionalMode ? "Client" : "Family")} {patient.age ? `• ${patient.age}y` : ""}
                    </span>
                    {selectedPatientId === patient.id && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[8px] font-black uppercase tracking-tighter">
                        <CheckCircle2 size={10} /> Active
                      </div>
                    )}
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
                      <MoreVertical size={20} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[140px] shadow-2xl border-border/40">
                    <DropdownMenuItem 
                      className="rounded-xl p-3 focus:bg-primary/5 focus:text-primary cursor-pointer gap-3 font-bold text-xs"
                      onClick={() => handleOpenEdit(patient)}
                    >
                      <Edit2 size={16} /> Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="rounded-xl p-3 focus:bg-destructive/5 focus:text-destructive text-destructive cursor-pointer gap-3 font-bold text-xs"
                      onClick={() => setPatientToDelete(patient)}
                    >
                      <Trash2 size={16} /> Delete Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* CHW Mode Teaser */}
      {!isProfessionalMode && (
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
