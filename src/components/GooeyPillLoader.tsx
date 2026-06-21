import { motion } from "framer-motion";
import { useId } from "react";

interface GooeyPillLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GooeyPillLoader({ size = "md", className = "" }: GooeyPillLoaderProps) {
  const filterId = useId();

  // Dims matching the size prop
  const dims = {
    sm: { width: 70, height: 26, ballSize: 12, travel: 22, blur: 4, contrast: 12 },
    md: { width: 110, height: 38, ballSize: 18, travel: 36, blur: 6, contrast: 16 },
    lg: { width: 150, height: 50, ballSize: 24, travel: 50, blur: 8, contrast: 18 },
  }[size];

  // We define standard animation duration and ease
  const duration = 1.6;
  const ease = "easeInOut";

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: dims.width, height: dims.height }}
      aria-label="Loading"
      role="status"
    >
      {/* SVG Container holding the balls and the gooey filter */}
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
        style={{ filter: `url(#${filterId})` }}
      >
        <defs>
          <filter id={filterId}>
            {/* Blur the input graphics */}
            <feGaussianBlur in="SourceGraphic" stdDeviation={dims.blur} result="blur" />
            {/* Color Matrix to sharpen the alpha channel, creating the gooey liquid connection */}
            <feColorMatrix
              in="blur"
              mode="matrix"
              values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${dims.contrast} -7`}
              result="gooey"
            />
            {/* Blend the crisp gooey result */}
            <feBlend in="SourceGraphic" in2="gooey" />
          </filter>
        </defs>

        {/* Capsule Track Background - rendered inside the SVG so it joins gooey-ly if desired, 
            or we can just render the moving medicine elements. Let's render the capsule outline/track first */}
        <g>
          {/* Left/First Ball (Primary Color) */}
          <motion.circle
            cx={dims.width / 2 - dims.travel / 2}
            cy={dims.height / 2}
            r={dims.ballSize / 2}
            fill="currentColor"
            className="text-primary"
            animate={{
              x: [0, dims.travel, 0],
              scale: [1, 1.15, 0.9, 1.15, 1],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease,
            }}
          />

          {/* Right/Second Ball (Secondary/Coral Accent Color) */}
          <motion.circle
            cx={dims.width / 2 + dims.travel / 2}
            cy={dims.height / 2}
            r={dims.ballSize / 2}
            fill="currentColor"
            className="text-[#e05c30]" // On-brand Dawa orange/coral color
            animate={{
              x: [0, -dims.travel, 0],
              scale: [1, 0.9, 1.15, 0.9, 1],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease,
            }}
          />

          {/* Center/Third Ball (Pulsing Purple/Muted Molecular connection) */}
          <motion.circle
            cx={dims.width / 2}
            cy={dims.height / 2}
            r={dims.ballSize / 2.3}
            fill="currentColor"
            className="text-[#8b5cf6]" // Purple/Indigo accent color
            animate={{
              y: [0, -dims.ballSize / 3, dims.ballSize / 3, 0],
              scale: [0.95, 1.1, 0.95, 1.1, 0.95],
            }}
            transition={{
              duration: duration * 1.2,
              repeat: Infinity,
              ease,
            }}
          />
        </g>
      </svg>

      {/* Pill Outer border glow wrapper */}
      <div
        className="absolute inset-0 rounded-full border border-primary/10 pointer-events-none"
        style={{
          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.15), 0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.1)",
        }}
      />
    </div>
  );
}
