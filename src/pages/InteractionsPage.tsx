import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useApp } from "@/contexts/AppContext";
import { checkInteractions, getRxCUI, getSpellingSuggestions } from "@/services/interactionChecker";
import { ParsedInteraction } from "@/types/interactions";
import { 
  ShieldAlert, AlertTriangle, Info, CheckCircle2, 
  Search, Plus, Trash2, Share2, X, Coffee, Wine, 
  GlassWater, Beef, Salad, Sparkles, Loader2, Brain 
} from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import PremiumLoader from "@/components/PremiumLoader";
import { aiApi } from "@/services/api";
import { toast } from "sonner";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function InteractionsPage() {
  const { medicines } = useApp();
  const [activeTab, setActiveTab] = useState<"cabinet" | "sandbox">("cabinet");
  const { t } = useTranslation();

  // Cabinet State
  const [interactions, setInteractions] = useState<ParsedInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Sandbox State
  const [sandboxDrugs, setSandboxDrugs] = useState<{ name: string; rxcui: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sandboxInteractions, setSandboxInteractions] = useState<ParsedInteraction[]>([]);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [searchingDrug, setSearchingDrug] = useState(false);

  // Holistic/Lifestyle State
  const [lifestyleFactors, setLifestyleFactors] = useState<string[]>([]);
  const [customFactor, setCustomFactor] = useState("");
  const [customFactors, setCustomFactors] = useState<string[]>([]);
  const [holisticLoading, setHolisticLoading] = useState(false);
  const [holisticReport, setHolisticReport] = useState<any[]>([]);

  // AI Translate State
  const [explanations, setExplanations] = useState<Record<string, { loading: boolean; text: string }>>({});
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);

  const availableFactors = [
    { id: "Alcohol", icon: Wine },
    { id: "Caffeine", icon: Coffee },
    { id: "Dairy", icon: GlassWater },
    { id: "Grapefruit", icon: Salad },
    { id: "High-fat meals", icon: Beef },
  ];

  const handleTabChange = (tab: "cabinet" | "sandbox") => {
    NativeService.haptics.impact(ImpactStyle.Light);
    setActiveTab(tab);
    setHolisticReport([]); // Clear reports on tab change to prevent mixups
  };

  const toggleFactor = (id: string) => {
    NativeService.haptics.impact(ImpactStyle.Light);
    setLifestyleFactors(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleAddCustomFactor = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customFactor.trim();
    if (!clean) return;
    
    if (customFactors.some(f => f.toLowerCase() === clean.toLowerCase()) || 
        availableFactors.some(f => f.id.toLowerCase() === clean.toLowerCase())) {
      toast.warning(`"${clean}" is already added.`);
      return;
    }

    NativeService.haptics.impact(ImpactStyle.Medium);
    setCustomFactors(prev => [...prev, clean]);
    setLifestyleFactors(prev => [...prev, clean]);
    setCustomFactor("");
    toast.success(`Added lifestyle factor: ${clean}`);
  };

  const removeCustomFactor = (factor: string) => {
    NativeService.haptics.impact(ImpactStyle.Light);
    setCustomFactors(prev => prev.filter(f => f !== factor));
    setLifestyleFactors(prev => prev.filter(f => f !== factor));
  };

  const checkHolistic = async () => {
    const activeMeds = activeTab === "cabinet" 
      ? medicines 
      : sandboxDrugs.map(d => ({ name: d.name, genericName: "" }));

    if (activeMeds.length === 0 || lifestyleFactors.length === 0) {
      toast.error("Please add medications and select lifestyle factors first.");
      return;
    }
    
    NativeService.haptics.impact(ImpactStyle.Medium);
    setHolisticLoading(true);
    try {
      const res = await aiApi.checkHolisticSafety({
        medicines: activeMeds as any[],
        lifestyleFactors
      }) as any;
      setHolisticReport(res.interactions || []);
      toast.success("Holistic safety report ready!");
    } catch (err) {
      console.error("Holistic check failed", err);
      toast.error("Failed to check lifestyle interactions.");
    } finally {
      setHolisticLoading(false);
    }
  };
  
  // Cabinet Safety Fetch
  useEffect(() => {
    const fetchInteractions = async () => {
      const rxcuis = medicines.map(m => m.rxcui).filter((id): id is string => !!id);
      
      if (rxcuis.length < 2) {
        setInteractions([]);
        return;
      }
      
      setLoading(true);
      try {
        const results = await checkInteractions(rxcuis);
        setInteractions(results);
      } catch (error) {
        console.error("Failed to load interactions", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (activeTab === "cabinet") {
      fetchInteractions();
    }
  }, [medicines, activeTab]);

  // Sandbox Safety Fetch
  useEffect(() => {
    const fetchSandboxInteractions = async () => {
      const rxcuis = sandboxDrugs.map(d => d.rxcui);
      if (rxcuis.length < 2) {
        setSandboxInteractions([]);
        return;
      }
      
      setSandboxLoading(true);
      try {
        const results = await checkInteractions(rxcuis);
        setSandboxInteractions(results);
      } catch (error) {
        console.error("Failed to load sandbox interactions", error);
      } finally {
        setSandboxLoading(false);
      }
    };

    if (activeTab === "sandbox") {
      fetchSandboxInteractions();
    }
  }, [sandboxDrugs, activeTab]);

  // Autocomplete Suggestions Effect
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const list = await getSpellingSuggestions(searchQuery);
      setSuggestions(list);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add drug to sandbox
  const addSandboxDrug = async (drugName: string) => {
    const cleanName = drugName.trim();
    if (!cleanName) return;

    if (sandboxDrugs.some(d => d.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.warning(`${cleanName} is already in the sandbox.`);
      return;
    }

    setSearchingDrug(true);
    try {
      const rxcui = await getRxCUI(cleanName);
      if (rxcui) {
        NativeService.haptics.impact(ImpactStyle.Medium);
        setSandboxDrugs(prev => [...prev, { name: cleanName, rxcui }]);
        setSearchQuery("");
        setSuggestions([]);
        toast.success(`Added ${cleanName} to sandbox.`);
      } else {
        toast.error(`Could not find "${cleanName}" in drug registry.`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Search failed. Check your internet connection.");
    } finally {
      setSearchingDrug(false);
    }
  };

  const removeSandboxDrug = (rxcui: string) => {
    NativeService.haptics.impact(ImpactStyle.Light);
    setSandboxDrugs(prev => prev.filter(d => d.rxcui !== rxcui));
  };

  const loadCabinetMeds = () => {
    const added: { name: string; rxcui: string }[] = [];
    medicines.forEach(m => {
      if (m.rxcui && !sandboxDrugs.some(d => d.rxcui === m.rxcui)) {
        added.push({ name: m.name, rxcui: m.rxcui });
      }
    });

    if (added.length === 0) {
      toast.info("No new cabinet medicines with valid RxCUIs to load.");
      return;
    }

    NativeService.haptics.impact(ImpactStyle.Medium);
    setSandboxDrugs(prev => [...prev, ...added]);
    toast.success(`Loaded ${added.length} medicines from cabinet.`);
  };

  const clearSandbox = () => {
    NativeService.haptics.impact(ImpactStyle.Heavy);
    setSandboxDrugs([]);
    setSandboxInteractions([]);
    toast.success("Sandbox cleared.");
  };

  // AI Translation helper
  const translateExplanation = async (interactionKey: string, drug1: string, drug2: string, technicalDesc: string) => {
    if (expandedExplanation === interactionKey) {
      setExpandedExplanation(null);
      return;
    }
    
    setExpandedExplanation(interactionKey);

    if (explanations[interactionKey]?.text) return;

    NativeService.haptics.impact(ImpactStyle.Light);
    setExplanations(prev => ({
      ...prev,
      [interactionKey]: { loading: true, text: "" }
    }));

    try {
      const response = await aiApi.chat({
        messages: [
          {
            role: "user",
            text: `Explain this clinical drug-drug interaction in simple, plain English for a patient.
Keep it extremely concise (maximum 3 bullet points, under 80 words total).
Detail:
- The specific risk in simple terms
- Clear instructions on what the patient should do (spacing, avoidance)
- Clear advice on when to call a doctor

Technical Description: "${technicalDesc}" between "${drug1}" and "${drug2}".`
          }
        ],
        medicines: [],
        userProfile: null,
        doseLogs: []
      });

      setExplanations(prev => ({
        ...prev,
        [interactionKey]: { loading: false, text: response.text }
      }));
    } catch (err) {
      console.error("Translation failed", err);
      toast.error("Failed to explain interaction.");
      setExplanations(prev => ({
        ...prev,
        [interactionKey]: { loading: false, text: "Could not fetch explanation. Please consult a health worker." }
      }));
    }
  };

  const handleShareReport = async () => {
    NativeService.haptics.impact(ImpactStyle.Medium);
    let reportText = `🛡️ Dawa Lens Safety & Interactions Report\n`;
    reportText += `Generated on: ${new Date().toLocaleDateString()}\n\n`;

    if (activeTab === "cabinet") {
      reportText += `=== CABINET MEDICATIONS ===\n`;
      if (medicines.length === 0) {
        reportText += `No medications currently in cabinet.\n`;
      } else {
        medicines.forEach(m => {
          reportText += `- ${m.name}${m.genericName ? ` (${m.genericName})` : ""}\n`;
        });
      }
      reportText += `\n`;

      reportText += `=== DETECTED INTERACTIONS ===\n`;
      if (interactions.length === 0) {
        reportText += `No drug-drug interactions detected.\n`;
      } else {
        interactions.forEach(inter => {
          const sev = inter.severity === "high" ? "🚨 SEVERE" : "⚠️ WARNING";
          reportText += `[${sev}] ${inter.drug1} & ${inter.drug2}\nDescription: ${inter.description}\n\n`;
        });
      }
    } else {
      reportText += `=== SANDBOX MEDICATIONS ===\n`;
      if (sandboxDrugs.length === 0) {
        reportText += `No medications currently in sandbox.\n`;
      } else {
        sandboxDrugs.forEach(d => {
          reportText += `- ${d.name}\n`;
        });
      }
      reportText += `\n`;

      reportText += `=== DETECTED INTERACTIONS ===\n`;
      if (sandboxInteractions.length === 0) {
        reportText += `No drug-drug interactions detected.\n`;
      } else {
        sandboxInteractions.forEach(inter => {
          const sev = inter.severity === "high" ? "🚨 SEVERE" : "⚠️ WARNING";
          reportText += `[${sev}] ${inter.drug1} & ${inter.drug2}\nDescription: ${inter.description}\n\n`;
        });
      }
    }

    if (holisticReport.length > 0) {
      reportText += `=== HOLISTIC & LIFESTYLE SAFETY ===\n`;
      holisticReport.forEach(h => {
        reportText += `[${h.risk} RISK] ${h.factor}\n`;
        reportText += `Explanation: ${h.explanation.replace(/[*#]/g, "")}\n`;
        reportText += `Advice: ${h.advice.replace(/[*#]/g, "")}\n\n`;
      });
    }

    reportText += `Disclaimer: This report is generated by Dawa Lens for informational purposes. Always consult a healthcare professional before changing your medication regimen.`;

    try {
      const { Share } = await import("@capacitor/share");
      const isNative = typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform();
      
      if (isNative) {
        await Share.share({
          title: "Medication Safety Report",
          text: reportText,
          dialogTitle: "Share Safety Report",
        });
      } else {
        if (navigator.share) {
          await navigator.share({
            title: "Medication Safety Report",
            text: reportText,
          });
        } else {
          await navigator.clipboard.writeText(reportText);
          toast.success("Safety report copied to clipboard!");
        }
      }
    } catch (err) {
      console.error("Share failed", err);
      try {
        await navigator.clipboard.writeText(reportText);
        toast.success("Safety report copied to clipboard!");
      } catch (clipErr) {
        toast.error("Failed to share or copy report.");
      }
    }
  };

  return (
    <div className="px-4 pt-12 pb-24">
      {activeTab === "cabinet" && medicines.length >= 2 && loading && !animationComplete && (
        <PremiumLoader 
          onComplete={() => setAnimationComplete(true)} 
          durationPerStep={1000} 
        />
      )}

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {activeTab === "cabinet" ? t("safety.title") : "Safety Sandbox"}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80 mt-1">
              {activeTab === "cabinet" ? t("safety.subtitle") : "Test interactions between arbitrary medicines"}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleShareReport}
              className="w-11 h-11 rounded-xl bg-card border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-all active:scale-95"
              title="Share Report"
            >
              <Share2 size={18} />
            </button>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <ShieldAlert size={20} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Glassmorphic Tab Switcher */}
      <div className="flex p-1 bg-muted/30 border border-border/30 rounded-xl mb-6 backdrop-blur-md">
        <button
          onClick={() => handleTabChange("cabinet")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "cabinet"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Cabinet Safety
        </button>
        <button
          onClick={() => handleTabChange("sandbox")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "sandbox"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Safety Sandbox
        </button>
      </div>

      {/* Disclaimer */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-8 p-4 rounded-xl border border-warning/20 bg-warning/5 transition-all hover:bg-warning/10"
      >
        <div className="flex items-start gap-3 text-warning">
          <Info size={16} className="mt-0.5 shrink-0 opacity-80" />
          <div className="text-[11px] leading-relaxed">
            <p className="font-bold mb-1 uppercase tracking-wider">{t("safety.disclaimer_title")}</p>
            <p className="opacity-90">
              {t("safety.disclaimer_body")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* TAB 1: CABINET SAFETY */}
      {activeTab === "cabinet" && (
        <div className="space-y-6">
          {medicines.length < 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="premium-card p-12 text-center"
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/40">
                <ShieldAlert size={24} />
              </div>
              <p className="text-sm text-muted-foreground font-semibold">
                {t("safety.no_medicines")}
              </p>
            </motion.div>
          )}

          {medicines.length >= 2 && loading && animationComplete && (
            <div className="space-y-4">
              <Skeleton className="h-[100px] w-full rounded-2xl" />
              <Skeleton className="h-[100px] w-full rounded-2xl" />
            </div>
          )}

          {medicines.length >= 2 && (!loading || animationComplete) && interactions.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-8 text-center"
            >
              <CheckCircle2 className="h-10 w-10 text-emerald-500/80 mx-auto mb-4" />
              <h3 className="font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{t("safety.no_interactions")}</h3>
            </motion.div>
          )}

          {medicines.length >= 2 && (!loading || animationComplete) && interactions.length > 0 && (
            <motion.div 
              variants={container} 
              initial="hidden" 
              animate="show" 
              className="space-y-4"
            >
              <h3 className="section-title flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                {t("safety.detected")} ({interactions.length})
              </h3>
              {interactions.map((interaction, idx) => {
                const key = `cabinet-${idx}`;
                const isExpanded = expandedExplanation === key;
                return (
                  <motion.div 
                    key={idx} 
                    variants={item}
                    className="rounded-xl border border-border/50 bg-card p-5 shadow-sm overflow-hidden relative transition-all hover:bg-accent/5"
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${interaction.severity === 'high' ? 'bg-destructive' : 'bg-warning'}`} />
                    
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-card-foreground lowercase capitalize tracking-tight">{interaction.drug1}</span>
                        <span className="text-muted-foreground text-[10px] font-bold uppercase opacity-50">&</span>
                        <span className="font-bold text-sm text-card-foreground lowercase capitalize tracking-tight">{interaction.drug2}</span>
                      </div>
                      {interaction.severity === 'high' ? (
                        <Badge variant="destructive" className="ml-2 px-2 py-0 text-[9px] uppercase font-bold tracking-widest">{t("safety.severe")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-warning/10 text-warning-foreground px-2 py-0 text-[9px] uppercase font-bold tracking-widest">{t("safety.warning")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium mb-3">
                      {interaction.description}
                    </p>

                    <button
                      onClick={() => translateExplanation(key, interaction.drug1, interaction.drug2, interaction.description)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      {explanations[key]?.loading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {isExpanded ? "Close Breakdown" : "AI Plain English Translation"}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 pt-4 border-t border-border/40 overflow-hidden"
                        >
                          <div className="bg-muted/10 p-3.5 rounded-xl border border-border/30">
                            <h4 className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1">
                              <Brain size={10} /> AI Breakdown Guidance
                            </h4>
                            {explanations[key]?.loading ? (
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-5/6" />
                              </div>
                            ) : (
                              <div className="text-xs text-foreground leading-relaxed font-medium prose prose-sm max-w-none">
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1">{children}</ul>,
                                    li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                                  }}
                                >
                                  {explanations[key]?.text}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* TAB 2: SAFETY SANDBOX */}
      {activeTab === "sandbox" && (
        <div className="space-y-6">
          <div className="premium-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Sandbox Drug Inventory</h3>
            
            {/* Search Input */}
            <div className="relative w-full mb-2">
              <input
                type="text"
                placeholder="Search and add a drug (e.g. Aspirin, Ibuprofen)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/40 border border-border/40 focus:outline-none focus:border-primary/50 text-sm text-foreground placeholder:text-muted-foreground/60"
              />
              <Search className="absolute left-3.5 top-3.5 text-muted-foreground/50" size={16} />
              {searchingDrug && <Loader2 className="absolute right-3.5 top-3.5 text-primary animate-spin" size={16} />}
            </div>

            {/* Spelling Suggestions */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-card border border-border/50 rounded-xl p-2.5 max-h-40 overflow-y-auto mb-4 flex flex-wrap gap-2 shadow-inner"
                >
                  <p className="w-full text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 px-1 mb-1">Suggestions:</p>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => addSandboxDrug(s)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/5 border border-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1 active:scale-95"
                    >
                      <Plus size={10} />
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Input Add Button when suggestions are empty but typing is done */}
            {searchQuery.trim().length >= 2 && suggestions.length === 0 && !searchingDrug && (
              <button
                onClick={() => addSandboxDrug(searchQuery)}
                className="flex items-center gap-1.5 text-xs text-primary font-bold px-1 mb-4 active:scale-95"
              >
                <Plus size={14} /> Add "{searchQuery}" directly
              </button>
            )}

            {/* Controls */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/40">
              <button
                onClick={loadCabinetMeds}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5"
              >
                <Plus size={12} /> Load Cabinet Meds
              </button>
              {sandboxDrugs.length > 0 && (
                <button
                  onClick={clearSandbox}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-all flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> Clear Sandbox
                </button>
              )}
            </div>
          </div>

          {/* Currently Added Sandbox Drugs */}
          <AnimatePresence>
            {sandboxDrugs.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap gap-2 mb-4 bg-card border border-border/40 p-4 rounded-xl shadow-sm"
              >
                <p className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Sandbox Drugs ({sandboxDrugs.length})</p>
                {sandboxDrugs.map(d => (
                  <motion.div
                    key={d.rxcui}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border/50 text-foreground"
                  >
                    <span className="text-xs font-semibold lowercase capitalize">{d.name}</span>
                    <button
                      onClick={() => removeSandboxDrug(d.rxcui)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactions Results */}
          {sandboxDrugs.length < 2 ? (
            <div className="p-8 border border-dashed border-border/50 rounded-2xl text-center opacity-60 bg-muted/5">
              <ShieldAlert className="mx-auto text-muted-foreground mb-3" size={24} />
              <p className="text-xs font-semibold text-muted-foreground">Add at least two medications to sandbox to check for drug-drug interactions.</p>
            </div>
          ) : sandboxLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[100px] w-full rounded-2xl" />
              <Skeleton className="h-[100px] w-full rounded-2xl" />
            </div>
          ) : sandboxInteractions.length === 0 ? (
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/80 mx-auto mb-4" />
              <h3 className="font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">No drug-drug interactions detected between Sandbox medicines.</h3>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="section-title flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Sandbox Interactions Detected ({sandboxInteractions.length})
              </h3>
              {sandboxInteractions.map((interaction, idx) => {
                const key = `sandbox-${idx}`;
                const isExpanded = expandedExplanation === key;
                return (
                  <motion.div 
                    key={idx} 
                    className="rounded-xl border border-border/50 bg-card p-5 shadow-sm overflow-hidden relative transition-all hover:bg-accent/5"
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${interaction.severity === 'high' ? 'bg-destructive' : 'bg-warning'}`} />
                    
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-card-foreground lowercase capitalize tracking-tight">{interaction.drug1}</span>
                        <span className="text-muted-foreground text-[10px] font-bold uppercase opacity-50">&</span>
                        <span className="font-bold text-sm text-card-foreground lowercase capitalize tracking-tight">{interaction.drug2}</span>
                      </div>
                      {interaction.severity === 'high' ? (
                        <Badge variant="destructive" className="ml-2 px-2 py-0 text-[9px] uppercase font-bold tracking-widest">{t("safety.severe")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-warning/10 text-warning-foreground px-2 py-0 text-[9px] uppercase font-bold tracking-widest">{t("safety.warning")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium mb-3">
                      {interaction.description}
                    </p>

                    <button
                      onClick={() => translateExplanation(key, interaction.drug1, interaction.drug2, interaction.description)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      {explanations[key]?.loading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {isExpanded ? "Close Breakdown" : "AI Plain English Translation"}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 pt-4 border-t border-border/40 overflow-hidden"
                        >
                          <div className="bg-muted/10 p-3.5 rounded-xl border border-border/30">
                            <h4 className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1">
                              <Brain size={10} /> AI Breakdown Guidance
                            </h4>
                            {explanations[key]?.loading ? (
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-5/6" />
                              </div>
                            ) : (
                              <div className="text-xs text-foreground leading-relaxed font-medium prose prose-sm max-w-none">
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1">{children}</ul>,
                                    li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                                  }}
                                >
                                  {explanations[key]?.text}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Holistic Safety Section (Used dynamically on active medication set) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 pt-12 border-t border-border/50"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 tracking-tight">
              <Sparkles size={20} className="text-primary" />
              Holistic Safety
            </h2>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-1 opacity-80">
              Check diet, herb & lifestyle safety for {activeTab === "cabinet" ? "cabinet" : "sandbox"} meds
            </p>
          </div>
          <button 
            onClick={checkHolistic}
            disabled={holisticLoading || lifestyleFactors.length === 0 || (activeTab === "cabinet" ? medicines.length === 0 : sandboxDrugs.length === 0)}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-primary/10 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
          >
            {holisticLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Analyze
          </button>
        </div>

        {/* Custom Factor Form */}
        <form onSubmit={handleAddCustomFactor} className="flex gap-2 mb-6 w-full max-w-md">
          <input
            type="text"
            placeholder="Add custom factor (e.g. Ginseng, Green Tea, Iron)"
            value={customFactor}
            onChange={(e) => setCustomFactor(e.target.value)}
            className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-card border border-border/50 focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            className="h-9 px-4 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/70 text-xs font-bold uppercase tracking-wider text-foreground transition-colors"
          >
            Add
          </button>
        </form>

        {/* Custom Factors Tag Display */}
        {customFactors.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {customFactors.map(factor => {
              const active = lifestyleFactors.includes(factor);
              return (
                <div
                  key={factor}
                  onClick={() => toggleFactor(factor)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    active 
                      ? "bg-warning/10 border-warning/40 text-warning-foreground dark:text-warning" 
                      : "bg-card border-border/30 text-muted-foreground hover:border-warning/20"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">{factor}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomFactor(factor);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Standard Quick Select Chips */}
        <div className="flex flex-wrap gap-2 mb-10">
          {availableFactors.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => toggleFactor(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                lifestyleFactors.includes(id) 
                  ? "bg-primary border-primary text-primary-foreground shadow-md ring-1 ring-primary/20" 
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/20"
              }`}
            >
              <Icon size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{id}</span>
            </button>
          ))}
        </div>

        {/* Results display */}
        {holisticReport.length > 0 && (
          <div className="space-y-4">
            {holisticReport.map((interaction, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="premium-card relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 w-1 h-full transition-all group-hover:w-1.5 ${
                  interaction.risk === "High" ? "bg-destructive" : interaction.risk === "Medium" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex items-center justify-between mb-4">
                   <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                     {interaction.factor}
                   </h4>
                   <Badge className={`px-2 py-0 text-[10px] font-bold uppercase tracking-widest ${
                     interaction.risk === "High" ? "bg-destructive text-destructive-foreground" : 
                     interaction.risk === "Medium" ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground"
                   }`}>
                     {interaction.risk} Risk
                   </Badge>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed mb-6 font-medium">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    }}
                  >
                    {interaction.explanation}
                  </ReactMarkdown>
                </div>
                <div className="bg-muted/10 p-4 rounded-xl border border-border/50">
                   <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Safety Advice</p>
                   <div className="text-xs font-semibold text-foreground leading-relaxed">
                     <ReactMarkdown
                       components={{
                         p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                       }}
                     >
                       {interaction.advice}
                     </ReactMarkdown>
                   </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {holisticReport.length === 0 && !holisticLoading && (
          <div className="p-12 rounded-2xl border border-dashed border-border/50 flex flex-col items-center text-center opacity-60 bg-muted/5">
             <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground/40">
               <Info size={24} />
             </div>
             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select factors and tap Analyze to see holistic feedback</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
