import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plane } from 'lucide-react';

interface TravelMapProps {
  isAnimating: boolean;
  destination: string;
}

// Simplified but recognisable world continent paths in a 1000×500 viewBox
const CONTINENTS = [
  // North America
  {
    id: 'na',
    d: 'M 120 60 L 145 55 L 165 60 L 180 70 L 185 85 L 178 100 L 190 115 L 200 130 L 195 150 L 185 165 L 170 175 L 155 170 L 145 160 L 130 155 L 115 145 L 105 130 L 95 115 L 90 100 L 95 85 L 105 70 Z M 85 80 L 95 75 L 100 85 L 90 90 Z',
  },
  // South America
  {
    id: 'sa',
    d: 'M 195 200 L 215 195 L 235 200 L 245 215 L 250 235 L 245 260 L 240 285 L 225 305 L 210 315 L 195 310 L 185 295 L 180 270 L 185 245 L 188 220 Z',
  },
  // Europe
  {
    id: 'eu',
    d: 'M 450 55 L 470 50 L 490 55 L 505 65 L 510 80 L 500 90 L 510 100 L 505 115 L 490 118 L 475 112 L 460 115 L 445 108 L 438 95 L 442 80 Z M 430 60 L 445 55 L 450 65 L 435 68 Z',
  },
  // Africa
  {
    id: 'af',
    d: 'M 460 140 L 485 135 L 510 140 L 525 160 L 530 185 L 528 210 L 520 240 L 510 265 L 500 285 L 488 295 L 475 290 L 462 275 L 452 250 L 445 225 L 442 200 L 445 175 L 450 155 Z',
  },
  // Asia
  {
    id: 'as',
    d: 'M 520 45 L 560 40 L 610 42 L 660 45 L 710 55 L 745 65 L 760 80 L 750 95 L 730 105 L 710 100 L 690 110 L 670 115 L 650 110 L 630 115 L 610 110 L 590 115 L 575 108 L 555 112 L 540 105 L 525 95 L 515 80 L 518 62 Z M 740 50 L 760 45 L 775 55 L 760 65 L 745 60 Z',
  },
  // Australia
  {
    id: 'au',
    d: 'M 720 280 L 750 270 L 785 272 L 810 285 L 820 305 L 815 325 L 800 340 L 775 345 L 750 340 L 730 325 L 718 305 Z',
  },
  // Russia / North Asia extension
  {
    id: 'ru',
    d: 'M 520 30 L 570 25 L 630 22 L 680 28 L 720 35 L 740 45 L 710 50 L 660 42 L 610 40 L 560 38 L 520 42 Z',
  },
  // Japan / SE Asia islands (simplified)
  {
    id: 'sea',
    d: 'M 750 100 L 765 95 L 775 105 L 765 112 Z M 780 110 L 790 105 L 798 115 L 788 120 Z M 700 135 L 730 130 L 745 140 L 735 155 L 715 158 L 700 148 Z',
  },
];

// Named geographic locations with their approximate SVG coordinates (1000×500)
const LOCATION_MAP: Record<string, { x: number; y: number }> = {
  // Africa
  kenya: { x: 530, y: 210 },
  nigeria: { x: 468, y: 195 },
  southafrica: { x: 495, y: 280 },
  egypt: { x: 510, y: 155 },
  ghana: { x: 455, y: 200 },
  ethiopia: { x: 535, y: 195 },
  tanzania: { x: 525, y: 225 },
  uganda: { x: 522, y: 210 },
  // Europe
  france: { x: 460, y: 95 },
  uk: { x: 445, y: 80 },
  germany: { x: 475, y: 85 },
  italy: { x: 478, y: 105 },
  spain: { x: 445, y: 105 },
  portugal: { x: 435, y: 108 },
  netherlands: { x: 468, y: 80 },
  sweden: { x: 478, y: 65 },
  norway: { x: 470, y: 58 },
  denmark: { x: 473, y: 70 },
  poland: { x: 490, y: 82 },
  ukraine: { x: 505, y: 85 },
  russia: { x: 560, y: 55 },
  greece: { x: 492, y: 110 },
  // Asia
  china: { x: 680, y: 95 },
  india: { x: 620, y: 145 },
  japan: { x: 757, y: 98 },
  southkorea: { x: 740, y: 100 },
  thailand: { x: 690, y: 155 },
  vietnam: { x: 705, y: 155 },
  singapore: { x: 710, y: 175 },
  indonesia: { x: 730, y: 185 },
  malaysia: { x: 710, y: 170 },
  pakistan: { x: 600, y: 125 },
  bangladesh: { x: 645, y: 140 },
  srilanka: { x: 628, y: 165 },
  uae: { x: 570, y: 140 },
  saudiarabia: { x: 553, y: 145 },
  turkey: { x: 520, y: 108 },
  iran: { x: 575, y: 125 },
  // Americas
  usa: { x: 150, y: 115 },
  canada: { x: 148, y: 85 },
  mexico: { x: 155, y: 155 },
  brazil: { x: 230, y: 255 },
  argentina: { x: 215, y: 305 },
  colombia: { x: 200, y: 215 },
  peru: { x: 195, y: 250 },
  chile: { x: 205, y: 295 },
  // Oceania
  australia: { x: 768, y: 308 },
  newzealand: { x: 825, y: 340 },
};

// HOME location (East Africa default)
const HOME = { x: 522, y: 210 };

function getDestCoords(destination: string): { x: number; y: number } {
  const key = destination.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(LOCATION_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  // Deterministic fallback based on string hash, spread across map
  const hash = destination.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    x: 300 + (hash % 500),
    y: 80 + (hash % 300),
  };
}

export const TravelMap: React.FC<TravelMapProps> = ({ isAnimating, destination }) => {
  const destCoords = useMemo(() => getDestCoords(destination || ''), [destination]);

  // Bezier control point: arc upward for realism
  const cpX = (HOME.x + destCoords.x) / 2;
  const cpY = Math.min(HOME.y, destCoords.y) - 80;
  const flightPath = `M ${HOME.x} ${HOME.y} Q ${cpX} ${cpY} ${destCoords.x} ${destCoords.y}`;

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-primary/15 shadow-2xl bg-[#050d1a]"
         style={{ aspectRatio: '16/7', minHeight: '200px' }}>

      {/* Starfield dots */}
      <div className="absolute inset-0 opacity-40"
           style={{
             backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
             backgroundSize: '28px 28px',
           }} />

      {/* Radial glow behind destination */}
      {isAnimating && (
        <div
          className="absolute pointer-events-none transition-opacity duration-700"
          style={{
            left: `${(destCoords.x / 1000) * 100}%`,
            top: `${(destCoords.y / 500) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
      )}

      <svg
        viewBox="0 0 1000 500"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Graticule (latitude/longitude lines) */}
        {[100, 200, 300, 400].map(y => (
          <line key={`lat-${y}`} x1="0" y1={y} x2="1000" y2={y}
                stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        ))}
        {[200, 400, 600, 800].map(x => (
          <line key={`lon-${x}`} x1={x} y1="0" x2={x} y2="500"
                stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        ))}

        {/* Continents */}
        {CONTINENTS.map(c => (
          <path
            key={c.id}
            d={c.d}
            fill="hsl(var(--primary) / 0.08)"
            stroke="hsl(var(--primary) / 0.25)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}

        {/* Home dot (always visible) */}
        <circle cx={HOME.x} cy={HOME.y} r="5" fill="hsl(var(--primary))" opacity="0.9" />
        <circle cx={HOME.x} cy={HOME.y} r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4">
          <animate attributeName="r" values="8;16;8" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* Flight arc + marker (only when animating) */}
        <AnimatePresence>
          {isAnimating && (
            <>
              {/* Dashed trail */}
              <motion.path
                key="dash"
                d={flightPath}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
                strokeDasharray="6 5"
                opacity={0.35}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2.2, ease: 'easeInOut' }}
              />

              {/* Solid bright arc */}
              <motion.path
                key="arc"
                d={flightPath}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2.2, ease: 'easeInOut' }}
                style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.8))' }}
              />

              {/* Moving plane icon along arc */}
              <motion.g
                key="plane"
                initial={{ offsetDistance: '0%', opacity: 0, scale: 0.8 }}
                animate={{ offsetDistance: '100%', opacity: 1, scale: 1 }}
                transition={{ duration: 2.2, ease: 'easeInOut' }}
                style={{
                  offsetPath: `path("${flightPath}")`,
                  offsetRotate: 'auto',
                }}
              >
                {/* Plane shape */}
                <polygon
                  points="-6,0 6,0 0,-10"
                  fill="hsl(var(--primary))"
                  style={{ filter: 'drop-shadow(0 0 4px hsl(var(--primary)))' }}
                />
              </motion.g>

              {/* Destination pulse rings */}
              <motion.circle
                key="dest-outer"
                cx={destCoords.x}
                cy={destCoords.y}
                r="18"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                transition={{ delay: 2, duration: 1.5, repeat: Infinity }}
              />
              <motion.circle
                key="dest-dot"
                cx={destCoords.x}
                cy={destCoords.y}
                r="7"
                fill="hsl(var(--primary))"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 2, duration: 0.4 }}
                style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary)))' }}
              />
            </>
          )}
        </AnimatePresence>
      </svg>

      {/* Origin label */}
      <div className="absolute top-3 left-4 flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Origin</span>
        <span className="text-xs font-black text-white/80 mt-0.5">📍 Current Location</span>
      </div>

      {/* Destination label */}
      <AnimatePresence>
        {destination && (
          <motion.div
            key="dest-label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-3 right-4 flex flex-col items-end"
          >
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Destination</span>
            <span className="text-sm font-black text-primary mt-0.5"
                  style={{ textShadow: '0 0 12px hsl(var(--primary) / 0.6)' }}>
              ✈️ {destination}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Distance badge (shows when animating) */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            key="badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: 1.5 }}
            className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10 backdrop-blur-sm"
          >
            <Plane size={10} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-wider text-primary">En Route</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
