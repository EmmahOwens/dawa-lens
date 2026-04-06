import { motion, AnimatePresence } from "framer-motion";
import { Search, Brain, Shield, Sparkles, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface Step {
  id: number;
  label: string;
  icon: any;
  color: string;
}

interface PremiumLoaderProps {
  onComplete?: () => void;
  durationPerStep?: number;
}

export default function PremiumLoader({ onComplete, durationPerStep = 1200 }: PremiumLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = [
    { id: 0, label: "🛰️ Calibrating Vision Systems...", icon: Search, color: "text-primary" },
    { id: 1, label: "🧠 Extracting Molecular Markers...", icon: Brain, color: "text-purple-500" },
    { id: 2, label: "🛡️ Cross-referencing Safety Registries...", icon: Shield, color: "text-success" },
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
      <div className="relative mb-12">
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="w-48 h-48 rounded-full border-2 border-dashed border-primary/30"
        />
        
        {/* Animated Icons */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.5, opacity: 0, rotate: 20 }}
              className={`p-6 rounded-3xl bg-card shadow-2xl relative ${steps[currentStep].color}`}
            >
              {(() => {
                const Icon = steps[currentStep].icon;
                return <Icon size={48} strokeWidth={2.5} />;
              })()}
              
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles size={20} className="text-primary" />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
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

      {/* Decorative scanning line */}
      <motion.div
        animate={{ top: ["10%", "90%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 right-0 h-px bg-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.5)] z-[-1]"
      />
    </div>
  );
}
