import React from "react";
import { motion } from "framer-motion";
import { Users, Activity } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

export function FamilyHubWidget() {
  const { patients } = useApp();

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Family Network</h4>
          <Users size={14} className="text-primary" />
        </div>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-5 shadow-sm flex items-center gap-4"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-primary">
             <span className="font-black">{patients.length}</span>
          </div>
          <div>
            <p className="text-[12px] font-black text-foreground uppercase tracking-tight">Active Profiles</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">
              Managing {patients.length} dependents
            </p>
          </div>
        </motion.div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Recent Updates</h4>
          <Activity size={14} className="text-primary" />
        </div>
        <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-2xl p-6 text-center">
          <p className="text-[11px] font-medium text-muted-foreground">Select a family member to view their specific insights and adherence records.</p>
        </div>
      </section>
    </div>
  );
}
