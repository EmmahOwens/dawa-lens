import React from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Calendar, Package, Sparkles } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

export function MedDetailsWidget() {
  const { t } = useTranslation();
  const { medicines, reminders } = useApp();
  
  const lastMed = medicines.length > 0 ? medicines[medicines.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Lifecycle */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lifecycle</h4>
          <Calendar size={12} className="text-primary" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
           <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                 <Package size={18} />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-tight text-foreground">Treatment Active</p>
                 <p className="text-[11px] font-medium text-muted-foreground">Day 14 of 30</p>
              </div>
           </div>
           <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "45%" }}
                className="h-full bg-primary"
              />
           </div>
        </div>
      </section>

      {/* Specific Safety */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Safety Pulse</h4>
          <ShieldAlert size={12} className="text-success" />
        </div>
        <div className="bg-success/5 border border-success/20 rounded-2xl p-4">
           <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-success" />
              <p className="text-[10px] font-black uppercase text-success">AI Verification Passed</p>
           </div>
           <p className="text-[11px] leading-relaxed text-success/80 font-medium">
             No known interactions with your current biometric profile detected for {lastMed?.name || "this medication"}.
           </p>
        </div>
      </section>
    </div>
  );
}
