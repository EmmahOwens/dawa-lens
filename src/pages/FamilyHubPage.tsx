import { useState } from "react";
import { motion } from "framer-motion";
import { useApp, Patient } from "@/contexts/AppContext";
import { Plus, Users, User, ArrowRight, Trash2, Heart, ShieldCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function FamilyHubPage() {
  const { patients, addPatient, setSelectedPatientId, selectedPatientId, userProfile, isProfessionalMode } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const [newAge, setNewAge] = useState("");

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    
    try {
      await addPatient({
        name: newName,
        relation: newRelation,
        age: parseInt(newAge) || undefined,
        gender: "other"
      });
      setNewName("");
      setNewRelation("");
      setNewAge("");
      setShowAddForm(false);
      toast({ 
        title: isProfessionalMode ? "Client added!" : "Family member added!", 
        description: isProfessionalMode ? `${newName} has been added to your client list.` : `${newName} is now in your circle.` 
      });
    } catch (err) {
      toast({ title: "Failed to add profile", variant: "destructive" });
    }
  };

  const currentSelection = selectedPatientId 
    ? patients.find(p => p.id === selectedPatientId)?.name 
    : userProfile?.name || "Self";

  return (
    <div className="px-4 pt-12 pb-24 min-h-screen bg-background">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isProfessionalMode ? "Client Hub" : "Family Hub"}
          </h1>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
            <Users size={22} />
          </div>
        </div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.1em] opacity-60">
          {isProfessionalMode ? "Professional Client Management" : "Manage your circle's health"}
        </p>
      </motion.div>

      {/* Active Profile Selection */}
      <div className="mb-10 premium-card border-primary/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
           {isProfessionalMode ? <Users size={80} className="text-primary" /> : <Heart size={80} className="text-primary" />}
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Currently Managing</p>
        <h2 className="text-2xl font-bold text-foreground mb-5 tracking-tight">{currentSelection}</h2>
        <Button 
          variant="default" 
          size="sm" 
          className="rounded-xl px-6 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-primary/20 group/btn"
          onClick={() => navigate("/")}
        >
          View Dashboard <ArrowRight size={14} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* Profile Carousel */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-8"
      >
        <div className="flex items-center justify-between px-1 mb-5">
          <h3 className="section-title mb-0">{isProfessionalMode ? "Your Clients" : "Circle Members"}</h3>
          <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40 tracking-[0.2em] bg-secondary px-3 py-1 rounded-full">Swipe</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-8 pt-2 px-1 -mx-1 snap-x snap-mandatory no-scrollbar">
          {/* Main User (Self) - Only show if not in purely professional context, or label as "Primary" */}
          <motion.div 
            key="self"
            variants={item}
            onClick={() => setSelectedPatientId(null)}
            className={`min-w-[200px] snap-start p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between shrink-0 h-48 group active:scale-[0.98] ${
              selectedPatientId === null ? "border-primary bg-primary/5 shadow-xl shadow-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card hover:border-primary/30"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${selectedPatientId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                <User size={24} />
              </div>
              {selectedPatientId === null && <ShieldCheck size={20} className="text-primary animate-in zoom-in duration-300" />}
            </div>
            <div>
              <p className="text-lg font-bold text-foreground mb-0.5 tracking-tight truncate">{userProfile?.name?.split(' ')[0] || "Self"}</p>
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest opacity-60">
                {isProfessionalMode ? "My Profile" : "Account Owner"}
              </p>
            </div>
          </motion.div>

          {/* Patients */}
          {patients.map((patient) => (
            <motion.div 
              key={patient.id}
              variants={item}
              onClick={() => setSelectedPatientId(patient.id)}
              className={`min-w-[200px] snap-start p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between shrink-0 h-48 group active:scale-[0.98] ${
                selectedPatientId === patient.id ? "border-primary bg-primary/5 shadow-xl shadow-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${selectedPatientId === patient.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                  <User size={24} />
                </div>
                {selectedPatientId === patient.id && <ShieldCheck size={20} className="text-primary animate-in zoom-in duration-300" />}
              </div>
              <div>
                <p className="text-lg font-bold text-foreground mb-0.5 tracking-tight truncate">{patient.name}</p>
                <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest opacity-60 line-clamp-1">
                  {patient.relation || (isProfessionalMode ? "Client" : "Family")} {patient.age ? `• ${patient.age}y` : ""}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Member Button */}
        {!showAddForm ? (
          <motion.button 
            variants={item}
            onClick={() => setShowAddForm(true)}
            className="w-full p-8 rounded-3xl border border-dashed border-border/60 flex items-center justify-center gap-4 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group shadow-sm"
          >
            <div className="p-2.5 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors shadow-inner">
              <Plus size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">{isProfessionalMode ? "Add New Client" : "Add Family Member"}</span>
          </motion.button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card border-primary/20 shadow-2xl shadow-primary/5"
          >
            <h3 className="text-xl font-bold mb-6 tracking-tight">{isProfessionalMode ? "Client Profile" : "New Circle Member"}</h3>
            <form onSubmit={handleAddPatient} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Full Name</label>
                <input 
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-14 px-5 rounded-2xl bg-secondary/50 border-none outline-none focus:ring-2 ring-primary/20 transition-all font-bold tracking-tight"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Relation / Type</label>
                  <input 
                    value={newRelation}
                    onChange={(e) => setNewRelation(e.target.value)}
                    className="w-full h-14 px-5 rounded-2xl bg-secondary/50 border-none outline-none focus:ring-2 ring-primary/20 transition-all font-bold text-sm tracking-tight"
                    placeholder={isProfessionalMode ? "e.g. Outpatient" : "e.g. Father"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Age</label>
                  <input 
                    type="number"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    className="w-full h-14 px-5 rounded-2xl bg-secondary/50 border-none outline-none focus:ring-2 ring-primary/20 transition-all font-bold text-sm tracking-tight"
                    placeholder="Years"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="flex-1 rounded-2xl text-[10px] uppercase font-black tracking-widest h-12"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-[2] rounded-2xl text-[10px] uppercase font-black tracking-widest h-12 shadow-xl shadow-primary/20"
                >
                  {isProfessionalMode ? "Register Client" : "Add to Circle"}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </motion.div>

      {/* CHW Mode Teaser - Hide if already in professional mode */}
      {!isProfessionalMode && (
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-16 p-10 rounded-[2.5rem] bg-primary/5 border border-primary/10 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
          <Users size={36} className="text-primary/40 mx-auto mb-5" />
          <h4 className="text-sm font-black uppercase tracking-widest text-foreground mb-2">Professional Mode</h4>
          <p className="text-xs text-muted-foreground leading-relaxed px-6 opacity-70">
            Are you a Community Health Worker? Enable Professional Mode in settings to manage client adherence and reporting.
          </p>
        </motion.div>
      )}
    </div>
  );
}
