import React from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

export function DashboardSearch() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-6"
    >
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          <Search size={18} />
        </div>
        <input
          type="text"
          placeholder="Search medications, history, or info..."
          className="w-full bg-card/40 backdrop-blur-xl border border-border/40 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all shadow-sm"
        />
        <div className="absolute inset-y-0 right-4 flex items-center">
           <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
             <span className="text-xs">⌘</span>K
           </kbd>
        </div>
      </div>
    </motion.div>
  );
}
