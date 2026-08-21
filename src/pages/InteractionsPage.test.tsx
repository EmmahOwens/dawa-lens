import * as React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import InteractionsPage from "./InteractionsPage";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockToast, mockCheckHolisticSafety, testState } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockCheckHolisticSafety: vi.fn(),
  testState: {
    medicines: [
      { id: "med-1", name: "Atorvastatin", genericName: "atorvastatin", rxcui: "83367" },
      { id: "med-2", name: "Lisinopril", genericName: "lisinopril", rxcui: "29046" },
    ],
  },
}));

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/components/PremiumLoader", () => ({
  default: () => null,
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
    userProfile: { name: "Test Patient", gender: "male" },
    patients: [],
    selectedPatientId: null,
  }),
}));

vi.mock("@/services/interactionChecker", () => ({
  checkInteractions: vi.fn().mockResolvedValue([]),
  getRxCUI: vi.fn().mockResolvedValue("12345"),
  getSpellingSuggestions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/openFdaClient", () => ({
  checkFdaMultiSafety: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/services/api", () => ({
  aiApi: {
    checkHolisticSafety: (...args: any[]) => mockCheckHolisticSafety(...args),
    chat: vi.fn().mockResolvedValue({ text: "Explanation" }),
  },
}));

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    haptics: {
      impact: vi.fn(),
    },
  },
}));

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("InteractionsPage - Holistic & Food Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const submitCustomFactor = (value: string) => {
    const input = screen.getByPlaceholderText(/Add any food, herb, or drink/i);
    fireEvent.change(input, { target: { value } });
    const addButton = screen.getByRole("button", { name: /^add$/i });
    fireEvent.click(addButton);
  };

  it("renders the Holistic & Food Safety section with inputs and chips", () => {
    render(<InteractionsPage />);
    expect(screen.getByText(/Holistic & Food Safety/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Add any food, herb, or drink/i)).toBeInTheDocument();
    expect(screen.getByText("Caffeine")).toBeInTheDocument();
    expect(screen.getByText("Grapefruit")).toBeInTheDocument();
  });

  it("allows adding and selecting an arbitrary custom food (e.g. Avocado)", () => {
    render(<InteractionsPage />);
    submitCustomFactor("Avocado");

    expect(screen.getByText("Avocado")).toBeInTheDocument();
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Added & selected "Avocado"'));
  });

  it("selects an existing chip when typed into the custom input", () => {
    render(<InteractionsPage />);
    submitCustomFactor("Dairy");

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Selected "Dairy"'));
  });

  it("sends ONLY the selected food when one chip is selected and analyzed", async () => {
    mockCheckHolisticSafety.mockResolvedValueOnce({
      interactions: [
        {
          factor: "Caffeine",
          risk: "Low",
          affectedMedicines: ["Atorvastatin"],
          mechanism: "Mild CYP3A4 substrate competition",
          explanation: "Caffeine has minor theoretical overlap.",
          advice: "Moderate consumption is safe.",
        },
      ],
    });

    render(<InteractionsPage />);
    
    // Click only Caffeine
    const caffeineChip = screen.getByText("Caffeine");
    fireEvent.click(caffeineChip);

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();

    const analyzeBtn = screen.getByRole("button", { name: /analyze \(1\)/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(mockCheckHolisticSafety).toHaveBeenCalledWith({
        medicines: testState.medicines,
        lifestyleFactors: ["Caffeine"],
      });
    });

    // Check that Caffeine report card is rendered
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 4, name: /caffeine/i })).toBeInTheDocument();
      expect(screen.getByText(/Low Risk/i)).toBeInTheDocument();
      expect(screen.getByText("Atorvastatin")).toBeInTheDocument();
      expect(screen.getByText(/Moderate consumption is safe/i)).toBeInTheDocument();
    });
  });

  it("filters out any unselected/hallucinated items returned by the AI", async () => {
    mockCheckHolisticSafety.mockResolvedValueOnce({
      interactions: [
        {
          factor: "Avocado",
          risk: "Safe",
          affectedMedicines: [],
          mechanism: "No interaction",
          explanation: "Avocado is completely safe with your medications.",
          advice: "Enjoy as part of a healthy diet.",
        },
        {
          factor: "Alcohol", // Unrequested hallucinated factor
          risk: "High",
          affectedMedicines: ["Atorvastatin"],
          mechanism: "Hepatotoxicity",
          explanation: "Alcohol should not appear in this report.",
          advice: "Do not drink.",
        },
      ],
    });

    render(<InteractionsPage />);

    // Add and select only Avocado
    submitCustomFactor("Avocado");

    const analyzeBtn = screen.getByRole("button", { name: /analyze \(1\)/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 4, name: /avocado/i })).toBeInTheDocument();
      expect(screen.getByText(/Safe \/ Compatible/i)).toBeInTheDocument();
      expect(screen.getByText(/Avocado is completely safe with your medications/i)).toBeInTheDocument();
    });

    // Alcohol report should NOT be rendered because it was not selected
    expect(screen.queryByText("Alcohol should not appear in this report.")).not.toBeInTheDocument();
  });

  it("allows clearing selected factors", () => {
    render(<InteractionsPage />);
    
    // Select Caffeine and Dairy
    fireEvent.click(screen.getByText("Caffeine"));
    fireEvent.click(screen.getByText("Dairy"));
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

    // Click Clear
    const clearBtn = screen.getByRole("button", { name: /^clear$/i });
    fireEvent.click(clearBtn);

    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    expect(mockToast.info).toHaveBeenCalledWith("Cleared selected factors");
  });
});
