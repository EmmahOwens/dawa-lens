import React, { useRef, useCallback } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { DotLottie } from "@lottiefiles/dotlottie-react";
import { motion } from "framer-motion";

interface LottieMojiProps {
  /** The emoji character, e.g. "😔". Must exist in MOOD_LOTTIE_MAP or a static fallback is shown. */
  emoji: string;
  /** Width and height in pixels. Default: 48 */
  size?: number;
  /**
   * When true: animation plays once then loops (selected/active state).
   * When false: animation is frozen on frame 0, greyscale (inactive state).
   */
  active?: boolean;
  className?: string;
}

const NOTO_BASE = "https://fonts.gstatic.com/s/e/notoemoji/latest";

/**
 * Maps mood emoji characters to their Google Noto Animated Emoji CDN Lottie JSON URLs.
 * Apache 2.0 — served by Google's own CDN, browser-cached per emoji.
 */
const MOOD_LOTTIE_MAP: Record<string, string> = {
  "😔": `${NOTO_BASE}/1f614/lottie.json`, // Pensive Face   — Low
  "😕": `${NOTO_BASE}/1f615/lottie.json`, // Confused Face  — Meh
  "😐": `${NOTO_BASE}/1f610/lottie.json`, // Neutral Face   — Okay
  "🙂": `${NOTO_BASE}/1f642/lottie.json`, // Slightly Smile — Good
  "🤩": `${NOTO_BASE}/1f929/lottie.json`, // Star-Struck    — Great
};

/** Human-readable labels for accessibility */
const EMOJI_LABELS: Record<string, string> = {
  "😔": "Pensive face – Low mood",
  "😕": "Confused face – Meh mood",
  "😐": "Neutral face – Okay mood",
  "🙂": "Slightly smiling face – Good mood",
  "🤩": "Star-struck face – Great mood",
};

// ── Eager prefetch on module load ─────────────────────────────────────────────
// Kick off a fetch for every known Lottie JSON as soon as this module is
// imported. The browser caches the response, so by the time the user taps an
// emoji the JSON is already in memory — zero network wait, no blurry frame.
if (typeof window !== "undefined") {
  Object.values(MOOD_LOTTIE_MAP).forEach((url) => {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "fetch";
    link.crossOrigin = "anonymous";
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * LottieMoji
 *
 * Drop-in replacement for RiveMoji on mood-expression surfaces.
 * Renders a Google Noto Animated Emoji Lottie animation for each supported
 * mood emoji. Falls back to a static <span> if the emoji is not in the map.
 *
 * Behaviour (matching WhatsApp/Telegram pattern):
 *  - active=false → frozen on frame 0, greyscale
 *  - active=true  → spring pop-in entrance, plays and loops
 *  - Tap while active → animation restarts from frame 0
 *  - Respects prefers-reduced-motion
 *
 * Performance:
 *  - All Lottie JSONs are prefetched via <link rel="prefetch"> on module load
 *  - A crisp static emoji is shown instantly while the player initialises,
 *    eliminating the blurry-placeholder frame
 */
export const LottieMoji: React.FC<LottieMojiProps> = ({
  emoji,
  size = 48,
  active = false,
  className,
}) => {
  const dotLottieRef = useRef<DotLottie | null>(null);
  const src = MOOD_LOTTIE_MAP[emoji];
  const label = EMOJI_LABELS[emoji] ?? emoji;

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const handleDotLottieRef = useCallback((instance: DotLottie | null) => {
    dotLottieRef.current = instance;
  }, []);

  /** Restart the animation when the user taps an already-active emoji */
  const handleReplay = useCallback(() => {
    if (active && dotLottieRef.current) {
      dotLottieRef.current.setFrame(0);
      dotLottieRef.current.play();
    }
  }, [active]);

  // ── Fallback: emoji not in the Noto map ──────────────────────────────────
  if (!src) {
    return (
      <span
        role="img"
        aria-label={label}
        className={className}
        style={{ fontSize: size * 0.72, lineHeight: 1, display: "inline-block" }}
      >
        {emoji}
      </span>
    );
  }

  // ── Lottie player ────────────────────────────────────────────────────────
  return (
    <motion.div
      role="img"
      aria-label={label}
      className={`relative flex items-center justify-center cursor-pointer select-none ${className ?? ""}`}
      style={{ width: size, height: size }}
      // Spring pop-in only when transitioning to active
      animate={active ? { scale: [0.85, 1.08, 1] } : { scale: 1 }}
      transition={
        active
          ? { type: "spring", stiffness: 420, damping: 18, mass: 0.8, duration: 0.35 }
          : { duration: 0 }
      }
      onClick={handleReplay}
    >
      {/*
        Instant crisp static emoji shown underneath while the Lottie player
        initialises. The DotLottieReact canvas appears on top once ready,
        so the user never sees a blurry/empty frame.
      */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          fontSize: size * 0.72,
          lineHeight: 1,
          filter: active ? "none" : "grayscale(1)",
          opacity: active ? 1 : 0.45,
          transition: "filter 0.25s ease, opacity 0.25s ease",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {emoji}
      </span>

      {/* Lottie canvas — renders on top of the static emoji once loaded */}
      <DotLottieReact
        dotLottieRefCallback={handleDotLottieRef}
        src={src}
        autoplay={active && !prefersReducedMotion}
        loop={active && !prefersReducedMotion}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          filter: active ? "none" : "grayscale(1)",
          opacity: active ? 1 : 0.45,
          transition: "filter 0.25s ease, opacity 0.25s ease",
        }}
      />
    </motion.div>
  );
};

export default LottieMoji;
