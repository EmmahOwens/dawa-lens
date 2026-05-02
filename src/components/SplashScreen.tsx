import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    const taglineTimer = setTimeout(() => setShowTagline(true), 600);

    // Smooth progress easing
    const progressTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        const increment = Math.max(0.5, (100 - p) * 0.08);
        return Math.min(p + increment, 100);
      });
    }, 40);

    return () => {
      clearTimeout(taglineTimer);
      clearInterval(progressTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#0a0f18] flex flex-col items-center justify-center">
      
      {/* ── Layer 1: Fluid Colorful Mesh Background ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-80"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        style={{
          background: `
            radial-gradient(circle at 10% 20%, rgba(67, 56, 202, 0.6), transparent 45%),
            radial-gradient(circle at 90% 10%, rgba(219, 39, 119, 0.5), transparent 40%),
            radial-gradient(circle at 30% 80%, rgba(14, 165, 233, 0.6), transparent 50%),
            radial-gradient(circle at 80% 85%, rgba(124, 58, 237, 0.5), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(45, 212, 191, 0.4), transparent 60%)
          `,
          filter: 'blur(60px)',
          transformOrigin: 'center center'
        }}
      />
      
      <motion.div
        className="absolute w-[150vw] h-[150vh] -top-[25vh] -left-[25vw] pointer-events-none opacity-40 mix-blend-screen"
        animate={{
          rotate: [0, 360],
        }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, rgba(56, 189, 248, 0.4) 0deg, rgba(232, 121, 249, 0.4) 120deg, rgba(52, 211, 153, 0.4) 240deg, rgba(56, 189, 248, 0.4) 360deg)',
          filter: 'blur(90px)',
        }}
      />

      {/* ── Layer 2: Main Content (Liquid Glass Pill) ── */}
      <div className="relative z-10 flex flex-col items-center w-full px-6">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center justify-center p-12 overflow-hidden rounded-[50px] sm:rounded-[60px]"
          style={{
            // Liquid Glass effect
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            // Highlighting the edges to simulate glass thickness
            borderTop: '1px solid rgba(255, 255, 255, 0.4)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.1)',
            width: '100%',
            maxWidth: '340px'
          }}
        >
          {/* Glass glare overlay */}
          <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[50px] sm:rounded-t-[60px]" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none opacity-50" />

          {/* Logo */}
          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-110" />
            <img
              src="/logo.png"
              alt="Dawa Lens Logo"
              style={{
                width: 110,
                height: 110,
                objectFit: 'contain',
                filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.25))',
              }}
              className="relative z-10"
            />
          </motion.div>

          {/* App Name */}
          <h1
            className="mt-8 relative z-10 text-center tracking-tight"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#ffffff',
              textShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            Dawa Lens
          </h1>
          
          <AnimatePresence>
            {showTagline && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="mt-2 text-white/80 text-xs font-semibold tracking-[0.25em] uppercase relative z-10 text-center"
                style={{
                  textShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}
              >
                Health Intelligence
              </motion.p>
            )}
          </AnimatePresence>

        </motion.div>

        {/* ── Loading Indicator ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          style={{ marginTop: '3.5rem', width: '100%', maxWidth: 220 }}
          className="relative z-10"
        >
          {/* Track (Glass style) */}
          <div
            style={{
              height: 4,
              borderRadius: 9999,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            {/* Fill */}
            <motion.div
              initial={{ width: '0%', x: '-100%' }}
              animate={{ width: `${Math.min(progress, 100)}%`, x: '0%' }}
              transition={{ ease: 'linear', duration: 0.08 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                borderRadius: 9999,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.6), #ffffff)',
                boxShadow: '0 0 10px rgba(255,255,255,0.6)',
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute z-10 flex items-center justify-center gap-3"
        style={{
          bottom: 'max(env(safe-area-inset-bottom, 24px), 36px)',
          left: 0,
          right: 0,
        }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
        <p
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          Dawa Innovation
        </p>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
      </motion.div>

    </div>
  );
};

export default SplashScreen;
