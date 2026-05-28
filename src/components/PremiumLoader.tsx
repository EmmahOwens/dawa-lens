import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import RiveAnimation from "./rive/RiveAnimation";

interface Step {
  id: number;
  label: string;
}

interface PremiumLoaderProps {
  onComplete?: () => void;
  durationPerStep?: number;
}

/**
 * PremiumLoader.tsx - Rive Optimized
 * Uses a single Rive state machine to handle transitions between analysis steps.
 */
export default function PremiumLoader({ onComplete, durationPerStep = 1200 }: PremiumLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = [
    { id: 0, label: "🛰️ Calibrating Vision Systems..." },
    { id: 1, label: "🧠 Extracting Molecular Markers..." },
    { id: 2, label: "🛡️ Cross-referencing Safety Registries..." },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        clearInterval(timer);
        setTimeout(() => onComplete?.(), 500);
        return prev;
      });
    }, durationPerStep);

    return () => clearInterval(timer);
  }, [onComplete, durationPerStep, steps.length]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/90 backdrop-blur-2xl p-8 text-center overflow-hidden">
      <div className="relative mb-12 w-64 h-64">
        {/* Rive handles the rotating rings, icon morphing, and scanning effects */}
        <RiveAnimation
          src="/assets/rive/premium_analysis.riv"
          stateMachine="AnalysisStateMachine"
          inputs={{
            "step": currentStep // Link React state to Rive input
          }}
          autoplay={true}
        />
      </div>

      <motion.div
        key={`label-${currentStep}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-xl font-black tracking-tight text-foreground">
          {steps[currentStep].label}
        </h2>
        
        <div className="w-64 h-1.5 bg-muted rounded-full mx-auto overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: durationPerStep / 1000, ease: "easeInOut" }}
            className={`h-full bg-primary rounded-full`}
          />
        </div>
        
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">
          Dawa AI Intelligence Core
        </p>
      </motion.div>
    </div>
  );
}
