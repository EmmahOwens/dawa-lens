import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DailyTimeline } from "../DailyTimeline";
import { Reminder, DoseLog } from "@/contexts/AppContext";

// Mock framer-motion cleanly without passing animation props to native DOM
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className }: any) => <div className={className}>{children}</div>,
    button: ({ children, className, onClick, title, "aria-label": ariaLabel }: any) => (
      <button className={className} onClick={onClick} title={title} aria-label={ariaLabel}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

describe("DailyTimeline Component", () => {
  it("should show a 'once' reminder created yesterday that is scheduled for today", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const reminders: Reminder[] = [
      {
        id: "rem-once-1",
        medicineName: "Amoxicillin",
        dose: "500mg",
        time: "14:00",
        repeatSchedule: "once",
        enabled: true,
        createdAt: yesterday,
      },
    ];

    const doseLogs: DoseLog[] = [];
    const handleAction = vi.fn();

    render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={doseLogs}
        onAction={handleAction}
      />
    );

    expect(screen.getByText("Amoxicillin")).toBeInTheDocument();
    expect(screen.getByText("500mg")).toBeInTheDocument();
  });

  it("should hide a 'once' reminder that was already taken on a previous day", () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const reminders: Reminder[] = [
      {
        id: "rem-once-taken",
        medicineName: "Ibuprofen",
        dose: "200mg",
        time: "10:00",
        repeatSchedule: "once",
        enabled: true,
        createdAt: twoDaysAgo,
      },
    ];

    const doseLogs: DoseLog[] = [
      {
        id: "log-prev-taken",
        reminderId: "rem-once-taken",
        medicineName: "Ibuprofen",
        dose: "200mg",
        scheduledTime: yesterday,
        actionTime: yesterday,
        action: "taken",
      },
    ];

    const handleAction = vi.fn();

    render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={doseLogs}
        onAction={handleAction}
      />
    );

    expect(screen.queryByText("Ibuprofen")).not.toBeInTheDocument();
  });

  it("should maintain chronological timeline order from morning to evening, highlighting the earliest pending dose as Next Dose", () => {
    const today = new Date();
    const todayISO = today.toISOString();

    const reminders: Reminder[] = [
      {
        id: "rem-1",
        medicineName: "Morning Med",
        dose: "1 pill",
        time: "08:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
      {
        id: "rem-2",
        medicineName: "Afternoon Med",
        dose: "2 pills",
        time: "14:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
      {
        id: "rem-3",
        medicineName: "Night Med",
        dose: "1 capsule",
        time: "20:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
    ];

    // Morning med is already taken
    const doseLogs: DoseLog[] = [
      {
        id: "log-morning",
        reminderId: "rem-1",
        medicineName: "Morning Med",
        dose: "1 pill",
        scheduledTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).toISOString(),
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 5, 0).toISOString(),
        action: "taken",
      },
    ];

    const handleAction = vi.fn();

    const { container } = render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={doseLogs}
        onAction={handleAction}
      />
    );

    // Verify medicine names appear in the document
    expect(screen.getByText("Morning Med")).toBeInTheDocument();
    expect(screen.getByText("Afternoon Med")).toBeInTheDocument();
    expect(screen.getByText("Night Med")).toBeInTheDocument();

    // Check headings maintain chronological order in DOM (08:00, 14:00, 20:00)
    const medicineHeadings = Array.from(container.querySelectorAll("h3")).map(el => el.textContent);
    expect(medicineHeadings).toEqual(["Morning Med", "Afternoon Med", "Night Med"]);

    // Morning med is marked as "Done"
    expect(screen.getByText("Done")).toBeInTheDocument();

    // Afternoon med should be marked as "Next Dose"
    expect(screen.getByText("Next Dose")).toBeInTheDocument();

    // Night med should be marked as "Upcoming"
    expect(screen.getByText("Upcoming")).toBeInTheDocument();

    // Only 1 Take button and 1 Skip button should exist (on Afternoon Med)
    const takeButtons = screen.getAllByTitle("Take dose");
    expect(takeButtons).toHaveLength(1);

    const skipButtons = screen.getAllByTitle("Mark missed or skipped");
    expect(skipButtons).toHaveLength(1);
  });

  it("should sort cards by day-aware chronological timestamp (e.g. today 07:00 precedes today 23:00)", () => {
    const today = new Date();
    const todayISO = today.toISOString();

    const reminders: Reminder[] = [
      {
        id: "rem-night",
        medicineName: "Late Night Med",
        dose: "1 pill",
        time: "23:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
      {
        id: "rem-morning",
        medicineName: "Early Morning Med",
        dose: "1 capsule",
        time: "07:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
    ];

    const { container } = render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={[]}
        onAction={vi.fn()}
      />
    );

    const medicineHeadings = Array.from(container.querySelectorAll("h3")).map(el => el.textContent);
    expect(medicineHeadings).toEqual(["Early Morning Med", "Late Night Med"]);
  });

  it("should correctly mark a dose as Done when snoozed first and then taken", () => {
    const today = new Date();
    const scheduledISO = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0).toISOString();

    const reminders: Reminder[] = [
      {
        id: "rem-snooze-take",
        medicineName: "Blood Pressure Med",
        dose: "10mg",
        time: "09:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: today.toISOString(),
      },
    ];

    // Log array contains snoozed log first, then taken log
    const doseLogs: DoseLog[] = [
      {
        id: "log-snooze-1",
        reminderId: "rem-snooze-take",
        medicineName: "Blood Pressure Med",
        dose: "10mg",
        scheduledTime: scheduledISO,
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0).toISOString(),
        action: "snoozed",
        snoozeUntil: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 15, 0).toISOString(),
      },
      {
        id: "log-take-2",
        reminderId: "rem-snooze-take",
        medicineName: "Blood Pressure Med",
        dose: "10mg",
        scheduledTime: scheduledISO,
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 15, 0).toISOString(),
        action: "taken",
      },
    ];

    render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={doseLogs}
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText("Blood Pressure Med")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("Next Dose")).not.toBeInTheDocument();
  });

  it("should not double-claim a single dose log across multiple slots close together", () => {
    const today = new Date();
    const reminders: Reminder[] = [
      {
        id: "rem-multi-slot",
        medicineName: "Eye Drops",
        dose: "2 drops",
        time: "08:00, 08:30",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: today.toISOString(),
      },
    ];

    // Only slot 0 (08:00) was taken
    const doseLogs: DoseLog[] = [
      {
        id: "log-slot-0",
        reminderId: "rem-multi-slot",
        medicineName: "Eye Drops",
        dose: "2 drops",
        scheduledTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).toISOString(),
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).toISOString(),
        action: "taken",
      },
    ];

    render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={doseLogs}
        onAction={vi.fn()}
      />
    );

    // One slot is Done (08:00), the other slot is Next Dose (08:30)
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Next Dose")).toBeInTheDocument();
  });

  it("should display patient name badge when patientName is provided", () => {
    const today = new Date();
    const reminders: Reminder[] = [
      {
        id: "rem-patient",
        medicineName: "Insulin",
        dose: "10 units",
        time: "12:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: today.toISOString(),
        patientName: "Sarah",
        patientId: "patient-123",
      },
    ];

    render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={[]}
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText("For Sarah")).toBeInTheDocument();
    expect(screen.getByText("Insulin")).toBeInTheDocument();
  });

  it("should trigger onAction when the Next Dose action buttons are clicked", () => {
    const today = new Date();
    const todayISO = today.toISOString();

    const reminders: Reminder[] = [
      {
        id: "rem-active",
        medicineName: "Active Med",
        dose: "10mg",
        time: "09:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
      {
        id: "rem-future",
        medicineName: "Future Med",
        dose: "20mg",
        time: "18:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
    ];

    const handleAction = vi.fn();

    render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={[]}
        onAction={handleAction}
      />
    );

    const takeButton = screen.getByTitle("Take dose");
    takeButton.click();

    const expectedISO = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      9,
      0,
      0,
      0
    ).toISOString();

    expect(handleAction).toHaveBeenCalledTimes(1);
    expect(handleAction).toHaveBeenCalledWith(
      reminders[0],
      "taken",
      expectedISO
    );
  });

  it("should advance next dose to subsequent reminder when earlier dose is actioned", () => {
    const today = new Date();
    const todayISO = today.toISOString();

    const reminders: Reminder[] = [
      {
        id: "rem-1",
        medicineName: "First Dose",
        dose: "5mg",
        time: "08:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
      {
        id: "rem-2",
        medicineName: "Second Dose",
        dose: "10mg",
        time: "12:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
    ];

    const handleAction = vi.fn();

    // First render with no logs: First Dose is Next Dose
    const { rerender } = render(
      <DailyTimeline
        reminders={reminders}
        doseLogs={[]}
        onAction={handleAction}
      />
    );

    expect(screen.getByText("First Dose")).toBeInTheDocument();
    expect(screen.getByText("Second Dose")).toBeInTheDocument();
    expect(screen.getByText("Next Dose")).toBeInTheDocument();

    // Second dose has Upcoming text
    expect(screen.getByText("Upcoming")).toBeInTheDocument();

    // Now simulate First Dose being taken
    const doseLogs: DoseLog[] = [
      {
        id: "log-first-taken",
        reminderId: "rem-1",
        medicineName: "First Dose",
        dose: "5mg",
        scheduledTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).toISOString(),
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 2, 0).toISOString(),
        action: "taken",
      },
    ];

    rerender(
      <DailyTimeline
        reminders={reminders}
        doseLogs={doseLogs}
        onAction={handleAction}
      />
    );

    // First Dose is Done, Second Dose is now the Next Dose
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Next Dose")).toBeInTheDocument();
    // "Upcoming" should no longer exist since Second Dose is now the only pending dose
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
  });
});
