import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AddReminderPage from "../AddReminderPage";

// ─── Hoisted mocks & state ───────────────────────────────────────────────────

const { mockNavigate, mockToast, mockAddReminder, mockUpdateReminder, mockAddMedicine, mockUpdateMedicine, testState } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockToast: vi.fn(),
    mockAddReminder: vi.fn().mockResolvedValue({ id: "rem-new" }),
    mockUpdateReminder: vi.fn().mockResolvedValue({ id: "rem-1" }),
    mockAddMedicine: vi.fn().mockResolvedValue({ id: "med-new" }),
    mockUpdateMedicine: vi.fn().mockResolvedValue({ id: "med-1" }),
    testState: {
      locationState: null as any,
      medicines: [
        {
          id: "med-1",
          name: "Amoxicillin 500mg",
          dosage: "500mg",
          currentQuantity: 15,
          totalQuantity: 30,
          dosagePerDose: 1,
          frequencyPerDay: 3,
          unit: "capsules",
          color: "blue",
          icon: "pill",
        },
        {
          id: "med-2",
          name: "Metformin 500mg",
          dosage: "500mg",
          currentQuantity: 60,
          totalQuantity: 60,
          dosagePerDose: 1,
          frequencyPerDay: 2,
          unit: "tablets",
          color: "green",
          icon: "tablet",
        },
        {
          id: "med-once",
          name: "Vitamin D3",
          dosage: "1000IU",
          currentQuantity: 30,
          totalQuantity: 30,
          dosagePerDose: 1,
          frequencyPerDay: 1,
          unit: "tablets",
          color: "amber",
          icon: "pill",
        },
      ] as any[],
      reminders: [] as any[],
    },
  }));

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: testState.locationState,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({
    isOnline: true,
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
    requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
  },
}));

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    haptics: { impact: vi.fn() },
    isBatteryOptimizationIgnored: vi.fn().mockResolvedValue(true),
    requestBatteryOptimizationExemption: vi.fn(),
  },
}));

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    medicines: testState.medicines,
    reminders: testState.reminders,
    addReminder: mockAddReminder,
    updateReminder: mockUpdateReminder,
    addMedicine: mockAddMedicine,
    updateMedicine: mockUpdateMedicine,
    userProfile: { id: "user-1", name: "John Doe" },
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

describe("AddReminderPage - Equal Time Spacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.locationState = null;
  });

  it("maintains equal time spacing when changing starting time for a Med Vault medication (3x/day)", async () => {
    testState.locationState = { medicineId: "med-1" };

    render(<AddReminderPage />);

    // Wait for the 3 time inputs to be populated from Med Vault frequency (frequencyPerDay: 3)
    await waitFor(() => {
      const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect(timeInputs).toHaveLength(3);
      expect((timeInputs[0] as HTMLInputElement).value).toBe("08:00");
      expect((timeInputs[1] as HTMLInputElement).value).toBe("16:00");
      expect((timeInputs[2] as HTMLInputElement).value).toBe("00:00");
    });

    const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

    // Change the starting time from 08:00 to 09:00
    fireEvent.change(timeInputs[0], { target: { value: "09:00" } });

    // Subsequent times MUST recalculate and shift with equal 8-hour spacing: 09:00 -> 17:00 -> 01:00
    await waitFor(() => {
      const updatedInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect(updatedInputs).toHaveLength(3);
      expect((updatedInputs[0] as HTMLInputElement).value).toBe("09:00");
      expect((updatedInputs[1] as HTMLInputElement).value).toBe("17:00");
      expect((updatedInputs[2] as HTMLInputElement).value).toBe("01:00");
    });
  });

  it("maintains equal time spacing for 2x/day medication when starting time changes", async () => {
    testState.locationState = { medicineId: "med-2" };

    render(<AddReminderPage />);

    await waitFor(() => {
      const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect(timeInputs).toHaveLength(2);
      expect((timeInputs[0] as HTMLInputElement).value).toBe("08:00");
      expect((timeInputs[1] as HTMLInputElement).value).toBe("20:00");
    });

    const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

    // Change starting time to 07:00 -> 07:00 + 12h = 19:00
    fireEvent.change(timeInputs[0], { target: { value: "07:00" } });

    await waitFor(() => {
      const updatedInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect(updatedInputs).toHaveLength(2);
      expect((updatedInputs[0] as HTMLInputElement).value).toBe("07:00");
      expect((updatedInputs[1] as HTMLInputElement).value).toBe("19:00");
    });
  });

  it("allows custom modification of individual non-starting slots without shifting other slots", async () => {
    testState.locationState = { medicineId: "med-1" };

    render(<AddReminderPage />);

    await waitFor(() => {
      const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect(timeInputs).toHaveLength(3);
    });

    const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

    // Change the second slot (idx = 1) from 16:00 to 17:30
    fireEvent.change(timeInputs[1], { target: { value: "17:30" } });

    await waitFor(() => {
      const updatedInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect((updatedInputs[0] as HTMLInputElement).value).toBe("08:00");
      expect((updatedInputs[1] as HTMLInputElement).value).toBe("17:30");
      expect((updatedInputs[2] as HTMLInputElement).value).toBe("00:00");
    });
  });

  it("preserves saved custom times when loading an existing reminder in edit mode", async () => {
    testState.locationState = {
      editId: "rem-1",
      medicineId: "med-1",
      medicineName: "Amoxicillin 500mg",
      dose: "500mg",
      time: "07:30,15:00,22:30",
      repeat: "custom",
    };

    render(<AddReminderPage />);

    // Times should NOT be overwritten with default 08:00, 16:00, 00:00 on mount
    await waitFor(() => {
      const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect(timeInputs).toHaveLength(3);
      expect((timeInputs[0] as HTMLInputElement).value).toBe("07:30");
      expect((timeInputs[1] as HTMLInputElement).value).toBe("15:00");
      expect((timeInputs[2] as HTMLInputElement).value).toBe("22:30");
    });
  });

  it("handles clearing input gracefully without setting NaN", async () => {
    testState.locationState = { medicineId: "med-1" };

    render(<AddReminderPage />);

    await waitFor(() => {
      const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      expect(timeInputs).toHaveLength(3);
    });

    const timeInputs = screen.getAllByDisplayValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

    // Clear input
    fireEvent.change(timeInputs[0], { target: { value: "" } });

    // Should not crash and first input should be empty string
    expect((timeInputs[0] as HTMLInputElement).value).toBe("");
  });
});
