import { lazy, ComponentType } from "react";

const RELOAD_KEY_PREFIX = "chunk_reload_attempted_";

export function isChunkLoadError(error: any): boolean {
  if (!error) return false;
  const message = (typeof error === "string" ? error : error?.message || "").toLowerCase();
  const stack = (typeof error === "object" && error?.stack ? error.stack : "").toLowerCase();

  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("error resolving module specifier") ||
    message.includes("loading chunk") ||
    message.includes("chunk load failed") ||
    message.includes("dynamically imported module") ||
    message.includes("reading 'default'") ||
    message.includes("reading \"default\"") ||
    message.includes("property 'default'") ||
    message.includes("evaluating 'module.default'") ||
    message.includes("failed to resolve default export") ||
    message.includes("module or module.default is undefined") ||
    message.includes("new version was deployed") ||
    stack.includes("reading 'default'") ||
    stack.includes("reading \"default\"")
  );
}

/**
 * Clear all chunk reload tracking flags from sessionStorage.
 * Used when user manually reloads, navigates home, or resets the error boundary.
 */
export function clearChunkReloadFlags(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key &&
        (key.startsWith(RELOAD_KEY_PREFIX) ||
          key.includes("chunk_reload") ||
          key.includes("vite_preload"))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Ignore sessionStorage errors in restricted environments
  }
}

/**
 * Wraps React.lazy with automatic reload resilience when a dynamic import fails
 * due to a new deployment replacing old hashed chunks or module resolution failure.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  name?: string
) {
  return lazy(async () => {
    const componentKey = `${RELOAD_KEY_PREFIX}${name || "global"}`;
    try {
      const module = await factory();

      // Guard: Validate that module and module.default exist.
      // If module is undefined or missing default (e.g. stale chunk fallback to HTML or failed import),
      // throw an explicit chunk load error so our retry handler and ErrorBoundary catch and recover from it.
      if (!module || typeof module.default === "undefined") {
        throw new Error(
          `Module "${name || "component"}" failed to resolve default export. (reading 'default' on undefined module). This usually indicates a new version was deployed.`
        );
      }

      // On successful load, clear the reload flag for this chunk
      try {
        sessionStorage.removeItem(componentKey);
      } catch {
        // Ignore sessionStorage errors in restricted environments
      }
      return module as { default: T };
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

