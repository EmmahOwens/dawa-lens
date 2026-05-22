/**
 * SplashScreen.tsx
 *
 * Deepin OS 25 – inspired boot animation for Dawa Lens.
 *
 * Animation timeline
 * ──────────────────
 *  0 ms   : ambient glow & sparkles fade in
 *  300 ms : orbital dot rings appear; sonar pings begin
 *  400 ms : logo springs into view
 *  1 700 ms: "Dawa · Lens" assembles letter-by-letter (blur → sharp)
 *  2 300 ms: loading wave dots appear
 *  2 700 ms: tagline fades in
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

// ─── Brand tokens ────────────────────────────────────────────────────────────
const TEAL_BRIGHT = "#22c9cc";
const TEAL = "#1a9ca0";
const BG = "#030507";

// Pre-computed sparkle positions so renders are deterministic
const SPARKLES = [
  { x: 11, y: 17, delay: 0.0, dur: 3.2 },
  { x: 83, y: 11, delay: 0.9, dur: 4.1 },
  { x: 73, y: 79, delay: 1.7, dur: 3.6 },
  { x: 21, y: 83, delay: 0.4, dur: 5.0 },
  { x: 47, y: 7, delay: 1.3, dur: 3.0 },
  { x: 92, y: 47, delay: 0.6, dur: 4.5 },
  { x: 7, y: 58, delay: 2.3, dur: 3.3 },
  { x: 63, y: 92, delay: 0.2, dur: 4.0 },
  { x: 34, y: 34, delay: 1.9, dur: 3.8 },
  { x: 56, y: 64, delay: 0.8, dur: 4.2 },
  { x: 19, y: 50, delay: 2.8, dur: 3.5 },
  { x: 77, y: 36, delay: 1.1, dur: 3.9 },
];

// ─── OrbitalDot ──────────────────────────────────────────────────────────────
// A square container (width = diameter) is centered on the logo and rotates.
// The single dot sits at the top-center of that container, so it orbits
// the center like a planet.  Since the dot is circular, no counter-rotation
// is needed.
interface OrbitalDotProps {
  radius: number;
  startAngle: number; // initial offset in degrees
  duration: number; // seconds per revolution
  dotSize: number;
  color: string;
  glowColor: string;
  opacity?: number;
  clockwise?: boolean;
  delay?: number;
}

const OrbitalDot: React.FC<OrbitalDotProps> = ({
  radius,
  startAngle,
  duration,
  dotSize,
  color,
  glowColor,
  opacity = 1,
  clockwise = true,
  delay = 0,
}) => (
  <motion.div
    style={{
      position: "absolute",
      width: radius * 2,
      height: radius * 2,
      top: "50%",
      left: "50%",
      x: -radius,
      y: -radius,
      rotate: startAngle,
      pointerEvents: "none",
    }}
    animate={{ rotate: clockwise ? startAngle + 360 : startAngle - 360 }}
    transition={{ duration, repeat: Infinity, ease: "linear", delay }}
  >
    {/* Dot placed at the very top-center of the rotating container */}
    <div
      style={{
        position: "absolute",
        top: -dotSize / 2,
        left: "50%",
        marginLeft: -dotSize / 2,
        width: dotSize,
        height: dotSize,
        borderRadius: "50%",
        background: color,
        opacity,
        boxShadow: `0 0 ${dotSize * 2.5}px ${dotSize * 0.8}px ${glowColor}`,
      }}
    />
  </motion.div>
);

// ─── SonarRing ───────────────────────────────────────────────────────────────
// A ring that expands outward from the logo like a sonar ping, then fades.
const SonarRing: React.FC<{ delay: number; baseSize: number }> = ({
  delay,
  baseSize,
}) => (
  <motion.div
    initial={{ scale: 0.7, opacity: 0 }}
    animate={{ scale: [0.7, 2.6], opacity: [0.65, 0] }}
    transition={{
      duration: 2.4,
      repeat: Infinity,
      repeatDelay: 0.8,
      delay,
      ease: "easeOut",
    }}
    style={{
      position: "absolute",
      width: baseSize,
      height: baseSize,
      borderRadius: "50%",
      border: `1px solid ${TEAL_BRIGHT}`,
      top: "50%",
      left: "50%",
      x: -baseSize / 2,
      y: -baseSize / 2,
      pointerEvents: "none",
    }}
  />
);

// ─── LoadingDots ─────────────────────────────────────────────────────────────
const LoadingDots: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {[0, 1, 2, 3].map((i) => (
      <motion.div
        key={i}
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: TEAL,
          boxShadow: `0 0 6px 2px ${TEAL}55`,
        }}
        animate={{
          y: [0, -8, 0],
          opacity: [0.25, 1, 0.25],
          scale: [0.75, 1.4, 0.75],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.2,
        }}
      />
    ))}
  </motion.div>
);

// ─── SplashScreen ────────────────────────────────────────────────────────────
const SplashScreen: React.FC = () => {
  const [showOrbits, setShowOrbits] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const t0 = setTimeout(() => setShowOrbits(true), 300);
    const t1 = setTimeout(() => setShowText(true), 1700);
    const t2 = setTimeout(() => setShowLoader(true), 2300);
    const t3 = setTimeout(() => setShowTagline(true), 2700);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Letter-reveal variants
  const letterV: Variants = {
    hidden: { opacity: 0, filter: "blur(14px)", y: 6 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] },
    },
  };
  const dawaContainerV: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 0 },
    },
  };
  const lensContainerV: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 0.32 },
    },
  };

  const titleStyle: React.CSSProperties = {
    fontFamily:
      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: "clamp(1.9rem, 7.5vw, 2.55rem)",
    fontWeight: 400,
    color: "#ffffff",
    letterSpacing: "0.05em",
    lineHeight: 1,
  };

  // Orbital ring dot angles
  const RING1_ANGLES = [0, 120, 240]; // inner  – 3 dots CW
  const RING2_ANGLES = [0, 72, 144, 216, 288]; // outer  – 5 dots CCW

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: BG }}
    >
      {/* ── Ambient radial glow ─────────────────────────────────────── */}
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

      {/* Slow-breathing secondary glow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0.28, 0.55] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2,
        }}
        style={{
          position: "absolute",
          width: "50vmax",
          height: "50vmax",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(26,156,160,0.06) 0%, transparent 70%)`,
          filter: "blur(48px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Background sparkles ─────────────────────────────────────── */}
      {SPARKLES.map((s, i) => (
        <motion.div
          key={`sp-${i}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0.5, 0], scale: [0, 1, 0] }}
          transition={{
            duration: s.dur,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: s.dur * 0.6 + s.delay * 0.4,
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: TEAL_BRIGHT,
            left: `${s.x}%`,
            top: `${s.y}%`,
            boxShadow: `0 0 5px 2px rgba(34,201,204,0.48)`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* ── Main content ────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* ╔═══════════════════════════════════════╗
            ║   Orbital arena + Logo                ║
            ╚═══════════════════════════════════════╝ */}
        <div
          style={{
            position: "relative",
            width: 220,
            height: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Sonar rings – start with the logo animation */}
          <SonarRing delay={1.0} baseSize={90} />
          <SonarRing delay={2.35} baseSize={90} />

          {/* Faint orbit guide circles */}
          {showOrbits &&
            [
              { r: 58, alpha: 0.15, delay: 0 },
              { r: 86, alpha: 0.08, delay: 0.18 },
            ].map(({ r, alpha, delay }) => (
              <motion.div
                key={`guide-${r}`}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  width: r * 2,
                  height: r * 2,
                  borderRadius: "50%",
                  border: `1px solid rgba(26,156,160,${alpha})`,
                  top: "50%",
                  left: "50%",
                  x: -r,
                  y: -r,
                  pointerEvents: "none",
                }}
              />
            ))}

          {/* Inner ring – 3 dots, clockwise, 7 s */}
          {showOrbits &&
            RING1_ANGLES.map((angle, i) => (
              <OrbitalDot
                key={`r1-${i}`}
                radius={58}
                startAngle={angle}
                duration={7}
                dotSize={3.5}
                color={TEAL_BRIGHT}
                glowColor="rgba(34,201,204,0.75)"
                opacity={0.88}
                clockwise
                delay={i * 0.06}
              />
            ))}

          {/* Outer ring – 5 dots, counter-clockwise, 15 s */}
          {showOrbits &&
            RING2_ANGLES.map((angle, i) => (
              <OrbitalDot
                key={`r2-${i}`}
                radius={86}
                startAngle={angle}
                duration={15}
                dotSize={2.5}
                color={TEAL}
                glowColor="rgba(26,156,160,0.55)"
                opacity={0.58}
                clockwise={false}
                delay={i * 0.12}
              />
            ))}

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.35 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.9,
              delay: 0.4,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            style={{
              position: "absolute",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Pulsing inner halo */}
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.22, 0.52, 0.22] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              style={{
                position: "absolute",
                width: 92,
                height: 92,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(34,201,204,0.3) 0%, transparent 70%)`,
                filter: "blur(10px)",
              }}
            />

            {/* Logo image */}
            <motion.img
              src="/logo.png"
              alt="Dawa Lens"
              style={{
                width: 76,
                height: 76,
                objectFit: "contain",
                position: "relative",
                zIndex: 1,
                display: "block",
              }}
              animate={{
                filter: [
                  "drop-shadow(0 0 3px  rgba(34,201,204,0.15))",
                  "drop-shadow(0 0 18px rgba(34,201,204,0.65)) drop-shadow(0 0 36px rgba(34,201,204,0.20))",
                  "drop-shadow(0 0 6px  rgba(34,201,204,0.25))",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.2,
              }}
            />
          </motion.div>
        </div>

        {/* ╔═══════════════════════════════════════╗
            ║   App name  "Dawa · Lens"             ║
            ╚═══════════════════════════════════════╝ */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: "0.3em",
            minHeight: "3.2rem",
          }}
        >
          <AnimatePresence>
            {showText && (
              <>
                {/* "Dawa" */}
                <motion.div
                  key="dawa"
                  variants={dawaContainerV}
                  initial="hidden"
                  animate="visible"
                  style={{ display: "flex" }}
                >
                  {"Dawa".split("").map((ch, i) => (
                    <motion.span key={i} variants={letterV} style={titleStyle}>
                      {ch}
                    </motion.span>
                  ))}
                </motion.div>

                {/* Glowing separator dot */}
                <motion.div
                  key="dot"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.32,
                    duration: 0.35,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: TEAL_BRIGHT,
                    boxShadow: `0 0 8px 3px rgba(34,201,204,0.58)`,
                    flexShrink: 0,
                    marginBottom: 2,
                  }}
                />

                {/* "Lens" */}
                <motion.div
                  key="lens"
                  variants={lensContainerV}
                  initial="hidden"
                  animate="visible"
                  style={{ display: "flex" }}
                >
                  {"Lens".split("").map((ch, i) => (
                    <motion.span key={i} variants={letterV} style={titleStyle}>
                      {ch}
                    </motion.span>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* ╔═══════════════════════════════════════╗
            ║   Tagline                             ║
            ╚═══════════════════════════════════════╝ */}
        <div style={{ marginTop: 10, minHeight: "1.4rem" }}>
          <AnimatePresence>
            {showTagline && (
              <motion.p
                key="tagline"
                initial={{ opacity: 0, y: 7, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.38)",
                  fontSize: "0.67rem",
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  fontWeight: 400,
                  textAlign: "center",
                  fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif',
                }}
              >
                Smart Medicine Reminder
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ╔═══════════════════════════════════════╗
            ║   Wave-pulse loading indicator        ║
            ╚═══════════════════════════════════════╝ */}
        <div style={{ marginTop: 48, minHeight: 24 }}>
          <AnimatePresence>
            {showLoader && <LoadingDots key="loader" />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
