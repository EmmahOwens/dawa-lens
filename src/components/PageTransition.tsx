import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * GPU-accelerated page transition using CSS animations only.
 *
 * Replaces framer-motion spring animations with CSS transforms so all
 * compositing happens on the GPU thread with zero main-thread JS cost.
 * Matches lichobile's approach: only `transform` and `opacity` are
 * animated to avoid layout triggers.
 *
 * Android/Web uses a vertical fade-up (Material-style).
 */
const PageTransition = ({ children }: PageTransitionProps) => {
  return (
    <div
      className="w-full h-full will-change-transform page-transition-enter"
      style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
    >
      {children}
    </div>
  );
};

export default PageTransition;
