import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { WellnessLog } from "@/contexts/AppContext";

// ─── Mutable test state accessible inside vi.mock closures ────────────────────

const testState = {
  scopedWellnessLogs: [] as WellnessLog[],
  scopedMedicines: [] as any[],
  scopedDoseLogs: [] as any[],
};

const mockAddWellnessLog = vi.fn();
const mockDeleteWellnessLog = vi.fn();
const mockToast = vi.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
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
    addWellnessLog: mockAddWellnessLog,
    deleteWellnessLog: mockDeleteWellnessLog,
    wellnessLogs: testState.scopedWellnessLogs,
    medicines: testState.scopedMedicines,
    doseLogs: testState.scopedDoseLogs,
    reminders: [],
    patients: [],
    selectedPatientId: null,
    userProfile: null,
  }),
}));

vi.mock("@/hooks/usePatientScope", () => ({
  usePatientScope: () => ({
    scopedWellnessLogs: testState.scopedWellnessLogs,
    scopedMedicines: testState.scopedMedicines,
    scopedDoseLogs: testState.scopedDoseLogs,
    scopedReminders: [],
    resolvedPatient: { id: null, name: "You", isOwner: true, type: "self" },
    matchPatient: () => true,
  }),
}));

vi.mock("@/services/api", () => ({
  aiApi: {
    getWellnessInsight: vi.fn().mockResolvedValue(null),
    getNutritionalGuidance: vi.fn().mockResolvedValue(null),
    getEmotionReflection: vi.fn().mockResolvedValue(null),
    checkMealSafety: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/components/rive/LottieMoji", () => ({
  LottieMoji: ({ emoji }: { emoji: string }) => <span>{emoji}</span>,
}));

vi.mock("@/components/rive/RiveMoji", () => ({
  RiveMoji: ({ emoji }: { emoji: string }) => <span>{emoji}</span>,
}));

vi.mock("@/components/wellness/WellnessInsightCard", () => ({
  default: () => <div data-testid="wellness-insight-card" />,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import WellnessPage from "./WellnessPage";

afterEach(() => {
  cleanup();
  testState.scopedWellnessLogs = [];
  testState.scopedMedicines = [];
  testState.scopedDoseLogs = [];
  vi.clearAllMocks();
});

describe("WellnessPage - Recent Reflections ordering & limits", () => {
  it("renders empty state when there are no wellness logs", () => {
    testState.scopedWellnessLogs = [];
    render(<WellnessPage />);
    expect(screen.getByText(/Your wellness journey starts here/i)).toBeInTheDocument();
  });

  it("arranges reflections in descending order of timestamps (most recent first)", () => {
    // Provide unsorted / randomly arranged logs
    testState.scopedWellnessLogs = [
      {
        id: "log-1",
        type: "food",
        timestamp: "2026-08-10T10:00:00.000Z",
        data: { meal: "Oldest Meal (Aug 10)" },
        userId: "u1",
      },
      {
        id: "log-3",
        type: "food",
        timestamp: "2026-08-19T08:00:00.000Z",
        data: { meal: "Newest Meal (Aug 19)" },
        userId: "u1",
      },
      {
        id: "log-2",
        type: "food",
        timestamp: "2026-08-15T12:00:00.000Z",
        data: { meal: "Middle Meal (Aug 15)" },
        userId: "u1",
      },
    ];

    render(<WellnessPage />);

    // Get all rendered meals in the feed
    const mealElements = screen.getAllByText(/Meal \(Aug/i);
    expect(mealElements).toHaveLength(3);

    // Verify ordering is most recent to oldest: Aug 19, Aug 15, Aug 10
    expect(mealElements[0]).toHaveTextContent("Newest Meal (Aug 19)");
    expect(mealElements[1]).toHaveTextContent("Middle Meal (Aug 15)");
    expect(mealElements[2]).toHaveTextContent("Oldest Meal (Aug 10)");
  });

  it("limits recent reflections to exactly the last 10 entries when more than 10 exist", () => {
    // Generate 15 logs with timestamps ranging from day 1 to day 15
    const logs: WellnessLog[] = Array.from({ length: 15 }, (_, i) => ({
      id: `log-${i + 1}`,
      type: "food",
      timestamp: new Date(2026, 7, i + 1, 12, 0, 0).toISOString(), // Aug 1 to Aug 15
      data: { meal: `Meal #${i + 1} (Day ${i + 1})` },
      userId: "u1",
    }));

    // Shuffle them to test sorting as well as limiting
    testState.scopedWellnessLogs = [...logs].sort(() => Math.random() - 0.5);

    render(<WellnessPage />);

    const mealElements = screen.getAllByText(/Meal #/i);
    // Should only have 10 elements rendered
    expect(mealElements).toHaveLength(10);

    // First item should be the most recent (Day 15)
    expect(mealElements[0]).toHaveTextContent("Meal #15 (Day 15)");
    // 10th item should be Day 6
    expect(mealElements[9]).toHaveTextContent("Meal #6 (Day 6)");

    // Days 1 through 5 should NOT be present
    for (let day = 1; day <= 5; day++) {
      expect(screen.queryByText(`Meal #${day} (Day ${day})`)).not.toBeInTheDocument();
    }
  });

  it("renders symptom logs with mood, symptoms, and AI reflections correctly", () => {
    testState.scopedWellnessLogs = [
      {
        id: "symptom-1",
        type: "symptom",
        timestamp: "2026-08-19T06:00:00.000Z",
        data: {
          mood: 5,
          energy: 4,
          symptoms: ["Good Focus", "Happy"],
          aiReflection: {
            reflection: "You are having an energetic and positive day.",
            affirmation: "I am flourishing.",
            tip: "Stay hydrated and keep up the momentum.",
          },
        },
        userId: "u1",
      },
    ];

    render(<WellnessPage />);

    expect(screen.getByText("Vitality Check")).toBeInTheDocument();
    expect(screen.getByText("Feeling: Good Focus, Happy")).toBeInTheDocument();
    expect(screen.getByText("You are having an energetic and positive day.")).toBeInTheDocument();
    expect(screen.getByText("I am flourishing.")).toBeInTheDocument();
    expect(screen.getByText("Stay hydrated and keep up the momentum.")).toBeInTheDocument();
  });
});
