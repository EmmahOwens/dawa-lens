import { describe, it, expect, beforeEach } from "vitest";
import { enqueueOp, getPendingOps, clearQueue } from "../offlineQueue";

describe("offlineQueue", () => {
  beforeEach(() => {
    clearQueue();
  });

  it("should cancel un-synced add-reminder op when delete-reminder is enqueued", () => {
    enqueueOp({
      type: "add-reminder",
      collection: "reminders",
      docId: "rem-offline-1",
      data: { medicineName: "Offline Med" },
      userId: "user-1",
    });

    expect(getPendingOps()).toHaveLength(1);
    expect(getPendingOps()[0].type).toBe("add-reminder");

    // Delete the same reminder while still offline
    enqueueOp({
      type: "delete-reminder",
      collection: "reminders",
      docId: "rem-offline-1",
      userId: "user-1",
    });

    // Both ops should be eliminated since it never synced to cloud
    expect(getPendingOps()).toHaveLength(0);
  });

  it("should retain delete-reminder op if reminder existed on cloud (no prior add op)", () => {
    enqueueOp({
      type: "delete-reminder",
      collection: "reminders",
      docId: "rem-cloud-1",
      userId: "user-1",
    });

    expect(getPendingOps()).toHaveLength(1);
    expect(getPendingOps()[0].type).toBe("delete-reminder");
    expect(getPendingOps()[0].docId).toBe("rem-cloud-1");
  });

  it("should collapse update ops when delete is called", () => {
    enqueueOp({
      type: "update-reminder",
      collection: "reminders",
      docId: "rem-existing-1",
      data: { time: "09:00" },
      userId: "user-1",
    });

    enqueueOp({
      type: "delete-reminder",
      collection: "reminders",
      docId: "rem-existing-1",
      userId: "user-1",
    });

    // Should only have the delete op remaining
    expect(getPendingOps()).toHaveLength(1);
    expect(getPendingOps()[0].type).toBe("delete-reminder");
  });
});
