import { describe, it, expect } from "vitest";
import {
  HEALTH_QUOTES,
  ENCOURAGEMENT_QUOTES,
  ADHERENCE_QUOTES,
  WELLNESS_QUOTES,
  MINDFULNESS_QUOTES,
  LIFESTYLE_QUOTES,
  INSPIRATION_QUOTES,
  getQuoteIndexForDate,
  getDailyQuote,
  getQuoteForDayOffset,
  getEncouragementQuote,
} from "../quotesService";
import { addDays, subDays } from "date-fns";

describe("10,000 Health Quotes Dataset & Engine", () => {
  it("contains exactly 10,000 unique health quotes in HEALTH_QUOTES", () => {
    expect(HEALTH_QUOTES).toBeDefined();
    expect(HEALTH_QUOTES.length).toBe(10000);
    const uniqueSet = new Set(HEALTH_QUOTES);
    expect(uniqueSet.size).toBe(10000);
  });

  it("contains 2,000 unique quotes in each of the 5 categories", () => {
    expect(ADHERENCE_QUOTES.length).toBe(2000);
    expect(WELLNESS_QUOTES.length).toBe(2000);
    expect(MINDFULNESS_QUOTES.length).toBe(2000);
    expect(LIFESTYLE_QUOTES.length).toBe(2000);
    expect(INSPIRATION_QUOTES.length).toBe(2000);

    expect(new Set(ADHERENCE_QUOTES).size).toBe(2000);
    expect(new Set(WELLNESS_QUOTES).size).toBe(2000);
    expect(new Set(MINDFULNESS_QUOTES).size).toBe(2000);
    expect(new Set(LIFESTYLE_QUOTES).size).toBe(2000);
    expect(new Set(INSPIRATION_QUOTES).size).toBe(2000);
  });

  it("contains 100+ unique encouragement quotes with emojis", () => {
    expect(ENCOURAGEMENT_QUOTES.length).toBeGreaterThanOrEqual(100);
    const emojiRegex = /\p{Extended_Pictographic}/u;
    for (const quote of ENCOURAGEMENT_QUOTES) {
      expect(typeof quote).toBe("string");
      expect(quote.trim().length).toBeGreaterThan(10);
      expect(emojiRegex.test(quote)).toBe(true);
    }
  });

  it("every single quote in HEALTH_QUOTES contains a vibrant emoji and valid text", () => {
    const emojiRegex = /\p{Extended_Pictographic}/u;
    for (let i = 0; i < HEALTH_QUOTES.length; i++) {
      const q = HEALTH_QUOTES[i];
      expect(q).toBeDefined();
      expect(typeof q).toBe("string");
      expect(q.trim().length).toBeGreaterThan(15);
      expect(emojiRegex.test(q)).toBe(true);
    }
  });

  it("loops through all 10,000 quotes without repeating over 10,000 consecutive days", () => {
    const baseDate = new Date("2026-01-01T12:00:00Z");
    const visitedIndices = new Set<number>();
    const visitedQuotes = new Set<string>();

    for (let day = 0; day < 10000; day++) {
      const targetDate = addDays(baseDate, day);
      const index = getQuoteIndexForDate(targetDate);
      const quote = getDailyQuote(targetDate);

      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(10000);
      expect(quote).toBe(HEALTH_QUOTES[index]);

      visitedIndices.add(index);
      visitedQuotes.add(quote);
    }

    // Exactly 10,000 distinct indices and quotes visited before wrapping
    expect(visitedIndices.size).toBe(10000);
    expect(visitedQuotes.size).toBe(10000);

    // Day 10,000 wraps around to Day 0
    const day10000Quote = getDailyQuote(addDays(baseDate, 10000));
    const day0Quote = getDailyQuote(baseDate);
    expect(day10000Quote).toBe(day0Quote);
  });

  it("is 100% idempotent: repeated calls on the same date return the exact same quote", () => {
    const testDate = new Date("2026-08-28T09:00:00Z");
    const initialQuote = getDailyQuote(testDate);
    const initialIndex = getQuoteIndexForDate(testDate);

    for (let i = 0; i < 50; i++) {
      expect(getDailyQuote(testDate)).toBe(initialQuote);
      expect(getQuoteIndexForDate(testDate)).toBe(initialIndex);
    }
  });

  it("interleaves categories round-robin across consecutive days", () => {
    const baseDate = new Date("2026-01-01T00:00:00Z");
    for (let day = 0; day < 20; day++) {
      const quote = getDailyQuote(addDays(baseDate, day));
      const expectedCat = day % 5;
      if (expectedCat === 0) expect(ADHERENCE_QUOTES).toContain(quote);
      if (expectedCat === 1) expect(WELLNESS_QUOTES).toContain(quote);
      if (expectedCat === 2) expect(MINDFULNESS_QUOTES).toContain(quote);
      if (expectedCat === 3) expect(LIFESTYLE_QUOTES).toContain(quote);
      if (expectedCat === 4) expect(INSPIRATION_QUOTES).toContain(quote);
    }
  });

  it("handles offset lookahead correctly via getQuoteForDayOffset", () => {
    const now = new Date("2026-08-28T07:00:00Z");
    for (let offset = 0; offset < 30; offset++) {
      const quoteFromOffset = getQuoteForDayOffset(offset, now);
      const quoteFromDirectDate = getDailyQuote(addDays(now, offset));
      expect(quoteFromOffset).toBe(quoteFromDirectDate);
    }
  });

  it("handles past dates, far-future dates, and leap days without crashing", () => {
    const pastDate = new Date("2010-05-15T00:00:00Z");
    const farFutureDate = new Date("2099-12-31T23:59:59Z");
    const leapDay = new Date("2028-02-29T12:00:00Z");

    const pastQuote = getDailyQuote(pastDate);
    const futureQuote = getDailyQuote(farFutureDate);
    const leapQuote = getDailyQuote(leapDay);

    expect(typeof pastQuote).toBe("string");
    expect(typeof futureQuote).toBe("string");
    expect(typeof leapQuote).toBe("string");
    expect(pastQuote.length).toBeGreaterThan(0);
    expect(futureQuote.length).toBeGreaterThan(0);
    expect(leapQuote.length).toBeGreaterThan(0);
  });

  it("returns a valid encouragement quote from getEncouragementQuote", () => {
    for (let i = 0; i < 20; i++) {
      const quote = getEncouragementQuote();
      expect(ENCOURAGEMENT_QUOTES).toContain(quote);
    }
  });
});
