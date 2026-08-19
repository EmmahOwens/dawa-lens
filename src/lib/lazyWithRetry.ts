import { lazy, ComponentType } from "react";

const RELOAD_KEY_PREFIX = "chunk_reload_attempted_";

export function isChunkLoadError(error: any): boolean {
  if (!error) return false;
  const message = (typeof error === "string" ? error : error.message || "").toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("loading chunk") ||
    message.includes("chunk load failed") ||
    message.includes("dynamically imported module")
  );
}

/**
 * Wraps React.lazy with automatic reload resilience when a dynamic import fails
 * due to a new deployment replacing old hashed chunks.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name?: string
) {
  return lazy(async () => {
    const componentKey = `${RELOAD_KEY_PREFIX}${name || "global"}`;
    try {
      const module = await factory();
      // On successful load, clear the reload flag for this chunk
      try {
        sessionStorage.removeItem(componentKey);
      } catch {
        // Ignore sessionStorage errors in restricted environments
      }
      return module;
    } catch (error: any) {
      const isChunkError = isChunkLoadError(error);

      if (isChunkError && typeof window !== "undefined") {
        let hasReloaded = false;
        try {
          hasReloaded = sessionStorage.getItem(componentKey) === "true";
        } catch {
          hasReloaded = false;
        }

        // If not yet reloaded and user is online, refresh to grab fresh index.html & chunks
        if (!hasReloaded && (typeof navigator === "undefined" || navigator.onLine)) {
          try {
            sessionStorage.setItem(componentKey, "true");
          } catch {
            // ignore
          }
          // Reload the page to fetch the latest index.html and chunk manifests
          window.location.reload();
          // Return a hanging promise so React doesn't render an error screen while page reloads
          return new Promise<{ default: T }>(() => {});
        }
      }

      throw error;
    }
  });
}
