import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RiveAnimation from "./rive/RiveAnimation";

const BG = "#050505";

/**
 * SplashScreen.tsx - Rive Optimized
 * Replaces complex multi-node Framer Motion animations with a single, high-performance Rive asset.
 */
const SplashScreen: React.FC = () => {
  const [showRive, setShowRive] = useState(false);

  useEffect(() => {
    // Faint delay to allow initial mount before starting Rive
    const timer = setTimeout(() => setShowRive(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: BG }}
    >
      {/* ── Ambient radial glow (retained for atmosphere) ────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 3 }}
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 72% 58% at 50% 52%,
            rgba(26,156,160,0.10) 0%,
            rgba(26,156,160,0.03) 42%,
            transparent 68%)`,
          pointerEvents: "none",
        }}
      />

      <div className="relative flex-1 w-full max-w-4xl mx-auto flex items-center justify-center min-h-[420px]">
        {showRive ? (
          <RiveAnimation
            src="/assets/rive/splash.riv"
            stateMachine="State Machine 1"
            className="w-full h-full"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/70">
            Loading…
          </div>
        )}
      </div>

      {/* Decorative tagline (rendered in DOM for SEO/Accessibility if needed,
          or can be moved into Rive) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute bottom-16 text-[10px] uppercase tracking-[0.3em] text-white/40"
      >
        Smart Medicine Reminder
      </motion.div>
    </div>
  );
};

export default SplashScreen;
