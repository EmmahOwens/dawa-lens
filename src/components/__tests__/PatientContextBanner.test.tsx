import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PatientContextBanner } from "../PatientContextBanner";

const mockSetSelectedPatientId = vi.fn();
const mockLogDose = vi.fn();

let mockAppContextState: any = {};
let mockResolvedPatient: any = {};

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => mockAppContextState,
}));

vi.mock("@/hooks/usePatientScope", () => ({
  usePatientScope: () => ({
    resolvedPatient: mockResolvedPatient,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("PatientContextBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppContextState = {
      selectedPatientId: null,
      setSelectedPatientId: mockSetSelectedPatientId,
      reminders: [],
      doseLogs: [],
      logDose: mockLogDose,
    };
    mockResolvedPatient = {
      id: "patient-1",
      name: "Alice Smith",
      type: "client",
      color: "blue",
    };
  });

  it("renders nothing when selectedPatientId is null", () => {
    const { container } = render(<PatientContextBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders patient context banner when a client profile is selected", () => {
    mockAppContextState.selectedPatientId = "patient-1";
    render(<PatientContextBanner />);

    expect(screen.getByText("Viewing Alice Smith's Profile")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();

    const exitBtn = screen.getByRole("button", { name: /exit/i });
    fireEvent.click(exitBtn);
    expect(mockSetSelectedPatientId).toHaveBeenCalledWith(null);
  });

  it("shows caregiver due dose alert and logs dose with patientId: null when taken", () => {
    const now = new Date();
    const currentH = now.getHours().toString().padStart(2, "0");
    const currentM = now.getMinutes().toString().padStart(2, "0");
    const dueTime = `${currentH}:${currentM}`;

    mockAppContextState.selectedPatientId = "patient-1";
    mockAppContextState.reminders = [
      {
        id: "rem-caregiver-metformin",
        medicineName: "Metformin",
        dose: "500mg",
        time: dueTime,
        enabled: true,
        patientId: null, // Caregiver reminder
      },
      {
        id: "rem-patient-aspirin",
        medicineName: "Aspirin",
        dose: "100mg",
        time: "12:00",
        enabled: true,
        patientId: "patient-1",
      },
    ];

    render(<PatientContextBanner />);

    // Check that caregiver due dose alert appears in the banner
    expect(screen.getByText(new RegExp(`Your dose due \\(${dueTime}\\):`, "i"))).toBeInTheDocument();
    expect(screen.getByText(/Metformin/i)).toBeInTheDocument();

    const takeBtn = screen.getByRole("button", { name: /take dose/i });
    fireEvent.click(takeBtn);

    // Verify logDose is called with patientId: null, ensuring it logs for the caregiver
    expect(mockLogDose).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderId: "rem-caregiver-metformin",
        medicineName: "Metformin",
        dose: "500mg",
        scheduledTime: dueTime,
        action: "taken",
        patientId: null,
      })
    );
  });
});
