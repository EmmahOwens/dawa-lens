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
import { LOGO_BASE64 } from "@/lib/logoBase64";

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
      src={LOGO_BASE64}
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

// ─── Lightweight GPU-composited ambient backdrop ─────────────────────────────
// Replaces 14 individual `filter: blur()` DOM elements with two zero-cost radial
// gradients so cold-start splash rendering never stalls low-RAM Android compositors.
const BackgroundPills: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 1,
      background: dark
        ? "radial-gradient(circle at 18% 20%, rgba(41, 151, 255, 0.14), transparent 46%), radial-gradient(circle at 82% 78%, rgba(224, 92, 48, 0.14), transparent 48%)"
        : "radial-gradient(circle at 18% 20%, rgba(0, 102, 204, 0.11), transparent 46%), radial-gradient(circle at 82% 78%, rgba(224, 92, 48, 0.10), transparent 48%)",
    }}
  />
);

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
