import React from "react";
import { motion } from "framer-motion";
import { FileText, Sparkles } from "@/lib/icons";

export function ReportWidget() {
  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Report Insights</h4>
          <FileText size={14} className="text-primary" />
        </div>
        
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-5 flex items-start gap-4 shadow-sm"
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
             <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[11px] leading-relaxed text-foreground/80 font-medium italic">
              "Generating a medical report utilizes Dawa-GPT to analyze your recent logs, identify dosage patterns, and compile actionable insights for your healthcare provider."
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
