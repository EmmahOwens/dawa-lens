import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DawaGPT from "../DawaGPT";

const mockChatWithDawaGPTStream = vi.fn();
vi.mock("@/services/aiAssistantService", () => ({
  chatWithDawaGPTStream: (...args: unknown[]) => mockChatWithDawaGPTStream(...args),
  resolveHonorific: () => "Mr.",
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({
    isOnline: true,
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

const mockSetDawaGPTInitialPrompt = vi.fn();
const mockAppState = {
  userProfile: { name: "Jane Doe", gender: "female" },
  isDawaGPTOpen: true,
  setIsDawaGPTOpen: vi.fn(),
  dawaGPTInitialPrompt: null as string | null,
  setDawaGPTInitialPrompt: mockSetDawaGPTInitialPrompt,
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
    resolvedPatient: { id: "p1", name: "Jane Doe" },
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

describe("DawaGPT Initial Prompt Auto-Send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.isDawaGPTOpen = true;
    mockAppState.dawaGPTInitialPrompt = null;
    mockChatWithDawaGPTStream.mockResolvedValue({
      id: "bot-response",
      role: "assistant",
      text: "I reviewed your safety alert. Warfarin and Aspirin should be closely monitored for bleeding.",
      source: "Gemini",
    });
  });

  it("automatically sends dawaGPTInitialPrompt and clears it without getting cancelled", async () => {
    const testPrompt = "I have active safety alerts for my medications (Warfarin, Aspirin):\n• Duplicate therapy detected: Warfarin + Aspirin\n\nCan you explain what these risks mean?";
    mockAppState.dawaGPTInitialPrompt = testPrompt;

    render(
      <MemoryRouter initialEntries={["/interactions"]}>
        <DawaGPT />
      </MemoryRouter>
    );

    // Initial prompt should be cleared in context
    expect(mockSetDawaGPTInitialPrompt).toHaveBeenCalledWith(null);

    // chatWithDawaGPTStream should be invoked with the prompt
    await waitFor(() => {
      expect(mockChatWithDawaGPTStream).toHaveBeenCalledTimes(1);
    });

    const calledMessages = mockChatWithDawaGPTStream.mock.calls[0][0];
    const userMessage = calledMessages.find((m: { role: string; text: string }) => m.role === "user");
    expect(userMessage).toBeDefined();
    expect(userMessage.text).toBe(testPrompt);

    // User message should be displayed in the UI
    expect(screen.getByText(/Duplicate therapy detected: Warfarin \+ Aspirin/i)).toBeInTheDocument();
    expect(screen.getByText(/I reviewed your safety alert/i)).toBeInTheDocument();
  });

  it("does not render generic welcome greeting when initial prompt is provided", async () => {
    const testPrompt = "Safety consultation prompt";
    mockAppState.dawaGPTInitialPrompt = testPrompt;

    render(
      <MemoryRouter initialEntries={["/interactions"]}>
        <DawaGPT />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockChatWithDawaGPTStream).toHaveBeenCalledTimes(1);
    });

    // Should NOT contain the generic system welcome phrase
    expect(screen.queryByText(/I'm DawaGPT, your health companion/i)).not.toBeInTheDocument();
  });
});
