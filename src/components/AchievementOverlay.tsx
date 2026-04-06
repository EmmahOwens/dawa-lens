import { motion, AnimatePresence } from "framer-motion";
import { Star, Heart, Trophy, CheckCircle2, Sparkles } from "lucide-react";
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

      const interval: any = setInterval(function() {
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-background/60 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20, rotate: -5 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="max-w-sm w-full bg-card rounded-[3rem] p-10 text-center shadow-[0_30px_100px_rgba(0,0,0,0.4)] border border-primary/20 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated Background Energy */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 opacity-10"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_70%)]" />
            </motion.div>

            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
                className="text-7xl mb-8 filter drop-shadow-2xl"
              >
                {emoji}
              </motion.div>

              <motion.h2
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-black tracking-tight text-foreground mb-3"
              >
                {title}
              </motion.h2>

              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg text-muted-foreground font-medium mb-8 leading-relaxed"
              >
                {subtitle}
              </motion.p>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <button
                  onClick={onClose}
                  className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
                >
                  Awesome!
                </button>
              </motion.div>
            </div>

            <div className="absolute top-4 right-4">
               <Sparkles className="text-primary animate-pulse" size={24} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
