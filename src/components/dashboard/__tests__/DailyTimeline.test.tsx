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
});
