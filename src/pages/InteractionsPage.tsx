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
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShieldAlert size={28} className="text-primary" />
          {t("safety.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("safety.subtitle")}
        </p>
      </motion.div>

      {/* Disclaimer */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4 font-medium"
      >
        <div className="flex items-start gap-2 text-warning">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold mb-1">{t("safety.disclaimer_title")}</p>
            <p>
              {t("safety.disclaimer_body")}
            </p>
          </div>
        </div>
      </motion.div>

      {medicines.length < 2 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-10 text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="opacity-40 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
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
          className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-6 text-center"
        >
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-bold text-emerald-600 dark:text-emerald-400">{t("safety.no_interactions")}</h3>
        </motion.div>
      )}

      {medicines.length >= 2 && (!loading || animationComplete) && interactions.length > 0 && (
        <motion.div 
          variants={container} 
          initial="hidden" 
          animate="show" 
          className="space-y-4"
        >
          <h3 className="font-semibold text-base text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            {t("safety.detected")} ({interactions.length})
          </h3>
          {interactions.map((interaction, idx) => (
            <motion.div 
              key={idx} 
              variants={item}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden relative"
            >
              <div className={`absolute top-0 left-0 w-1.5 h-full ${interaction.severity === 'high' ? 'bg-destructive' : 'bg-warning'}`} />
              
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-card-foreground lowercase capitalize">{interaction.drug1}</span>
                  <span className="text-muted-foreground text-xs font-normal">&</span>
                  <span className="font-bold text-sm text-card-foreground lowercase capitalize">{interaction.drug2}</span>
                </div>
                {interaction.severity === 'high' ? (
                  <Badge variant="destructive" className="ml-2 px-2 py-0 text-[10px] uppercase font-bold tracking-wider">{t("safety.severe")}</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-warning/20 text-warning-foreground dark:bg-warning/30 px-2 py-0 text-[10px] uppercase font-bold tracking-wider">{t("safety.warning")}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <Sparkles size={22} className="text-primary" />
              Holistic Safety
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Check interactions with lifestyle & diet</p>
          </div>
          <button 
            onClick={checkHolistic}
            disabled={holisticLoading || lifestyleFactors.length === 0 || medicines.length === 0}
            className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
          >
            {holisticLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Analyze
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {availableFactors.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => toggleFactor(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all ${
                lifestyleFactors.includes(id) 
                  ? "bg-primary border-primary text-primary-foreground shadow-md" 
                  : "bg-card border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Icon size={16} />
              <span className="text-[11px] font-black uppercase tracking-tight">{id}</span>
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
                className="p-6 rounded-[2rem] bg-card border border-border shadow-sm relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  interaction.risk === "High" ? "bg-destructive" : interaction.risk === "Medium" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex items-center justify-between mb-3">
                   <h4 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
                     {interaction.factor}
                   </h4>
                   <Badge className={
                     interaction.risk === "High" ? "bg-destructive text-destructive-foreground" : 
                     interaction.risk === "Medium" ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground"
                   }>
                     {interaction.risk} Risk
                   </Badge>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed mb-4">{interaction.explanation}</p>
                <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Safety Advice</p>
                   <p className="text-xs font-bold text-foreground">{interaction.advice}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {holisticReport.length === 0 && !holisticLoading && (
          <div className="p-8 rounded-[2rem] border-2 border-dashed border-border flex flex-col items-center text-center opacity-40">
             <Info size={32} className="mb-3" />
             <p className="text-xs font-bold uppercase tracking-widest">Select lifestyle factors and tap Analyze</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
