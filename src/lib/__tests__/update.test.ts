import { describe, it, expect, vi, beforeEach } from "vitest";
import { isNewerVersion, fetchLatestRelease } from "../update";
import { Capacitor } from "@capacitor/core";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock("@/plugins/app-updater", () => ({
  default: {
    getDeviceABI: vi.fn().mockResolvedValue({ abi: "arm64-v8a" }),
    addListener: vi.fn(),
    downloadAndInstall: vi.fn(),
  },
}));

describe("update utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isNewerVersion", () => {
    it("returns true when remote version is higher than local", () => {
      expect(isNewerVersion("1.7.19", "1.7.18")).toBe(true);
      expect(isNewerVersion("v1.8.0", "1.7.18")).toBe(true);
      expect(isNewerVersion("v.2.0.0", "1.7.18")).toBe(true);
      expect(isNewerVersion("1.7.18.1", "1.7.18")).toBe(true);
    });

    it("returns false when remote version is equal or lower", () => {
      expect(isNewerVersion("1.7.18", "1.7.18")).toBe(false);
      expect(isNewerVersion("v1.7.18", "1.7.18")).toBe(false);
      expect(isNewerVersion("1.7.17", "1.7.18")).toBe(false);
      expect(isNewerVersion("1.0.0", "1.7.18")).toBe(false);
    });

    it("handles invalid or non-numeric version strings gracefully", () => {
      expect(isNewerVersion("abc", "1.7.18")).toBe(false);
      expect(isNewerVersion("", "1.7.18")).toBe(false);
    });
  });

  describe("fetchLatestRelease", () => {
    it("returns null immediately on web platform without fetching releases", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      vi.mocked(Capacitor.getPlatform).mockReturnValue("web");

      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const result = await fetchLatestRelease();
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("returns null on non-Android native platforms", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");

      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const result = await fetchLatestRelease();
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("fetches release and parses APK asset on native Android", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Capacitor.getPlatform).mockReturnValue("android");

      const mockReleaseData = {
        tag_name: "v1.7.19",
        html_url: "https://github.com/EmmahOwens/dawa-lens/releases/tag/v1.7.19",
        assets: [
          {
            name: "app-arm64-v8a-release.apk",
            browser_download_url: "https://github.com/EmmahOwens/dawa-lens/releases/download/v1.7.19/app-arm64-v8a-release.apk",
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleaseData,
      } as Response);

      const result = await fetchLatestRelease();
      expect(result).toEqual({
        latestVersion: "1.7.19",
        downloadUrl: "https://github.com/EmmahOwens/dawa-lens/releases/download/v1.7.19/app-arm64-v8a-release.apk",
        sha256: undefined,
      });

      fetchSpy.mockRestore();
    });
  });
});
