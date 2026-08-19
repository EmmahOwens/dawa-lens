import { describe, it, expect } from "vitest";
import { parseNotificationExtra } from "../NotificationHandler";

describe("NotificationHandler - parseNotificationExtra", () => {
  it("should return empty object for null or undefined", () => {
    expect(parseNotificationExtra(null)).toEqual({});
    expect(parseNotificationExtra(undefined)).toEqual({});
  });

  it("should return the object if already an object", () => {
    const data = { reminderId: "rem-123", patientId: "pat-456", route: "/reminders" };
    expect(parseNotificationExtra(data)).toEqual(data);
  });

  it("should parse stringified JSON correctly", () => {
    const rawString = JSON.stringify({
      reminderId: "rem-123",
      patientId: "pat-456",
      patientName: "John",
      route: "/reminders",
    });
    expect(parseNotificationExtra(rawString)).toEqual({
      reminderId: "rem-123",
      patientId: "pat-456",
      patientName: "John",
      route: "/reminders",
    });
  });

  it("should gracefully handle malformed JSON strings without throwing", () => {
    expect(parseNotificationExtra("not-json")).toEqual({});
    expect(parseNotificationExtra("{bad:json}")).toEqual({});
  });
});
