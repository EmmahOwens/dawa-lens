import { motion } from "framer-motion";
import RiveAnimation from "./rive/RiveAnimation";

interface PageLoaderProps {
  /** "full" renders a full-screen overlay with backdrop blur (default).
   *  "inline" renders only the pill animation — useful inside cards/panels. */
  variant?: "full" | "inline";
  /** Optional descriptive label shown below the animation (full variant only). */
  label?: string;
}

/**
 * PageLoader.tsx - Rive Optimized
 * Replaces complex staggered DOM animations with a single vector-based Rive loop.
 */
export default function PageLoader({
  variant = "full",
  label,
}: PageLoaderProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center py-8 h-12 w-24 mx-auto">
        <RiveAnimation
          src="/assets/rive/pill_loader.riv"
          stateMachine="State Machine 1"
          autoplay={true}
        />
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

      {/* Main Loader Area - Combines Logo + Pill Wave + Scan Beam in one Rive file */}
      <div className="relative z-10 w-64 h-64">
        <RiveAnimation
          src="/assets/rive/full_page_loader.riv"
          stateMachine="State Machine 1"
          autoplay={true}
        />
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
