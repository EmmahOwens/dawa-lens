import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardWidget } from "../DashboardWidget";
import { Reminder, DoseLog } from "@/contexts/AppContext";

const mockLogDose = vi.fn().mockResolvedValue(undefined);
let mockScopedReminders: Reminder[] = [];
let mockScopedDoseLogs: DoseLog[] = [];

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    logDose: mockLogDose,
  }),
}));

vi.mock("@/hooks/usePatientScope", () => ({
  usePatientScope: () => ({
    scopedReminders: mockScopedReminders,
    scopedDoseLogs: mockScopedDoseLogs,
  }),
}));

vi.mock("@/hooks/useIntelligenceContext", () => ({
  useIntelligenceContext: () => ({
    insight: "Patient is adhering well.",
    nutritionalTip: "Take with plenty of water.",
    isLoading: false,
  }),
}));

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DashboardWidget Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display the exact next dose slot rather than comma-separated list of times", () => {
    const today = new Date();
    const todayISO = today.toISOString();

    mockScopedReminders = [
      {
        id: "rem-1",
        medicineName: "Panadol",
        dose: "2 tablets",
        time: "17:00, 01:00, 09:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
    ];

    // Slot 0 (17:00) is taken
    mockScopedDoseLogs = [
      {
        id: "log-1",
        reminderId: "rem-1",
        medicineName: "Panadol",
        dose: "2 tablets",
        scheduledTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0).toISOString(),
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 1, 0).toISOString(),
        action: "taken",
      },
    ];

    render(<DashboardWidget />);

    // Should NOT display the raw string "17:00, 01:00, 09:00"
    expect(screen.queryByText("17:00, 01:00, 09:00")).not.toBeInTheDocument();
    expect(screen.queryByText("17:00,01:00,09:00")).not.toBeInTheDocument();

    // Should display the medicine name and dose
    expect(screen.getByText(/Panadol/i)).toBeInTheDocument();
    expect(screen.getByText(/2 tablets/i)).toBeInTheDocument();

    // Should display Next Dose badge and title
    expect(screen.getAllByText("Next Dose").length).toBeGreaterThanOrEqual(2);

    // Action buttons should be present
    expect(screen.getByRole("button", { name: /take dose/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip dose/i })).toBeInTheDocument();
  });

  it("should display adjustment shift offset when a dose has been shifted", () => {
    const today = new Date();
    const todayISO = today.toISOString();

    mockScopedReminders = [
      {
        id: "rem-1",
        medicineName: "Panadol",
        dose: "2 tablets",
        time: "17:00, 01:00, 09:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: todayISO,
      },
    ];

    // Taken 1 minute late
    mockScopedDoseLogs = [
      {
        id: "log-1",
        reminderId: "rem-1",
        medicineName: "Panadol",
        dose: "2 tablets",
        scheduledTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0).toISOString(),
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 1, 0).toISOString(),
        action: "taken",
      },
    ];

    render(<DashboardWidget />);

    // Next dose slot has an adjustment (e.g. +1m)
    const shiftBadge = screen.queryByText(/[+-]\d+m/);
    expect(shiftBadge).toBeInTheDocument();
  });

  it("should trigger logDose when Take Dose button is clicked", async () => {
    const today = new Date();
    mockScopedReminders = [
      {
        id: "rem-1",
        medicineName: "Panadol",
        dose: "2 tablets",
        time: "17:00, 01:00, 09:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: today.toISOString(),
      },
    ];
    mockScopedDoseLogs = [];

    render(<DashboardWidget />);

    const takeButton = screen.getByRole("button", { name: /take dose/i });
    fireEvent.click(takeButton);

    expect(mockLogDose).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderId: "rem-1",
        medicineName: "Panadol",
        dose: "2 tablets",
        action: "taken",
      })
    );
  });

  it("should display All Doses Complete when all reminders for today are taken", () => {
    const today = new Date();
    mockScopedReminders = [
      {
        id: "rem-single",
        medicineName: "Vitamin C",
        dose: "1 tablet",
        time: "08:00",
        repeatSchedule: "daily",
        enabled: true,
        createdAt: today.toISOString(),
      },
    ];

    mockScopedDoseLogs = [
      {
        id: "log-1",
        reminderId: "rem-single",
        medicineName: "Vitamin C",
        dose: "1 tablet",
        scheduledTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).toISOString(),
        actionTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).toISOString(),
        action: "taken",
      },
    ];

    render(<DashboardWidget />);

    expect(screen.getByText("All Doses Complete")).toBeInTheDocument();
  });

  it("should display No Reminders when no active reminders exist", () => {
    mockScopedReminders = [];
    mockScopedDoseLogs = [];

    render(<DashboardWidget />);

    expect(screen.getByText("No Reminders")).toBeInTheDocument();
  });
});
