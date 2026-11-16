import { SCREEN_MEDIA } from "@/lib/screenMedia";

export const SCREEN_IMAGE_PATHS = Object.values(SCREEN_MEDIA).map((m) => m.src);

const decodedCache = new Set<string>();
let preloadStarted = false;

export function isScreenImageReady(src: string): boolean {
  return decodedCache.has(src);
}

/**
 * Silently preloads and decodes bundled screen hero WebP assets during browser idle time
 * so navigating to feature pages shows full-resolution images instantaneously.
 */
export function preloadScreenImages(): void {
  if (preloadStarted || typeof window === "undefined") return;
  preloadStarted = true;

  const run = () => {
    SCREEN_IMAGE_PATHS.forEach((src) => {
      if (decodedCache.has(src)) return;
      const img = new Image();
      img.decoding = "async";
      img.src = src;

      const markReady = () => {
        decodedCache.add(src);
      };

      if (typeof img.decode === "function") {
        img
          .decode()
          .then(markReady)
          .catch(() => {
            if (img.complete && img.naturalWidth > 0) {
              markReady();
            }
          });
      } else {
        img.onload = markReady;
      }
    });
  };

  if ("requestIdleCallback" in window) {
    (
      window as Window & {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback(run, { timeout: 1200 });
  } else {
    setTimeout(run, 250);
  }
}
