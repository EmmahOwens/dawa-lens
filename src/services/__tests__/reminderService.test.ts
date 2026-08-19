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

  it("should return false if taken on time — subsequent slot is in the future", () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    // Taken at 12:00 exactly. Interval to next slot = 3h. Candidate = 15:00. now = 12:00 → future → ok.
    const actualTakeTime = new Date(now);
    expect(isShiftIntoPast(reminder, 0, actualTakeTime, now)).toBe(false);
  });

  it("should return false for an early dose — subsequent slot is still in the future", () => {
    // Taken at 11:55 (5 min early). Interval = 3h. Candidate = 14:55. now = 11:55 → future → ok.
    const now = new Date();
    now.setHours(11, 55, 0, 0);
    const actualTakeTime = new Date(now);
    expect(isShiftIntoPast(reminder, 0, actualTakeTime, now)).toBe(false);
  });

  it("should return false for a late dose — subsequent slot still lands in the future", () => {
    // Taken at 16:00 (4h late). Interval to next slot = 3h. Candidate = 19:00.
    // now = 16:00, so 19:00 is in the future → false (shift is valid).
    const now = new Date();
    now.setHours(16, 0, 0, 0);
    const actualTakeTime = new Date(now);
    expect(isShiftIntoPast(reminder, 0, actualTakeTime, now)).toBe(false);
  });

  it("should return true if taken so late that subsequent slot lands in the past", () => {
    // Taken at 14:30 (slot 0 = 12:00, slot 1 = 15:00, interval = 3h).
    // Candidate = 14:30 + 3h = 17:30. But now = 18:00 → 17:30 is in the past → true.
    const now = new Date();
    now.setHours(18, 0, 0, 0);
    const actualTakeTime = new Date(now);
    actualTakeTime.setHours(14, 30, 0, 0);
    expect(isShiftIntoPast(reminder, 0, actualTakeTime, now)).toBe(true);
  });
});

import {
  calculateDynamicSchedule,
  parseReminderTimes,
  findSlotIndexForTime,
  getInterSlotInterval,
} from "@/lib/dynamicSchedule";
import { calculateNextDose } from "../reminderService";

describe("dynamicSchedule - interval preservation", () => {
  it("should shift subsequent slots earlier when a morning dose is taken early", () => {
    const times = ["08:00", "20:00"]; // 12h interval
    const actualTake = new Date();
    actualTake.setHours(6, 30, 0, 0); // 90m early

    const result = calculateDynamicSchedule(times, 0, actualTake);
    expect(result.hasChanges).toBe(true);
    expect(result.newTimes).toEqual(["06:30", "18:30"]);
    expect(result.newTimeStr).toBe("06:30,18:30");
  });

  it("should shift subsequent slots later when a morning dose is taken late", () => {
    const times = ["08:00", "20:00"]; // 12h interval
    const actualTake = new Date();
    actualTake.setHours(9, 30, 0, 0); // 90m late

    const result = calculateDynamicSchedule(times, 0, actualTake);
    expect(result.hasChanges).toBe(true);
    expect(result.newTimes).toEqual(["09:30", "21:30"]);
    expect(result.newTimeStr).toBe("09:30,21:30");
  });

  it("should preserve 3-dose daily intervals (e.g. 08:00, 14:00, 20:00)", () => {
    const times = ["08:00", "14:00", "20:00"]; // 6h intervals
    const actualTake = new Date();
    actualTake.setHours(9, 0, 0, 0); // 1h late for slot 0

    const result = calculateDynamicSchedule(times, 0, actualTake);
    expect(result.newTimes).toEqual(["09:00", "15:00", "21:00"]);
  });

  it("should only adjust subsequent slots when taking second dose", () => {
    const times = ["08:00", "14:00", "20:00"];
    const actualTake = new Date();
    actualTake.setHours(15, 15, 0, 0); // slot 1 taken at 15:15 (75m late)

    const result = calculateDynamicSchedule(times, 1, actualTake);
    // slot 0 remains 08:00, slot 1 becomes 15:15, slot 2 becomes 21:15 (6h after 15:15)
    expect(result.newTimes).toEqual(["08:00", "15:15", "21:15"]);
  });
});

describe("reminderService - calculateNextDose with dynamic shifts", () => {
  it("should calculate the shifted next dose today after taking first dose early", () => {
    const reminder: Reminder = {
      id: "rem-multi",
      medicineName: "Amoxicillin",
      dose: "500mg",
      time: "08:00,20:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const scheduledDate = new Date();
    scheduledDate.setHours(8, 0, 0, 0);

    const takenDate = new Date();
    takenDate.setHours(6, 30, 0, 0);

    const takenLog: DoseLog = {
      id: "log-1",
      reminderId: "rem-multi",
      medicineName: "Amoxicillin",
      dose: "500mg",
      scheduledTime: scheduledDate.toISOString(),
      actionTime: takenDate.toISOString(),
      action: "taken",
    };

    const nextDose = calculateNextDose([reminder], [takenLog]);
    expect(nextDose).not.toBeNull();
    // Next dose should be slot 1 at 18:30 (12h after 06:30)
    const scheduledHours = nextDose!.scheduledAt.getHours();
    const scheduledMins = nextDose!.scheduledAt.getMinutes();
    expect(`${scheduledHours.toString().padStart(2, "0")}:${scheduledMins.toString().padStart(2, "0")}`).toBe("18:30");
  });

  it("should calculate the shifted next dose today after taking first dose late", () => {
    const reminder: Reminder = {
      id: "rem-multi",
      medicineName: "Amoxicillin",
      dose: "500mg",
      time: "08:00,20:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const scheduledDate = new Date();
    scheduledDate.setHours(8, 0, 0, 0);

    const takenDate = new Date();
    takenDate.setHours(9, 30, 0, 0);

    const takenLog: DoseLog = {
      id: "log-1",
      reminderId: "rem-multi",
      medicineName: "Amoxicillin",
      dose: "500mg",
      scheduledTime: scheduledDate.toISOString(),
      actionTime: takenDate.toISOString(),
      action: "taken",
    };

    const nextDose = calculateNextDose([reminder], [takenLog]);
    expect(nextDose).not.toBeNull();
    // Next dose should be slot 1 at 21:30 (12h after 09:30)
    const scheduledHours = nextDose!.scheduledAt.getHours();
    const scheduledMins = nextDose!.scheduledAt.getMinutes();
    expect(`${scheduledHours.toString().padStart(2, "0")}:${scheduledMins.toString().padStart(2, "0")}`).toBe("21:30");
  });

  it("should point to tomorrow once daily dose is taken today", () => {
    const reminder: Reminder = {
      id: "rem-single",
      medicineName: "Vitamin D",
      dose: "1 capsule",
      time: "08:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const scheduledDate = new Date();
    scheduledDate.setHours(8, 0, 0, 0);

    const takenDate = new Date();
    takenDate.setHours(8, 45, 0, 0);

    const takenLog: DoseLog = {
      id: "log-1",
      reminderId: "rem-single",
      medicineName: "Vitamin D",
      dose: "1 capsule",
      scheduledTime: scheduledDate.toISOString(),
      actionTime: takenDate.toISOString(),
      action: "taken",
    };

    const nextDose = calculateNextDose([reminder], [takenLog]);
    expect(nextDose).not.toBeNull();
    // Tomorrow at 08:00
    const now = new Date();
    expect(nextDose!.scheduledAt.getDate()).toBe(new Date(now.getTime() + 24 * 3600 * 1000).getDate());
  });
});

