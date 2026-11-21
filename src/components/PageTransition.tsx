import { ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

const PRIMARY_TAB_PATHS = new Set(["/", "/reminders", "/history", "/settings"]);

/**
 * Native-feel directional GPU page transition using CSS composite-only animations.
 *
 * - Primary bottom-nav tab switches use a subtle 170ms crossfade (`.page-transition-tab`).
 * - Detail screen pushes use a subtle Material shared-axis forward slide (`.page-transition-push`).
 * - Back pops use a matching reverse shared-axis slide (`.page-transition-pop`).
 *
 * Zero Framer Motion main-thread overhead during route hydration or data loading.
 */
const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const navType = useNavigationType();

  const transitionClass = PRIMARY_TAB_PATHS.has(location.pathname)
    ? "page-transition-tab"
    : navType === "POP"
      ? "page-transition-pop"
      : "page-transition-push";

  return (
    <div
      key={location.key || location.pathname}
      className={`w-full h-full ${transitionClass}`}
      style={{ backfaceVisibility: "hidden" }}
    >
      {children}
    </div>
  );
};

export default PageTransition;
