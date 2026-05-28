import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRive, Layout, Fit, Alignment, StateMachineInput } from '@rive-app/react-canvas';

interface RiveAnimationProps {
  src: string;
  stateMachine?: string;
  artboard?: string;
  className?: string;
  autoplay?: boolean;
  inputs?: Record<string, boolean | number>;
  onLoad?: () => void;
  fit?: Fit;
  alignment?: Alignment;
}

// Simple global cache for .riv files to avoid redundant fetches/decoding
const rivCache: Record<string, ArrayBuffer> = {};

/**
 * Optimized Rive Animation Wrapper
 * Implements Stage 2 Optimization Strategy:
 * 1. .riv file caching
 * 2. Auto-pause when offscreen (IntersectionObserver)
 * 3. Respects "Reduce Motion" system settings
 * 4. State Machine integration
 */
export const RiveAnimation: React.FC<RiveAnimationProps> = ({
  src,
  stateMachine,
  artboard,
  className,
  autoplay = true,
  inputs,
  onLoad,
  fit = Fit.Contain,
  alignment = Alignment.Center,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rivBuffer, setRivBuffer] = useState<ArrayBuffer | null>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const { rive, RiveComponent } = useRive({
    buffer: rivBuffer || undefined,
    src: rivBuffer ? undefined : src,
    stateMachines: stateMachine,
    artboard: artboard,
    autoplay: autoplay && !prefersReducedMotion,
    layout: new Layout({ fit, alignment }),
    onLoad: () => {
      if (onLoad) onLoad();
    },
  });

  // Handle caching
  useEffect(() => {
    if (rivCache[src]) {
      setRivBuffer(rivCache[src]);
    } else {
      fetch(src)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          rivCache[src] = buffer;
          setRivBuffer(buffer);
        })
        .catch((err) => console.error('Failed to load Rive asset:', src, err));
    }
  }, [src]);

  // Handle inputs updates
  useEffect(() => {
    if (rive && stateMachine && inputs) {
      const stateMachineInputs = rive.stateMachineInputs(stateMachine);
      if (stateMachineInputs) {
        Object.entries(inputs).forEach(([key, value]) => {
          const input = stateMachineInputs.find((i) => i.name === key);
          if (input) {
            input.value = value;
          }
        });
      }
    }
  }, [rive, stateMachine, inputs]);

  // Optimization: Pause when offscreen
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
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [rive, autoplay, prefersReducedMotion]);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }}>
      <RiveComponent />
    </div>
  );
};

export default RiveAnimation;
