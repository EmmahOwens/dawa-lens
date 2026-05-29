import React, { useEffect, useRef, ReactNode } from 'react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

interface RiveAnimationProps {
  src: string;
  stateMachine?: string;
  artboard?: string;
  className?: string;
  autoplay?: boolean;
  inputs?: Record<string, boolean | number>;
  onLoad?: () => void;
  onError?: () => void;
  fit?: Fit;
  alignment?: Alignment;
  /** Rendered while the animation is loading or if it fails to load */
  fallback?: ReactNode;
}

const resolveRiveSrc = (src: string) => {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
    return src;
  }
  try {
    return new URL(src, import.meta.url).href;
  } catch {
    return src;
  }
};

/**
 * RiveAnimation
 *
 * Wraps @rive-app/react-canvas with:
 *  - Graceful fallback (custom UI) while loading or on error
 *  - Auto-pause when scrolled offscreen (IntersectionObserver)
 *  - Respects prefers-reduced-motion
 *  - State machine input syncing
 *
 * NOTE: Do NOT pass both `buffer` and `src` to useRive simultaneously —
 * the hook initialises once and does not support switching between them.
 * We use `src` exclusively and let the browser cache the HTTP response.
 */
export const RiveAnimation: React.FC<RiveAnimationProps> = ({
  src,
  stateMachine,
  artboard,
  className,
  autoplay = true,
  inputs,
  onLoad,
  onError,
  fit = Fit.Contain,
  alignment = Alignment.Center,
  fallback,
}) => {
  const resolvedSrc = resolveRiveSrc(src);
  const containerRef = useRef<HTMLDivElement>(null);

  // Respect the OS "reduce motion" preference
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const { rive, RiveComponent } = useRive({
    src: resolvedSrc,
    stateMachines: stateMachine,
    artboard,
    autoplay: autoplay && !prefersReducedMotion,
    layout: new Layout({ fit, alignment }),
    onLoad: () => {
      onLoad?.();
    },
    onLoadError: () => {
      console.error('[RiveAnimation] Failed to load asset:', resolvedSrc);
      onError?.();
    },
  });

  // Sync React state → Rive state machine inputs
  useEffect(() => {
    if (!rive || !stateMachine || !inputs) return;
    const smInputs = rive.stateMachineInputs(stateMachine);
    if (!smInputs) return;
    Object.entries(inputs).forEach(([key, value]) => {
      const input = smInputs.find((i) => i.name === key);
      if (input) input.value = value;
    });
  }, [rive, stateMachine, inputs]);

  // Pause animation when scrolled out of view, resume when back
  useEffect(() => {
    if (!rive || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (autoplay && !prefersReducedMotion) rive.play();
          } else {
            rive.pause();
          }
        });
      },
      { threshold: 0.1 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [rive, autoplay, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
    >
      {rive ? (
        <RiveComponent style={{ width: '100%', height: '100%' }} />
      ) : (
        // Show the caller-supplied fallback while loading / on error
        <>{fallback ?? null}</>
      )}
    </div>
  );
};

export default RiveAnimation;
