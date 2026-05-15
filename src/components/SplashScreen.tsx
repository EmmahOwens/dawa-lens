import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

const SplashScreen: React.FC = () => {
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    // Delay the appearance of the tagline for a sequential reveal effect
    // Increased delay slightly to allow typing effect to finish first
    const taglineTimer = setTimeout(() => setShowTagline(true), 2000);

    return () => {
      clearTimeout(taglineTimer);
    };
  }, []);

  const appName = "Dawa Lens".split("");

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08, // Speed of the typing effect
        delayChildren: 0.6, // Wait before starting to type
      },
    },
  };

  const letterVariants: Variants = {
    hidden: { opacity: 0, x: -8, filter: 'blur(4px)' },
    visible: { 
      opacity: 1, 
      x: 0, 
      filter: 'blur(0px)',
      transition: { duration: 0.5, ease: "easeOut" }
    },
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden flex flex-col items-center justify-center bg-[#050505]">
      
      {/* ── Deepin-style Subtle Ambient Background ── */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
         <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="w-[100vw] h-[100vw] max-w-[800px] max-h-[800px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(26, 156, 160, 0.08) 0%, rgba(5, 5, 5, 0) 60%)',
              filter: 'blur(50px)',
            }}
         />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full px-6">
        
        {/* Logo and App Name Container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col items-center justify-center"
        >
          {/* Logo */}
          <motion.div
            animate={{ 
              scale: [1, 1.03, 1], 
              filter: [
                'drop-shadow(0px 0px 0px rgba(26,156,160,0))', 
                'drop-shadow(0px 0px 20px rgba(26,156,160,0.3))', 
                'drop-shadow(0px 0px 0px rgba(26,156,160,0))'
              ] 
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <img
              src="/logo.png"
              alt="Dawa Lens Logo"
              style={{
                width: 100,
                height: 100,
                objectFit: 'contain',
              }}
              className="relative z-10 drop-shadow-xl"
            />
          </motion.div>

          {/* App Name with Deepin-style typing effect */}
          <motion.h1
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mt-8 relative z-10 flex space-x-[2px] justify-center tracking-wide"
            style={{
              fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '2.25rem',
              fontWeight: 400,
              color: '#ffffff',
              letterSpacing: '0.08em',
              textShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            {appName.map((letter, index) => (
              <motion.span 
                key={index} 
                variants={letterVariants}
                // Handle spaces properly in flex layout
                style={{ width: letter === " " ? "0.4em" : "auto" }}
              >
                {letter}
              </motion.span>
            ))}
          </motion.h1>
          
          <AnimatePresence>
            {showTagline && (
              <motion.p
                initial={{ opacity: 0, filter: 'blur(8px)', y: 5 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="mt-3 text-white/50 text-xs sm:text-sm font-light tracking-[0.2em] uppercase relative z-10 text-center"
              >
                Smart Medicine Reminder
              </motion.p>
            )}
          </AnimatePresence>

        </motion.div>

        {/* ── Deepin-style Elegant Spinner ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1.5 }} // Delayed to appear after typing finishes
          className="relative z-10 mt-16 flex items-center justify-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="rounded-full"
            style={{
              width: 36,
              height: 36,
              border: '2px solid rgba(255, 255, 255, 0.05)',
              borderTopColor: 'rgba(26, 156, 160, 0.9)', // Using Dawa Lens theme color #1a9ca0
              borderRightColor: 'rgba(26, 156, 160, 0.2)',
              boxShadow: '0 0 15px rgba(26, 156, 160, 0.2)',
            }}
          />
        </motion.div>
      </div>

    </div>
  );
};

export default SplashScreen;
