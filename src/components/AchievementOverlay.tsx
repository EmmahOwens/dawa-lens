import { motion, AnimatePresence } from "framer-motion";
import { Star, Heart, Trophy, CheckCircle2, Sparkles } from "@/lib/icons";
import { RiveMoji } from "./rive/RiveMoji";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

interface AchievementOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  emoji?: string;
}

export default function AchievementOverlay({ open, onClose, title, subtitle, emoji = "💊" }: AchievementOverlayProps) {
  useEffect(() => {
    if (open) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      const closeTimer = setTimeout(onClose, 5000);
      return () => {
        clearInterval(interval);
        clearTimeout(closeTimer);
      };
    }
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="max-w-sm w-full bg-card rounded-[20px] p-8 text-center shadow-xl border border-border relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative z-10 flex flex-col items-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ 
                  scale: [0, 1.15, 1],
                  y: [0, -6, 0]
                }}
                transition={{ 
                  delay: 0.15, 
                  duration: 0.6,
                  type: "spring", 
                  bounce: 0.5 
                }}
                className="mb-6 relative"
              >
                <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <RiveMoji emoji={emoji} size={72} active={open} />
                </div>
              </motion.div>

              <motion.h2
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold tracking-tight text-foreground mb-2"
              >
                {title}
              </motion.h2>

              <motion.p
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-muted-foreground font-medium mb-6 leading-relaxed"
              >
                {subtitle}
              </motion.p>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="w-full"
              >
                <button
                  onClick={onClose}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-full font-semibold text-xs tracking-wide hover:bg-primary/90 active:scale-95 transition-all shadow-none"
                >
                  Awesome!
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
