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

  it("should enforce 8h spacing for 3-dose daily regimens (e.g. 08:00, 16:00, 00:00)", () => {
    const times = ["08:00", "16:00", "00:00"]; // 8h intervals
    const actualTake = new Date();
    actualTake.setHours(9, 0, 0, 0); // 1h late for slot 0

    const result = calculateDynamicSchedule(times, 0, actualTake);
    expect(result.newTimes).toEqual(["09:00", "17:00", "01:00"]);
  });

  it("should adjust all slots to preserve equal 8h intervals when taking second dose late", () => {
    const times = ["08:00", "16:00", "00:00"];
    const actualTake = new Date();
    actualTake.setHours(17, 15, 0, 0); // slot 1 (16:00) taken at 17:15 (75m late)

    const result = calculateDynamicSchedule(times, 1, actualTake);
    // All slots spaced by 8h anchored to 17:15: 09:15, 17:15, 01:15
    expect(result.newTimes).toEqual(["09:15", "17:15", "01:15"]);
  });

  it("should preserve equal 12h spacing when taking second dose early (e.g. 08:00, 20:00 taken at 18:00)", () => {
    const times = ["08:00", "20:00"]; // 12h interval
    const actualTake = new Date();
    actualTake.setHours(18, 0, 0, 0); // slot 1 taken at 18:00 (2h early)

    const result = calculateDynamicSchedule(times, 1, actualTake);
    // Both slots shift by -2h to preserve 12h spacing: 08:00->06:00, 20:00->18:00
    expect(result.newTimes).toEqual(["06:00", "18:00"]);
    expect(result.newTimeStr).toBe("06:00,18:00");
  });

  it("should preserve equal 8h spacing when taking second dose early (e.g. 08:00, 16:00, 00:00 taken at 14:00)", () => {
    const times = ["08:00", "16:00", "00:00"]; // 8h interval
    const actualTake = new Date();
    actualTake.setHours(14, 0, 0, 0); // slot 1 taken at 14:00 (2h early)

    const result = calculateDynamicSchedule(times, 1, actualTake);
    // All slots shift by -2h to preserve 8h spacing: 08:00->06:00, 16:00->14:00, 00:00->22:00
    expect(result.newTimes).toEqual(["06:00", "14:00", "22:00"]);
  });

  it("should preserve equal 8h spacing when taking third dose early (e.g. 08:00, 16:00, 00:00 taken at 22:00)", () => {
    const times = ["08:00", "16:00", "00:00"]; // 8h interval
    const actualTake = new Date();
    actualTake.setHours(22, 0, 0, 0); // slot 2 taken at 22:00 (2h early)

    const result = calculateDynamicSchedule(times, 2, actualTake);
    // All slots shift by -2h to preserve 8h spacing: 08:00->06:00, 16:00->14:00, 00:00->22:00
    expect(result.newTimes).toEqual(["06:00", "14:00", "22:00"]);
  });

  it("should preserve equal 6h spacing for 4-dose daily regimens (e.g. 08:00, 14:00, 20:00, 02:00 taken early at 18:00)", () => {
    const times = ["08:00", "14:00", "20:00", "02:00"]; // 6h interval
    const actualTake = new Date();
    actualTake.setHours(18, 0, 0, 0); // slot 2 taken at 18:00 (2h early)

    const result = calculateDynamicSchedule(times, 2, actualTake);
    // All slots spaced by 6h anchored to 18:00: 06:00, 12:00, 18:00, 00:00
    expect(result.newTimes).toEqual(["06:00", "12:00", "18:00", "00:00"]);
  });
});

describe("reminderService - calculateNextDose with dynamic shifts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

describe("isReminderScheduledOnDate & checkMissedDoses", () => {
  it("correctly identifies active schedule days for custom repeatDays", async () => {
    const { isReminderScheduledOnDate } = await import("../reminderService");
    const reminder: Reminder = {
      id: "rem-custom",
      medicineName: "Custom Med",
      dose: "1 tab",
      time: "08:00",
      repeatSchedule: "custom",
      repeatDays: [1, 3, 5], // Mon, Wed, Fri
      enabled: true,
      createdAt: new Date("2026-08-01T00:00:00Z").toISOString(),
    };

    // Sunday (0)
    const sunday = new Date("2026-08-02T10:00:00Z");
    expect(isReminderScheduledOnDate(reminder, sunday)).toBe(false);

    // Monday (1)
    const monday = new Date("2026-08-03T10:00:00Z");
    expect(isReminderScheduledOnDate(reminder, monday)).toBe(true);

    // Tuesday (2)
    const tuesday = new Date("2026-08-04T10:00:00Z");
    expect(isReminderScheduledOnDate(reminder, tuesday)).toBe(false);

    // Wednesday (3)
    const wednesday = new Date("2026-08-05T10:00:00Z");
    expect(isReminderScheduledOnDate(reminder, wednesday)).toBe(true);
  });

  it("correctly handles one-time reminders only on creation day", async () => {
    const { isReminderScheduledOnDate } = await import("../reminderService");
    const createdDate = new Date("2026-08-10T09:00:00Z");
    const reminder: Reminder = {
      id: "rem-once",
      medicineName: "One Time Med",
      dose: "1 tab",
      time: "10:00",
      repeatSchedule: "once",
      enabled: true,
      createdAt: createdDate.toISOString(),
    };

    // Same day
    expect(isReminderScheduledOnDate(reminder, new Date("2026-08-10T12:00:00Z"))).toBe(true);

    // Next day
    expect(isReminderScheduledOnDate(reminder, new Date("2026-08-11T10:00:00Z"))).toBe(false);

    // Same day with existing taken log
    const takenLog: DoseLog = {
      id: "log-once",
      reminderId: "rem-once",
      medicineName: "One Time Med",
      dose: "1 tab",
      scheduledTime: "2026-08-10T10:00:00Z",
      actionTime: "2026-08-10T10:05:00Z",
      action: "taken",
    };
    expect(isReminderScheduledOnDate(reminder, new Date("2026-08-10T12:00:00Z"), [takenLog])).toBe(false);
  });

  it("checkMissedDoses does not log missed doses on off-schedule days", async () => {
    const { checkMissedDoses } = await import("../reminderService");

    const loggedDoses: any[] = [];
    const mockLogDose = async (log: any) => {
      loggedDoses.push(log);
    };

    const now = new Date();
    // A custom reminder only scheduled for a day of week different from today and yesterday
    const todayDay = now.getDay();
    const offDay1 = (todayDay + 2) % 7;
    const offDay2 = (todayDay + 3) % 7;

    const reminder: Reminder = {
      id: "rem-offday",
      medicineName: "Offday Med",
      dose: "1 tab",
      time: "01:00", // Scheduled 1 AM (hours ago)
      repeatSchedule: "custom",
      repeatDays: [offDay1, offDay2],
      enabled: true,
      createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      patientId: "patient-123",
    };

    await checkMissedDoses([reminder], [], mockLogDose);
    expect(loggedDoses.length).toBe(0);
  });

  it("checkMissedDoses propagates patientId to logDose when a dose is missed", async () => {
    const { checkMissedDoses } = await import("../reminderService");

    const loggedDoses: any[] = [];
    const mockLogDose = async (log: any) => {
      loggedDoses.push(log);
    };

    const now = new Date();
    // Scheduled 3 hours ago today
    const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000);
    const timeStr = `${threeHoursAgo.getHours().toString().padStart(2, "0")}:${threeHoursAgo.getMinutes().toString().padStart(2, "0")}`;

    const reminder: Reminder = {
      id: "rem-daily-missed",
      medicineName: "Daily Med",
      dose: "1 tab",
      time: timeStr,
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
      patientId: "patient-abc",
    };

    await checkMissedDoses([reminder], [], mockLogDose);
    expect(loggedDoses.length).toBeGreaterThan(0);
    expect(loggedDoses[0].patientId).toBe("patient-abc");
    expect(loggedDoses[0].action).toBe("missed");
  });
});

describe("filterInvalidMissedLogs (Auto-healing)", () => {
  it("removes phantom missed logs recorded on off-schedule days", async () => {
    const { filterInvalidMissedLogs } = await import("@/contexts/AppContext");

    const reminder: Reminder = {
      id: "rem-custom-heal",
      medicineName: "Weekly Med",
      dose: "1 tab",
      time: "08:00",
      repeatSchedule: "custom",
      repeatDays: [1], // Monday only
      enabled: true,
      createdAt: "2026-08-01T00:00:00Z",
    };

    // Tuesday log (day 2) marked as missed
    const invalidLog: DoseLog = {
      id: "invalid-missed-1",
      reminderId: "rem-custom-heal",
      medicineName: "Weekly Med",
      dose: "1 tab",
      scheduledTime: "2026-08-04T08:00:00Z", // Tuesday
      actionTime: "2026-08-04T10:00:00Z",
      action: "missed",
    };

    // Monday log (day 1) marked as missed (valid)
    const validLog: DoseLog = {
      id: "valid-missed-2",
      reminderId: "rem-custom-heal",
      medicineName: "Weekly Med",
      dose: "1 tab",
      scheduledTime: "2026-08-03T08:00:00Z", // Monday
      actionTime: "2026-08-03T10:00:00Z",
      action: "missed",
    };

    const { validLogs, invalidLogIds } = filterInvalidMissedLogs(
      [invalidLog, validLog],
      [reminder]
    );

    expect(invalidLogIds).toContain("invalid-missed-1");
    expect(invalidLogIds).not.toContain("valid-missed-2");
    expect(validLogs.length).toBe(1);
    expect(validLogs[0].id).toBe("valid-missed-2");
  });
});


