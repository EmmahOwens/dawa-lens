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
  const { patients, addPatient, setSelectedPatientId, selectedPatientId, userProfile } = useApp();
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
      toast({ title: "Family member added!", description: `${newName} is now in your circle.` });
    } catch (err) {
      toast({ title: "Failed to add member", variant: "destructive" });
    }
  };

  const currentSelection = selectedPatientId 
    ? patients.find(p => p.id === selectedPatientId)?.name 
    : userProfile?.name || "Self";

  return (
    <div className="px-4 pt-12 pb-20">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Family Hub
          </h1>
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
            <Users size={20} />
          </div>
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80">
          Manage your circle's health
        </p>
      </motion.div>

      {/* Active Profile Selection */}
      <div className="mb-10 premium-card border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Heart size={64} className="text-primary" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Currently Managing</p>
        <h2 className="text-2xl font-bold text-foreground mb-4 tracking-tight">{currentSelection}</h2>
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-lg px-6 border-primary/30 text-primary font-bold uppercase tracking-wider text-[10px] h-9 hover:bg-primary/5"
          onClick={() => navigate("/")}
        >
          View Dashboard <ArrowRight size={14} className="ml-2" />
        </Button>
      </div>

      {/* Profile Carousel */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-8"
      >
        <div className="flex items-center justify-between px-1 mb-4">
          <h3 className="section-title mb-0">Circle Members</h3>
          <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 tracking-wider bg-muted/50 px-2 py-0.5 rounded">Swipe</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-1 -mx-1 snap-x snap-mandatory no-scrollbar">
          {/* Main User (Self) */}
          <motion.div 
            key="self"
            variants={item}
            onClick={() => setSelectedPatientId(null)}
            className={`min-w-[180px] snap-start p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shrink-0 h-44 group active:scale-[0.98] ${
              selectedPatientId === null ? "border-primary bg-primary/5 shadow-lg shadow-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card hover:border-primary/30"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedPatientId === null ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                <User size={24} />
              </div>
              {selectedPatientId === null && <ShieldCheck size={20} className="text-primary" />}
            </div>
            <div>
              <p className="text-lg font-bold text-foreground mb-0.5 tracking-tight truncate">{userProfile?.name?.split(' ')[0] || "Self"}</p>
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Account Owner</p>
            </div>
          </motion.div>

          {/* Patients */}
          {patients.map((patient) => (
            <motion.div 
              key={patient.id}
              variants={item}
              onClick={() => setSelectedPatientId(patient.id)}
              className={`min-w-[180px] snap-start p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shrink-0 h-44 group active:scale-[0.98] ${
                selectedPatientId === patient.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedPatientId === patient.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                  <User size={24} />
                </div>
                {selectedPatientId === patient.id && <ShieldCheck size={20} className="text-primary" />}
              </div>
              <div>
                <p className="text-lg font-bold text-foreground mb-0.5 tracking-tight truncate">{patient.name.split(' ')[0]}</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider line-clamp-1">
                  {patient.relation || "Family"} {patient.age ? `• ${patient.age}y` : ""}
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
            className="w-full p-6 rounded-2xl border border-dashed border-border flex items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all group"
          >
            <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
              <Plus size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Add Family Member</span>
          </motion.button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card border-primary/20"
          >
            <h3 className="text-lg font-bold mb-6 tracking-tight">New Circle Member</h3>
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Full Name</label>
                <input 
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-muted/30 border-none outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Relation</label>
                  <input 
                    value={newRelation}
                    onChange={(e) => setNewRelation(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-muted/30 border-none outline-none focus:ring-2 ring-primary/20 transition-all font-medium text-sm"
                    placeholder="e.g. Father"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Age</label>
                  <input 
                    type="number"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-muted/30 border-none outline-none focus:ring-2 ring-primary/20 transition-all font-medium text-sm"
                    placeholder="optional"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="flex-1 rounded-xl text-xs uppercase font-bold tracking-wider h-11"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-[2] rounded-xl text-xs uppercase font-bold tracking-wider h-11 shadow-lg shadow-primary/10"
                >
                  Add Member
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </motion.div>

      {/* CHW Mode Teaser */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="mt-12 p-8 rounded-2xl bg-primary/5 border border-primary/10 text-center"
      >
        <Users size={32} className="text-primary/30 mx-auto mb-4" />
        <h4 className="text-sm font-bold text-foreground mb-1">Professional Mode</h4>
        <p className="text-xs text-muted-foreground leading-relaxed px-4 opacity-80">
          Are you a Community Health Worker? Enable Professional Mode in settings to manage client adherence.
        </p>
      </motion.div>
    </div>
  );
}
