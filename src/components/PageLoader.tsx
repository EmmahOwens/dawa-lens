import { motion, type Transition } from "framer-motion";

interface PageLoaderProps {
  /** "full" renders a full-screen overlay with backdrop blur (default).
   *  "inline" renders only the pill animation — useful inside cards/panels. */
  variant?: "full" | "inline";
  /** Optional descriptive label shown below the animation (full variant only). */
  label?: string;
}

// ─── Animation constants ────────────────────────────────────────────────────
const pillTransition = (delay: number): Transition => ({
  duration: 0.85,
  repeat: Infinity,
  ease: "easeInOut" as const,
  delay,
});

/** Three staggered pill-shaped capsules that wave up and down.
 *  On-brand for a medication app — the shapes mirror actual pill capsules. */
function PillWave({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: { w: 22, h: 9, gap: 7, stagger: 0.13 },
    md: { w: 32, h: 13, gap: 10, stagger: 0.15 },
    lg: { w: 42, h: 16, gap: 13, stagger: 0.18 },
  }[size];

  const pills = [0, dims.stagger, dims.stagger * 2];

  return (
    <div
      className="flex items-end"
      style={{ gap: dims.gap, height: dims.h + 20 }}
      aria-label="Loading"
      role="status"
    >
      {pills.map((delay, i) => {
        // Middle pill is slightly larger so the wave looks organic
        const pillH = i === 1 ? dims.h + 2 : dims.h;
        const pillW = i === 1 ? dims.w + 4 : dims.w;

        return (
          <motion.span
            key={i}
            animate={{
              y: [0, -14, 0],
              scaleX: [1, 0.88, 1],
              scaleY: [1, 1.1, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={pillTransition(delay)}
            style={{
              display: "block",
              width: pillW,
              height: pillH,
              borderRadius: 9999,
              // Primary brand blue with subtle glow
              background:
                i === 1 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.65)",
              boxShadow:
                i === 1 ? "0 0 14px hsl(var(--primary) / 0.45)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Decorative scanning beam (full variant only) ────────────────────────────
function ScanBeam() {
  return (
    <motion.div
      aria-hidden
      animate={{ top: ["8%", "92%"] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 1,
        background:
          "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.25) 40%, hsl(var(--primary) / 0.4) 50%, hsl(var(--primary) / 0.25) 60%, transparent 100%)",
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function PageLoader({
  variant = "full",
  label,
}: PageLoaderProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center py-8">
        <PillWave size="sm" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl overflow-hidden"
    >
      {/* Ambient radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          className="w-[70vw] h-[70vw] max-w-sm max-h-sm rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Decorative horizontal scan line */}
      <ScanBeam />

      {/* Logo */}
      <motion.img
        src="/logo.png"
        alt="Dawa Lens"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{
          opacity: [0.6, 0.85, 0.6],
          scale: [1, 1.04, 1],
          filter: [
            "drop-shadow(0 0 0px hsl(var(--primary) / 0))",
            "drop-shadow(0 0 16px hsl(var(--primary) / 0.35))",
            "drop-shadow(0 0 0px hsl(var(--primary) / 0))",
          ],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
          // First entry
          opacity: { duration: 0.4, repeat: Infinity, repeatDelay: 2 },
        }}
        style={{ width: 68, height: 68, objectFit: "contain" }}
        className="mb-10 relative z-10"
      />

      {/* Pill wave */}
      <div className="relative z-10">
        <PillWave size="md" />
      </div>

      {/* Label */}
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 relative z-10"
      >
        {label ?? "Loading"}
      </motion.p>
    </motion.div>
  );
}
