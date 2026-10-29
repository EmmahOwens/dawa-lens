import { describe, it, expect } from "vitest";
import { calculateVitalitySummary } from "../vitalityUtils";
import { WellnessLog, DoseLog } from "../../contexts/AppContext";

describe("calculateVitalitySummary", () => {
  it("returns 7 days with 100% adherence and null wellness when logs are empty", () => {
    const summary = calculateVitalitySummary([], []);
    expect(summary).toHaveLength(7);
    summary.forEach((day) => {
      expect(day.adherence).toBe(100);
      expect(day.energy).toBeNull();
      expect(day.mood).toBeNull();
    });
  });

  it("calculates exact 1-5 integer scale mapped to 20-100 for a single log", () => {
    const today = new Date().toISOString();
    const wellnessLogs: WellnessLog[] = [
      {
        id: "w1",
        userId: "user-1",
        type: "symptom",
        timestamp: today,
        data: { mood: 4, energy: 3, symptoms: [] },
      },
    ];

    const summary = calculateVitalitySummary([], wellnessLogs);
    const todayPoint = summary[summary.length - 1];
    expect(todayPoint.mood).toBe(80); // 4 * 20
    expect(todayPoint.energy).toBe(60); // 3 * 20
  });

  it("prioritizes the latest valid log of the day without fractional halfway scores", () => {
    const earlierToday = new Date(Date.now() - 3600000).toISOString();
    const laterToday = new Date().toISOString();

    const wellnessLogs: WellnessLog[] = [
      {
        id: "w1",
        userId: "user-1",
        type: "symptom",
        timestamp: earlierToday,
        data: { mood: 4, energy: 3, symptoms: [] },
      },
      {
        id: "w2",
        userId: "user-1",
        type: "symptom",
        timestamp: laterToday,
        data: { mood: 5, energy: 4, symptoms: [] },
      },
    ];

    const summary = calculateVitalitySummary([], wellnessLogs);
    const todayPoint = summary[summary.length - 1];
    // Must align to 100 (5★) and 80 (4★), NOT 90 (4.5★) or 70 (3.5★)
    expect(todayPoint.mood).toBe(100);
    expect(todayPoint.energy).toBe(80);
  });

  it("handles logs where one entry lacks energy without pulling energy to fractional or 0", () => {
    const earlierToday = new Date(Date.now() - 3600000).toISOString();
    const laterToday = new Date().toISOString();

    const wellnessLogs: WellnessLog[] = [
      {
        id: "w1",
        userId: "user-1",
        type: "symptom",
        timestamp: earlierToday,
        data: { mood: 3, energy: 4, symptoms: [] },
      },
      {
        id: "w2",
        userId: "user-1",
        type: "symptom",
        timestamp: laterToday,
        data: { mood: 4 }, // No energy provided (e.g. quick mood tap)
      },
    ];

    const summary = calculateVitalitySummary([], wellnessLogs);
    const todayPoint = summary[summary.length - 1];
    expect(todayPoint.mood).toBe(80); // 4 * 20 (latest valid mood)
    expect(todayPoint.energy).toBe(80); // 4 * 20 (latest valid energy kept, not dragged down by missing)
  });

  it("clamps and rounds properly between 1 and 5", () => {
    const today = new Date().toISOString();
    const wellnessLogs: WellnessLog[] = [
      {
        id: "w1",
        userId: "user-1",
        type: "symptom",
        timestamp: today,
        data: { mood: 6, energy: 0.2, symptoms: [] },
      },
    ];

    const summary = calculateVitalitySummary([], wellnessLogs);
    const todayPoint = summary[summary.length - 1];
    expect(todayPoint.mood).toBe(100); // Clamped to 5 * 20
    expect(todayPoint.energy).toBe(20); // Clamped to min 1 * 20
  });

  it("handles 0 or null energy by leaving it as null", () => {
    const today = new Date().toISOString();
    const wellnessLogs: WellnessLog[] = [
      {
        id: "w1",
        userId: "user-1",
        type: "symptom",
        timestamp: today,
        data: { mood: 3, energy: 0, symptoms: [] },
      },
    ];

    const summary = calculateVitalitySummary([], wellnessLogs);
    const todayPoint = summary[summary.length - 1];
    expect(todayPoint.mood).toBe(60);
    expect(todayPoint.energy).toBeNull();
  });
});
