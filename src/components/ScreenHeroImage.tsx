import { useState } from "react";
import { cn } from "@/lib/utils";

interface ScreenHeroImageProps {
  src: string;
  alt: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Responsive 16:9-inspired hero banner for feature screens.
 * Uses WebP assets with smooth fade-in and high-contrast scrim overlay.
 */
export function ScreenHeroImage({
  src,
  alt,
  eyebrow,
  title,
  subtitle,
  className,
}: ScreenHeroImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[22px] border border-border bg-muted/40 shadow-sm mb-6",
        "h-36 sm:h-44 md:h-52 lg:h-56",
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover object-center transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />

      {(eyebrow || title || subtitle) && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none"
          />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-6 flex flex-col justify-end text-white">
            {eyebrow && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85 mb-0.5">
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="text-[18px] sm:text-[22px] font-semibold leading-tight tracking-tight text-white">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[12px] sm:text-[13px] text-white/85 mt-0.5 line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
