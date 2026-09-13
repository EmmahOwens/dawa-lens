import { describe, it, expect, beforeEach } from "vitest";
import {
  WELLNESS_PULSE_QUOTES,
  WELLNESS_PULSE_STORAGE_KEY,
  WELLNESS_PULSE_SESSION_INDEX_KEY,
  formatWellnessPulseQuote,
  getNextWellnessPulseQuote,
  advanceWellnessPulseQuote,
} from "./wellnessPulseQuotes";

describe("wellnessPulseQuotes", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("Quote Collection Quality", () => {
    it("contains between 50 and 100 curated quotes", () => {
      expect(WELLNESS_PULSE_QUOTES.length).toBeGreaterThanOrEqual(50);
      expect(WELLNESS_PULSE_QUOTES.length).toBeLessThanOrEqual(100);
      expect(WELLNESS_PULSE_QUOTES.length).toBe(75);
    });

    it("has only non-empty and trimmed strings", () => {
      WELLNESS_PULSE_QUOTES.forEach((quote, idx) => {
        expect(quote.trim().length, `Quote at index ${idx} is empty`).toBeGreaterThan(0);
      });
    });

    it("has unique quotes with no duplicate entries", () => {
      const set = new Set(WELLNESS_PULSE_QUOTES);
      expect(set.size).toBe(WELLNESS_PULSE_QUOTES.length);
    });
  });

  describe("formatWellnessPulseQuote", () => {
    it("replaces {name} with provided user name", () => {
      const template = "Hello {name}, keep shining!";
      expect(formatWellnessPulseQuote(template, "Amina")).toBe("Hello Amina, keep shining!");
    });

    it("falls back to 'friend' if name is undefined or empty", () => {
      const template = "Keep going, {name}.";
      expect(formatWellnessPulseQuote(template)).toBe("Keep going, friend.");
      expect(formatWellnessPulseQuote(template, "")).toBe("Keep going, friend.");
      expect(formatWellnessPulseQuote(template, "   ")).toBe("Keep going, friend.");
    });

    it("leaves quotes without {name} untouched", () => {
      const template = "Every positive habit shapes your future.";
      expect(formatWellnessPulseQuote(template, "Kato")).toBe(
        "Every positive habit shapes your future."
      );
    });
  });

  describe("Persistent Launch Cycle Engine", () => {
    it("provides the first quote on initial launch and sets up next index", () => {
      const quote = getNextWellnessPulseQuote("Sarah");
      const expected = formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[0], "Sarah");
      expect(quote).toBe(expected);

      // Current session index should be 0
      expect(sessionStorage.getItem(WELLNESS_PULSE_SESSION_INDEX_KEY)).toBe("0");
      // Persistent index should point to next quote (1)
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("1");
    });

    it("keeps the same quote during the same active session (navigating around the app)", () => {
      const firstCall = getNextWellnessPulseQuote("Sarah");
      const secondCall = getNextWellnessPulseQuote("Sarah");
      const thirdCall = getNextWellnessPulseQuote("Sarah");

      expect(firstCall).toBe(secondCall);
      expect(secondCall).toBe(thirdCall);
      // Persistent pointer remains 1, has not jumped multiple times
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("1");
    });

    it("updates personalization if user profile loads asynchronously during same session", () => {
      const quoteBeforeAuth = getNextWellnessPulseQuote();
      expect(quoteBeforeAuth).toContain("friend");

      const quoteAfterAuth = getNextWellnessPulseQuote("Grace");
      expect(quoteAfterAuth).toContain("Grace");

      // Cycle pointer did not advance prematurely
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("1");
    });

    it("advances to the next quote on subsequent app launch / new session", () => {
      // Launch 1
      const quote1 = getNextWellnessPulseQuote("Alex");
      expect(quote1).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[0], "Alex"));

      // Simulate app close & reopen (sessionStorage cleared)
      sessionStorage.clear();

      // Launch 2
      const quote2 = getNextWellnessPulseQuote("Alex");
      expect(quote2).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[1], "Alex"));
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("2");

      // Simulate another app reopen
      sessionStorage.clear();

      // Launch 3
      const quote3 = getNextWellnessPulseQuote("Alex");
      expect(quote3).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[2], "Alex"));
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("3");
    });

    it("cycles through all quotes and wraps around to the beginning", () => {
      const total = WELLNESS_PULSE_QUOTES.length;

      // Fast forward to last quote
      localStorage.setItem(WELLNESS_PULSE_STORAGE_KEY, (total - 1).toString());
      sessionStorage.clear();

      const lastQuote = getNextWellnessPulseQuote("User");
      expect(lastQuote).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[total - 1], "User"));
      // Next index should wrap around to 0
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("0");

      // Simulate next launch after wrapping
      sessionStorage.clear();
      const wrapQuote = getNextWellnessPulseQuote("User");
      expect(wrapQuote).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[0], "User"));
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("1");
    });

    it("handles corrupted or invalid localStorage index gracefully", () => {
      localStorage.setItem(WELLNESS_PULSE_STORAGE_KEY, "invalid_number");
      sessionStorage.clear();

      const quote = getNextWellnessPulseQuote("Pat");
      expect(quote).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[0], "Pat"));
      expect(localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY)).toBe("1");
    });

    it("advanceWellnessPulseQuote forces advancement", () => {
      const q1 = getNextWellnessPulseQuote("Dev");
      expect(q1).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[0], "Dev"));

      const q2 = advanceWellnessPulseQuote("Dev");
      expect(q2).toBe(formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[1], "Dev"));
    });
  });
});
