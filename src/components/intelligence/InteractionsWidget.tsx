import React from "react";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle2, CopyPlus } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { checkConditionSafety } from "@/services/conditionInteractionService";

export function InteractionsWidget() {
  const { medicines, userProfile } = useApp();
  
  // Combine all safety warnings for active medicines
  const allWarnings = medicines.flatMap(med => 
    userProfile ? checkConditionSafety(med.name, med.genericName, []) : []
  );

  // Deduplicate warnings
  const uniqueWarnings = Array.from(new Set(allWarnings.map(w => w.warning)))
    .map(warning => allWarnings.find(w => w.warning === warning)!);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Global Watchdog</h4>
          <ShieldAlert size={14} className={uniqueWarnings.length > 0 ? "text-destructive" : "text-success"} />
        </div>
        
        {uniqueWarnings.length > 0 ? (
          <div className="space-y-3">
            {uniqueWarnings.map((warning, i) => (
              <motion.div 
                key={i} 
                whileHover={{ scale: 1.02 }}
                className="bg-destructive/5 backdrop-blur-sm border border-destructive/20 rounded-[1.5rem] p-5 flex gap-4 italic shadow-sm"
              >
                <ShieldAlert size={16} className="text-destructive shrink-0" />
                <p className="text-[11px] leading-relaxed text-destructive/90 font-medium">{warning.warning}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-success/5 backdrop-blur-sm border border-success/20 rounded-[1.5rem] p-5 flex items-center gap-4 shadow-sm"
          >
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
               <CheckCircle2 size={16} className="text-success" />
            </div>
            <p className="text-[10px] text-success/90 font-black uppercase tracking-widest">No known interactions</p>
          </motion.div>
        )}
      </section>
    </div>
  );
}
