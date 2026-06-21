import { motion, type Transition } from "framer-motion";
import { GooeyPillLoader } from "./GooeyPillLoader";

interface PageLoaderProps {
  /** "full" renders a full-screen overlay with backdrop blur (default).
   *  "inline" renders only the pill animation — useful inside cards/panels. */
  variant?: "full" | "inline";
  /** Optional descriptive label shown below the animation (full variant only). */
  label?: string;
}

// ─── Decorative premium scanning laser line ─────────────────────────────────
function ScanBeam() {
  return (
    <motion.div
      aria-hidden
      animate={{ 
        top: ["5%", "95%", "5%"],
        opacity: [0.3, 0.9, 0.3]
      }}
      transition={{ 
        duration: 4.2, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }}
      style={{
        position: "absolute",
        left: "5%",
        right: "5%",
        height: "2px",
        background:
          "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 30%, hsl(var(--primary)) 70%, transparent 100%)",
        boxShadow: "0 0 15px 3px hsl(var(--primary) / 0.5), 0 0 4px 1px hsl(var(--primary))",
        zIndex: 5,
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
      <div className="flex items-center justify-center py-6" role="status" aria-label="Loading">
        <GooeyPillLoader size="sm" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background/85 backdrop-blur-2xl overflow-hidden"
    >
      {/* Premium ambient light fields (pulsing radial gradients) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        {/* Glow center */}
        <motion.div
          animate={{
            scale: [1, 1.2, 0.95, 1.1, 1],
            opacity: [0.25, 0.4, 0.2, 0.35, 0.25],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="w-[90vw] h-[90vw] max-w-lg max-h-lg rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.22) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        {/* Secondary subtle orange ambient light */}
        <motion.div
          animate={{
            scale: [1.1, 0.9, 1.15, 1],
            opacity: [0.12, 0.22, 0.15, 0.12],
          }}
          transition={{
            duration: 9.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute w-[80vw] h-[80vw] max-w-md max-h-md rounded-full"
          style={{
            background:
              "radial-gradient(circle, #e05c30 0%, transparent 65%)",
            filter: "blur(70px)",
            transform: "translate(-20px, 40px)",
          }}
        />
      </div>

      {/* Futuristic scanning beam */}
      <ScanBeam />

      {/* Decorative cybernetic grid backing (soft opacity) */}
      <div 
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Content layout card */}
      <div className="relative z-10 flex flex-col items-center max-w-xs p-8 rounded-3xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/20 shadow-2xl backdrop-blur-md">
        {/* Animated App Logo with premium pulse */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{
            opacity: [0.75, 1, 0.75],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="mb-8"
        >
          <img
            src="/logo.png"
            alt="Dawa Lens"
            style={{ width: 72, height: 72, objectFit: "contain" }}
            className="drop-shadow-[0_0_12px_hsl(var(--primary)/0.25)] dark:drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
          />
        </motion.div>

        {/* High-fidelity fluid gooey loader */}
        <div className="mb-6">
          <GooeyPillLoader size="md" />
        </div>

        {/* Dynamic scanning label */}
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 0.85, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/80 text-center"
        >
          {label ?? "Scanning System"}
        </motion.p>
      </div>
    </motion.div>
  );
}
