import { describe, it, expect } from "vitest";
import { computeShiftOffset } from "../reminderService";
import { Reminder, DoseLog, hasOverlapConflict, isShiftIntoPast } from "@/contexts/AppContext";

describe("reminderService - computeShiftOffset", () => {
  const reminder: Reminder = {
    id: "rem-123",
    medicineName: "Test Med",
    dose: "1 tablet",
    time: "21:00",
    repeatSchedule: "daily",
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  it("should return 0 when no logs exist today", () => {
    expect(computeShiftOffset(reminder, [])).toBe(0);
  });

  it("should return 0 when dose is taken exactly on schedule", () => {
    const scheduledTime = new Date();
    scheduledTime.setHours(21, 0, 0, 0);

    const log: DoseLog = {
      id: "log-1",
      reminderId: "rem-123",
      medicineName: "Test Med",
      dose: "1 tablet",
      scheduledTime: scheduledTime.toISOString(),
      actionTime: scheduledTime.toISOString(),
      action: "taken",
    };
    expect(computeShiftOffset(reminder, [log])).toBe(0);
  });

  it("should return positive minutes deviation for a late dose", () => {
    const scheduledTime = new Date();
    scheduledTime.setHours(21, 0, 0, 0);

    const actionTime = new Date();
    actionTime.setHours(21, 15, 0, 0);

    const log: DoseLog = {
      id: "log-1",
      reminderId: "rem-123",
      medicineName: "Test Med",
      dose: "1 tablet",
      scheduledTime: scheduledTime.toISOString(),
      actionTime: actionTime.toISOString(),
      action: "taken",
    };
    expect(computeShiftOffset(reminder, [log])).toBe(15);
  });

  it("should return negative minutes deviation for an early dose", () => {
    const scheduledTime = new Date();
    scheduledTime.setHours(21, 0, 0, 0);

    const actionTime = new Date();
    actionTime.setHours(20, 50, 0, 0);

    const log: DoseLog = {
      id: "log-1",
      reminderId: "rem-123",
      medicineName: "Test Med",
      dose: "1 tablet",
      scheduledTime: scheduledTime.toISOString(),
      actionTime: actionTime.toISOString(),
      action: "taken",
    };
    expect(computeShiftOffset(reminder, [log])).toBe(-10);
  });

  it("should support 10+ hour early doses", () => {
    const scheduledTime = new Date();
    scheduledTime.setHours(21, 0, 0, 0);

    const actionTime = new Date();
    actionTime.setHours(10, 30, 0, 0);

    const log: DoseLog = {
      id: "log-1",
      reminderId: "rem-123",
      medicineName: "Test Med",
      dose: "1 tablet",
      scheduledTime: scheduledTime.toISOString(),
      actionTime: actionTime.toISOString(),
      action: "taken",
    };
    // 10.5 hours early = -630 minutes
    expect(computeShiftOffset(reminder, [log])).toBe(-630);
  });

  it("should ignore deviation > 24 hours (1440m)", () => {
    const scheduledTime = new Date();
    scheduledTime.setHours(21, 0, 0, 0);

    const actionTime = new Date();
    actionTime.setHours(21, 0, 0, 0);
    actionTime.setDate(actionTime.getDate() + 2); // 2 days later

    const log: DoseLog = {
      id: "log-1",
      reminderId: "rem-123",
      medicineName: "Test Med",
      dose: "1 tablet",
      scheduledTime: scheduledTime.toISOString(),
      actionTime: actionTime.toISOString(),
      action: "taken",
    };
    expect(computeShiftOffset(reminder, [log])).toBe(0);
  });
});

describe("AppContext - hasOverlapConflict", () => {
  const allReminders: Reminder[] = [
    {
      id: "rem-other",
      medicineName: "Other Med",
      dose: "1 tablet",
      time: "08:00,20:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
      patientId: null,
    },
  ];

  it("should return false if there is no overlap", () => {
    expect(hasOverlapConflict(["12:00", "18:00"], "rem-123", null, allReminders)).toBe(false);
  });

  it("should return true if proposed time is exactly the same as another reminder's time", () => {
    expect(hasOverlapConflict(["08:00", "12:00"], "rem-123", null, allReminders)).toBe(true);
  });

  it("should return true if proposed time is within 10 minutes", () => {
    expect(hasOverlapConflict(["07:55", "12:00"], "rem-123", null, allReminders)).toBe(true);
    expect(hasOverlapConflict(["20:05", "12:00"], "rem-123", null, allReminders)).toBe(true);
  });

  it("should handle midnight wrapping correctly (e.g. 23:55 and 00:02)", () => {
    const remindersWithMidnight: Reminder[] = [
      {
        id: "rem-other",
        medicineName: "Other Med",
        dose: "1 tablet",
        time: "23:55",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: new Date().toISOString(),
        patientId: null,
      }
    ];
    expect(hasOverlapConflict(["00:02"], "rem-123", null, remindersWithMidnight)).toBe(true);
  });
});

describe("AppContext - isShiftIntoPast", () => {
  const reminder: Reminder = {
    id: "rem-123",
    medicineName: "Test Med",
    dose: "1 tablet",
    time: "12:00,15:00",
    repeatSchedule: "daily",
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  it("should return false if shift does not put subsequent doses in the past", () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    expect(isShiftIntoPast(reminder, 0, 0, now)).toBe(false);
  });

  it("should return true if positive shift puts subsequent dose in the past relative to now", () => {
    const now = new Date();
    now.setHours(16, 0, 0, 0);
    // slotIndex = 0 (12:00), shift = +30m. Subsequent slot 15:00 becomes 15:30.
    // Since now is 16:00, 15:30 is in the past!
    expect(isShiftIntoPast(reminder, 0, 30, now)).toBe(true);
  });
});
