/**
 * SplashScreen.tsx
 *
 * Faithful recreation of the Dawa Lens splash screen concept.
 *
 * Layout (top → bottom, vertically centered):
 *   • Full-bleed background with scattered blurred pill decorations
 *   • Central hero: /logo.png displayed large as the main focal point
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

// ─── The central logo ─────────────────────────────────────────────────────────
// Displays the /logo.png app icon as the hero image, matching the concept
// where the orbital illustration IS the logo.  A subtle drop shadow is applied
// so it reads well on both light and dark backgrounds.
const OrbitalCenter: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div
    style={{
      width: 220,
      height: 220,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <img
      src="/logo.png"
      alt="Dawa Lens"
      style={{
        width: 220,
        height: 220,
        objectFit: "contain",
        // Soft shadow so the logo lifts off the background in both modes
        filter: dark
          ? "drop-shadow(0 8px 32px rgba(0,0,0,0.55))"
          : "drop-shadow(0 8px 24px rgba(80,90,120,0.22))",
      }}
    />
  </div>
);

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
          Smart Medicine Reminder
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
