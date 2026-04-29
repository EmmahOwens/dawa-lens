import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    // Delay tagline for cinematic stagger
    const taglineTimer = setTimeout(() => setShowTagline(true), 700);

    // Smooth progress easing
    const progressTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        // Ease-out curve: fast at start, slows near end
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
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-white dark:bg-black flex flex-col items-center justify-center">

      {/* ── Layer 1: Full-screen radial gradient backdrop ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 50% 40%,
              hsl(211 100% 96%) 0%,
              hsl(0 0% 100%) 100%
            )
          `,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none dark:block hidden"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 50% 40%,
              hsl(211 100% 8%) 0%,
              hsl(0 0% 0%) 100%
            )
          `,
        }}
      />

      {/* ── Layer 2: Floating ambient orbs (Apple-style soft glow) ── */}
      <motion.div
        className="absolute pointer-events-none"
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.18, 0.28, 0.18],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: '65vw',
          height: '65vw',
          maxWidth: 480,
          maxHeight: 480,
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(211 100% 60% / 0.6), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <motion.div
        className="absolute pointer-events-none"
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.10, 0.18, 0.10],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          width: '50vw',
          height: '50vw',
          maxWidth: 360,
          maxHeight: 360,
          bottom: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(170 80% 50% / 0.5), transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* ── Main Content ── */}
      <div className="relative z-10 flex flex-col items-center w-full px-8">

        {/* ── Logo Section ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.75, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center mb-10"
          style={{ width: 160, height: 160 }}
        >
          {/* Outer pulsing ring — Apple Focus Ring */}
          <motion.div
            className="absolute rounded-full"
            animate={{
              scale: [1, 1.18, 1],
              opacity: [0.25, 0, 0.25],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 168,
              height: 168,
              border: '1.5px solid hsl(211 100% 50% / 0.6)',
              borderRadius: '50%',
            }}
          />
          {/* Secondary pulse ring */}
          <motion.div
            className="absolute rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.15, 0, 0.15],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            style={{
              width: 168,
              height: 168,
              border: '1px solid hsl(211 100% 50% / 0.3)',
              borderRadius: '50%',
            }}
          />

          {/* Icon container — iOS app icon style */}
          <motion.div
            animate={{ scale: [1, 1.025, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 148,
              height: 148,
              borderRadius: '34px',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(240,247,255,0.92) 100%)',
              boxShadow: `
                0 0 0 1px rgba(255,255,255,0.9),
                0 4px 6px -2px rgba(0,0,0,0.05),
                0 20px 50px -10px rgba(0,120,255,0.18),
                0 40px 80px -20px rgba(0,0,0,0.12),
                inset 0 1px 0 rgba(255,255,255,1)
              `,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Glossy top-left highlight */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                borderRadius: '34px 34px 60% 60%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
                pointerEvents: 'none',
              }}
            />

            <img
              src="/logo.png"
              alt="Dawa Lens"
              style={{
                width: 110,
                height: 110,
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 16px rgba(0,100,255,0.15)) drop-shadow(0 2px 8px rgba(0,0,0,0.08))',
                zIndex: 1,
              }}
            />
          </motion.div>
        </motion.div>

        {/* ── App Name ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <h1
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
              fontSize: 'clamp(2rem, 8vw, 2.75rem)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: 'hsl(220 20% 10%)',
              margin: 0,
            }}
            className="dark:!text-white"
          >
            Dawa Lens
          </h1>
        </motion.div>

        {/* ── Tagline ── */}
        <AnimatePresence>
          {showTagline && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
                fontSize: 'clamp(0.65rem, 2.5vw, 0.75rem)',
                fontWeight: 500,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'hsl(211 40% 55%)',
                marginTop: '0.75rem',
              }}
              className="dark:!text-blue-400/70"
            >
              Health Intelligence
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── Loading Indicator ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          style={{ marginTop: '3.5rem', width: '100%', maxWidth: 200 }}
        >
          {/* Track */}
          <div
            style={{
              height: 2.5,
              borderRadius: 9999,
              background: 'hsl(211 30% 88%)',
              overflow: 'hidden',
              position: 'relative',
            }}
            className="dark:!bg-white/10"
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
                background: 'linear-gradient(90deg, hsl(211 100% 55%), hsl(190 100% 50%))',
                boxShadow: '0 0 8px hsl(211 100% 60% / 0.5)',
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* ── Footer — Subtle branding ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 1 }}
        style={{
          position: 'absolute',
          bottom: 'max(env(safe-area-inset-bottom, 20px), 28px)',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {/* Small dot separator */}
        <div
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'hsl(211 40% 70%)',
            opacity: 0.5,
          }}
        />
        <p
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '0.6rem',
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'hsl(211 20% 60%)',
            opacity: 0.55,
          }}
          className="dark:!text-white/30"
        >
          Dawa Innovation
        </p>
        <div
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'hsl(211 40% 70%)',
            opacity: 0.5,
          }}
        />
      </motion.div>
    </div>
  );
};

export default SplashScreen;
