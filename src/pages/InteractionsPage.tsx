import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { checkInteractions } from "@/services/interactionChecker";
import { ParsedInteraction } from "@/types/interactions";
import { ShieldAlert, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function InteractionsPage() {
  const { medicines } = useApp();
  const [interactions, setInteractions] = useState<ParsedInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  
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
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShieldAlert size={28} className="text-primary" />
          My Interactions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A dynamic check of how your saved medications might interact with each other.
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
          <p className="text-xs leading-relaxed">
            The information provided here is for educational purposes only. Sourced from the NIH NLM API. 
            <strong> Do not alter your medications without consulting a physician.</strong>
          </p>
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
            Add at least two medications to your profile to check for interactions.
          </p>
        </motion.div>
      )}

      {medicines.length >= 2 && loading && (
        <div className="space-y-4">
          <Skeleton className="h-[100px] w-full rounded-2xl" />
          <Skeleton className="h-[100px] w-full rounded-2xl" />
        </div>
      )}

      {medicines.length >= 2 && !loading && interactions.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-6 text-center"
        >
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-bold text-emerald-600 dark:text-emerald-400">No Known Interactions</h3>
          <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            No major interactions found between your saved medications.
          </p>
        </motion.div>
      )}

      {medicines.length >= 2 && !loading && interactions.length > 0 && (
        <motion.div 
          variants={container} 
          initial="hidden" 
          animate="show" 
          className="space-y-4"
        >
          <h3 className="font-semibold text-base text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Detected Interactions ({interactions.length})
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
                  <Badge variant="destructive" className="ml-2 px-2 py-0 text-[10px] uppercase font-bold tracking-wider">Severe</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-warning/20 text-warning-foreground dark:bg-warning/30 px-2 py-0 text-[10px] uppercase font-bold tracking-wider">Warning</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {interaction.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
