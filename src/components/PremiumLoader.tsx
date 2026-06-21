import { motion, AnimatePresence } from "framer-motion";
import { Search, Brain, Shield, Sparkles } from "@/lib/icons";
import { useState, useEffect, useMemo } from "react";
import { RiveMoji } from "./rive/RiveMoji";

interface Step {
  id: number;
  label: string | React.ReactNode;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  colorClass: string;
  glowColor: string;
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
      label: (
        <span className="flex items-center justify-center gap-2">
          <RiveMoji emoji="🛰️" size={24} /> Calibrating Vision Systems...
        </span>
      ), 
      icon: Search, 
      colorClass: "text-primary",
      glowColor: "hsl(var(--primary))"
    },
    { 
      id: 1, 
      label: (
        <span className="flex items-center justify-center gap-2">
          <RiveMoji emoji="🧠" size={24} /> Extracting Molecular Markers...
        </span>
      ), 
      icon: Brain, 
      colorClass: "text-purple-500",
      glowColor: "#a855f7"
    },
    { 
      id: 2, 
      label: (
        <span className="flex items-center justify-center gap-2">
          <RiveMoji emoji="🛡️" size={24} /> Cross-referencing Safety Registries...
        </span>
      ), 
      icon: Shield, 
      colorClass: "text-success",
      glowColor: "hsl(var(--success))"
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

  // Generate deterministic particles for the scanning animation
  const particles = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      angle: (i / 18) * Math.PI * 2 + (Math.random() * 0.4 - 0.2),
      distance: 65 + Math.random() * 55,
      delay: Math.random() * 1.8,
      size: 2.5 + Math.random() * 3.5,
      duration: 2.2 + Math.random() * 1.2
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/85 backdrop-blur-2xl p-6 overflow-hidden">
      
      {/* Dynamic ambient background glow synced to active step's color */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          key={`bg-glow-${currentStep}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.22, scale: 1.15 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="w-[85vw] h-[85vw] max-w-md max-h-md rounded-full"
          style={{
            background: `radial-gradient(circle, ${steps[currentStep].glowColor} 0%, transparent 65%)`,
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Cybernetic Grid backing */}
      <div 
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Glassmorphic diagnostic console panel */}
      <div className="relative z-10 w-full max-w-sm p-8 rounded-3xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/30 shadow-2xl backdrop-blur-md flex flex-col items-center text-center">
        
        {/* Core scanner orbital visualization */}
        <div className="relative w-48 h-48 mb-10 flex items-center justify-center">
          
          {/* Molecular particle emission field */}
          <div className="absolute inset-0 flex items-center justify-center">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                animate={{
                  x: [0, Math.cos(p.angle) * p.distance],
                  y: [0, Math.sin(p.angle) * p.distance - 15],
                  opacity: [0, 0.85, 0],
                  scale: [0.4, 1.1, 0.2],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: "easeOut",
                }}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: p.size,
                  height: p.size,
                  background: steps[currentStep].glowColor,
                  boxShadow: `0 0 10px 1px ${steps[currentStep].glowColor}`,
                }}
              />
            ))}
          </div>

          {/* Outer Cybernetic Ring (Clockwise) */}
          <motion.svg
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute w-44 h-44 pointer-events-none"
            style={{ color: steps[currentStep].glowColor, opacity: 0.35 }}
          >
            <circle
              cx="88"
              cy="88"
              r="80"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="8 10 4 10 12 12"
            />
          </motion.svg>

          {/* Inner Cybernetic Ring (Counter-Clockwise) */}
          <motion.svg
            animate={{ rotate: -360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute w-36 h-36 pointer-events-none"
            style={{ color: steps[currentStep].glowColor, opacity: 0.45 }}
          >
            <circle
              cx="72"
              cy="72"
              r="64"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="20 8 6 8"
            />
          </motion.svg>

          {/* Glowing aura frame for active icon */}
          <motion.div
            animate={{
              boxShadow: [
                `0 0 20px 2px ${steps[currentStep].glowColor}30`,
                `0 0 35px 8px ${steps[currentStep].glowColor}50`,
                `0 0 20px 2px ${steps[currentStep].glowColor}30`,
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 rounded-full bg-card/45 dark:bg-card/25 border border-white/10 dark:border-white/5 flex items-center justify-center relative z-10 backdrop-blur-xl"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.5, opacity: 0, rotate: 30 }}
                transition={{ type: "spring", damping: 15, stiffness: 120 }}
                className={`p-3 relative ${steps[currentStep].colorClass}`}
              >
                {(() => {
                  const Icon = steps[currentStep].icon;
                  return <Icon size={38} strokeWidth={2.2} />;
                })()}

                {/* Animated micro-stars */}
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="absolute -top-1.5 -right-1.5 text-yellow-400"
                >
                  <Sparkles size={16} />
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>

        {/* Text and step indicators stack */}
        <div className="w-full space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`label-${currentStep}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="h-14 flex items-center justify-center"
            >
              <h2 className="text-lg font-bold tracking-tight text-foreground/90">
                {steps[currentStep].label}
              </h2>
            </motion.div>
          </AnimatePresence>

          {/* Premium Progress Glass Tube */}
          <div className="w-64 h-2 bg-muted/40 dark:bg-white/5 rounded-full mx-auto overflow-hidden relative border border-white/5">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: durationPerStep / 1000, ease: "easeInOut" }}
              className="h-full rounded-full relative"
              style={{ backgroundColor: steps[currentStep].glowColor }}
            >
              {/* Shiny reflection/sweep in progress bar */}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-pulse" />
            </motion.div>
          </div>

          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">
            Dawa AI Intelligence Core
          </p>
        </div>
      </div>

      {/* Decorative vertical sweeping laser beam */}
      <motion.div
        animate={{ top: ["5%", "95%", "5%"] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-4 right-4 h-[1px] opacity-25 z-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${steps[currentStep].glowColor} 40%, ${steps[currentStep].glowColor} 60%, transparent 100%)`,
          boxShadow: `0 0 10px 1px ${steps[currentStep].glowColor}`,
        }}
      />
    </div>
  );
}
