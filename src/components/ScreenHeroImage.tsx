import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isScreenImageReady } from "@/lib/preloadScreenImages";
import { getScreenLqip } from "@/lib/screenMedia";

interface ScreenHeroImageProps {
  src: string;
  lqip?: string;
  alt: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Compact split editorial header with instant LQIP blur-up WebP loading.
 * Mobile: compact horizontal thumbnail card keeping tools above the fold.
 * Desktop: richer asymmetrical editorial card with generous visual framing.
 */
export function ScreenHeroImage({
  src,
  lqip,
  alt,
  eyebrow,
  title,
  subtitle,
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

  return (
    <div
      className={cn(
        "group relative w-full rounded-[20px] glass-card p-3.5 sm:p-4 md:p-5 mb-5",
        "flex items-center justify-between gap-3.5 sm:gap-5 md:gap-6",
        className
      )}
    >
      {/* Left: Crisp Editorial Text */}
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-[0.08em]">
            {eyebrow}
          </span>
        )}
        {title && (
          <h2 className="text-[16px] sm:text-[18px] md:text-[20px] font-semibold leading-snug tracking-tight text-foreground truncate">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-[12px] sm:text-[13px] text-muted-foreground leading-snug line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Compact on mobile, richer on desktop — Instant Blur-Up LQIP */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-muted/40 shadow-xs",
          "w-20 h-20 sm:w-36 sm:h-24 md:w-52 md:h-32"
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
            "relative h-full w-full object-cover object-center transition-opacity duration-300 ease-out sm:group-hover:scale-[1.03]",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </div>
  );
}
