/**
 * Tests for HistoryPage — ConfirmationDialog integration
 *
 * Covers:
 *   - Unit tests (subtask 3.4)
 *   - Property 1: Confirm invokes deleteDoseLog with the correct log ID (subtask 3.1)
 *     **Validates: Requirements 1.6, 4.3**
 *   - Property 2: Medicine name appears in dialog body (subtask 3.2)
 *     **Validates: Requirements 1.2**
 *   - Property 6: Dialog state resets after any close path — HistoryPage variant (subtask 3.3)
 *     **Validates: Requirements 1.7, 1.8, 4.5**
 */

import * as React from "react";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

// ─── Mutable test state accessible inside vi.mock closures ────────────────────

// Using a plain object so the mock closures read the current value dynamically
const testState = {
  scopedDoseLogs: [] as import("@/contexts/AppContext").DoseLog[],
};

const mockDeleteDoseLog = vi.fn();
const mockLogDose = vi.fn();
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

// Simplify framer-motion to avoid JSDOM animation issues while keeping HTML tags valid
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    {} as Record<string, unknown>,
    {
      get: (_target, prop: string) =>
        React.forwardRef(function MotionEl(
          { children, layout: _l, initial: _i, animate: _a, exit: _e, ...rest }:
            React.HTMLAttributes<HTMLElement> & { layout?: unknown; initial?: unknown; animate?: unknown; exit?: unknown },
          ref: React.Ref<HTMLElement>
        ) {
          return React.createElement(prop, { ...rest, ref }, children);
        }),
    }
  ),
}));

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    deleteDoseLog: mockDeleteDoseLog,
    logDose: mockLogDose,
    doseLogs: [],
    medicines: [],
    reminders: [],
    patients: [],
    wellnessLogs: [],
    selectedPatientId: null,
    userProfile: null,
  }),
}));

vi.mock("@/hooks/usePatientScope", () => ({
  // Reads from the shared testState object — always reflects the latest assignment
  usePatientScope: () => ({
    scopedDoseLogs: testState.scopedDoseLogs,
    resolvedPatient: { id: null, name: "You", isOwner: true, type: "self" },
    matchPatient: () => true,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ─── Import component under test (after mocks) ───────────────────────────────

import HistoryPage from "./HistoryPage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDoseLog(
  overrides: Partial<import("@/contexts/AppContext").DoseLog> = {}
): import("@/contexts/AppContext").DoseLog {
  return {
    id: "log-1",
    reminderId: "rem-1",
    medicineName: "Aspirin",
    dose: "500mg",
    scheduledTime: new Date().toISOString(),
    actionTime: new Date().toISOString(),
    action: "taken",
    ...overrides,
  };
}

function renderHistoryPage() {
  return render(<HistoryPage />);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  testState.scopedDoseLogs = [];
});

// ─── Unit tests (subtask 3.4) ─────────────────────────────────────────────────

describe("HistoryPage — unit tests", () => {
  it("clicking the trash icon opens the dialog with the correct medicineName", async () => {
    testState.scopedDoseLogs = [
      makeDoseLog({ id: "log-abc", medicineName: "Ibuprofen" }),
    ];

    renderHistoryPage();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const trashBtn = await screen.findByTitle(/undo|delete record/i);
    fireEvent.click(trashBtn);

    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(
      "Ibuprofen"
    );
  });

  it("clicking the trash icon opens the dialog with the correct logId — confirm calls deleteDoseLog with it", async () => {
    testState.scopedDoseLogs = [
      makeDoseLog({ id: "target-log-id", medicineName: "Paracetamol" }),
    ];
    mockDeleteDoseLog.mockResolvedValue(undefined);

    renderHistoryPage();
    fireEvent.click(await screen.findByTitle(/undo|delete record/i));

    fireEvent.click(await screen.findByRole("button", { name: /delete record/i }));

    await waitFor(() => {
      expect(mockDeleteDoseLog).toHaveBeenCalledTimes(1);
      expect(mockDeleteDoseLog).toHaveBeenCalledWith("target-log-id");
    });
  });

  it("clicking Cancel closes the dialog without calling deleteDoseLog", async () => {
    testState.scopedDoseLogs = [
      makeDoseLog({ id: "log-cancel", medicineName: "Aspirin" }),
    ];

    renderHistoryPage();
    fireEvent.click(await screen.findByTitle(/undo|delete record/i));

    await waitFor(() =>
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    );

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() =>
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    );
    expect(mockDeleteDoseLog).not.toHaveBeenCalled();
  });

  it("shows a success toast after confirming delete", async () => {
    testState.scopedDoseLogs = [
      makeDoseLog({ id: "log-toast", medicineName: "Metformin" }),
    ];
    mockDeleteDoseLog.mockResolvedValue(undefined);

    renderHistoryPage();
    fireEvent.click(await screen.findByTitle(/undo|delete record/i));
    fireEvent.click(await screen.findByRole("button", { name: /delete record/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/log deleted/i) })
      );
    });
  });
});

// ─── Property 1: Confirm invokes deleteDoseLog with the correct log ID ────────
// **Validates: Requirements 1.6, 4.3**

describe("Property 1: Confirm invokes callback with the correct log ID", () => {
  it(
    "deleteDoseLog is called exactly once with the exact log ID for any string ID",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          async (logId) => {
            cleanup();
            vi.clearAllMocks();
            mockDeleteDoseLog.mockResolvedValue(undefined);

            testState.scopedDoseLogs = [
              makeDoseLog({ id: logId, medicineName: "TestMed" }),
            ];

            renderHistoryPage();

            const trashBtn = await screen.findByTitle(/undo|delete record/i);
            fireEvent.click(trashBtn);

            const confirmBtn = await screen.findByRole("button", {
              name: /delete record/i,
            });
            fireEvent.click(confirmBtn);

            await waitFor(() => {
              expect(mockDeleteDoseLog).toHaveBeenCalledTimes(1);
              expect(mockDeleteDoseLog).toHaveBeenCalledWith(logId);
            });

            cleanup();
          }
        ),
        { numRuns: 20 }
      );
    },
    30_000
  );
});

// ─── Property 2: Medicine name appears in dialog body ────────────────────────
// **Validates: Requirements 1.2**

describe("Property 2: Medicine name appears in dialog body", () => {
  it(
    "the dialog description contains the medicine name for any non-empty name string",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          async (medicineName) => {
            cleanup();
            vi.clearAllMocks();

            testState.scopedDoseLogs = [
              makeDoseLog({ id: "log-p2", medicineName }),
            ];

            renderHistoryPage();

            const trashBtn = await screen.findByTitle(/undo|delete record/i);
            fireEvent.click(trashBtn);

            const dialog = await waitFor(() => {
              const el = document.querySelector('[role="dialog"]');
              expect(el).not.toBeNull();
              return el!;
            });

            expect(dialog.textContent).toContain(medicineName);

            cleanup();
          }
        ),
        { numRuns: 20 }
      );
    },
    30_000
  );
});

// ─── Property 6: Dialog state resets after any close path ────────────────────
// **Validates: Requirements 1.7, 1.8, 4.5**

describe("Property 6: Dialog state resets after any close path — HistoryPage variant", () => {
  it(
    "dialog is closed and absent from DOM after cancel, confirm, or overlay close",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("cancel", "confirm", "overlay") as fc.Arbitrary<
            "cancel" | "confirm" | "overlay"
          >,
          async (closePath) => {
            cleanup();
            vi.clearAllMocks();
            mockDeleteDoseLog.mockResolvedValue(undefined);

            testState.scopedDoseLogs = [
              makeDoseLog({ id: "log-p6", medicineName: "P6Med" }),
            ];

            renderHistoryPage();

            // Open the dialog
            const trashBtn = await screen.findByTitle(/undo|delete record/i);
            fireEvent.click(trashBtn);

            await waitFor(() =>
              expect(document.querySelector('[role="dialog"]')).not.toBeNull()
            );

            if (closePath === "cancel") {
              fireEvent.click(
                screen.getByRole("button", { name: /^cancel$/i })
              );
            } else if (closePath === "confirm") {
              fireEvent.click(
                screen.getByRole("button", { name: /delete record/i })
              );
            } else {
              // overlay: Radix fires onOpenChange(false) on overlay pointer events.
              // Trigger via Escape key as the most reliable JSDOM simulation.
              act(() => {
                fireEvent.keyDown(document.body, {
                  key: "Escape",
                  code: "Escape",
                });
              });
            }

            // After any close path the dialog should disappear
            await waitFor(
              () => expect(document.querySelector('[role="dialog"]')).toBeNull(),
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
