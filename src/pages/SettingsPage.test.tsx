/**
 * Tests for SettingsPage — ConfirmationDialog integration
 *
 * Covers:
 *   - Unit tests (subtask 5.2)
 *     - Clicking "Clear All Data" opens the dialog without calling clearAllData
 *     - Clicking Confirm calls clearAllData and shows the success toast
 *     - Clicking Cancel closes the dialog without calling clearAllData
 *     **Validates: Requirements 2.1, 2.6, 2.7, 2.8**
 *
 *   - Property 6: Dialog state resets after any close path — SettingsPage variant (subtask 5.1)
 *     Feature: confirmation-dialogs, Property 6: Dialog state resets after any close path
 *     **Validates: Requirements 2.8, 2.9, 4.5**
 */

import * as React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { Capacitor } from "@capacitor/core";

// ─── Shared mock functions ────────────────────────────────────────────────────

const mockClearAllData = vi.fn();
const mockToast = vi.fn();
const mockIsBatteryOptimizationIgnored = vi.fn().mockResolvedValue(true);
const mockOpenBatteryOptimizationSettings = vi.fn().mockResolvedValue(true);
const mockRequestBatteryOptimizationExemption = vi.fn().mockResolvedValue(undefined);

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
    getPlatform: vi.fn().mockReturnValue("web"),
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    isBatteryOptimizationIgnored: () => mockIsBatteryOptimizationIgnored(),
    openBatteryOptimizationSettings: () => mockOpenBatteryOptimizationSettings(),
    requestBatteryOptimizationExemption: () => mockRequestBatteryOptimizationExemption(),
    preferences: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

// Simplify framer-motion to avoid JSDOM animation issues while keeping HTML tags valid
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
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
            ...rest
          }: React.HTMLAttributes<HTMLElement> & {
            layout?: unknown;
            initial?: unknown;
            animate?: unknown;
            exit?: unknown;
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
    clearAllData: mockClearAllData,
    storageMode: "local",
    setStorageMode: vi.fn(),
    isLoggedIn: false,
    logoutUser: vi.fn(),
    userProfile: null,
    syncLocalToCloud: vi.fn(),
    isProfessionalMode: false,
    setIsProfessionalMode: vi.fn(),
    lastSyncTimestamp: null,
    updateUserProfile: vi.fn(),
    rememberMe: true,
    setRememberMe: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ThemeToggle is visual-only; stub it to avoid context dependencies
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => React.createElement("div", { "data-testid": "theme-toggle" }),
}));

// date-fns used in the component — stub to avoid locale issues in tests
vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "a moment ago",
}));

// ─── Import component under test (after mocks) ───────────────────────────────

import SettingsPage from "./SettingsPage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSettingsPage() {
  return render(<SettingsPage />);
}

async function openClearDialog() {
  await waitFor(() => {
    expect(screen.getByText(/Battery Optimization/i)).toBeInTheDocument();
  });

  const clearBtn = await screen.findByRole("button", {
    name: /clear (all )?data|settings\.clear_data/i,
  });
  fireEvent.click(clearBtn);

  await waitFor(() =>
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  );
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  vi.mocked(Capacitor.getPlatform).mockReturnValue("web");
  mockIsBatteryOptimizationIgnored.mockResolvedValue(true);
  mockOpenBatteryOptimizationSettings.mockResolvedValue(true);
  mockRequestBatteryOptimizationExemption.mockResolvedValue(undefined);
  mockClearAllData.mockClear();
  mockToast.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Unit tests (subtask 5.2) ─────────────────────────────────────────────────

describe("SettingsPage — unit tests", () => {
  it("clicking 'Clear All Data' opens the dialog without calling clearAllData", async () => {
    renderSettingsPage();

    // Dialog should not be present initially
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    await openClearDialog();

    // Dialog is open
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // clearAllData should NOT have been called
    expect(mockClearAllData).not.toHaveBeenCalled();
  });

  it("clicking Confirm calls clearAllData and shows a success toast", async () => {
    mockClearAllData.mockResolvedValue(undefined);
    renderSettingsPage();

    await openClearDialog();

    const confirmBtn = screen.getByRole("button", {
      name: /yes,?\s*delete everything/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockClearAllData).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      );
    });
  });

  it("clicking Cancel closes the dialog without calling clearAllData", async () => {
    renderSettingsPage();

    await openClearDialog();

    const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelBtn);

    await waitFor(() =>
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    );

    expect(mockClearAllData).not.toHaveBeenCalled();
  });

  it("renders 'Exempt' badge and 'Manage' button when battery optimization is exempt", async () => {
    mockIsBatteryOptimizationIgnored.mockResolvedValue(true);
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText(/Battery Optimization/i)).toBeInTheDocument();
      expect(screen.getByText("Exempt")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
    });
  });

  it("renders 'Action Required' badge and 'Configure' button when battery optimization is not exempt", async () => {
    mockIsBatteryOptimizationIgnored.mockResolvedValue(false);
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText(/Battery Optimization/i)).toBeInTheDocument();
      expect(screen.getByText("Action Required")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /configure/i })).toBeInTheDocument();
    });
  });

  it("opens battery optimization settings when configure button is clicked on Android", async () => {
    const { Capacitor } = await import("@capacitor/core");
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    mockIsBatteryOptimizationIgnored.mockResolvedValue(false);

    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /configure/i })).toBeInTheDocument();
    });

    const configureBtn = screen.getByRole("button", { name: /configure/i });
    fireEvent.click(configureBtn);

    await waitFor(() => {
      expect(mockOpenBatteryOptimizationSettings).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Device Battery Settings",
        })
      );
    });
  });
});

// ─── Property 6: Dialog state resets after any close path — SettingsPage variant ─
// Feature: confirmation-dialogs, Property 6: Dialog state resets after any close path
// **Validates: Requirements 2.8, 2.9, 4.5**

describe("Property 6: Dialog state resets after any close path — SettingsPage variant", () => {
  it(
    "clearDialogOpen is false (dialog absent from DOM) after cancel, confirm, or overlay close",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("cancel", "confirm", "overlay") as fc.Arbitrary<
            "cancel" | "confirm" | "overlay"
          >,
          async (closePath) => {
            cleanup();
            vi.clearAllMocks();
            mockClearAllData.mockResolvedValue(undefined);

            renderSettingsPage();

            // Open the dialog
            await openClearDialog();

            // Close via the selected path
            if (closePath === "cancel") {
              fireEvent.click(
                screen.getByRole("button", { name: /^cancel$/i })
              );
            } else if (closePath === "confirm") {
              fireEvent.click(
                screen.getByRole("button", {
                  name: /yes,?\s*delete everything/i,
                })
              );
            } else {
              // overlay: Radix fires onOpenChange(false) on Escape key press
              act(() => {
                fireEvent.keyDown(document.body, {
                  key: "Escape",
                  code: "Escape",
                });
              });
            }

            // After any close path, the dialog must be absent from the DOM
            // (clearDialogOpen === false)
            await waitFor(
              () =>
                expect(document.querySelector('[role="dialog"]')).toBeNull(),
              { timeout: 3000 }
            );

            cleanup();
          }
        ),
        { numRuns: 20 }
      );
    },
    30_000
  );
});
