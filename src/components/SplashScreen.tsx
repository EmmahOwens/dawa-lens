import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const SplashScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);

  // Simulate an elegant, smooth loading progress
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        // Ease-out curve simulation for the progress bar
        const increment = Math.max(1, (100 - p) * 0.1);
        return p + increment;
      });
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-[9999] overflow-hidden">
      {/* Apple-inspired subtle ambient light */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] bg-primary/20 blur-[120px] rounded-full mix-blend-normal dark:mix-blend-lighten"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-10"
        >
          {/* Glassmorphism logo container for a premium iOS app icon feel */}
          <div className="relative flex items-center justify-center w-36 h-36 rounded-[2rem] bg-white/40 dark:bg-black/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl">
            {/* Subtle inner reflection */}
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-white/20 to-transparent opacity-50 pointer-events-none" />
            
            <img
              src="/logo.png"
              alt="Dawa Lens Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-md z-10"
            />
          </div>
        </motion.div>

        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              Dawa Lens
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
            className="mt-4 text-muted-foreground/70 text-xs sm:text-sm font-medium tracking-[0.3em] uppercase"
          >
            Health Intelligence
          </motion.p>
        </div>

        {/* Minimalist Apple-like progress indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-16 w-full max-w-[180px]"
        >
          <div className="h-[3px] w-full bg-secondary/50 overflow-hidden rounded-full relative">
            <motion.div
              className="absolute top-0 left-0 h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ ease: "linear", duration: 0.1 }}
            />
          </div>
        </motion.div>
      </div>

      {/* Clean, refined Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-10"
      >
        <p className="text-[10px] font-semibold text-muted-foreground/30 uppercase tracking-[0.2em]">
          Dawa Innovation
        </p>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
