import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TravelCompanionPage from "../TravelCompanionPage";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetTravelAdvice, mockToast, testState } = vi.hoisted(() => ({
  mockGetTravelAdvice: vi.fn(),
  mockToast: vi.fn(),
  testState: {
    medicines: [
      { id: "med-1", name: "Panadol", genericName: "Paracetamol", dosage: "500mg" },
      { id: "med-2", name: "Glucophage", genericName: "Metformin", dosage: "500mg" },
      { id: "med-3", name: "Ventolin", genericName: "Salbutamol", dosage: "100mcg" },
    ] as any[],
    userProfile: { name: "John Doe" },
  },
}));

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    medicines: testState.medicines,
    userProfile: testState.userProfile,
  }),
}));

vi.mock("@/hooks/useGeolocation", () => ({
  useGeolocation: () => ({
    location: { country: "Kenya", latitude: -1.286389, longitude: 36.817223 },
    status: "granted",
    requestLocation: vi.fn(),
  }),
}));

vi.mock("@/services/api", () => ({
  aiApi: {
    getTravelAdvice: (...args: any[]) => mockGetTravelAdvice(...args),
  },
}));

vi.mock("@/components/travel/TravelMap", () => ({
  TravelMap: () => <div data-testid="mock-travel-map">Travel Map</div>,
}));

vi.mock("@/components/PermissionRequest", () => ({
  default: () => null,
}));

vi.mock("@/components/MessageRenderer", () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
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

describe("TravelCompanionPage - Local Pharmacy Equivalents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.medicines = [
      { id: "med-1", name: "Panadol", genericName: "Paracetamol", dosage: "500mg" },
      { id: "med-2", name: "Glucophage", genericName: "Metformin", dosage: "500mg" },
      { id: "med-3", name: "Ventolin", genericName: "Salbutamol", dosage: "100mcg" },
    ];
    testState.userProfile = { name: "John Doe" };
  });

  it("renders equivalents for all medications in user's list when full advice is returned", async () => {
    mockGetTravelAdvice.mockResolvedValue({
      equivalents: [
        { original: "Panadol", equivalent: "Doliprane (500mg Paracetamol)" },
        { original: "Glucophage", equivalent: "Stagid / Metformine Mylan" },
        { original: "Ventolin", equivalent: "Ventoline Spray" },
      ],
      timezoneAdvice: "Maintain your standard 8-hour dosing interval.",
      customsNotes: "Carry original prescriptions.",
      emergencyContacts: [
        { service: "SAMU Ambulance", number: "15", type: "ambulance" },
        { service: "ANSM", number: "+33 1 58 47 50 00", type: "drug_authority" },
      ],
      healthRisks: "No specific vaccine mandates.",
    });

    render(<TravelCompanionPage />);

    const input = screen.getByPlaceholderText(/Enter country/i);
    fireEvent.change(input, { target: { value: "France" } });

    const analyzeBtn = screen.getByRole("button", { name: /Analyze Trip/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Local Pharmacy Equivalents/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify all 3 user medications and their destination equivalents are rendered
    expect(screen.getByText("Panadol")).toBeInTheDocument();
    expect(screen.getByText("Doliprane (500mg Paracetamol)")).toBeInTheDocument();

    expect(screen.getByText("Glucophage")).toBeInTheDocument();
    expect(screen.getByText("Stagid / Metformine Mylan")).toBeInTheDocument();

    expect(screen.getByText("Ventolin")).toBeInTheDocument();
    expect(screen.getByText("Ventoline Spray")).toBeInTheDocument();
  });

  it("backfills missing medications when API returns only partial equivalents", async () => {
    // API returns advice where only Panadol is included, missing Glucophage and Ventolin
    mockGetTravelAdvice.mockResolvedValue({
      equivalents: [
        { original: "Panadol", equivalent: "Doliprane" },
      ],
      timezoneAdvice: "Standard schedule.",
      customsNotes: "Carry prescription.",
      emergencyContacts: [],
      healthRisks: "None.",
    });

    render(<TravelCompanionPage />);

    const input = screen.getByPlaceholderText(/Enter country/i);
    fireEvent.change(input, { target: { value: "France" } });

    const analyzeBtn = screen.getByRole("button", { name: /Analyze Trip/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Local Pharmacy Equivalents/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Panadol matched from API
    expect(screen.getByText("Panadol")).toBeInTheDocument();
    expect(screen.getByText("Doliprane")).toBeInTheDocument();

    // Glucophage backfilled with generic / fallback
    expect(screen.getByText("Glucophage")).toBeInTheDocument();
    expect(screen.getByText(/Metformin/i)).toBeInTheDocument();

    // Ventolin backfilled with generic / fallback
    expect(screen.getByText("Ventolin")).toBeInTheDocument();
    expect(screen.getByText(/Salbutamol/i)).toBeInTheDocument();
  });

  it("shows empty state when user has no medications", () => {
    testState.medicines = [];

    render(<TravelCompanionPage />);

    expect(screen.getByText(/No Medications Found/i)).toBeInTheDocument();
    expect(screen.getByText(/Please add medications to your profile/i)).toBeInTheDocument();
  });
});
