import React from "react";
import { motion } from "framer-motion";
import { Settings, ShieldCheck } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";

export function SettingsWidget() {
  const { userProfile } = useApp();

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Account Status</h4>
          <Settings size={14} className="text-primary" />
        </div>
        
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center shrink-0 border border-success/20">
               <ShieldCheck size={18} className="text-success" />
             </div>
             <div>
               <p className="text-[12px] font-black text-foreground uppercase tracking-tight">{userProfile?.name || "User"}</p>
               <p className="text-[10px] font-medium text-success mt-0.5 uppercase tracking-wider">
                 Profile Secured
               </p>
             </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
