import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MedVaultPage from "../MedVaultPage";

// ─── Hoisted mocks & state ───────────────────────────────────────────────────

const { mockRequestLocation, mockUpdateMedicine, mockToast, mockNavigate, testState } =
  vi.hoisted(() => ({
    mockRequestLocation: vi.fn(),
    mockUpdateMedicine: vi.fn(),
    mockToast: vi.fn(),
    mockNavigate: vi.fn(),
    testState: {
      geoStatus: "idle",
      medicines: [
        {
          id: "med-1",
          name: "Amoxicillin 500mg",
          dosage: "500mg",
          currentQuantity: 4,
          totalQuantity: 20,
          dosagePerDose: 1,
          frequencyPerDay: 3,
          unit: "capsules",
          color: "blue",
          icon: "pill",
        },
      ] as any[],
      reminders: [] as any[],
    },
  }));

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    medicines: testState.medicines,
    updateMedicine: mockUpdateMedicine,
    isInitializing: false,
  }),
}));

vi.mock("@/hooks/usePatientScope", () => ({
  usePatientScope: () => ({
    scopedMedicines: testState.medicines,
    scopedReminders: testState.reminders,
    activeProfileId: "self",
  }),
}));

vi.mock("@/hooks/useGeolocation", () => ({
  useGeolocation: (options?: { autoRequest?: boolean }) => ({
    location: testState.geoStatus === "granted" ? { latitude: 0.3476, longitude: 32.5825 } : null,
    status: testState.geoStatus,
    error: null,
    requestLocation: mockRequestLocation,
  }),
}));

vi.mock("@/components/pharmacy/PharmacyFinderModal", () => ({
  PharmacyFinderModal: ({ medicine, onClose }: any) => (
    <div data-testid="pharmacy-finder-modal">
      <span>Pharmacy Finder Modal: {medicine?.name || "General"}</span>
      <button onClick={onClose}>Close Finder</button>
    </div>
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    {} as Record<string, unknown>,
    {
      get: (_target, prop: string) =>
        React.forwardRef(function MotionEl(
          { children, layout: _l, initial: _i, animate: _a, exit: _e, variants: _v, transition: _t, ...rest }:
            React.HTMLAttributes<HTMLElement> & {
              layout?: unknown;
              initial?: unknown;
              animate?: unknown;
              exit?: unknown;
              variants?: unknown;
              transition?: unknown;
            },
          ref: React.Ref<HTMLElement>
        ) {
          return React.createElement(prop, { ...rest, ref }, children);
        }),
    }
  ),
}));

describe("MedVaultPage - Location Permission Dialog for Find NDA Pharmacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.geoStatus = "idle";
    testState.medicines = [
      {
        id: "med-1",
        name: "Amoxicillin 500mg",
        dosage: "500mg",
        currentQuantity: 4,
        totalQuantity: 20,
        dosagePerDose: 1,
        frequencyPerDay: 3,
        unit: "capsules",
        color: "blue",
        icon: "pill",
      },
    ];
  });

  it("shows location permission dialog when clicking 'Find NDA Pharmacy' with ungranted location", () => {
    testState.geoStatus = "idle";
    render(<MedVaultPage />);

    // Pharmacy modal should not be visible initially
    expect(screen.queryByTestId("pharmacy-finder-modal")).not.toBeInTheDocument();
    // Permission dialog should not be visible initially
    expect(screen.queryByText(/Enable Location Services/i)).not.toBeInTheDocument();

    // Click "Find NDA Pharmacy" button on the tracked medicine card
    const findBtn = screen.getByRole("button", { name: /Find NDA Pharmacy/i });
    fireEvent.click(findBtn);

    // Permission dialog box must appear requiring location services
    expect(screen.getByText(/Enable Location Services/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Allow DawaLens to access your device location to discover the nearest NDA-licensed pharmacies/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Allow Location/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Maybe later/i })).toBeInTheDocument();

    // Pharmacy modal should still not be opened yet
    expect(screen.queryByTestId("pharmacy-finder-modal")).not.toBeInTheDocument();
  });

  it("requests location and opens pharmacy finder modal on confirming location permission dialog", async () => {
    testState.geoStatus = "idle";
    mockRequestLocation.mockImplementation(async () => {
      testState.geoStatus = "granted";
    });

    render(<MedVaultPage />);

    // Click "Find NDA Pharmacy"
    const findBtn = screen.getByRole("button", { name: /Find NDA Pharmacy/i });
    fireEvent.click(findBtn);

    // Confirm dialog
    const allowBtn = screen.getByRole("button", { name: /Allow Location/i });
    fireEvent.click(allowBtn);

    await waitFor(() => {
      expect(mockRequestLocation).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("pharmacy-finder-modal")).toBeInTheDocument();
      expect(screen.getByText(/Pharmacy Finder Modal: Amoxicillin 500mg/i)).toBeInTheDocument();
    });

    // Permission dialog should be closed
    expect(screen.queryByText(/Enable Location Services/i)).not.toBeInTheDocument();
  });

  it("dismisses dialog and does not open modal when selecting 'Maybe later'", () => {
    testState.geoStatus = "idle";
    render(<MedVaultPage />);

    // Click "Find NDA Pharmacy"
    const findBtn = screen.getByRole("button", { name: /Find NDA Pharmacy/i });
    fireEvent.click(findBtn);

    expect(screen.getByText(/Enable Location Services/i)).toBeInTheDocument();

    // Click "Maybe later"
    const cancelBtn = screen.getByRole("button", { name: /Maybe later/i });
    fireEvent.click(cancelBtn);

    // Permission dialog dismissed and modal not opened
    expect(screen.queryByText(/Enable Location Services/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("pharmacy-finder-modal")).not.toBeInTheDocument();
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("directly opens pharmacy finder modal if location permission is already granted", () => {
    testState.geoStatus = "granted";
    render(<MedVaultPage />);

    const findBtn = screen.getByRole("button", { name: /Find NDA Pharmacy/i });
    fireEvent.click(findBtn);

    // Permission dialog should NOT appear
    expect(screen.queryByText(/Enable Location Services/i)).not.toBeInTheDocument();
    // Modal opens directly
    expect(screen.getByTestId("pharmacy-finder-modal")).toBeInTheDocument();
    expect(screen.getByText(/Pharmacy Finder Modal: Amoxicillin 500mg/i)).toBeInTheDocument();
  });

  it("shows location dialog when selecting 'NDA Pharmacies' header button with ungranted location", () => {
    testState.geoStatus = "denied";
    render(<MedVaultPage />);

    const headerBtn = screen.getByRole("button", { name: /^NDA Pharmacies$/i });
    fireEvent.click(headerBtn);

    expect(screen.getByText(/Enable Location Services/i)).toBeInTheDocument();
  });

  it("shows location dialog when selecting 'Top 5 NDA Pharmacies' banner button with ungranted location", () => {
    testState.geoStatus = "denied";
    render(<MedVaultPage />);

    const bannerBtn = screen.getByRole("button", { name: /^Top 5 NDA Pharmacies$/i });
    fireEvent.click(bannerBtn);

    expect(screen.getByText(/Enable Location Services/i)).toBeInTheDocument();
  });
});
