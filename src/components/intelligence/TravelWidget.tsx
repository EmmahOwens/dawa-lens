import React from "react";
import { motion } from "framer-motion";
import { Plane, MapPin } from "@/lib/icons";

export function TravelWidget() {
  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Travel Intelligence</h4>
          <Plane size={14} className="text-primary" />
        </div>
        
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-primary/5 backdrop-blur-md border border-primary/20 rounded-[2rem] p-6 shadow-sm hover:shadow-primary/5 transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 rounded-full bg-primary/10">
               <MapPin size={16} className="text-primary" />
             </div>
             <p className="text-[12px] font-black uppercase tracking-tight">Trip Analysis</p>
          </div>
          <p className="text-[11px] leading-relaxed text-foreground/80 font-medium">
            Enter your destination to analyze cross-border medication regulations, generic equivalents, and local health advisory data.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
