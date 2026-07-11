import { motion } from "framer-motion";

interface BouncingPillsLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function BouncingPillsLoader({ size = "md", className = "" }: BouncingPillsLoaderProps) {
  const dims = {
    sm: { width: 10, height: 26, spacing: "gap-1.5", bounce: -10 },
    md: { width: 14, height: 38, spacing: "gap-2.5", bounce: -16 },
    lg: { width: 18, height: 50, spacing: "gap-3.5", bounce: -22 },
  }[size];

  const pills = [
    {
      topColor: "hsl(var(--primary))",
      bottomColor: "hsl(var(--primary) / 0.25)",
      rotate: -12,
    },
    {
      topColor: "#e05c30", // Dawa Orange/Coral
      bottomColor: "rgba(224, 92, 48, 0.25)",
      rotate: 0,
    },
    {
      topColor: "#8b5cf6", // Purple/Indigo
      bottomColor: "rgba(139, 92, 246, 0.25)",
      rotate: 12,
    },
  ];

  return (
    <div
      className={`flex items-center justify-center ${dims.spacing} ${className}`}
      role="status"
      aria-label="Loading"
    >
      {pills.map((pill, index) => (
        <motion.div
          key={index}
          className="relative flex flex-col overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
          style={{
            width: dims.width,
            height: dims.height,
            borderRadius: dims.width,
          }}
          animate={{
            y: [0, dims.bounce, 0],
            rotate: [0, pill.rotate, 0],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.15,
          }}
        >
          {/* Top Half (colored) */}
          <div
            className="w-full h-1/2"
            style={{
              background: `linear-gradient(135deg, ${pill.topColor} 0%, ${pill.topColor}cc 100%)`,
            }}
          />
          {/* Bottom Half (light/translucent/glassy) */}
          <div
            className="w-full h-1/2 border-t border-white/10 dark:border-white/5"
            style={{
              backgroundColor: pill.bottomColor,
              backdropFilter: "blur(1px)",
            }}
          />
          
          {/* 3D Gloss Highlight overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.08) 100%)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.15)",
              borderRadius: dims.width,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}
