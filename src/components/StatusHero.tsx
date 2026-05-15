import React from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, ChevronRight } from "@/lib/icons";
import { NextDoseInfo } from "@/services/reminderService";

interface StatusHeroProps {
  nextDose: NextDoseInfo | null;
  takenToday: number;
  totalToday: number;
  onNextDoseClick: () => void;
  onProgressClick: () => void;
}

export function StatusHero({ nextDose, takenToday, totalToday, onNextDoseClick, onProgressClick }: StatusHeroProps) {
  const progress = totalToday > 0 ? (takenToday / totalToday) * 100 : 0;
  
  return (
    <div className="grid grid-cols-1 gap-4 mb-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground shadow-xl shadow-primary/20"
      >
        {/* Decorative Background Elements */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 backdrop-blur-md">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-white">Live Status</span>
            </div>
            {progress === 100 && totalToday > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-success/20 px-3 py-1 backdrop-blur-md border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider">Perfect Day! 🏆</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Left Side: Next Dose */}
            <div className="flex-1 cursor-pointer group" onClick={onNextDoseClick}>
              <div className="flex items-center gap-2 mb-1 text-white/70">
                <Clock size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Next Dose Due</span>
              </div>
              
              {nextDose ? (
                <>
                  <h2 className="text-4xl font-black tracking-tighter mb-1 group-active:scale-95 transition-transform">
                    {nextDose.timeUntil}
                  </h2>
                  <p className="text-sm font-medium opacity-90 truncate max-w-[180px]">
                    {nextDose.reminder.medicineName} • {nextDose.reminder.time}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black tracking-tighter mb-1">
                    All Set!
                  </h2>
                  <p className="text-sm font-medium opacity-90">
                    No more doses today
                  </p>
                </>
              )}
            </div>

            {/* Right Side: Progress Circle */}
            <div 
              className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center active:scale-95 transition-transform"
              onClick={onProgressClick}
            >
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="10"
                />
                {/* Progress Circle */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="white"
                  strokeWidth="10"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "263.9", strokeDashoffset: "263.9" }}
                  animate={{ 
                    strokeDashoffset: 263.9 - (progress / 100) * 263.9 
                  }}
                  transition={{ duration: 1.5, ease: "anticipate" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black leading-none">{takenToday}</span>
                <span className="text-[10px] font-bold uppercase opacity-60">/ {totalToday}</span>
              </div>
            </div>
          </div>
          
          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
             <div className="flex -space-x-2">
                {[...Array(Math.min(totalToday, 5))].map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-6 w-6 rounded-full border-2 border-primary flex items-center justify-center text-[10px] font-bold ${i < takenToday ? 'bg-white text-primary' : 'bg-white/20 text-white/40'}`}
                  >
                    {i < takenToday ? <CheckCircle2 size={12} strokeWidth={3} /> : i + 1}
                  </div>
                ))}
                {totalToday > 5 && (
                  <div className="h-6 w-6 rounded-full border-2 border-primary bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/60">
                    +{totalToday - 5}
                  </div>
                )}
             </div>
             <button 
               onClick={onNextDoseClick}
               className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-colors"
             >
               View Schedule <ChevronRight size={12} />
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
