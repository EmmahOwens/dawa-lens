import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isChunkLoadError, clearChunkReloadFlags, lazyWithRetry } from "../lazyWithRetry";

describe("lazyWithRetry & isChunkLoadError", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe("isChunkLoadError", () => {
    it("identifies 'Cannot read properties of undefined (reading 'default')' as a chunk error", () => {
      const error = new TypeError("Cannot read properties of undefined (reading 'default')");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("identifies Safari style 'undefined is not an object (evaluating 'module.default')' as a chunk error", () => {
      const error = new TypeError("undefined is not an object (evaluating 'module.default')");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("identifies Vite dynamic import preload failures", () => {
      const error = new Error("Failed to fetch dynamically imported module: https://example.com/assets/Page-123.js");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("identifies Safari WebKit module script import errors", () => {
      const error = new Error("Importing a module script failed.");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("identifies stack traces containing 'reading default'", () => {
      const error = new Error("Component render crashed");
      error.stack = "TypeError: Cannot read properties of undefined (reading 'default')\n  at readLazyComponentType";
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("returns false for regular application errors", () => {
      expect(isChunkLoadError(new Error("User is not authenticated"))).toBe(false);
      expect(isChunkLoadError(new Error("Failed to save medication"))).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });
  });

  describe("clearChunkReloadFlags", () => {
    it("clears chunk reload and vite preload keys while preserving unrelated keys", () => {
      sessionStorage.setItem("chunk_reload_attempted_Dashboard", "true");
      sessionStorage.setItem("chunk_reload_attempted_MedVaultPage", "true");
      sessionStorage.setItem("error_boundary_chunk_reload_ts", "12345678");
      sessionStorage.setItem("vite_preload_reload_ts", "87654321");
      sessionStorage.setItem("user_theme_preference", "dark");

      clearChunkReloadFlags();

      expect(sessionStorage.getItem("chunk_reload_attempted_Dashboard")).toBeNull();
      expect(sessionStorage.getItem("chunk_reload_attempted_MedVaultPage")).toBeNull();
      expect(sessionStorage.getItem("error_boundary_chunk_reload_ts")).toBeNull();
      expect(sessionStorage.getItem("vite_preload_reload_ts")).toBeNull();
      expect(sessionStorage.getItem("user_theme_preference")).toBe("dark");
    });
  });

  describe("lazyWithRetry component factory guard", () => {
    it("triggers automatic reload on initial chunk load failure", async () => {
      const reloadMock = vi.fn();
      const originalLocation = window.location;
      delete (window as unknown as { location?: unknown }).location;
      (window as unknown as { location: unknown }).location = {
        ...originalLocation,
        reload: reloadMock,
      };

      try {
        const badFactory = vi.fn().mockResolvedValue(undefined as any);
        const LazyComp = lazyWithRetry(badFactory, "TestComponent");

        const loader = (LazyComp as any)._payload._result;
        loader();

        // Wait a short tick for promise resolution
        await new Promise((r) => setTimeout(r, 20));

        expect(sessionStorage.getItem("chunk_reload_attempted_TestComponent")).toBe("true");
        expect(reloadMock).toHaveBeenCalled();
      } finally {
        (window as unknown as { location: unknown }).location = originalLocation;
      }
    });

    it("throws error to ErrorBoundary if already reloaded in current session", async () => {
      sessionStorage.setItem("chunk_reload_attempted_TestComponent", "true");

      const badFactory = vi.fn().mockResolvedValue({ someNamedExport: true } as any);
      const LazyComp = lazyWithRetry(badFactory, "TestComponent");

      const loader = (LazyComp as any)._payload._result;

      await expect(loader()).rejects.toThrow(/failed to resolve default export/i);
    });

    it("succeeds and clears reload flag when factory resolves a valid default export", async () => {
      sessionStorage.setItem("chunk_reload_attempted_ValidComp", "true");

      const ValidComponent = () => null;
      const goodFactory = vi.fn().mockResolvedValue({ default: ValidComponent });
      const LazyComp = lazyWithRetry(goodFactory, "ValidComp");

      const loader = (LazyComp as any)._payload._result;
      const res = await loader();

      expect(res.default).toBe(ValidComponent);
      expect(sessionStorage.getItem("chunk_reload_attempted_ValidComp")).toBeNull();
    });
  });
});
