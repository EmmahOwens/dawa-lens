import { BouncingPillsLoader } from "./BouncingPillsLoader";

interface PageLoaderProps {
  /** "full" renders a lightweight in-flow route transition state without blocking shell chrome.
   *  "inline" renders only the pill animation — useful inside cards/panels. */
  variant?: "full" | "inline";
  /** Optional descriptive label shown below the animation (full variant only). */
  label?: string;
}

export default function PageLoader({
  variant = "full",
  label,
}: PageLoaderProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center py-6" role="status" aria-label="Loading">
        <BouncingPillsLoader size="sm" />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label ?? "Loading"}
      className="w-full min-h-[60vh] flex flex-col items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-2xl space-y-5">
        {/* Lightweight hero placeholder matching compact split ScreenHeroImage dimensions */}
        <div className="w-full h-28 sm:h-32 md:h-40 rounded-[20px] bg-muted/50 border border-border/50 animate-pulse" />

        {/* Centered pill loader & status label */}
        <div className="flex flex-col items-center justify-center py-4 gap-3">
          <BouncingPillsLoader size="md" />
          <p className="text-xs font-medium text-muted-foreground text-center">
            {label ?? "Loading view..."}
          </p>
        </div>

        {/* Subtle content card skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-muted/40 border border-border/40 animate-pulse" />
          <div className="h-24 rounded-2xl bg-muted/40 border border-border/40 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
