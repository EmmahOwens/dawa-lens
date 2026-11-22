import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { isScreenImageReady } from "@/lib/preloadScreenImages";
import { getScreenLqip } from "@/lib/screenMedia";
import { EDITORIAL_EASE, EditorialEyebrow } from "@/components/editorial/EditorialPrimitives";

interface ScreenHeroMetric {
  label: string;
  value: React.ReactNode;
}

interface ScreenHeroImageProps {
  src: string;
  lqip?: string;
  alt: string;
  eyebrow?: string;
  indexLabel?: string;
  title?: string;
  accentWord?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  metrics?: ScreenHeroMetric[];
  asH1?: boolean;
  className?: string;
}

/**
 * Editorial Split-Frame Hero for feature screens.
 * Pairs indexed mono micro-labels + mixed sans/italic Instrument Serif display typography
 * on the left with an inset photographic frame (film grain + subtle settle-zoom + LQIP) on the right.
 * Full Light & Dark mode parity; keeps tools above the fold on mobile.
 */
export function ScreenHeroImage({
  src,
  lqip,
  alt,
  eyebrow,
  indexLabel,
  title,
  accentWord,
  subtitle,
  actions,
  metrics,
  asH1 = false,
  className,
}: ScreenHeroImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(() => isScreenImageReady(src));
  const resolvedLqip = lqip ?? getScreenLqip(src);

  useEffect(() => {
    if (isScreenImageReady(src)) {
      setLoaded(true);
      return;
    }
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const renderTitle = () => {
    if (!title) return null;
    const HeadingTag = asH1 ? "h1" : "h2";

    if (accentWord && title.toLowerCase().includes(accentWord.toLowerCase())) {
      const idx = title.toLowerCase().indexOf(accentWord.toLowerCase());
      const before = title.slice(0, idx);
      const match = title.slice(idx, idx + accentWord.length);
      const after = title.slice(idx + accentWord.length);

      return (
        <HeadingTag className="editorial-display text-[26px] sm:text-[34px] md:text-[38px] font-medium text-foreground leading-[1.04] tracking-[-0.035em]">
          {before}
          <em className="editorial-serif text-[1.09em] text-muted-foreground font-normal">
            {match}
          </em>
          {after}
        </HeadingTag>
      );
    }

    return (
      <HeadingTag className="editorial-display text-[24px] sm:text-[32px] md:text-[36px] font-medium text-foreground leading-[1.06] tracking-[-0.032em]">
        {title}
      </HeadingTag>
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EDITORIAL_EASE }}
      className={cn(
        "group relative w-full rounded-[26px] editorial-glass p-5 sm:p-6 md:p-7 mb-7 overflow-hidden",
        className
      )}
    >
      {/* Subtle architectural top specular hairline */}
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 dark:via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5 md:gap-8">
        {/* Left: Editorial Typography & Controls */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-3">
            {eyebrow && (
              <EditorialEyebrow
                index={indexLabel}
                label={eyebrow}
                dotColor="bg-primary"
              />
            )}
            {/* Mobile compact thumbnail */}
            <div className="sm:hidden relative shrink-0 w-16 h-16 overflow-hidden rounded-[16px] border border-border/70 bg-muted/40">
              {resolvedLqip && !loaded && (
                <img
                  src={resolvedLqip}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover scale-110 blur-md"
                />
              )}
              <img
                src={src}
                alt={alt}
                loading="eager"
                decoding="async"
                className={cn(
                  "relative h-full w-full object-cover transition-opacity duration-300",
                  loaded ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="editorial-grain" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-2 max-w-xl">
            {renderTitle()}
            {subtitle && (
              <p className="text-[13.5px] sm:text-[14.5px] text-muted-foreground leading-[1.55] max-w-[34rem] font-normal">
                {subtitle}
              </p>
            )}
          </div>

          {metrics && metrics.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1.5 border-t border-border/60">
              {metrics.map((m, i) => (
                <div key={m.label} className="flex items-baseline gap-2">
                  {i > 0 && (
                    <span className="hidden sm:inline text-border/80 select-none mr-3" aria-hidden="true">
                      |
                    </span>
                  )}
                  <span className="editorial-tabular text-[15px] font-medium text-foreground">
                    {m.value}
                  </span>
                  <span className="editorial-mono text-[9.5px] text-muted-foreground">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {actions && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {actions}
            </div>
          )}
        </div>

        {/* Right: Desktop / Tablet Inset Photography Frame */}
        <div
          className={cn(
            "hidden sm:block relative shrink-0 overflow-hidden rounded-[20px] border border-border/75 dark:border-white/15 bg-muted/40",
            "sm:w-44 sm:h-32 md:w-60 md:h-40 lg:w-64 lg:h-44"
          )}
        >
          {resolvedLqip && !loaded && (
            <img
              src={resolvedLqip}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center scale-110 blur-md"
            />
          )}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading="eager"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cn(
              "relative h-full w-full object-cover object-center transition-all duration-700 ease-out-expo group-hover:scale-[1.04]",
              loaded ? "opacity-100 scale-100" : "opacity-0 scale-[1.05]"
            )}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10"
            aria-hidden="true"
          />
          <div className="editorial-grain" aria-hidden="true" />
        </div>
      </div>
    </motion.section>
  );
}
