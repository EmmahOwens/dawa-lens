import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { stringToHash } from "@/services/reminderService";
import { parseNotificationExtra } from "@/components/NotificationHandler";
import MessageRenderer from "@/components/MessageRenderer";
import { calculateRefillStatus } from "@/services/refillService";

describe("Crash Resilience Tests", () => {
  describe("stringToHash 32-Bit Integer Range Safety", () => {
    it("always produces positive numbers within signed 32-bit integer limits", () => {
      const testStrings = [
        "",
        "a",
        "medication_reminder_12345",
        "2026-08-19T10:30:00.000Z",
        "special_chars!@#$%^&*()_+~`",
        "long_string_".repeat(100),
      ];

      for (const str of testStrings) {
        const hash = stringToHash(str);
        expect(hash).toBeGreaterThan(0);
        expect(hash).toBeLessThanOrEqual(2147483647);
        expect(Number.isInteger(hash)).toBe(true);
      }
    });

    it("handles extreme hash collision values without exceeding 2147483647", () => {
      // Test 1,000 generated strings
      for (let i = 0; i < 1000; i++) {
        const randomStr = Math.random().toString(36).substring(2) + i;
        const hash = stringToHash(randomStr);
        expect(hash).toBeGreaterThanOrEqual(1);
        expect(hash).toBeLessThanOrEqual(2147483646);
      }
    });
  });

  describe("MessageRenderer Defensiveness", () => {
    it("renders empty string or undefined safely without throwing", () => {
      const { container: c1 } = render(
        <BrowserRouter>
          <MessageRenderer text={""} />
        </BrowserRouter>
      );
      expect(c1).toBeDefined();

      const { container: c2 } = render(
        <BrowserRouter>
          <MessageRenderer text={undefined as any} />
        </BrowserRouter>
      );
      expect(c2).toBeDefined();

      const { container: c3 } = render(
        <BrowserRouter>
          <MessageRenderer text={null as any} />
        </BrowserRouter>
      );
      expect(c3).toBeDefined();
    });

    it("strips action metadata cleanly without error", () => {
      render(
        <BrowserRouter>
          <MessageRenderer text="Take your pill now. [ACTION EXECUTED: UPDATE_REMINDER]" />
        </BrowserRouter>
      );
      expect(screen.getByText("Take your pill now.")).toBeInTheDocument();
      expect(screen.queryByText(/ACTION EXECUTED/)).not.toBeInTheDocument();
    });

    it("strips previous suggestions offered text cleanly from output", () => {
      render(
        <BrowserRouter>
          <MessageRenderer text="Would you like me to help you set a reminder to take your next dose, or plan a refill? [Previous suggestions offered: Set reminders for my medicines, Check my dose history, Plan a refill for Metronidazole]" />
        </BrowserRouter>
      );
      expect(screen.getByText("Would you like me to help you set a reminder to take your next dose, or plan a refill?")).toBeInTheDocument();
      expect(screen.queryByText(/Previous suggestions offered/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Check my dose history/i)).not.toBeInTheDocument();
    });
  });

  describe("NotificationHandler Extra Parser", () => {
    it("parses strings, objects, null, and malformed JSON safely", () => {
      expect(parseNotificationExtra(null)).toEqual({});
      expect(parseNotificationExtra(undefined)).toEqual({});
      expect(parseNotificationExtra("not a json string")).toEqual({});
      expect(parseNotificationExtra(12345)).toEqual({});
      expect(parseNotificationExtra({ reminderId: "rem_1", dose: "1 pill" })).toEqual({
        reminderId: "rem_1",
        dose: "1 pill",
      });
      expect(
        parseNotificationExtra(JSON.stringify({ reminderId: "rem_2", patientId: "p_1" }))
      ).toEqual({
        reminderId: "rem_2",
        patientId: "p_1",
      });
    });
  });

  describe("Refill Status Calculation with Edge-case Reminders", () => {
    it("calculates refill status safely when reminder time is undefined, empty, or custom", () => {
      const reminders: any[] = [
        {
          id: "r1",
          medicineId: "m1",
          enabled: true,
          repeatSchedule: "custom",
          time: "08:00,14:00,20:00",
        },
        {
          id: "r2",
          medicineId: "m1",
          enabled: true,
          repeatSchedule: "custom",
          time: undefined, // edge case
        },
        {
          id: "r3",
          medicineId: "m1",
          enabled: true,
          repeatSchedule: "daily",
          time: "", // edge case
        },
      ];

      const medicine: any = {
        id: "m1",
        name: "Test Medicine",
        currentQuantity: 30,
        dosagePerDose: 1,
      };

      const status = calculateRefillStatus(medicine, reminders);
      expect(status).not.toBeNull();
      expect(typeof status?.daysRemaining).toBe("number");
    });
  });
});
