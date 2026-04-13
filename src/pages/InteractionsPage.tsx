import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { checkInteractions } from "@/services/interactionChecker";
import { ParsedInteraction } from "@/types/interactions";
import { ShieldAlert, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import PremiumLoader from "@/components/PremiumLoader";
import { aiApi } from "@/services/api";
import { Coffee, Wine, GlassWater, Beef, Salad, Sparkles, Loader2 } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function InteractionsPage() {
  const { medicines } = useApp();
  const [interactions, setInteractions] = useState<ParsedInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const { t } = useTranslation();

  // Holistic/Lifestyle State
  const [lifestyleFactors, setLifestyleFactors] = useState<string[]>([]);
  const [holisticLoading, setHolisticLoading] = useState(false);
  const [holisticReport, setHolisticReport] = useState<any[]>([]);

  const availableFactors = [
    { id: "Alcohol", icon: Wine },
    { id: "Caffeine", icon: Coffee },
    { id: "Dairy", icon: GlassWater },
    { id: "Grapefruit", icon: Salad },
    { id: "High-fat meals", icon: Beef },
  ];

  const toggleFactor = (id: string) => {
    setLifestyleFactors(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const checkHolistic = async () => {
    if (medicines.length === 0 || lifestyleFactors.length === 0) return;
    setHolisticLoading(true);
    try {
      const res = await aiApi.checkHolisticSafety({
        medicines,
        lifestyleFactors
      });
      setHolisticReport(res.interactions || []);
    } catch (err) {
      console.error("Holistic check failed", err);
    } finally {
      setHolisticLoading(false);
    }
  };
  
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
    
    fetchInteractions();
  }, [medicines]);

  return (
    <div className="px-4 pt-12 pb-4">
      {medicines.length >= 2 && loading && !animationComplete && (
        <PremiumLoader 
          onComplete={() => setAnimationComplete(true)} 
          durationPerStep={1000} 
        />
      )}
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {t("safety.title")}
          </h1>
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
            <ShieldAlert size={20} />
          </div>
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80">
          {t("safety.subtitle")}
        </p>
      </motion.div>

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
          {interactions.map((interaction, idx) => (
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
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                {interaction.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Holistic Interaction Section */}
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
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-1 opacity-80">Check interactions with lifestyle & diet</p>
          </div>
          <button 
            onClick={checkHolistic}
            disabled={holisticLoading || lifestyleFactors.length === 0 || medicines.length === 0}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-primary/10 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
          >
            {holisticLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Analyze
          </button>
        </div>

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
                <p className="text-xs text-muted-foreground leading-relaxed mb-6 font-medium">{interaction.explanation}</p>
                <div className="bg-muted/10 p-4 rounded-xl border border-border/50">
                   <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Safety Advice</p>
                   <p className="text-xs font-semibold text-foreground leading-relaxed">{interaction.advice}</p>
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
             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select lifestyle factors and tap Analyze</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
