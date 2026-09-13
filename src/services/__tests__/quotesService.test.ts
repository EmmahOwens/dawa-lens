import { describe, it, expect } from "vitest";
import {
  HEALTH_QUOTES,
  ENCOURAGEMENT_QUOTES,
  ADHERENCE_QUOTES,
  WELLNESS_QUOTES,
  MINDFULNESS_QUOTES,
  LIFESTYLE_QUOTES,
  INSPIRATION_QUOTES,
  HYDRATION_MESSAGES,
  EVENING_CHECKIN_MESSAGES,
  WEEKLY_SUMMARY_MESSAGES,
  WELLNESS_NUDGE_MESSAGES,
  getQuoteIndexForDate,
  getDailyQuote,
  getQuoteForDayOffset,
  getEncouragementQuote,
  getHydrationQuote,
  getEveningCheckInQuote,
  getWeeklySummaryQuote,
  getWellnessNudgeQuote,
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

  it("contains 200+ unique encouragement quotes with emojis", () => {
    expect(ENCOURAGEMENT_QUOTES.length).toBeGreaterThanOrEqual(200);
    const emojiRegex = /\p{Extended_Pictographic}/u;
    for (const quote of ENCOURAGEMENT_QUOTES) {
      expect(typeof quote).toBe("string");
      expect(quote.trim().length).toBeGreaterThan(10);
      expect(emojiRegex.test(quote)).toBe(true);
    }
    expect(new Set(ENCOURAGEMENT_QUOTES).size).toBe(ENCOURAGEMENT_QUOTES.length);
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

  it("returns a valid encouragement quote from getEncouragementQuote with anti-repetition", () => {
    const picked: string[] = [];
    for (let i = 0; i < 25; i++) {
      const quote = getEncouragementQuote();
      expect(ENCOURAGEMENT_QUOTES).toContain(quote);
      picked.push(quote);
    }
    // With anti-repetition memory buffer, there should be high uniqueness across 25 sequential calls
    const uniqueCount = new Set(picked).size;
    expect(uniqueCount).toBeGreaterThanOrEqual(20);
  });
});

describe("Hydration & Engagement Quotes Datasets & Rotation Engines", () => {
  const emojiRegex = /\p{Extended_Pictographic}/u;

  describe("Hydration Quotes (HYDRATION_MESSAGES)", () => {
    it("contains at least 120 unique hydration quotes", () => {
      expect(HYDRATION_MESSAGES).toBeDefined();
      expect(HYDRATION_MESSAGES.length).toBeGreaterThanOrEqual(120);
      const set = new Set(HYDRATION_MESSAGES);
      expect(set.size).toBe(HYDRATION_MESSAGES.length);
    });

    it("every single quote has an emoji and substantive, valid text", () => {
      for (const quote of HYDRATION_MESSAGES) {
        expect(typeof quote).toBe("string");
        expect(quote.trim().length).toBeGreaterThan(15);
        expect(emojiRegex.test(quote)).toBe(true);
      }
    });

    it("getHydrationQuote produces no repeats across all 6 slots in a day", () => {
      const testDate = new Date("2026-09-15T08:00:00Z");
      const dayQuotes = new Set<string>();
      for (let slot = 0; slot < 6; slot++) {
        const quote = getHydrationQuote(testDate, slot);
        expect(HYDRATION_MESSAGES).toContain(quote);
        dayQuotes.add(quote);
      }
      expect(dayQuotes.size).toBe(6);
    });

    it("getHydrationQuote cycles without duplicate quotes across 20 consecutive days", () => {
      const baseDate = new Date("2026-09-01T08:00:00Z");
      const visited = new Set<string>();
      const totalSlots = 20 * 6; // 120 slots

      for (let day = 0; day < 20; day++) {
        const d = addDays(baseDate, day);
        for (let slot = 0; slot < 6; slot++) {
          const quote = getHydrationQuote(d, slot);
          visited.add(quote);
        }
      }

      // Over 120 slots, all 120 quotes are visited before wrapping
      expect(visited.size).toBe(HYDRATION_MESSAGES.length);
    });

    it("getHydrationQuote wraps around smoothly and idempotently", () => {
      const d0 = new Date("2026-01-01T08:00:00Z");
      const wrapDays = Math.floor(HYDRATION_MESSAGES.length / 6);
      const dWrap = addDays(d0, wrapDays);

      expect(getHydrationQuote(dWrap, 0)).toBe(getHydrationQuote(d0, 0));
      expect(getHydrationQuote(dWrap, 3)).toBe(getHydrationQuote(d0, 3));
    });
  });

  describe("Evening Check-In Quotes (EVENING_CHECKIN_MESSAGES)", () => {
    it("contains at least 50 unique evening check-in quotes", () => {
      expect(EVENING_CHECKIN_MESSAGES).toBeDefined();
      expect(EVENING_CHECKIN_MESSAGES.length).toBeGreaterThanOrEqual(50);
      const set = new Set(EVENING_CHECKIN_MESSAGES);
      expect(set.size).toBe(EVENING_CHECKIN_MESSAGES.length);
    });

    it("every quote has an emoji and valid text", () => {
      for (const quote of EVENING_CHECKIN_MESSAGES) {
        expect(typeof quote).toBe("string");
        expect(quote.trim().length).toBeGreaterThan(15);
        expect(emojiRegex.test(quote)).toBe(true);
      }
    });

    it("getEveningCheckInQuote rotates day-by-day across 50 consecutive days without repeating", () => {
      const baseDate = new Date("2026-09-01T20:00:00Z");
      const visited = new Set<string>();
      for (let day = 0; day < 50; day++) {
        const quote = getEveningCheckInQuote(addDays(baseDate, day));
        visited.add(quote);
      }
      expect(visited.size).toBe(50);
    });
  });

  describe("Weekly Summary Messages (WEEKLY_SUMMARY_MESSAGES)", () => {
    it("contains at least 24 unique weekly summary quotes", () => {
      expect(WEEKLY_SUMMARY_MESSAGES).toBeDefined();
      expect(WEEKLY_SUMMARY_MESSAGES.length).toBeGreaterThanOrEqual(24);
      const set = new Set(WEEKLY_SUMMARY_MESSAGES);
      expect(set.size).toBe(WEEKLY_SUMMARY_MESSAGES.length);
    });

    it("every quote has an emoji and valid text", () => {
      for (const quote of WEEKLY_SUMMARY_MESSAGES) {
        expect(typeof quote).toBe("string");
        expect(quote.trim().length).toBeGreaterThan(15);
        expect(emojiRegex.test(quote)).toBe(true);
      }
    });

    it("getWeeklySummaryQuote rotates week-by-week across 8 consecutive weeks", () => {
      const baseDate = new Date("2026-09-06T20:00:00Z");
      const visited = new Set<string>();
      for (let week = 0; week < 8; week++) {
        const quote = getWeeklySummaryQuote(week, baseDate);
        visited.add(quote);
      }
      expect(visited.size).toBe(8);
    });
  });

  describe("Wellness Nudge Messages (WELLNESS_NUDGE_MESSAGES)", () => {
    it("contains at least 24 unique wellness nudge quotes", () => {
      expect(WELLNESS_NUDGE_MESSAGES).toBeDefined();
      expect(WELLNESS_NUDGE_MESSAGES.length).toBeGreaterThanOrEqual(24);
      const set = new Set(WELLNESS_NUDGE_MESSAGES);
      expect(set.size).toBe(WELLNESS_NUDGE_MESSAGES.length);
    });

    it("every quote has an emoji and valid text", () => {
      for (const quote of WELLNESS_NUDGE_MESSAGES) {
        expect(typeof quote).toBe("string");
        expect(quote.trim().length).toBeGreaterThan(15);
        expect(emojiRegex.test(quote)).toBe(true);
      }
    });

    it("getWellnessNudgeQuote rotates day-by-day across consecutive days", () => {
      const baseDate = new Date("2026-09-01T10:00:00Z");
      const visited = new Set<string>();
      for (let day = 0; day < 20; day++) {
        const quote = getWellnessNudgeQuote(addDays(baseDate, day));
        visited.add(quote);
      }
      expect(visited.size).toBe(20);
    });
  });
});

