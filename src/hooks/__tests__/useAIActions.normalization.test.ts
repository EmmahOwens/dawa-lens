import { describe, it, expect } from "vitest";
import { normalizeTimeStr } from "../useAIActions";

describe("useAIActions — time string normalization", () => {
  it("should normalize valid 12-hour format strings", () => {
    expect(normalizeTimeStr("8:00 AM")).toBe("08:00");
    expect(normalizeTimeStr("8 PM")).toBe("20:00");
    expect(normalizeTimeStr("12:30 PM")).toBe("12:30");
    expect(normalizeTimeStr("12:00 AM")).toBe("00:00");
  });

  it("should normalize valid 24-hour format strings", () => {
    expect(normalizeTimeStr("08:00")).toBe("08:00");
    expect(normalizeTimeStr("14:30")).toBe("14:30");
    expect(normalizeTimeStr("8")).toBe("08:00");
    expect(normalizeTimeStr("23")).toBe("23:00");
  });

  it("should parse descriptive daily frequency strings", () => {
    expect(normalizeTimeStr("twice daily")).toBe("08:00,20:00");
    expect(normalizeTimeStr("take twice a day")).toBe("08:00,20:00");
    expect(normalizeTimeStr("3 times a day")).toBe("08:00,14:00,20:00");
    expect(normalizeTimeStr("thrice daily")).toBe("08:00,14:00,20:00");
    expect(normalizeTimeStr("4x daily")).toBe("08:00,12:00,16:00,20:00");
  });

  it("should parse descriptive time of day words", () => {
    expect(normalizeTimeStr("morning")).toBe("08:00");
    expect(normalizeTimeStr("in the afternoon")).toBe("13:00");
    expect(normalizeTimeStr("evening dose")).toBe("18:00");
    expect(normalizeTimeStr("at bedtime")).toBe("21:00");
  });

  it("should default to 08:00 for completely unparseable values", () => {
    expect(normalizeTimeStr("")).toBe("08:00");
    expect(normalizeTimeStr("as needed")).toBe("08:00");
  });
});
