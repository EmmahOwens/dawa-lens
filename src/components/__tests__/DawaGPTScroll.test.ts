import { describe, it, expect } from "vitest";
import { isLatestMessageInView } from "../DawaGPT";

describe("DawaGPT - isLatestMessageInView", () => {
  const containerRect = { top: 100, bottom: 700, height: 600 };

  it("returns true when scrolled to the very bottom (isNearBottom < 40)", () => {
    const result = isLatestMessageInView({
      containerScrollHeight: 2000,
      containerScrollTop: 1400, // 2000 - 1400 - 600 = 0
      containerClientHeight: 600,
      containerRect,
      latestRect: { top: 500, bottom: 680, height: 180 },
    });
    expect(result).toBe(true);
  });

  it("returns true when reading the top of a tall message (addressing user issue: was showing button when message in view)", () => {
    // A 500px response where user scrolled to read the beginning (top) of the message.
    // Distance from bottom is 400px (which falsely triggered old > 100px threshold).
    const result = isLatestMessageInView({
      containerScrollHeight: 2000,
      containerScrollTop: 1000, // 2000 - 1000 - 600 = 400px away from bottom
      containerClientHeight: 600,
      containerRect,
      latestRect: { top: 120, bottom: 620, height: 500 }, // 500px tall, completely on screen!
    });
    expect(result).toBe(true);
  });

  it("returns true when scrolling through the body of an extra-tall message", () => {
    // 1500px tall message, user is reading the middle
    const result = isLatestMessageInView({
      containerScrollHeight: 3000,
      containerScrollTop: 1800,
      containerClientHeight: 600,
      containerRect,
      latestRect: { top: -200, bottom: 1300, height: 1500 }, // spans across entire viewport
    });
    expect(result).toBe(true);
  });

  it("returns true for a short message that is substantially visible", () => {
    // Short 80px message, 70px visible
    const result = isLatestMessageInView({
      containerScrollHeight: 1200,
      containerScrollTop: 500,
      containerClientHeight: 600,
      containerRect,
      latestRect: { top: 630, bottom: 710, height: 80 },
    });
    expect(result).toBe(true);
  });

  it("returns false when user scrolled up into older messages and latest message is below the viewport", () => {
    // Latest message is pushed completely below containerRect.bottom (700)
    const result = isLatestMessageInView({
      containerScrollHeight: 2500,
      containerScrollTop: 800,
      containerClientHeight: 600,
      containerRect,
      latestRect: { top: 850, bottom: 1150, height: 300 }, // 150px below bottom
    });
    expect(result).toBe(false);
  });

  it("returns false when only a tiny sliver is peeking at the very bottom edge", () => {
    // Top of latest message is at 695 (only 5px inside bottom 700)
    const result = isLatestMessageInView({
      containerScrollHeight: 2000,
      containerScrollTop: 700,
      containerClientHeight: 600,
      containerRect,
      latestRect: { top: 695, bottom: 995, height: 300 },
    });
    expect(result).toBe(false);
  });

  it("returns false when user scrolled up to read previous messages and tall latest message top is pushed to bottom", () => {
    // Latest message is 500px, but user scrolled up to read older messages;
    // only 50px of latest message remains at bottom of screen
    const result = isLatestMessageInView({
      containerScrollHeight: 2500,
      containerScrollTop: 600,
      containerClientHeight: 600,
      containerRect,
      latestRect: { top: 650, bottom: 1150, height: 500 },
    });
    expect(result).toBe(false);
  });
});
