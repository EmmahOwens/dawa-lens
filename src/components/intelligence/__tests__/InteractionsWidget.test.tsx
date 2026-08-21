import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InteractionsWidget } from "../InteractionsWidget";

// Hoisted mocks
const {
  mockOpenDawaGPTWithPrompt,
  mockCheckInteractions,
  mockCheckFdaMultiSafety,
  testState,
} = vi.hoisted(() => ({
  mockOpenDawaGPTWithPrompt: vi.fn(),
  mockCheckInteractions: vi.fn().mockResolvedValue([]),
  mockCheckFdaMultiSafety: vi.fn().mockResolvedValue({
    hasCriticalAlert: false,
    boxedWarnings: [],
    contraindicationAlerts: [],
    allergenAlerts: [],
    duplicateTherapies: [],
    recalls: [],
  }),
  testState: {
    medicines: [
      { id: "med-1", name: "Ibuprofen (Nurofen)", genericName: "ibuprofen", rxcui: "5640" },
      { id: "med-2", name: "Panadol", genericName: "paracetamol", rxcui: "7052" },
    ],
    selectedPatientId: null,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    medicines: testState.medicines,
    userProfile: { id: "test-user-id", name: "Test User", gender: "male", dateOfBirth: "1990-01-01" },
    patients: [],
    selectedPatientId: testState.selectedPatientId,
    openDawaGPTWithPrompt: mockOpenDawaGPTWithPrompt,
  }),
}));

vi.mock("@/services/interactionChecker", () => ({
  checkInteractions: (...args: any[]) => mockCheckInteractions(...args),
}));

vi.mock("@/services/openFdaClient", () => ({
  checkFdaMultiSafety: (...args: any[]) => mockCheckFdaMultiSafety(...args),
}));

vi.mock("@/services/conditionInteractionService", () => ({
  checkConditionSafety: vi.fn().mockReturnValue([]),
}));

describe("InteractionsWidget — Global Watchdog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.medicines = [
      { id: "med-1", name: "Ibuprofen (Nurofen)", genericName: "ibuprofen", rxcui: "5640" },
      { id: "med-2", name: "Panadol", genericName: "paracetamol", rxcui: "7052" },
    ];
    testState.selectedPatientId = null;
    mockCheckFdaMultiSafety.mockResolvedValue({
      hasCriticalAlert: false,
      boxedWarnings: [],
      contraindicationAlerts: [],
      allergenAlerts: [],
      duplicateTherapies: [],
      recalls: [],
    });
    mockCheckInteractions.mockResolvedValue([]);
  });

  it("renders Duplicate Therapy alert when duplicate pharmacological classes exist", async () => {
    mockCheckFdaMultiSafety.mockResolvedValue({
      hasCriticalAlert: false,
      boxedWarnings: [],
      contraindicationAlerts: [],
      allergenAlerts: [],
      duplicateTherapies: [
        {
          drug1: "Ibuprofen (Nurofen)",
          drug2: "Panadol",
          sharedClass: "Nonsteroidal Anti-inflammatory Drug [EPC]",
          warning: "Both medications belong to the same pharmacologic class. Concurrent use increases toxicity risk.",
        },
      ],
      recalls: [],
    });
    mockCheckInteractions.mockResolvedValue([]);

    render(<InteractionsWidget />);

    await waitFor(() => {
      expect(screen.getByText(/Duplicate Class Alert/i)).toBeInTheDocument();
      expect(screen.getByText("Alert Active")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Ibuprofen \(Nurofen\) \+ Panadol/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Duplicates")).toBeInTheDocument();
    expect(screen.getByText("Consult DawaGPT on Safety")).toBeInTheDocument();
  });

  it("triggers DawaGPT when clicking 'Consult DawaGPT on Safety'", async () => {
    mockCheckFdaMultiSafety.mockResolvedValue({
      hasCriticalAlert: false,
      boxedWarnings: [],
      contraindicationAlerts: [],
      allergenAlerts: [],
      duplicateTherapies: [
        {
          drug1: "Ibuprofen",
          drug2: "Panadol",
          sharedClass: "NSAID",
          warning: "Duplicate therapy warning.",
        },
      ],
      recalls: [],
    });

    render(<InteractionsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Consult DawaGPT on Safety")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Consult DawaGPT on Safety"));
    expect(mockOpenDawaGPTWithPrompt).toHaveBeenCalledTimes(1);
    expect(mockOpenDawaGPTWithPrompt.mock.calls[0][0]).toContain("duplicate therapies detected");
  });

  it("renders Critical Risk alert when boxed warnings or high severity conflicts are present", async () => {
    mockCheckFdaMultiSafety.mockResolvedValue({
      hasCriticalAlert: true,
      boxedWarnings: [{ drugName: "Warfarin", warning: "Major bleeding risk." }],
      contraindicationAlerts: [],
      allergenAlerts: [],
      duplicateTherapies: [],
      recalls: [],
    });

    render(<InteractionsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Critical Risk")).toBeInTheDocument();
      expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    expect(screen.getByText("Ask DawaGPT to Resolve")).toBeInTheDocument();
  });

  it("renders Cabinet 100% Secure when no interactions or alerts exist with >= 2 meds", async () => {
    mockCheckFdaMultiSafety.mockResolvedValue({
      hasCriticalAlert: false,
      boxedWarnings: [],
      contraindicationAlerts: [],
      allergenAlerts: [],
      duplicateTherapies: [],
      recalls: [],
    });
    mockCheckInteractions.mockResolvedValue([]);

    render(<InteractionsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Cabinet 100% Secure")).toBeInTheDocument();
      expect(screen.getByText("Zero Known Interactions")).toBeInTheDocument();
      expect(screen.getByText("Secure")).toBeInTheDocument();
    });
  });

  it("renders Single Medication state when fewer than 2 medications exist", async () => {
    testState.medicines = [{ id: "med-1", name: "Amoxicillin", genericName: "amoxicillin", rxcui: "723" }];

    render(<InteractionsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Single Medication")).toBeInTheDocument();
      expect(screen.getByText("Standby")).toBeInTheDocument();
    });

    expect(screen.getByText(/Add 2 or more medicines to activate automated cross-drug synergy/i)).toBeInTheDocument();
  });

  it("launches DawaGPT with dietary check prompt when clicking a dietary chip", async () => {
    render(<InteractionsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Grapefruit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Grapefruit"));
    expect(mockOpenDawaGPTWithPrompt).toHaveBeenCalledTimes(1);
    expect(mockOpenDawaGPTWithPrompt.mock.calls[0][0]).toContain("Does Grapefruit interact with my medications");
  });
});
