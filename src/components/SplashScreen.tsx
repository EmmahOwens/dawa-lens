import React from 'react';
import { motion } from 'framer-motion';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-[9999] overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.05, 0.1, 0.05],
            x: [0, 30, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-[10%] left-[10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.08, 0.05],
            x: [0, -30, 0],
            y: [0, 20, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[10%] right-[10%] w-[70%] h-[70%] rounded-full bg-primary/10 blur-[150px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          duration: 1.2, 
          ease: [0.16, 1, 0.3, 1] 
        }}
        className="flex flex-col items-center gap-12 relative z-10"
      >
        <div className="relative">
          {/* Central Logo Glow */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-[-40px] bg-primary/25 blur-[60px] rounded-full"
          />
          
          {/* Logo Container */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative"
          >
            <div className="p-1 rounded-full bg-gradient-to-tr from-primary/20 via-transparent to-primary/20 backdrop-blur-sm shadow-2xl">
              <img 
                src="/logo.png" 
                alt="Dawa Lens Logo" 
                className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              />
            </div>
          </motion.div>
        </div>
        
        <div className="flex flex-col items-center text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
          >
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-7xl">
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60">
                Dawa Lens
              </span>
            </h1>
            
            {/* Elegant Progress Indicator */}
            <div className="h-[2px] w-32 bg-primary/10 mx-auto mt-6 rounded-full overflow-hidden">
              <motion.div 
                animate={{ 
                  x: ["-100%", "100%"],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="h-full w-2/3 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              />
            </div>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-8 text-muted-foreground/60 text-xs font-bold tracking-[0.4em] uppercase"
          >
            Health Intelligence Redefined
          </motion.p>
        </div>
      </motion.div>
      
      {/* Minimal Footer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-16 flex items-center gap-2"
      >
        <span className="h-[1px] w-8 bg-border/40" />
        <span className="text-[10px] font-medium text-muted-foreground/30 uppercase tracking-widest">
          Secured by Dawa Innovation
        </span>
        <span className="h-[1px] w-8 bg-border/40" />
      </motion.div>
    </div>
  );
};

export default SplashScreen;
