import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DailyTimeline } from "../DailyTimeline";
import { Reminder, DoseLog } from "@/contexts/AppContext";

// Mock framer-motion and icons
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    button: ({ children, className, onClick, ...props }: any) => <button className={className} onClick={onClick} {...props}>{children}</button>,
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

  it("should order the next pending dose first, followed by upcoming doses, followed by actioned doses", () => {
    const today = new Date();
    const todayStr = today.toDateString();
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
    expect(screen.getByText("Afternoon Med")).toBeInTheDocument();
    expect(screen.getByText("Night Med")).toBeInTheDocument();
    expect(screen.getByText("Morning Med")).toBeInTheDocument();

    // Check headings order in DOM
    const medicineHeadings = Array.from(container.querySelectorAll("h3")).map(el => el.textContent);
    expect(medicineHeadings).toEqual(["Afternoon Med", "Night Med", "Morning Med"]);

    // Afternoon med should be marked as "Next Dose"
    expect(screen.getByText("Next Dose")).toBeInTheDocument();

    // Night med should be marked as "Upcoming"
    expect(screen.getByText("Upcoming")).toBeInTheDocument();

    // Morning med should be marked as "Done"
    expect(screen.getByText("Done")).toBeInTheDocument();

    // Only 1 Take button and 1 Skip button should exist (on Afternoon Med)
    const takeButtons = screen.getAllByTitle("Take dose");
    expect(takeButtons).toHaveLength(1);

    const skipButtons = screen.getAllByTitle("Mark missed or skipped");
    expect(skipButtons).toHaveLength(1);
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

    // Second Dose is now the Next Dose
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Next Dose")).toBeInTheDocument();
    // "Upcoming" should no longer exist since Second Dose is now the only pending dose
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
  });
});
