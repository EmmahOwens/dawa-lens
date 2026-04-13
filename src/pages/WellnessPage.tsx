import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, WellnessLog } from "@/contexts/AppContext";
import { Heart, Utensils, Sparkles, Loader2, Thermometer, Smile, Zap, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function WellnessPage() {
  const { wellnessLogs, addWellnessLog, medicines } = useApp();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"journal" | "food">("journal");
  const [loading, setLoading] = useState(false);
  
  // Journal State
  const [mood, setMood] = useState(3); // 1-5
  const [energy, setEnergy] = useState(3); // 1-5
  const [symptoms, setSymptoms] = useState<string[]>([]);
  
  // Food State
  const [meal, setMeal] = useState("");
  const [mealSafety, setMealSafety] = useState<any>(null);

  const handleLogWellness = async () => {
    setLoading(true);
    try {
      await addWellnessLog({
        type: "symptom",
        data: { mood, energy, symptoms }
      });
      toast({ title: "Journal Entry Saved", description: "Your wellness data has been recorded." });
      setSymptoms([]);
    } finally {
      setLoading(false);
    }
  };

  const checkMeal = async () => {
    if (!meal) return;
    setLoading(true);
    try {
      const res = await aiApi.checkMealSafety({ medicines, mealDescription: meal });
      setMealSafety(res);
    } finally {
      setLoading(false);
    }
  };

  const handleLogFood = async () => {
    if (!meal) return;
    setLoading(true);
    try {
      await addWellnessLog({
        type: "food",
        data: { meal, safety: mealSafety }
      });
      setMeal("");
      setMealSafety(null);
      toast({ title: "Meal Logged", description: "Nutritional data synced." });
    } finally {
      setLoading(false);
    }
  };

  const symptomOptions = ["Headache", "Nausea", "Dizziness", "Fatigue", "Good Focus", "Relaxed"];

  return (
    <div className="px-4 pt-12 pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Wellness Hub
          </h1>
          <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center text-success shadow-sm">
            <Heart size={20} />
          </div>
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80">
          Sync your body and treatment
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 bg-muted/50 rounded-xl border border-border/50">
        <button 
          onClick={() => setActiveTab("journal")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === "journal" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
        >
          Daily Journal
        </button>
        <button 
          onClick={() => setActiveTab("food")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === "food" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
        >
          Food Log
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "journal" ? (
          <motion.div
            key="journal"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            {/* Mood & Energy */}
            <div className="premium-card">
              <h3 className="section-title flex items-center gap-2">
                <Smile size={14} className="text-success" /> How's the vibe?
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    <span>Low Energy</span>
                    <span>High Energy</span>
                  </div>
                  <input 
                    type="range" min="1" max="5" value={energy} 
                    onChange={(e) => setEnergy(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-success transition-opacity hover:opacity-100"
                  />
                </div>

                <div className="flex justify-between gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setMood(val)}
                      className={`flex-1 h-12 rounded-xl text-xl flex items-center justify-center transition-all ${mood === val ? "bg-success text-success-foreground scale-105 shadow-md shadow-success/10" : "bg-muted/50 grayscale opacity-40 hover:opacity-100 hover:grayscale-0"}`}
                    >
                      {val === 1 ? "😔" : val === 2 ? "😕" : val === 3 ? "😐" : val === 4 ? "🙂" : "💎"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Symptom Chips */}
            <div className="premium-card">
               <h3 className="section-title">Specific Symptoms</h3>
               <div className="flex flex-wrap gap-2">
                  {symptomOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSymptoms(prev => prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev, opt])}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border-2 transition-all ${symptoms.includes(opt) ? "bg-primary border-primary text-primary-foreground shadow-sm" : "border-border text-muted-foreground hover:border-primary/30"}`}
                    >
                      {opt}
                    </button>
                  ))}
               </div>
               <Button 
                onClick={handleLogWellness}
                disabled={loading}
                className="w-full mt-6 h-12 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/10"
               >
                 {loading ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                 Record Daily Vitals
               </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="food"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            {/* Meal Entry */}
            <div className="premium-card">
              <h3 className="section-title flex items-center gap-2">
                <Utensils size={14} className="text-warning" /> What are we eating?
              </h3>
              <textarea 
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                placeholder="e.g. Grilled salmon, avocado salad, and a glass of milk"
                className="w-full h-32 p-4 rounded-xl bg-muted/30 border-none outline-none focus:ring-2 ring-warning/20 transition-all font-medium text-sm leading-relaxed"
              />
              
              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={checkMeal} 
                  variant="outline" 
                  disabled={loading || !meal}
                  className="flex-1 h-11 rounded-lg text-[10px] font-bold tracking-wider uppercase"
                >
                  {loading ? <Loader2 className="animate-spin mr-2" size={12} /> : <Sparkles className="mr-2 text-warning" size={12} />}
                  Check Safety
                </Button>
                <Button 
                  onClick={handleLogFood} 
                  disabled={loading || !meal}
                  className="flex-1 h-11 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-warning text-warning-foreground hover:bg-warning/90"
                >
                  Log Meal
                </Button>
              </div>

              {/* AI Meal Verdict */}
              {mealSafety && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`mt-6 p-6 rounded-2xl border-2 ${mealSafety.risk === "Safe" ? "bg-success/5 border-success/30" : mealSafety.risk === "Medium" ? "bg-warning/5 border-warning/30" : "bg-destructive/5 border-destructive/30"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {mealSafety.risk === "Safe" ? <ShieldCheck className="text-success" /> : <AlertTriangle className={mealSafety.risk === "High" ? "text-destructive" : "text-warning"} />}
                    <p className="font-black text-sm uppercase tracking-tighter">{mealSafety.verdict}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{mealSafety.explanation}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <motion.div variants={container} initial="hidden" animate="show" className="mt-12 space-y-4">
        <h3 className="section-title px-1">Recent Reflections</h3>
        {wellnessLogs.slice(0, 10).map((log) => (
          <motion.div 
            key={log.id} 
            variants={item}
            className="p-4 rounded-xl bg-card border border-border/50 flex items-start gap-4 transition-all hover:bg-accent/5 hover:border-primary/20"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${log.type === "food" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
               {log.type === "food" ? <Utensils size={16} /> : <Zap size={16} />}
            </div>
            <div className="flex-1 min-w-0">
               <div className="flex items-center justify-between mb-0.5">
                 <p className="text-xs font-bold text-foreground">
                   {log.type === "food" ? "Nutritional Log" : "Mood & Vitality"}
                 </p>
                 <p className="text-[9px] font-medium text-muted-foreground">{format(new Date(log.timestamp), "h:mm a")}</p>
               </div>
               <p className="text-xs text-muted-foreground truncate leading-relaxed">
                 {log.type === "food" ? log.data.meal : `${log.data.symptoms.length > 0 ? log.data.symptoms.join(", ") : "Steady vibes"}`}
               </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
