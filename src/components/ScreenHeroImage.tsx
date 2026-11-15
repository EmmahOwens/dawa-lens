import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isScreenImageReady } from "@/lib/preloadScreenImages";

interface ScreenHeroImageProps {
  src: string;
  alt: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Responsive editorial hero banner for feature screens.
 * Uses preloaded WebP photography with instant cache-aware display and high-contrast scrim overlay.
 */
export function ScreenHeroImage({
  src,
  alt,
  eyebrow,
  title,
  subtitle,
  className,
}: ScreenHeroImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(() => isScreenImageReady(src));

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
        "group relative w-full overflow-hidden rounded-[22px] border border-border/80 bg-gradient-to-br from-muted/70 via-muted/40 to-muted/60 shadow-sm mb-6",
        "h-40 sm:h-48 md:h-56 lg:h-60",
        className
      )}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="eager"
        decoding="sync"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover object-center transition-all duration-300 ease-out sm:group-hover:scale-[1.02]",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />

      {(eyebrow || title || subtitle) && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5 pointer-events-none"
          />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-6 flex flex-col justify-end text-white">
            {eyebrow && (
              <span className="inline-flex self-start items-center px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-white mb-1.5">
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="text-[18px] sm:text-[22px] font-semibold leading-tight tracking-tight text-white drop-shadow-xs">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[12px] sm:text-[13px] text-white/90 mt-0.5 line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
