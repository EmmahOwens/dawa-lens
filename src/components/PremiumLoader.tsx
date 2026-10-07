import { motion, AnimatePresence } from "framer-motion";
import { Search, Brain, Shield, Sparkles, Check } from "@/lib/icons";
import { useState, useEffect, useMemo } from "react";
import { RiveMoji } from "./rive/RiveMoji";

interface Step {
  id: number;
  label: string | React.ReactNode;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

interface PremiumLoaderProps {
  onComplete?: () => void;
  durationPerStep?: number;
}

export default function PremiumLoader({ onComplete, durationPerStep = 1200 }: PremiumLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = useMemo(() => [
    { 
      id: 0, 
      label: "Calibrating Vision Systems...", 
      icon: Search, 
    },
    { 
      id: 1, 
      label: "Extracting Molecular Markers...", 
      icon: Brain, 
    },
    { 
      id: 2, 
      label: "Cross-referencing Safety Registries...", 
      icon: Shield, 
    },
  ], []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        clearInterval(timer);
        setTimeout(() => onComplete?.(), 600);
        return prev;
      });
    }, durationPerStep);

    return () => clearInterval(timer);
  }, [onComplete, durationPerStep, steps.length]);

  const ActiveIcon = steps[currentStep].icon;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl p-6">
      {/* Apple-styled diagnostic panel card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-[20px] border border-border bg-card/95 shadow-xl p-8 flex flex-col items-center text-center"
      >
        {/* Central Icon Disc */}
        <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
          {/* Subtle spinning track ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary"
          />

          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-primary"
              >
                <ActiveIcon size={28} strokeWidth={2} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Step Label */}
        <div className="min-h-[52px] flex items-center justify-center mb-6">
          <AnimatePresence mode="wait">
            <motion.p
              key={`label-${currentStep}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              {steps[currentStep].label}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Apple Segmented Step Dots */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, idx) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? "w-7 bg-primary"
                  : idx < currentStep
                  ? "w-3 bg-primary/40"
                  : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Apple Status Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-[11px] font-medium text-muted-foreground border border-border">
          <Sparkles size={12} className="text-primary" />
          <span>Dawa AI Analysis</span>
        </div>
      </motion.div>
    </div>
  );
}
