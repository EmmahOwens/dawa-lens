import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { Heart, Utensils, Sparkles, Loader2, Smile, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Brain, Activity, Coffee, Info, Trash2, TrendingUp } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { aiApi } from "@/services/api";
import { generateLocalClinicalAssessment } from "@/services/clinicalAssessmentService";
import WellnessInsightCard from "@/components/wellness/WellnessInsightCard";
import { LottieMoji } from "@/components/rive/LottieMoji";
import { RiveMoji } from "@/components/rive/RiveMoji";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, isSameDay } from "date-fns";
import { toDate } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

// 7-day sparkline data derived from wellness logs
function useEmotionSparkline(wellnessLogs: ReturnType<typeof usePatientScope>["scopedWellnessLogs"]) {
  const sparkline = Array.from({ length: 7 }).map((_, i) => {
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

  const hasLogs = sparkline.some((d) => d.mood !== null || d.energy !== null);
  if (!hasLogs) {
    return sparkline.map((d, i) => {
      if (i === 0) return { ...d, mood: 4.2, energy: 3.5 };
      if (i === 1) return { ...d, mood: 4.5, energy: 4.0 };
      return d;
    });
  }

  return sparkline;
}

/**
 * Normalizes warning explanation markdown text so that bullet points and bolding are preserved cleanly.
 * Splits inline bullets (e.g. "* Item 1 * Item 2") onto new lines.
 */
function formatWarningExplanation(text: string): string {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim().replace(/^["'\u201C\u201D\s]+|["'\u201C\u201D\s]+$/g, "").trim();
  clean = clean.replace(/(?:^|\s+)•\s*/g, "\n* ");
  clean = clean.replace(/([^\n])\s+([*•-]\s+)/g, "$1\n\n$2");
  clean = clean.replace(/([^\n])\s+(\d+)[\.\)]\s+/g, "$1\n\n$2. ");
  return clean.trim();
}

/**
 * Normalizes timing advice text so each numbered item (1. ..., 2. ...) is placed on its own line
 * rather than being compacted into a single run-on paragraph.
 */
function formatTimingAdvice(text: string | string[]): string {
  if (!text) return "";
  const rawText = Array.isArray(text) ? text.join("\n\n") : text;
  if (typeof rawText !== "string") return "";

  let clean = rawText.trim().replace(/^["'\u201C\u201D\s]+|["'\u201C\u201D\s]+$/g, "").trim();

  // Ensure each numbered item starts on a new line
  clean = clean.replace(/(?:^|\s+)(\d+)[\.\)]\s+/g, (match, num, offset) => {
    return offset === 0 ? `${num}. ` : `\n\n${num}. `;
  });

  clean = clean.replace(/(?:^|\s+)•\s*/g, "\n* ");
  clean = clean.replace(/([^\n])\s+([*•-]\s+)/g, "$1\n\n$2");

  return clean.trim();
}

export default function WellnessPage() {
  const { addWellnessLog, deleteWellnessLog } = useApp();
  const { scopedWellnessLogs, scopedMedicines, scopedDoseLogs } = usePatientScope();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"journal" | "food">("journal");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(false);
  const [reflectionLoading, setReflectionLoading] = useState(false);

  const isToday = isSameDay(selectedDate, new Date());

  const latestDayLog = useMemo(() => {
    return (
      scopedWellnessLogs
        .filter((l) => l.type === "symptom" && isSameDay(toDate(l.timestamp), selectedDate))
        .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime())[0] || null
    );
  }, [scopedWellnessLogs, selectedDate]);
  const [insight, setInsight] = useState<any>(() => {
    try {
      const cached = sessionStorage.getItem("dawa_wellness_page_insight");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [insightLoading, setInsightLoading] = useState(false);
  const [guidance, setGuidance] = useState<any>(() => {
    try {
      const cached = sessionStorage.getItem("dawa_nutritional_guidance");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [guidanceLoading, setGuidanceLoading] = useState(false);

  // Sort reflections by most recent timestamp descending and take the last 10 entries
  const recentReflections = useMemo(() => {
    return [...scopedWellnessLogs]
      .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime())
      .slice(0, 10);
  }, [scopedWellnessLogs]);

  const fetchWellnessInsight = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = (() => {
        try {
          const item = sessionStorage.getItem("dawa_wellness_page_insight");
          return item ? JSON.parse(item) : null;
        } catch {
          return null;
        }
      })();

      if (cached) {
        setInsight(cached);
        return;
      }
    }

    if (scopedWellnessLogs.length === 0 && scopedDoseLogs.length === 0 && scopedMedicines.length === 0) return;
    setInsightLoading(true);
    try {
      const res = await aiApi.getWellnessInsight({
        doseLogs: scopedDoseLogs,
        wellnessLogs: scopedWellnessLogs,
        medicines: scopedMedicines
      });
      if (res && typeof res === "object") {
        const raw = res as any;
        const scoreVal = typeof raw?.score === "number"
          ? raw.score
          : typeof raw?.correlationScore === "number"
          ? raw.correlationScore
          : 80;
        const normalized = {
          ...raw,
          score: Math.max(0, Math.min(100, Math.round(scoreVal))),
          correlationScore: Math.max(0, Math.min(100, Math.round(scoreVal))),
          insight: raw?.insight ?? (Array.isArray(raw?.insights) && raw.insights.length > 0 ? raw.insights[0] : (raw?.summary || "Adherence patterns recorded.")),
          recommendation: raw?.recommendation ?? (Array.isArray(raw?.actionItems) && raw.actionItems.length > 0 ? raw.actionItems[0] : "Maintain consistent scheduled doses."),
          status: raw?.status ?? (scoreVal >= 75 ? "improving" : scoreVal >= 50 ? "stable" : "declining"),
          source: "ai" as const,
        };
        setInsight(normalized);
        try {
          sessionStorage.setItem("dawa_wellness_page_insight", JSON.stringify(normalized));
        } catch (e) {
          console.error("Failed to save wellness page insight to sessionStorage", e);
        }
      } else {
        const local = generateLocalClinicalAssessment(scopedDoseLogs, scopedWellnessLogs, scopedMedicines);
        setInsight(local);
        try {
          sessionStorage.setItem("dawa_wellness_page_insight", JSON.stringify(local));
        } catch {}
      }
    } catch (err) {
      console.warn("AI Wellness insight fetch failed, falling back to local intelligence:", err);
      const local = generateLocalClinicalAssessment(scopedDoseLogs, scopedWellnessLogs, scopedMedicines);
      setInsight(local);
      try {
        sessionStorage.setItem("dawa_wellness_page_insight", JSON.stringify(local));
      } catch {}
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    fetchWellnessInsight();
  }, [scopedWellnessLogs, scopedDoseLogs, scopedMedicines]);

  const fetchNutritionalGuidance = async () => {
    const cached = (() => {
      try {
        const item = sessionStorage.getItem("dawa_nutritional_guidance");
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    })();

    if (cached) {
      setGuidance(cached);
      return;
    }

    if (scopedMedicines.length === 0) return;
    setGuidanceLoading(true);
    try {
      const res = await aiApi.getNutritionalGuidance({ medicines: scopedMedicines });
      if (res) {
        setGuidance(res);
        try {
          sessionStorage.setItem("dawa_nutritional_guidance", JSON.stringify(res));
        } catch (e) {
          console.error("Failed to save nutritional guidance to sessionStorage", e);
        }
      }
    } catch (err) {
      console.error("Failed to fetch nutritional guidance:", err);
    } finally {
      setGuidanceLoading(false);
    }
  };

  useEffect(() => {
    fetchNutritionalGuidance();
  }, [scopedMedicines]);

  // Journal State
  const [mood, setMood] = useState(3); // 1-5
  const [energy, setEnergy] = useState(3); // 1-5
  const [symptoms, setSymptoms] = useState<string[]>([]);

  // Sync Daily Vibe inputs whenever selectedDayLog or selectedDate changes
  useEffect(() => {
    if (latestDayLog) {
      const recordedMood = Number(latestDayLog.data?.mood);
      const recordedEnergy = Number(latestDayLog.data?.energy);
      const recordedSymptoms = latestDayLog.data?.symptoms;
      setMood(Number.isFinite(recordedMood) && recordedMood >= 1 && recordedMood <= 5 ? recordedMood : 3);
      setEnergy(Number.isFinite(recordedEnergy) && recordedEnergy >= 1 && recordedEnergy <= 5 ? recordedEnergy : 3);
      setSymptoms(Array.isArray(recordedSymptoms) ? recordedSymptoms : []);
    } else {
      setMood(3);
      setEnergy(3);
      setSymptoms([]);
    }
  }, [latestDayLog, selectedDate]);

  // Food State
  const [meal, setMeal] = useState("");
  const [mealSafety, setMealSafety] = useState<any>(null);

  const handleLogWellness = async () => {
    setLoading(true);
    setReflectionLoading(true);
    try {
      // Step 1: Fetch personalized AI reflection from Groq (same API key flow as DawaGPT)
      let aiReflection: { reflection: string; affirmation: string; tip: string } | null = null;
      try {
        aiReflection = await aiApi.getEmotionReflection({
          mood,
          energy,
          symptoms,
          medicines: scopedMedicines,
        });
      } catch (reflectionErr) {
        console.warn("Groq reflection failed, saving log without AI reflection:", reflectionErr);
      } finally {
        setReflectionLoading(false);
      }

      // Step 2: Save wellness log with AI reflection baked into data
      const timestamp = isToday ? new Date().toISOString() : selectedDate.toISOString();
      await addWellnessLog({
        type: "symptom",
        timestamp,
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
      const res = await aiApi.checkMealSafety({ medicines: scopedMedicines, mealDescription: meal });
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

  const sparklineData = useEmotionSparkline(scopedWellnessLogs);

  return (
    <div className="w-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
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
        <WellnessInsightCard insight={insight} loading={insightLoading} onRefresh={() => fetchWellnessInsight(true)} />
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
                <div>
                  <h3 className="section-title flex items-center gap-2 mb-0.5">
                    <Smile size={16} className="text-success" /> Daily Vibe
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                    {isToday ? "Today" : format(selectedDate, "EEEE")} • {format(selectedDate, "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {latestDayLog ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-success/15 text-success uppercase tracking-wider border border-success/20">
                      <CheckCircle2 size={11} /> Recorded
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-muted/70 text-muted-foreground uppercase tracking-wider border border-border/50">
                      Check-in
                    </span>
                  )}
                </div>
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
                        className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl transition-all duration-300 ${mood === m.val ? "bg-success text-success-foreground scale-110 shadow-lg shadow-success/20 -translate-y-1" : "bg-muted/30 hover:bg-muted/50"}`}
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
                ) : latestDayLog ? (
                  <><CheckCircle2 className="mr-2" size={16} /> Update Daily Reflection</>
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
                              <div className="mt-1 p-1 rounded-lg bg-success/20 text-success shrink-0">
                                <Utensils size={10} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-foreground mb-0.5">{rec.food}</p>
                                <div className="text-[10px] text-muted-foreground leading-tight">
                                  <ReactMarkdown
                                    components={{
                                      p: ({ children }) => <p className="mb-0 leading-tight">{children}</p>,
                                      strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                                    }}
                                  >
                                    {rec.benefit || rec.reason || ""}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Warnings */}
                        {guidance.warnings?.length > 0 && (
                          <div className="space-y-2">
                            {guidance.warnings.map((warn: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                                <div className="mt-1 p-1 rounded-lg bg-destructive/20 text-destructive shrink-0">
                                  <AlertTriangle size={10} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] font-black uppercase text-destructive tracking-widest">{warn.factor}</p>
                                    <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-[8px] font-black uppercase tracking-tighter text-destructive">
                                      {warn.severity} RISK
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground leading-relaxed">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({ children }) => <p className="mb-1 last:mb-0 leading-relaxed">{children}</p>,
                                        ul: ({ children }) => <ul className="list-disc pl-3.5 space-y-1 my-0.5">{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-0.5">{children}</ol>,
                                        li: ({ children }) => <li className="text-[10px] leading-relaxed marker:text-destructive/60">{children}</li>,
                                        strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                                      }}
                                    >
                                      {formatWarningExplanation(warn.explanation)}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Timing Advice */}
                        {guidance.timingAdvice && (
                          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex items-start gap-3">
                            <div className="mt-0.5 p-1 rounded-lg bg-muted/50 text-muted-foreground/70 shrink-0">
                              <Coffee size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                                Administration & Timing Advice
                              </p>
                              <div className="text-[10px] text-muted-foreground leading-relaxed">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                                    ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1.5 my-1">{children}</ol>,
                                    ul: ({ children }) => <ul className="list-disc pl-3.5 space-y-1.5 my-1">{children}</ul>,
                                    li: ({ children }) => <li className="text-[10px] leading-relaxed marker:font-bold marker:text-foreground/70 pl-0.5">{children}</li>,
                                    strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                                  }}
                                >
                                  {formatTimingAdvice(guidance.timingAdvice)}
                                </ReactMarkdown>
                              </div>
                            </div>
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

      {/* 7-Day Emotion Trend */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 sm:p-6 shadow-sm relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#3B82F6] flex items-center justify-center text-white shadow-sm shrink-0">
              <TrendingUp size={12} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              7-DAY EMOTION TREND
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#52D696]" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                MOOD
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                ENERGY
              </span>
            </div>
          </div>
        </div>

        {/* 7-Day Graph Grid */}
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end pt-4 pb-1 min-h-[140px]">
          {sparklineData.map((d, i) => {
            const hasData = d.mood !== null || d.energy !== null;
            const isSelected = isSameDay(d.date, selectedDate);
            const isDayToday = isSameDay(d.date, new Date());

            // Scale mood (1-5) into green capsule pill height (28px - 58px)
            const moodHeight = d.mood ? Math.max(28, (d.mood / 5) * 58) : 0;
            // Scale energy (1-5) into blue stem height (16px - 44px)
            const energyHeight = d.energy ? Math.max(16, (d.energy / 5) * 44) : 0;

            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`flex flex-col items-center gap-2 group relative py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer focus:outline-none ${
                  isSelected
                    ? "bg-primary/10 ring-2 ring-primary shadow-sm -translate-y-0.5"
                    : "hover:bg-muted/40"
                }`}
                aria-label={`View vibe for ${format(d.date, "MMM d")}`}
              >
                {/* Tooltip on hover */}
                {hasData && (
                  <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-lg shadow-lg whitespace-nowrap z-20">
                    Mood: {d.mood ? d.mood.toFixed(1) : "—"} | Energy: {d.energy ? d.energy.toFixed(1) : "—"}
                  </div>
                )}

                {/* Graph Column Height Container */}
                <div className="w-full flex flex-col items-center justify-end h-[95px] relative">
                  {hasData ? (
                    <div className="flex flex-col items-center w-full relative">
                      {/* Green Mood Capsule Bar */}
                      {d.mood !== null && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: `${moodHeight}px`, opacity: 1 }}
                          transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
                          className={`w-full max-w-[46px] sm:max-w-[54px] rounded-2xl bg-[#52D696] shadow-sm relative z-10 ${
                            isSelected ? "ring-2 ring-primary/40 shadow-md" : ""
                          }`}
                        />
                      )}

                      {/* Blue Energy Stem protruding vertically below mood pill */}
                      {d.energy !== null && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: `${energyHeight}px`, opacity: 1 }}
                          transition={{ delay: i * 0.05 + 0.04, duration: 0.4, ease: "easeOut" }}
                          className="w-[3.5px] rounded-full bg-[#3B82F6] relative -mt-1 z-0"
                        />
                      )}
                    </div>
                  ) : (
                    /* Baseline dash for empty days */
                    <div className={`w-full h-[2.5px] rounded-full mb-1 ${isSelected ? "bg-primary" : "bg-slate-100 dark:bg-slate-800"}`} />
                  )}
                </div>

                {/* Day Label */}
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isSelected ? "text-primary font-black" : "text-slate-400 dark:text-slate-500"
                  }`}>
                    {format(d.date, "EEE")}
                  </span>
                  {isDayToday && (
                    <span className={`text-[8px] font-black uppercase tracking-tighter leading-none mt-0.5 ${
                      isSelected ? "text-primary" : "text-primary/70"
                    }`}>
                      Today
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Feed */}
      <motion.div variants={container} initial="hidden" animate="show" className="mt-10 space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title mb-0">Recent Reflections</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Last 10 Entries</span>
        </div>

        <div className="space-y-3">
          {recentReflections.length === 0 ? (
            <div className="p-12 rounded-3xl border-2 border-dashed border-border/50 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Heart size={24} className="text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">Your wellness journey starts here</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-widest">Log your first vibe or meal</p>
            </div>
          ) : (
            recentReflections.map((log) => {
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
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-110 ${log.type === "food" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
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
                                {[1, 2, 3, 4, 5].map(n => (
                                  <div key={n} className={`w-2 h-2 rounded-sm ${n <= logMood ? "bg-success" : "bg-muted/30"
                                    }`} />
                                ))}
                              </div>
                            </div>
                          )}
                          {logEnergy != null && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Energy</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(n => (
                                  <div key={n} className={`w-2 h-2 rounded-sm ${n <= logEnergy ? "bg-primary" : "bg-muted/30"
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
