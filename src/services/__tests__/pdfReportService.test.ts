import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateBlockAwarePageCuts,
  getPreparedReport,
  invalidatePreparedPdfCache,
} from "../pdfReportService";

describe("pdfReportService", () => {
  beforeEach(() => {
    invalidatePreparedPdfCache();
    vi.restoreAllMocks();
  });

  describe("calculateBlockAwarePageCuts", () => {
    it("returns [0, totalHeight] when container height is smaller than maxPageHeightPx", () => {
      const container = document.createElement("div");
      Object.defineProperty(container, "scrollHeight", { value: 600, configurable: true });
      Object.defineProperty(container, "offsetHeight", { value: 600, configurable: true });

      const cuts = calculateBlockAwarePageCuts(container, 1120);
      expect(cuts).toEqual([0, 600]);
    });

    it("splits at .pdf-block boundaries when content exceeds single page", () => {
      const container = document.createElement("div");
      Object.defineProperty(container, "scrollHeight", { value: 2400, configurable: true });
      Object.defineProperty(container, "offsetHeight", { value: 2400, configurable: true });

      vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 2400,
        height: 2400,
        left: 0,
        right: 800,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Create 3 blocks
      const block1 = document.createElement("div");
      block1.className = "pdf-block";
      vi.spyOn(block1, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 800,
        height: 800,
        left: 0,
        right: 800,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const block2 = document.createElement("div");
      block2.className = "pdf-block";
      vi.spyOn(block2, "getBoundingClientRect").mockReturnValue({
        top: 850,
        bottom: 1600,
        height: 750,
        left: 0,
        right: 800,
        width: 800,
        x: 0,
        y: 850,
        toJSON: () => {},
      });

      const block3 = document.createElement("div");
      block3.className = "pdf-block";
      vi.spyOn(block3, "getBoundingClientRect").mockReturnValue({
        top: 1650,
        bottom: 2400,
        height: 750,
        left: 0,
        right: 800,
        width: 800,
        x: 0,
        y: 1650,
        toJSON: () => {},
      });

      container.appendChild(block1);
      container.appendChild(block2);
      container.appendChild(block3);

      const cuts = calculateBlockAwarePageCuts(container, 1120);

      // Page 1 should cut cleanly after block 1 (800 + 12 = 812)
      // Page 2 should cut cleanly after block 2 (1600 + 12 = 1612)
      // Final page ends at totalHeight (2400)
      expect(cuts.length).toBeGreaterThan(2);
      expect(cuts[0]).toBe(0);
      expect(cuts[1]).toBe(812);
      expect(cuts[cuts.length - 1]).toBe(2400);
    });
  });

  describe("cache management", () => {
    it("returns null when no report is prepared", () => {
      expect(getPreparedReport("test_sig")).toBeNull();
    });

    it("invalidates cache properly", () => {
      invalidatePreparedPdfCache();
      expect(getPreparedReport("any_sig")).toBeNull();
    });
  });
});

