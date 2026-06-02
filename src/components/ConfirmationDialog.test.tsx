/**
 * Tests for ConfirmationDialog component
 *
 * Covers:
 *   - Unit tests (subtask 1.4)
 *   - Property 4: open prop governs visibility (subtask 1.1) — Validates: Requirements 3.4
 *   - Property 5: dangerBadgeLabel rendered faithfully (subtask 1.2) — Validates: Requirements 1.3, 2.3, 3.6
 *   - Property 3: All itemList entries are rendered (subtask 1.3) — Validates: Requirements 2.4, 3.5
 */

import * as React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import ConfirmationDialog, { type ConfirmationDialogProps } from "./ConfirmationDialog";

// Clean up the DOM after each test to prevent portal leakage across tests
afterEach(() => {
  cleanup();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDialog(props: Partial<ConfirmationDialogProps> = {}) {
  const defaults: ConfirmationDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Delete Record",
    description: "This action cannot be undone.",
    onConfirm: vi.fn(),
  };
  return render(<ConfirmationDialog {...defaults} {...props} />);
}

// ─── Unit tests (subtask 1.4) ─────────────────────────────────────────────────

describe("ConfirmationDialog — unit tests", () => {
  it("renders Confirm button with custom confirmLabel", () => {
    renderDialog({ confirmLabel: "Delete Record" });
    expect(screen.getByRole("button", { name: /delete record/i })).toBeInTheDocument();
  });

  it("renders Cancel button with custom cancelLabel", () => {
    renderDialog({ cancelLabel: "Go Back" });
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
  });

  it("renders default labels when confirmLabel and cancelLabel are omitted", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("clicking Cancel calls onOpenChange(false) and does NOT call onConfirm", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({ onOpenChange, onConfirm });

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clicking Confirm closes dialog first then calls onConfirm", async () => {
    const callOrder: string[] = [];
    const onOpenChange = vi.fn(() => callOrder.push("onOpenChange"));
    const onConfirm = vi.fn(() => callOrder.push("onConfirm"));
    renderDialog({ onOpenChange, onConfirm });

    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    // onOpenChange(false) must be called before onConfirm
    expect(callOrder).toEqual(["onOpenChange", "onConfirm"]);
  });

  it("does NOT render an item list when itemList is omitted", () => {
    renderDialog({ itemList: undefined });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("does NOT render an item list when itemList is an empty array", () => {
    renderDialog({ itemList: [] });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("variant='critical' applies bg-destructive/10 class to header region", () => {
    renderDialog({ variant: "critical" });
    // In jsdom, Tailwind classes appear as literal strings in class attributes.
    // Use getAllByText to locate the dialog role, then inspect its DOM for the
    // tinted header class. We look directly in the document for the class string.
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // The header div inside the dialog should have the bg-destructive/10 class
    const tintedHeader = dialog!.querySelector('[class*="bg-destructive/10"]');
    expect(tintedHeader).not.toBeNull();
  });

  it("variant='default' does NOT apply the destructive tint to header region", () => {
    renderDialog({ variant: "default" });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // The header region (flex-col items-center) should NOT carry the tint
    // (only the badge span has bg-destructive/10 when dangerBadgeLabel is set,
    //  but we didn't pass dangerBadgeLabel here)
    const tintedHeader = dialog!.querySelector(
      '.flex.flex-col.items-center[class*="bg-destructive/10"]'
    );
    expect(tintedHeader).toBeNull();
  });

  it("renders dangerBadgeLabel text when provided", () => {
    renderDialog({ dangerBadgeLabel: "Irreversible" });
    expect(screen.getByText("Irreversible")).toBeInTheDocument();
  });

  it("does NOT render badge when dangerBadgeLabel is omitted", () => {
    renderDialog({ dangerBadgeLabel: undefined });
    expect(screen.queryByText(/irreversible/i)).not.toBeInTheDocument();
  });

  it("renders item list when itemList is provided", () => {
    renderDialog({ itemList: ["All medications", "Dose logs"] });
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("All medications")).toBeInTheDocument();
    expect(screen.getByText("Dose logs")).toBeInTheDocument();
  });
});

// ─── Property 4: open prop governs visibility (subtask 1.1) ──────────────────
// **Validates: Requirements 3.4**

describe("Property 4: Controlled open prop governs visibility", () => {
  it("dialog content is present when open=true and absent when open=false", () => {
    fc.assert(
      fc.property(fc.boolean(), (open) => {
        // Clean DOM before each iteration
        cleanup();

        renderDialog({ open, title: "Test Dialog" });

        if (open) {
          // When open, the dialog role should be present in the DOM
          expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        } else {
          // When closed, AnimatePresence removes the animated content
          expect(document.querySelector('[role="dialog"]')).toBeNull();
        }

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: dangerBadgeLabel rendered faithfully (subtask 1.2) ──────────
// **Validates: Requirements 1.3, 2.3, 3.6**

describe("Property 5: dangerBadgeLabel is rendered faithfully", () => {
  it(
    "the rendered header contains visible badge text matching the provided string",
    () => {
      fc.assert(
        fc.property(
          // Constrain to strings with at least one visible (non-whitespace) character —
          // matching the semantic intent of a visible badge label
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (label) => {
            cleanup();

            renderDialog({ open: true, dangerBadgeLabel: label });

            // Find the badge span inside the dialog by class
            const dialog = document.querySelector('[role="dialog"]');
            expect(dialog).not.toBeNull();

            // The badge is a <span> with the badge styling classes
            const badge = dialog!.querySelector('span[class*="rounded-full"][class*="bg-destructive"]');
            expect(badge).not.toBeNull();
            expect(badge!.textContent).toBe(label);

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    },
    30_000
  );
});

// ─── Property 3: All itemList entries are rendered (subtask 1.3) ─────────────
// **Validates: Requirements 2.4, 3.5**

describe("Property 3: All itemList entries are rendered", () => {
  it(
    "every string in itemList appears as a visible list item",
    () => {
      fc.assert(
        fc.property(
          // Items must have visible content — filter to non-whitespace-only strings
          fc.array(
            fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          (items) => {
            cleanup();

            // Use unique items to avoid duplicate key issues in the rendered list
            const uniqueItems = [...new Set(items)];

            renderDialog({ open: true, itemList: uniqueItems });

            const dialog = document.querySelector('[role="dialog"]');
            expect(dialog).not.toBeNull();

            const list = dialog!.querySelector("ul");
            expect(list).not.toBeNull();

            // Every item must appear as text content in a list item
            const listItems = Array.from(list!.querySelectorAll("li"));
            for (const item of uniqueItems) {
              const found = listItems.some((li) => li.textContent?.trim() === item.trim());
              expect(found).toBe(true);
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    },
    30_000
  );
});
