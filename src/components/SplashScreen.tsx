/**
 * SplashScreen.tsx
 *
 * Faithful recreation of the Dawa Lens splash screen concept.
 *
 * Layout (top → bottom, vertically centered):
 *   • Full-bleed background with scattered blurred pill decorations
 *   • Central orbital: 3 concentric rings + glassmorphism lens bowl
 *     with 8 colorful pills arranged around it, gold pill at center
 *   • "Dawa Lens" brand text  (dark/light responsive)
 *   • "See Medicine. Live Better." tagline
 *   • Spinner + "Loading..." at the bottom
 *
 * Animation: only the bottom loading spinner animates.
 * Everything else is static.
 */

import React from "react";
import { useTheme } from "next-themes";

// ─── Pill shape helper ────────────────────────────────────────────────────────
interface PillProps {
  width: number;
  height: number;
  color: string;
  colorB?: string; // second half color (split-capsule style)
  rotate?: number;
  style?: React.CSSProperties;
}

const Pill: React.FC<PillProps> = ({
  width,
  height,
  color,
  colorB,
  rotate = 0,
  style,
}) => {
  const r = height / 2;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: r,
        transform: `rotate(${rotate}deg)`,
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: `0 4px 16px rgba(0,0,0,0.22), inset 0 1px 2px rgba(255,255,255,0.35)`,
        ...style,
      }}
    >
      {colorB ? (
        // Split capsule: left half + right half
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          <div style={{ width: "50%", background: color }} />
          <div style={{ width: "50%", background: colorB }} />
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          }}
        />
      )}
    </div>
  );
};

// ─── Round tablet helper ──────────────────────────────────────────────────────
interface TabletProps {
  size: number;
  color: string;
  style?: React.CSSProperties;
}

const Tablet: React.FC<TabletProps> = ({ size, color, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 38% 38%, ${color}ee, ${color}99)`,
      boxShadow: `0 4px 14px rgba(0,0,0,0.22), inset 0 1px 2px rgba(255,255,255,0.4)`,
      flexShrink: 0,
      ...style,
    }}
  />
);

// ─── Spinner (the only animated element) ─────────────────────────────────────
const Spinner: React.FC<{ dark: boolean }> = ({ dark }) => {
  const color = dark ? "rgba(255,255,255,0.55)" : "rgba(80,80,100,0.55)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Ring spinner matching the concept screenshot */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `2.5px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(100,100,120,0.18)"}`,
          borderTopColor: dark ? "rgba(255,255,255,0.7)" : "rgba(80,80,110,0.75)",
          animation: "dawa-spin 0.85s linear infinite",
        }}
      />
      <span
        style={{
          fontSize: "0.72rem",
          color,
          letterSpacing: "0.02em",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        Loading...
      </span>

      <style>{`
        @keyframes dawa-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ─── The central orbital ──────────────────────────────────────────────────────
// Three concentric SVG rings + glass bowl + 8 pills positioned around them
// + gold pill in center.  All sizes are in px; the wrapper is 260×260.
const OrbitalCenter: React.FC<{ dark: boolean }> = ({ dark }) => {
  const ringColor = dark ? "rgba(255,255,255,0.18)" : "rgba(100,110,130,0.22)";
  const bowlBg = dark
    ? "radial-gradient(circle at 44% 38%, rgba(60,65,80,0.95) 0%, rgba(30,32,40,0.98) 60%, rgba(15,15,20,1) 100%)"
    : "radial-gradient(circle at 44% 38%, rgba(230,235,245,0.95) 0%, rgba(210,215,230,0.90) 60%, rgba(195,200,218,0.88) 100%)";
  const bowlBorder = dark
    ? "1.5px solid rgba(255,255,255,0.12)"
    : "1.5px solid rgba(180,185,200,0.6)";
  const size = 260;
  const cx = size / 2;

  // Ring radii (outer → inner)
  const R3 = 118; // outermost
  const R2 = 96;
  const R1 = 74;
  const bowlR = 52; // glass bowl radius

  // 8 pills placed on R2 at evenly-spaced angles (top = -90°)
  // Arrangement matching the concept (clockwise from top):
  // pink, teal, yellow-orange, orange tablet, blue-white, white-red, red-white, white
  const pillsOnRing: {
    angle: number;
    type: "pill" | "tablet";
    color: string;
    colorB?: string;
    w: number;
    h: number;
    rot: number;
  }[] = [
    { angle: -90, type: "pill", color: "#e8527a", w: 20, h: 10, rot: 0 },         // top: pink
    { angle: -45, type: "pill", color: "#28bfbf", w: 20, h: 10, rot: 45 },        // top-right: teal
    { angle: 0,   type: "pill", color: "#e8a22a", w: 20, h: 10, rot: 90 },        // right: orange-yellow
    { angle: 45,  type: "tablet", color: "#f07540", w: 12, h: 12, rot: 0 },       // bottom-right: orange tablet
    { angle: 90,  type: "pill", color: "#fff", colorB: "#2979e8", w: 20, h: 10, rot: 0 },  // bottom: blue-white
    { angle: 135, type: "pill", color: "#fff", colorB: "#e03030", w: 20, h: 10, rot: -45 },// bottom-left: white-red
    { angle: 180, type: "pill", color: "#e03030", colorB: "#fff", w: 20, h: 10, rot: 90 }, // left: red-white
    { angle: 225, type: "pill", color: "#fff", w: 18, h: 9, rot: 135 },           // top-left: white
  ];

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* SVG concentric rings */}
      <svg
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <circle cx={cx} cy={cx} r={R3} fill="none" stroke={ringColor} strokeWidth="1" />
        <circle cx={cx} cy={cx} r={R2} fill="none" stroke={ringColor} strokeWidth="1" />
        <circle cx={cx} cy={cx} r={R1} fill="none" stroke={ringColor} strokeWidth="1" />
      </svg>

      {/* Glass bowl */}
      <div
        style={{
          position: "absolute",
          top: cx - bowlR,
          left: cx - bowlR,
          width: bowlR * 2,
          height: bowlR * 2,
          borderRadius: "50%",
          background: bowlBg,
          border: bowlBorder,
          boxShadow: dark
            ? "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.08)"
            : "0 8px 32px rgba(100,110,140,0.25), inset 0 1px 3px rgba(255,255,255,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      />

      {/* Gold pill in center */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-15deg)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 44,
            height: 20,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f0c84a 0%, #d4a017 60%, #c49012 100%)",
            boxShadow: "0 4px 18px rgba(212,160,23,0.55), inset 0 1px 3px rgba(255,255,200,0.5)",
          }}
        />
      </div>

      {/* Pills arranged around ring R2 */}
      {pillsOnRing.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const px = cx + R2 * Math.cos(rad);
        const py = cx + R2 * Math.sin(rad);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              transform: "translate(-50%, -50%)",
              zIndex: 5,
            }}
          >
            {p.type === "tablet" ? (
              <Tablet size={p.w} color={p.color} />
            ) : (
              <Pill
                width={p.w}
                height={p.h}
                color={p.color}
                colorB={p.colorB}
                rotate={p.rot}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Scattered background pills ───────────────────────────────────────────────
// Mimics the blurred scattered pills in the concept images.
// We render them at fixed positions with blur applied, so they feel
// like out-of-focus medicine scattered on a surface.
const BackgroundPills: React.FC<{ dark: boolean }> = ({ dark }) => {
  // [x%, y%, rotate, blur, opacity, width, height, color, colorB?]
  const pills: [number, number, number, number, number, number, number, string, string?][] = [
    [5,  4,  -30, 6, 0.55, 40, 18, "#e8e0d0"],
    [80, 3,  20,  5, 0.50, 36, 15, "#ccc9c0"],
    [92, 8,  -10, 4, 0.45, 28, 12, "#e07070"],
    [2,  20, 45,  7, 0.40, 44, 19, "#4dc0e0"],
    [88, 22, -50, 6, 0.50, 38, 16, "#e8a030"],
    [7,  75, -15, 5, 0.55, 46, 20, "#4dc0e0"],
    [85, 70, 30,  6, 0.45, 42, 18, "#d4a017"],
    [15, 90, 10,  4, 0.50, 36, 15, "#e07070", "#fff"],
    [70, 88, -25, 5, 0.48, 40, 17, "#888", "#aaa"],
    [50, 6,  60,  7, 0.35, 30, 13, "#d4c0b0"],
    [95, 45, -40, 8, 0.30, 38, 16, "#e8c0c0"],
    [3,  50, 20,  6, 0.35, 32, 14, "#b0c0d8"],
    [60, 92, 15,  5, 0.42, 38, 16, "#e8a020"],
    [25, 5,  -5,  4, 0.30, 24, 11, "#d0d0c0"],
  ];

  return (
    <>
      {pills.map(([x, y, rot, blur, opacity, w, h, c, cB], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            transform: `rotate(${rot}deg)`,
            filter: `blur(${blur}px)`,
            opacity: dark ? opacity * 0.75 : opacity,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {h === w ? (
            <Tablet size={w} color={c} />
          ) : (
            <Pill width={w} height={h} color={c} colorB={cB} />
          )}
        </div>
      ))}
    </>
  );
};

// ─── SplashScreen ────────────────────────────────────────────────────────────
const SplashScreen: React.FC = () => {
  const { resolvedTheme } = useTheme();

  // resolvedTheme may be undefined on first render before next-themes hydrates.
  // Fall back to the OS colour-scheme preference so the screen never flashes
  // the wrong theme.
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = resolvedTheme ? resolvedTheme === "dark" : prefersDark;

  const bg = dark ? "#111114" : "#e8eaf0";
  const titleDawa = dark ? "#ffffff" : "#1a2540";
  const titleLens = "#e05c30"; // coral-orange in both modes (matches concept)
  const tagline = dark ? "rgba(200,205,215,0.65)" : "rgba(60,65,85,0.62)";

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: bg }}
    >
      {/* Scattered background pills */}
      <BackgroundPills dark={dark} />

      {/* Subtle radial vignette to blend edges */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: dark
            ? "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)"
            : "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(180,185,200,0.45) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Main content stack */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* Central orbital */}
        <OrbitalCenter dark={dark} />

        {/* Brand name */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "baseline",
            gap: "0.22em",
          }}
        >
          <span
            style={{
              fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: "clamp(2rem, 8vw, 2.6rem)",
              fontWeight: 700,
              color: titleDawa,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            Dawa
          </span>
          <span
            style={{
              fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: "clamp(2rem, 8vw, 2.6rem)",
              fontWeight: 700,
              color: titleLens,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            Lens
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            marginTop: 8,
            fontSize: "0.92rem",
            color: tagline,
            letterSpacing: "0.01em",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            textAlign: "center",
          }}
        >
          See Medicine. Live Better.
        </p>

        {/* Loading spinner */}
        <div style={{ marginTop: 56 }}>
          <Spinner dark={dark} />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
