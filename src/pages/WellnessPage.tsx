import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, WellnessLog } from "@/contexts/AppContext";
import { Heart, Utensils, Sparkles, Loader2, Thermometer, Smile, Zap, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, Brain, Moon, Wind, Activity, Coffee, CloudRain, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiApi } from "@/services/api";
import WellnessInsightCard from "@/components/wellness/WellnessInsightCard";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function WellnessPage() {
  const { wellnessLogs, addWellnessLog, medicines, doseLogs } = useApp();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"journal" | "food">("journal");
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<any>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  
  const fetchWellnessInsight = async () => {
    if (wellnessLogs.length === 0) return;
    setInsightLoading(true);
    try {
      const res = await aiApi.getWellnessInsight({
        doseLogs,
        wellnessLogs,
        medicines
      });
      setInsight(res);
    } catch (err) {
      console.error("Failed to fetch wellness insight:", err);
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    fetchWellnessInsight();
  }, [wellnessLogs.length]); // Re-fetch when logs change
  
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

  const symptomCategories = [
    {
      name: "Physical",
      icon: <Activity size={14} />,
      options: ["Headache", "Nausea", "Dizziness", "Fatigue", "Pain", "Fever"]
    },
    {
      name: "Mental",
      icon: <Brain size={14} />,
      options: ["Good Focus", "Relaxed", "Anxious", "Stressed", "Happy", "Irritable"]
    },
    {
      name: "Treatment",
      icon: <Zap size={14} />,
      options: ["Dry Mouth", "Insomnia", "Appetite Change", "Metallic Taste"]
    }
  ];

  const moodEmojis = [
    { val: 1, emoji: "😔", label: "Low" },
    { val: 2, emoji: "😕", label: "Meh" },
    { val: 3, emoji: "😐", label: "Okay" },
    { val: 4, emoji: "🙂", label: "Good" },
    { val: 5, emoji: "💎", label: "Great" }
  ];

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

      {/* AI Insight Card */}
      <div className="mb-8">
        <WellnessInsightCard insight={insight} loading={insightLoading} />
      </div>

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
            <div className="premium-card overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="section-title flex items-center gap-2 mb-0">
                  <Smile size={16} className="text-success" /> Daily Vibe
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success uppercase tracking-wider">
                  Check-in
                </span>
              </div>
              
              <div className="space-y-8">
                {/* Energy Slider */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Vitality Level</p>
                    <p className="text-lg font-black text-foreground">{energy * 20}%</p>
                  </div>
                  <div className="relative h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${energy * 20}%` }}
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-success/40 to-success"
                    />
                    <input 
                      type="range" min="1" max="5" value={energy} 
                      onChange={(e) => setEnergy(parseInt(e.target.value))}
                      className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                    <Zap size={10} className="text-muted-foreground/40" />
                    <Zap size={10} className="text-success" />
                  </div>
                </div>

                {/* Mood Selector */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-4">Current Mood</p>
                  <div className="flex justify-between gap-2">
                    {moodEmojis.map((m) => (
                      <button
                        key={m.val}
                        onClick={() => setMood(m.val)}
                        className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl transition-all duration-300 ${mood === m.val ? "bg-success text-success-foreground scale-110 shadow-lg shadow-success/20 -translate-y-1" : "bg-muted/30 grayscale opacity-40 hover:opacity-100 hover:grayscale-0"}`}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className={`text-[8px] font-black uppercase tracking-tighter ${mood === m.val ? "opacity-100" : "opacity-0"}`}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Symptom Categorization */}
            <div className="premium-card">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="section-title flex items-center gap-2 mb-0">
                   <Activity size={16} className="text-primary" /> Body Scan
                 </h3>
               </div>

               <div className="space-y-6">
                 {symptomCategories.map((cat) => (
                   <div key={cat.name}>
                     <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                       {cat.icon}
                       <span>{cat.name}</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {cat.options.map(opt => (
                          <button
                            key={opt}
                            onClick={() => setSymptoms(prev => prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev, opt])}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${symptoms.includes(opt) ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10" : "bg-card border-border/50 text-muted-foreground hover:border-primary/30"}`}
                          >
                            {opt}
                          </button>
                        ))}
                     </div>
                   </div>
                 ))}
               </div>

               <Button 
                onClick={handleLogWellness}
                disabled={loading}
                className="w-full mt-8 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
               >
                 {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle2 className="mr-2" size={16} />}
                 Secure Daily Reflection
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="section-title flex items-center gap-2 mb-0">
                  <Utensils size={16} className="text-warning" /> Plate Analysis
                </h3>
                <Sparkles size={16} className="text-warning/40 animate-pulse" />
              </div>

              <div className="relative">
                <textarea 
                  value={meal}
                  onChange={(e) => setMeal(e.target.value)}
                  placeholder="What's on your plate?"
                  className="w-full h-36 p-5 rounded-2xl bg-muted/20 border-2 border-transparent focus:border-warning/30 outline-none transition-all font-medium text-sm leading-relaxed resize-none shadow-inner"
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 opacity-40">
                  <Info size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">AI Assisted</span>
                </div>
              </div>

              {/* Suggestions */}
              <div className="mt-4 mb-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3 ml-1">Quick Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {["Grilled Fish & Salad", "Fruit Smoothie", "Chicken Breast & Rice", "Oatmeal with Nuts"].map(s => (
                    <button
                      key={s}
                      onClick={() => setMeal(s)}
                      className="px-3 py-1.5 rounded-lg bg-warning/5 border border-warning/10 text-warning text-[10px] font-bold hover:bg-warning/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button 
                  onClick={checkMeal} 
                  variant="outline" 
                  disabled={loading || !meal}
                  className="h-12 rounded-xl text-[10px] font-black tracking-widest uppercase border-warning/20 text-warning hover:bg-warning/5"
                >
                  {loading ? <Loader2 className="animate-spin mr-2" size={14} /> : <ShieldCheck className="mr-2" size={14} />}
                  Safety Check
                </Button>
                <Button 
                  onClick={handleLogFood} 
                  disabled={loading || !meal}
                  className="h-12 rounded-xl text-[10px] font-black tracking-widest uppercase bg-warning text-warning-foreground hover:bg-warning/90 shadow-lg shadow-warning/20"
                >
                  Record Meal
                </Button>
              </div>

              {/* AI Meal Verdict */}
              <AnimatePresence>
                {mealSafety && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`mt-6 p-6 rounded-3xl border-2 relative overflow-hidden ${mealSafety.risk === "Safe" ? "bg-success/5 border-success/20" : mealSafety.risk === "Medium" ? "bg-warning/5 border-warning/20" : "bg-destructive/5 border-destructive/20"}`}
                  >
                    {/* Background Glow */}
                    <div className={`absolute -right-12 -bottom-12 w-32 h-32 blur-3xl opacity-20 ${mealSafety.risk === "Safe" ? "bg-success" : mealSafety.risk === "Medium" ? "bg-warning" : "bg-destructive"}`} />
Loop
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${mealSafety.risk === "Safe" ? "bg-success text-success-foreground" : mealSafety.risk === "Medium" ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}`}>
                        {mealSafety.risk === "Safe" ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">AI Verdict</p>
                        <h4 className="font-black text-lg leading-tight tracking-tight">{mealSafety.verdict}</h4>
                      </div>
                    </div>
                    
                    <div className="space-y-3 relative z-10">
                      <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                        {mealSafety.explanation}
                      </p>
                      
                      <div className={`h-1 w-full rounded-full bg-muted/30 overflow-hidden`}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: mealSafety.risk === "Safe" ? "100%" : mealSafety.risk === "Medium" ? "50%" : "20%" }}
                          className={`h-full ${mealSafety.risk === "Safe" ? "bg-success" : mealSafety.risk === "Medium" ? "bg-warning" : "bg-destructive"}`}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <motion.div variants={container} initial="hidden" animate="show" className="mt-12 space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title mb-0">Recent Reflections</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Last 10 Entries</span>
        </div>

        <div className="space-y-3">
          {wellnessLogs.length === 0 ? (
            <div className="p-12 rounded-3xl border-2 border-dashed border-border/50 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Heart size={24} className="text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">Your wellness journey starts here</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-widest">Log your first vibe or meal</p>
            </div>
          ) : (
            wellnessLogs.slice(0, 10).map((log) => (
              <motion.div 
                key={log.id} 
                variants={item}
                className="group p-5 rounded-3xl bg-card border border-border/50 flex items-start gap-5 transition-all hover:bg-accent/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-110 ${log.type === "food" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                   {log.type === "food" ? <Utensils size={20} /> : <Zap size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-1.5">
                     <p className="text-[10px] font-black text-foreground uppercase tracking-widest">
                       {log.type === "food" ? "Nutritional Log" : "Vitality Check"}
                     </p>
                     <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter bg-muted/50 px-1.5 py-0.5 rounded">
                       {format(new Date(log.timestamp), "MMM d • h:mm a")}
                     </p>
                   </div>
                   <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                     {log.type === "food" 
                       ? log.data.meal 
                       : (log.data.symptoms && log.data.symptoms.length > 0) 
                          ? `Feeling ${log.data.symptoms.join(", ")}` 
                          : `Overall vibe: ${log.data.mood === 5 ? "Incredible" : log.data.mood === 4 ? "Good" : "Steady"}`
                     }
                   </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
