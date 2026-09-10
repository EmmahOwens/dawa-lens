import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DawaGPT from "../DawaGPT";

let mockIsOnline = true;
vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({
    isOnline: mockIsOnline,
  }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDragControls: () => ({
    start: vi.fn(),
  }),
  motion: new Proxy(
    {} as Record<string, unknown>,
    {
      get: (_target, prop: string) =>
        React.forwardRef(function MotionEl(
          {
            children,
            layout: _l,
            initial: _i,
            animate: _a,
            exit: _e,
            whileHover: _wh,
            whileTap: _wt,
            drag: _d,
            dragControls: _dc,
            dragListener: _dl,
            dragConstraints: _dconst,
            dragElastic: _de,
            onDragEnd: _ode,
            ...rest
          }: Record<string, unknown> & { children?: React.ReactNode },
          ref: React.Ref<HTMLElement>
        ) {
          return React.createElement(prop, { ...rest, ref }, children);
        }),
    }
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockAppState = {
  userProfile: { name: "John Doe", gender: "male" },
  isDawaGPTOpen: false,
  setIsDawaGPTOpen: vi.fn(),
  dawaGPTInitialPrompt: null,
  setDawaGPTInitialPrompt: vi.fn(),
  patients: [],
  medicines: [],
  reminders: [],
  doseLogs: [],
  wellnessLogs: [],
  isOnline: true,
};

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => mockAppState,
}));

vi.mock("@/hooks/usePatientScope", () => ({
  usePatientScope: () => ({
    scopedMedicines: [],
    scopedReminders: [],
    scopedDoseLogs: [],
    scopedWellnessLogs: [],
    resolvedPatient: { id: "p1", name: "John Doe" },
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAIActions", () => ({
  useAIActions: () => ({
    dispatchAIAction: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSwipeToDismiss", () => ({
  useSwipeToDismiss: () => ({}),
}));

vi.mock("@/hooks/useTypewriterPlaceholder", () => ({
  useTypewriterPlaceholder: () => "Ask DawaGPT anything...",
}));

describe("DawaGPT Offline Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
    mockAppState.isDawaGPTOpen = false;
  });

  it("renders the floating toggle button when online", () => {
    mockIsOnline = true;
    render(
      <MemoryRouter initialEntries={["/reminders"]}>
        <DawaGPT />
      </MemoryRouter>
    );

    const triggerBtn = screen.getByRole("button", { name: /open dawagpt/i });
    expect(triggerBtn).toBeInTheDocument();
  });

  it("does not render the floating toggle button when offline", () => {
    mockIsOnline = false;
    render(
      <MemoryRouter initialEntries={["/reminders"]}>
        <DawaGPT />
      </MemoryRouter>
    );

    const triggerBtn = screen.queryByRole("button", { name: /open dawagpt/i });
    expect(triggerBtn).not.toBeInTheDocument();
  });

  it("displays offline badge and disables input when chat is open while offline", () => {
    mockIsOnline = false;
    mockAppState.isDawaGPTOpen = true;

    render(
      <MemoryRouter initialEntries={["/reminders"]}>
        <DawaGPT />
      </MemoryRouter>
    );

    expect(screen.getByText("Offline")).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText("DawaGPT is unavailable offline...");
    expect(textarea).toBeDisabled();
    expect(screen.getByText(/Internet connection required for AI responses/i)).toBeInTheDocument();
  });
});
