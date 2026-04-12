import React from "react";
import { motion } from "framer-motion";
import { Heart, Activity, Brain, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function WellnessWidget() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Correlation Engine */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Correlation Engine</h4>
          <Brain size={12} className="text-destructive" />
        </div>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-destructive/5 border border-destructive/20 rounded-3xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                <Activity size={14} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-tight text-foreground">Mood Sensitivity</p>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
            "Your mood logs show a <span className="text-destructive font-black">15% improvement</span> on days where you log a high-protein breakfast."
          </p>
        </motion.div>
      </section>

      {/* Wellness Summary */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Snapshot</h4>
          <CheckCircle2 size={12} className="text-success" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
           <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
              <span>Avg Mood</span>
              <span className="text-foreground">4.2 / 5</span>
           </div>
           <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "84%" }}
                className="h-full bg-success"
              />
           </div>
           <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
              <span>Avg Vitality</span>
              <span className="text-foreground">3.8 / 5</span>
           </div>
           <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "76%" }}
                className="h-full bg-primary"
              />
           </div>
        </div>
      </section>
    </div>
  );
}
