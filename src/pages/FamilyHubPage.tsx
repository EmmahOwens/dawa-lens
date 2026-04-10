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
        className="mb-10"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-black tracking-tighter text-foreground">
            Family Hub
          </h1>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Users size={24} />
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest opacity-70">
          Manage your circle's health
        </p>
      </motion.div>

      {/* Active Profile Selection */}
      <div className="mb-10 p-6 rounded-[2.5rem] bg-card border-2 border-primary/20 shadow-xl shadow-primary/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <Heart size={80} className="text-primary" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Currently Managing</p>
        <h2 className="text-2xl font-bold text-foreground mb-4">{currentSelection}</h2>
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-full px-6 border-primary/30 text-primary font-bold uppercase tracking-wider text-[10px] h-9"
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
        <div className="flex items-center justify-between px-2 mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Circle Members</h3>
          <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 tracking-widest bg-muted px-2 py-0.5 rounded">Swipe</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-8 pt-2 px-2 -mx-2 snap-x snap-mandatory drop-shadow-xl" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <style>{`
            div::-webkit-scrollbar { display: none; }
          `}</style>
          
          {/* Main User (Self) */}
          <motion.div 
            variants={item}
            onClick={() => setSelectedPatientId(null)}
            className={`min-w-[200px] snap-center p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer flex flex-col justify-between shrink-0 h-48 active:scale-95 ${
              selectedPatientId === null ? "border-primary bg-primary/10 shadow-2xl shadow-primary/20" : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center ${selectedPatientId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"}`}>
                <User size={28} />
              </div>
              {selectedPatientId === null && <ShieldCheck size={24} className="text-primary" />}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground mb-1 tracking-tight truncate">{userProfile?.name?.split(' ')[0] || "Self"}</p>
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Account Owner</p>
            </div>
          </motion.div>

          {/* Patients */}
          {patients.map((patient) => (
            <motion.div 
              key={patient.id}
              variants={item}
              onClick={() => setSelectedPatientId(patient.id)}
              className={`min-w-[200px] snap-center p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer flex flex-col justify-between shrink-0 h-48 active:scale-95 ${
                selectedPatientId === patient.id ? "border-primary bg-primary/10 shadow-2xl shadow-primary/20" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center ${selectedPatientId === patient.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"}`}>
                  <User size={28} />
                </div>
                {selectedPatientId === patient.id && <ShieldCheck size={24} className="text-primary" />}
              </div>
              <div>
                <p className="text-xl font-bold text-foreground mb-1 tracking-tight truncate">{patient.name.split(' ')[0]}</p>
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest line-clamp-1">
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
            className="w-full p-5 rounded-[2rem] border-2 border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
          >
            <Plus size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">Add Family Member</span>
          </motion.button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-[2.5rem] bg-card border-2 border-primary/30 shadow-xl"
          >
            <h3 className="text-lg font-bold mb-4">New Circle Member</h3>
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
              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="flex-1 rounded-full text-xs uppercase font-black tracking-widest h-11"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-[2] rounded-full text-xs uppercase font-black tracking-widest h-11 shadow-lg shadow-primary/20"
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
        className="mt-12 p-8 rounded-[3rem] bg-primary/5 border border-primary/20 text-center"
      >
        <Users size={40} className="text-primary/40 mx-auto mb-4" />
        <h4 className="text-sm font-bold text-foreground mb-2">Professional Mode</h4>
        <p className="text-xs text-muted-foreground leading-relaxed px-4">
          Are you a Community Health Worker? Enable Professional Mode in settings to manage client adherence.
        </p>
      </motion.div>
    </div>
  );
}
