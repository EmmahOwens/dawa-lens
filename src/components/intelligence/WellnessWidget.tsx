import React from "react";
import { motion } from "framer-motion";
import { Heart, Activity, Brain, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function WellnessWidget() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      {/* Correlation Engine */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Correlation Engine</h4>
          <Brain size={14} className="text-primary" />
        </div>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-primary/5 backdrop-blur-md border border-primary/20 rounded-[2rem] p-6 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Activity size={18} />
             </div>
             <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-foreground">Mood Sensitivity</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Insight Active</p>
             </div>
          </div>
          <p className="text-[11px] leading-relaxed text-foreground/80 font-medium italic">
            "Your mood logs show a <span className="text-primary font-black">15% improvement</span> on days where you log a high-protein breakfast."
          </p>
        </motion.div>
      </section>

      {/* Wellness Summary */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">System Snapshot</h4>
          <CheckCircle2 size={14} className="text-success" />
        </div>
        <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-6 space-y-6 shadow-sm">
           <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                 <span>Avg Mood</span>
                 <span className="text-foreground">4.2 / 5.0</span>
              </div>
              <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: "84%" }}
                   className="h-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                 />
              </div>
           </div>
           
           <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                 <span>Avg Vitality</span>
                 <span className="text-foreground">3.8 / 5.0</span>
              </div>
              <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: "76%" }}
                   className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                 />
              </div>
           </div>
        </div>
      </section>
    </div>

  );
}
