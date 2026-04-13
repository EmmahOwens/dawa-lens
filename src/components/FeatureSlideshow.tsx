import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Users, Heart, FileText, History, Plane } from "lucide-react";

interface ActionItem {
  icon: any;
  label: string;
  to: string;
  color: string;
  ringScale: number;
  description: string;
}

const ORIGINAL_ACTIONS: ActionItem[] = [
  { icon: Camera, label: "Quick Scan", to: "/scan", color: "bg-primary text-primary-foreground", ringScale: 1.05, description: "Identify pills instantly with Vision AI" },
  { icon: Users, label: "Family Hub", to: "/family", color: "bg-success text-success-foreground", ringScale: 1, description: "Manage health for your entire circle" },
  { icon: Heart, label: "Wellness", to: "/wellness", color: "bg-destructive text-destructive-foreground", ringScale: 1.1, description: "Track mood, energy and symptoms" },
  { icon: FileText, label: "Dossier", to: "/report", color: "bg-indigo-600 text-white", ringScale: 1, description: "Generate detailed health reports" },
  { icon: History, label: "History", to: "/history", color: "bg-accent text-accent-foreground", ringScale: 1, description: "Review your medication journey" },
  { icon: Plane, label: "Travel", to: "/travel", color: "bg-warning text-warning-foreground", ringScale: 1.05, description: "Stay safe while traveling abroad" },
];

function shuffle<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export function FeatureSlideshow() {
  const navigate = useNavigate();
  const [shuffledActions, setShuffledActions] = useState(() => shuffle(ORIGINAL_ACTIONS));
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev === shuffledActions.length - 1) {
          // Shuffle for next cycle
          setShuffledActions(shuffle(ORIGINAL_ACTIONS));
          return 0;
        }
        return prev + 1;
      });
    }, 7000); // 7 seconds delay

    return () => clearInterval(interval);
  }, [shuffledActions]);

  const current = shuffledActions[currentIndex];

  return (
    <div className="relative w-full h-52 mb-10 overflow-hidden rounded-2xl group">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.to}
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -50, scale: 0.95 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-0 p-8 flex flex-col justify-between cursor-pointer ${current.color}`}
          onClick={() => navigate(current.to)}
        >
          {/* Background Decoration */}
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-md shadow-lg border border-white/10">
              <current.icon size={24} />
            </div>
            <div className="flex gap-1.5">
              {shuffledActions.map((_, i) => (
                <div 
                  key={i}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/30"
                  }`} 
                />
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <motion.h3 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold tracking-tight"
            >
              {current.label}
            </motion.h3>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-white/80 text-xs font-semibold uppercase tracking-wider mt-1"
            >
              {current.description}
            </motion.p>
          </div>
          
          <div className="absolute bottom-6 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider bg-white text-black px-4 py-2 rounded-lg shadow-xl">
               Explore Now
             </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
