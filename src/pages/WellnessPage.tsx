import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, WellnessLog } from "@/contexts/AppContext";
import { Heart, Utensils, Sparkles, Loader2, Smile, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Brain, Activity, Coffee, Info, Trash2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { aiApi } from "@/services/api";
import WellnessInsightCard from "@/components/wellness/WellnessInsightCard";
import { LottieMoji } from "@/components/rive/LottieMoji";
import { RiveMoji } from "@/components/rive/RiveMoji";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, isSameDay } from "date-fns";
import { toDate } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

// 7-day sparkline data derived from wellness logs
function useEmotionSparkline(wellnessLogs: ReturnType<typeof useApp>["wellnessLogs"]) {
  return Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayLogs = wellnessLogs.filter(
      (l) => l.type === "symptom" && isSameDay(toDate(l.timestamp), date)
    );
    if (dayLogs.length === 0) return { date, mood: null, energy: null };
    const avgMood =
      dayLogs.reduce((acc, l) => acc + (Number(l.data?.mood) || 0), 0) / dayLogs.length;
    const avgEnergy =
      dayLogs.reduce((acc, l) => acc + (Number(l.data?.energy) || 0), 0) / dayLogs.length;
    return { date, mood: avgMood, energy: avgEnergy };
  });
}

export default function WellnessPage() {
  const { wellnessLogs, addWellnessLog, deleteWellnessLog, medicines, doseLogs } = useApp();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"journal" | "food">("journal");
  const [loading, setLoading] = useState(false);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [insight, setInsight] = useState<any>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [guidance, setGuidance] = useState<any>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  
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

  const fetchNutritionalGuidance = async () => {
    if (medicines.length === 0) return;
    setGuidanceLoading(true);
    try {
      const res = await aiApi.getNutritionalGuidance({ medicines });
      setGuidance(res);
    } catch (err) {
      console.error("Failed to fetch nutritional guidance:", err);
    } finally {
      setGuidanceLoading(false);
    }
  };

  useEffect(() => {
    fetchNutritionalGuidance();
  }, [medicines.length]);
  
  // Journal State
  const [mood, setMood] = useState(3); // 1-5
  const [energy, setEnergy] = useState(3); // 1-5
  const [symptoms, setSymptoms] = useState<string[]>([]);
  
  // Food State
  const [meal, setMeal] = useState("");
  const [mealSafety, setMealSafety] = useState<any>(null);

  const handleLogWellness = async () => {
    setLoading(true);
    setReflectionLoading(true);
    try {
      // Step 1: Fetch personalized AI reflection from Groq (same API key flow as Dawa-GPT)
      let aiReflection: { reflection: string; affirmation: string; tip: string } | null = null;
      try {
        aiReflection = await aiApi.getEmotionReflection({
          mood,
          energy,
          symptoms,
          medicines,
        });
      } catch (reflectionErr) {
        console.warn("Groq reflection failed, saving log without AI reflection:", reflectionErr);
      } finally {
        setReflectionLoading(false);
      }

      // Step 2: Save wellness log with AI reflection baked into data (so it persists in Recent Reflections)
      await addWellnessLog({
        type: "symptom",
        data: {
          mood,
          energy,
          symptoms,
          ...(aiReflection ? { aiReflection } : {}),
        },
      });

      toast({
        title: aiReflection ? (
          <span className="flex items-center gap-2">
            Reflection Saved <RiveMoji emoji="✨" size={16} />
          </span>
        ) : "Journal Entry Saved",
        description: aiReflection
          ? "Your AI-powered reflection is ready."
          : "Your wellness data has been recorded.",
      });
      setSymptoms([]);
    } catch (err) {
      console.error("Failed to save wellness log:", err);
      toast({ title: "Save Failed", description: "Could not save your reflection. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
      setReflectionLoading(false);
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
    { val: 5, emoji: "🤩", label: "Great" }
  ];

  const sparklineData = useEmotionSparkline(wellnessLogs);

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
                          <LottieMoji emoji={m.emoji} size={32} className="mb-1" active={mood === m.val} />
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
                disabled={loading || reflectionLoading}
                className="w-full mt-8 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
               >
                 {reflectionLoading ? (
                   <><Loader2 className="animate-spin mr-2" size={16} /> Generating Reflection…</>
                 ) : loading ? (
                   <><Loader2 className="animate-spin mr-2" size={16} /> Saving…</>
                 ) : (
                   <><CheckCircle2 className="mr-2" size={16} /> Secure Daily Reflection</>
                 )}
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
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3 ml-1">Local Favorites</p>
                <div className="flex flex-wrap gap-2">
                  {["Matooke & G-nut Sauce", "Fish Stew & Kalo", "Katogo with Beans", "Steamed Luwombo", "Mukene & Posho", "Nakati & Sweet Potatoes", "Nsenene (Grasshoppers)", "Roasted Gonja"].map(s => (
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

              {/* AI Nutritional Guard */}
              <AnimatePresence>
                {(guidance || guidanceLoading) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-8 pt-6 border-t border-border/50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-warning flex items-center gap-2">
                        <ShieldCheck size={14} /> AI Nutritional Guard
                      </h4>
                      {guidanceLoading && <Loader2 size={12} className="animate-spin text-warning/50" />}
                    </div>

                    {guidance && (
                      <div className="space-y-4">
                        {/* Recommendations */}
                        <div className="grid grid-cols-1 gap-2">
                          {guidance.recommendations?.map((rec: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-success/5 border border-success/10 transition-all hover:bg-success/10">
                              <div className="mt-1 p-1 rounded-lg bg-success/20 text-success">
                                <Utensils size={10} />
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-foreground mb-0.5">{rec.food}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">{rec.benefit}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Warnings */}
                        {guidance.warnings?.length > 0 && (
                          <div className="space-y-2">
                            {guidance.warnings.map((warn: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                                <div className="mt-1 p-1 rounded-lg bg-destructive/20 text-destructive">
                                  <AlertTriangle size={10} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-[10px] font-black uppercase text-destructive tracking-widest">{warn.factor}</p>
                                    <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-[8px] font-black uppercase tracking-tighter text-destructive">
                                      {warn.severity} RISK
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground leading-tight">{warn.explanation}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Timing Advice */}
                        {guidance.timingAdvice && (
                          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-3">
                            <Coffee size={14} className="text-muted-foreground/60" />
                            <p className="text-[10px] font-semibold text-muted-foreground italic">
                              "{guidance.timingAdvice}"
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

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

      {/* 7-Day Emotion Sparkline */}
      {sparklineData.some(d => d.mood !== null) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 premium-card"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title flex items-center gap-2 mb-0">
              <Activity size={14} className="text-primary" /> 7-Day Emotion Trend
            </h3>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Mood</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Energy</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2 h-20">
            {sparklineData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '60px', justifyContent: 'flex-end' }}>
                  {d.mood !== null && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.mood / 5) * 60}px` }}
                      transition={{ delay: i * 0.06, duration: 0.4 }}
                      className="w-full rounded-t-lg bg-success/60 min-h-[4px]"
                    />
                  )}
                  {d.energy !== null && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.energy / 5) * 60}px` }}
                      transition={{ delay: i * 0.06 + 0.05, duration: 0.4 }}
                      className="w-1 rounded-full bg-primary/50 absolute"
                      style={{ position: 'relative' }}
                    />
                  )}
                  {d.mood === null && (
                    <div className="w-full h-1 bg-muted/30 rounded" />
                  )}
                </div>
                <span className="text-[8px] font-bold text-muted-foreground/40 uppercase">
                  {format(d.date, 'EEE')}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Feed */}
      <motion.div variants={container} initial="hidden" animate="show" className="mt-10 space-y-6">
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
            wellnessLogs.slice(0, 10).map((log) => {
              const logMood = log.type === "symptom" ? (log.data?.mood != null ? Number(log.data.mood) : null) : null;
              const logEnergy = log.type === "symptom" ? (log.data?.energy != null ? Number(log.data.energy) : null) : null;
              const logSymptoms = log.type === "symptom" ? (log.data?.symptoms as string[] | undefined) : null;
              const moodEmoji =
                logMood === 5 ? "🤩" : logMood === 4 ? "🙂" : logMood === 3 ? "😐" : logMood === 2 ? "😕" : logMood === 1 ? "😔" : null;

              const logAiReflection = log.type === "symptom"
                ? (log.data?.aiReflection as { reflection: string; affirmation: string; tip: string } | undefined)
                : undefined;

              return (
                <motion.div
                  key={log.id}
                  variants={item}
                  className="group rounded-3xl bg-card border border-border/50 overflow-hidden transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5"
                >
                  {/* Top row */}
                  <div className="flex items-start gap-4 p-5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-110 ${
                        log.type === "food" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                      }`}
                    >
                      {log.type === "food" ? <Utensils size={20} /> : moodEmoji ? (
                        <LottieMoji emoji={moodEmoji} size={24} active={true} />
                      ) : <Zap size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-black text-foreground uppercase tracking-widest">
                          {log.type === "food" ? "Nutritional Log" : "Vitality Check"}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter bg-muted/50 px-1.5 py-0.5 rounded">
                            {format(toDate(log.timestamp), "MMM d • h:mm a")}
                          </p>
                          <button
                            onClick={async () => {
                              if (confirm("Delete this log entry?")) {
                                try {
                                  await deleteWellnessLog(log.id);
                                  toast({ title: "Log Deleted" });
                                } catch (err) {
                                  toast({ title: "Delete Failed", variant: "destructive" });
                                }
                              }
                            }}
                            className="p-1 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                        {log.type === "food"
                          ? String(log.data?.meal ?? "")
                          : logSymptoms && logSymptoms.length > 0
                            ? `Feeling: ${logSymptoms.join(", ")}`
                            : logMood != null
                              ? `Mood: ${logMood >= 4 ? "Positive" : logMood <= 2 ? "Low" : "Steady"}`
                              : "Logged a check-in"}
                      </p>
                      {/* Mood + Energy mini indicators */}
                      {log.type === "symptom" && (logMood != null || logEnergy != null) && (
                        <div className="flex gap-3 mt-2">
                          {logMood != null && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Mood</span>
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(n => (
                                  <div key={n} className={`w-2 h-2 rounded-sm ${
                                    n <= logMood ? "bg-success" : "bg-muted/30"
                                  }`} />
                                ))}
                              </div>
                            </div>
                          )}
                          {logEnergy != null && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Energy</span>
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(n => (
                                  <div key={n} className={`w-2 h-2 rounded-sm ${
                                    n <= logEnergy ? "bg-primary" : "bg-muted/30"
                                  }`} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Reflection block — shown only for symptom logs that have one */}
                  {logAiReflection && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent border border-primary/15 p-4 space-y-3"
                    >
                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Sparkles size={12} className="text-primary" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">AI Reflection</span>
                      </div>

                      {/* Reflection text */}
                      <p className="text-xs font-medium text-foreground/80 leading-relaxed">
                        {logAiReflection.reflection}
                      </p>

                      {/* Affirmation pill */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                        <span className="text-[10px]"><RiveMoji emoji="✨" size={12} /></span>
                        <span className="text-[10px] font-bold text-success italic">{logAiReflection.affirmation}</span>
                      </div>

                      {/* Tip */}
                      {logAiReflection.tip && (
                        <div className="flex items-start gap-2 pt-1 border-t border-primary/10">
                          <Zap size={11} className="text-warning mt-0.5 shrink-0" />
                          <p className="text-[10px] font-semibold text-muted-foreground leading-snug">
                            {logAiReflection.tip}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
