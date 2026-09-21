import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeDailyTimelineSlots } from "../timelineSchedule";
import { Reminder, DoseLog } from "@/contexts/AppContext";

describe("timelineSchedule - computeDailyTimelineSlots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-09-21 at 17:16:00
    vi.setSystemTime(new Date(2026, 8, 21, 17, 16, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should parse multi-time reminders, identify the next pending dose, and compute shift adjustments", () => {
    const reminder: Reminder = {
      id: "rem-panadol",
      medicineName: "Panadol",
      dose: "2 tablets",
      time: "17:00, 01:00, 09:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date(2026, 8, 21, 8, 0, 0).toISOString(),
    };

    // First dose at 17:00 was taken at 17:01 (1 minute late)
    // Dynamic interval calculation preserves inter-slot interval
    const doseLogs: DoseLog[] = [
      {
        id: "log-1",
        reminderId: "rem-panadol",
        medicineName: "Panadol",
        dose: "2 tablets",
        scheduledTime: new Date(2026, 8, 21, 17, 0, 0).toISOString(),
        actionTime: new Date(2026, 8, 21, 17, 1, 0).toISOString(),
        action: "taken",
      },
    ];

    const result = computeDailyTimelineSlots([reminder], doseLogs);

    // 3 slots total
    expect(result.slots.length).toBe(3);

    // First slot is actioned
    expect(result.slots[0].isActioned).toBe(true);
    expect(result.slots[0].baseTime).toBe("17:00");

    // Second slot is the next dose
    expect(result.overallNextSlot).not.toBeNull();
    expect(result.overallNextSlot?.reminder.medicineName).toBe("Panadol");
    expect(result.overallNextSlot?.slotIndex).toBe(1);
    expect(result.overallNextSlot?.baseTime).toBe("01:00");
    // Display time is adjusted according to the taken log's interval
    expect(result.overallNextSlot?.displayTime).toBeDefined();
    // Slot 2 has an offset
    expect(typeof result.overallNextSlot?.offsetMinutes).toBe("number");
  });

  it("should return null for overallNextSlot when all slots are actioned", () => {
    const reminder: Reminder = {
      id: "rem-1",
      medicineName: "Aspirin",
      dose: "1 pill",
      time: "08:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date(2026, 8, 21, 7, 0, 0).toISOString(),
    };

    const doseLogs: DoseLog[] = [
      {
        id: "log-done",
        reminderId: "rem-1",
        medicineName: "Aspirin",
        dose: "1 pill",
        scheduledTime: new Date(2026, 8, 21, 8, 0, 0).toISOString(),
        actionTime: new Date(2026, 8, 21, 8, 5, 0).toISOString(),
        action: "taken",
      },
    ];

    const result = computeDailyTimelineSlots([reminder], doseLogs);
    expect(result.slots.length).toBe(1);
    expect(result.slots[0].isActioned).toBe(true);
    expect(result.overallNextSlot).toBeNull();
  });
});
