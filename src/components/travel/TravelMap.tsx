import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface TravelMapProps {
  isAnimating: boolean;
  destination: string;
}

export const TravelMap: React.FC<TravelMapProps> = ({ isAnimating, destination }) => {
  // Simplified World Map SVG Path
  const worldMapPath = "M 10 30 Q 15 25 20 30 T 30 30 T 40 25 T 50 35 T 60 30 T 70 25 T 80 35 T 90 30 M 10 50 Q 20 45 30 55 T 50 50 T 70 60 T 90 45 M 20 70 Q 30 65 45 75 T 70 65 T 85 75";
  
  // Home coordinates (approximate center-ish)
  const home = { x: 30, y: 40 };
  
  // Destination coordinates (random-ish based on destination name hash or just a fixed offset)
  const destCoords = useMemo(() => {
    if (!destination) return { x: 70, y: 30 };
    const hash = destination.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return { 
      x: 50 + (hash % 40), 
      y: 20 + (hash % 40) 
    };
  }, [destination]);

  // Curve path for flight
  const flightPath = `M ${home.x} ${home.y} Q ${(home.x + destCoords.x) / 2} ${Math.min(home.y, destCoords.y) - 20} ${destCoords.x} ${destCoords.y}`;

  return (
    <div className="relative w-full aspect-[2/1] bg-primary/5 rounded-[2.5rem] overflow-hidden border border-primary/10 shadow-inner">
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      
      <svg viewBox="0 0 100 80" className="w-full h-full p-8 overflow-visible">
        {/* Simplified Continents */}
        <path 
          d={worldMapPath} 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="0.5" 
          className="text-primary/20"
          strokeLinecap="round"
        />
        
        {/* Static Map Markers */}
        <circle cx={home.x} cy={home.y} r="1" className="fill-primary animate-pulse" />
        
        {isAnimating && (
          <>
            {/* Flight Path */}
            <motion.path
              d={flightPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeDasharray="1, 2"
              className="text-primary/40"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
            
            {/* Animated Solid Path */}
            <motion.path
              d={flightPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className="text-primary"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
            
            {/* Moving Airplane */}
            <motion.g
              initial={{ offsetDistance: "0%", opacity: 0 }}
              animate={{ offsetDistance: "100%", opacity: 1 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              style={{ 
                offsetPath: `path("${flightPath}")`,
                offsetRotate: "auto 90deg"
              }}
            >
              <path 
                d="M-1.5,-1.5 L1.5,0 L-1.5,1.5 Z" 
                fill="currentColor" 
                className="text-primary" 
              />
            </motion.g>

            {/* Destination Marker */}
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.4 }}
            >
              <circle cx={destCoords.x} cy={destCoords.y} r="2" className="fill-primary/20" />
              <circle cx={destCoords.x} cy={destCoords.y} r="0.8" className="fill-primary" />
              
              <motion.circle 
                cx={destCoords.x} 
                cy={destCoords.y} 
                r="3" 
                className="stroke-primary fill-none"
                strokeWidth="0.2"
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.g>
          </>
        )}
      </svg>
      
      {/* Location Tags */}
      <div className="absolute top-6 left-8 flex flex-col">
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Origin</span>
        <span className="text-xs font-black text-foreground">Current Location</span>
      </div>
      
      <AnimatePresence>
        {destination && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute bottom-6 right-8 flex flex-col items-end"
          >
            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Destination</span>
            <span className="text-xs font-black text-primary">{destination}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
