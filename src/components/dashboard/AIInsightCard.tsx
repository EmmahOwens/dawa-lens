import React from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

interface AIInsightCardProps {
  adherencePercent: number;
}

export function AIInsightCard({ adherencePercent }: AIInsightCardProps) {
  const getInsight = () => {
    if (adherencePercent === 100) return "Your perfect consistency this week is improving your long-term recovery odds. Keep it up!";
    if (adherencePercent > 80) return "You're doing great! Small tip: Setting a backup alarm for your evening dose might help hit that 100%.";
    return "We noticed some missed doses. Consistency is key for medication effectiveness. Need help setting better reminders?";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-8 relative overflow-hidden rounded-[2rem] bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20"
    >
      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">AI Health Insight</span>
        </div>
        
        <p className="text-sm font-medium leading-relaxed mb-4">
          "{getInsight()}"
        </p>
        
        <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-colors border border-white/10">
          Ask DawaGPT <ArrowRight size={12} />
        </button>
      </div>
    </motion.div>
  );
}
