import { describe, it, expect } from "vitest";
import { calculateRefillStatus, getDailyDoseRate, LOW_STOCK_THRESHOLD, CRITICAL_STOCK_THRESHOLD } from "../refillService";
import { Medicine, Reminder } from "@/contexts/AppContext";

describe("refillService - getDailyDoseRate and calculateRefillStatus", () => {
  it("calculates accurate daily consumption for multi-time daily reminders (e.g. Panadol 2 pills x 3 times/day = 6 pills/day)", () => {
    const panadol: Medicine = {
      id: "panadol-1",
      name: "Panadol Extra",
      dosage: "500mg",
      dosagePerDose: 2,
      currentQuantity: 30,
      totalQuantity: 60,
      unit: "tablets",
      addedAt: new Date().toISOString(),
    };

    const reminder: Reminder = {
      id: "rem-panadol",
      medicineId: "panadol-1",
      medicineName: "Panadol Extra",
      dose: "2 tablets",
      time: "08:00, 14:00, 20:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    // Daily dose rate: 2 pills * 3 times = 6 pills/day
    const dailyRate = getDailyDoseRate(panadol, [reminder]);
    expect(dailyRate).toBe(6);

    // 30 pills with 6 pills/day = 5 days left (In stock)
    const status30 = calculateRefillStatus(panadol, [reminder]);
    expect(status30?.daysRemaining).toBe(5);
    expect(status30?.isLow).toBe(false);
    expect(status30?.isWarning).toBe(false);

    // 18 pills with 6 pills/day = 3 days left (Low Stock Warning, <= 3 days)
    const status18 = calculateRefillStatus({ ...panadol, currentQuantity: 18 }, [reminder]);
    expect(status18?.daysRemaining).toBe(3);
    expect(status18?.isLow).toBe(false);
    expect(status18?.isWarning).toBe(true);

    // 12 pills with 6 pills/day = 2 days left (Critical Stock Alert, <= 2 days)
    const status12 = calculateRefillStatus({ ...panadol, currentQuantity: 12 }, [reminder]);
    expect(status12?.daysRemaining).toBe(2);
    expect(status12?.isLow).toBe(true);
    expect(status12?.isWarning).toBe(false);

    // 6 pills with 6 pills/day = 1 day left (Critical Stock Alert)
    const status6 = calculateRefillStatus({ ...panadol, currentQuantity: 6 }, [reminder]);
    expect(status6?.daysRemaining).toBe(1);
    expect(status6?.isLow).toBe(true);

    // 0 pills = Out of stock (Critical)
    const status0 = calculateRefillStatus({ ...panadol, currentQuantity: 0 }, [reminder]);
    expect(status0?.daysRemaining).toBe(0);
    expect(status0?.isLow).toBe(true);
    expect(status0?.isOutOfStock).toBe(true);
  });

  it("handles multiple separate reminders for the same medicine", () => {
    const medicine: Medicine = {
      id: "med-multi",
      name: "Amoxicillin",
      dosage: "250mg",
      dosagePerDose: 1,
      currentQuantity: 14,
      totalQuantity: 28,
      unit: "capsules",
      addedAt: new Date().toISOString(),
    };

    const rem1: Reminder = {
      id: "r1",
      medicineId: "med-multi",
      medicineName: "Amoxicillin",
      dose: "1 capsule",
      time: "08:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const rem2: Reminder = {
      id: "r2",
      medicineId: "med-multi",
      medicineName: "Amoxicillin",
      dose: "1 capsule",
      time: "20:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    // 1 capsule at 8am + 1 capsule at 8pm = 2 capsules/day
    const dailyRate = getDailyDoseRate(medicine, [rem1, rem2]);
    expect(dailyRate).toBe(2);

    const status = calculateRefillStatus(medicine, [rem1, rem2]);
    expect(status?.daysRemaining).toBe(7); // 14 / 2 = 7 days
    expect(status?.isLow).toBe(false);
    expect(status?.isWarning).toBe(false);
  });

  it("handles fallback when no active reminders exist", () => {
    const medicine: Medicine = {
      id: "med-no-rem",
      name: "Vitamin C",
      dosage: "1000mg",
      dosagePerDose: 2,
      currentQuantity: 6,
      totalQuantity: 30,
      unit: "tablets",
      addedAt: new Date().toISOString(),
    };

    // Fallback uses dosagePerDose (2/day) -> 6 / 2 = 3 days remaining -> isWarning
    const dailyRate = getDailyDoseRate(medicine, []);
    expect(dailyRate).toBe(2);

    const status = calculateRefillStatus(medicine, []);
    expect(status?.daysRemaining).toBe(3);
    expect(status?.isWarning).toBe(true);
    expect(status?.isLow).toBe(false);
  });

  it("handles unlinked reminders that match by medicine name", () => {
    const medicine: Medicine = {
      id: "med-unlinked",
      name: "Metformin",
      dosage: "500mg",
      dosagePerDose: 1,
      currentQuantity: 60,
      totalQuantity: 100,
      unit: "tablets",
      addedAt: new Date().toISOString(),
    };

    const reminder: Reminder = {
      id: "rem-unlinked",
      medicineName: "Metformin",
      dose: "2 tablets",
      time: "09:00, 21:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    // Reminder has dose: "2 tablets" and 2 slots = 4 tablets/day
    const dailyRate = getDailyDoseRate({ ...medicine, dosagePerDose: undefined }, [reminder]);
    expect(dailyRate).toBe(4);

    const status = calculateRefillStatus({ ...medicine, dosagePerDose: undefined }, [reminder]);
    expect(status?.daysRemaining).toBe(15); // 60 / 4 = 15 days
  });

  it("handles custom repeat days schedule accurately", () => {
    const medicine: Medicine = {
      id: "med-custom",
      name: "Methotrexate",
      dosage: "2.5mg",
      dosagePerDose: 4,
      currentQuantity: 12,
      totalQuantity: 24,
      unit: "tablets",
      addedAt: new Date().toISOString(),
    };

    const reminder: Reminder = {
      id: "rem-custom",
      medicineId: "med-custom",
      medicineName: "Methotrexate",
      dose: "4 tablets",
      time: "08:00",
      repeatSchedule: "custom",
      repeatDays: [1, 4], // 2 days a week
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    // 4 pills * 1 time * 2 days / 7 = 8/7 (~1.14 pills/day)
    const dailyRate = getDailyDoseRate(medicine, [reminder]);
    expect(dailyRate).toBeCloseTo(8 / 7, 2);

    // 12 pills with 8/7 pills/day = Math.floor(12 / (8/7)) = 10 days
    const status = calculateRefillStatus(medicine, [reminder]);
    expect(status?.daysRemaining).toBe(10);
    expect(status?.isLow).toBe(false);
    expect(status?.isWarning).toBe(false);
  });
});
