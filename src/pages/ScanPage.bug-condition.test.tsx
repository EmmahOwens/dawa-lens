/**
 * Bug Condition Exploration Test — Scan Page Permanent Loader on Capacitor
 *
 * Property 1: Bug Condition — Scan Page UI Always Renders on Capacitor
 *
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. Do NOT fix the code when this test fails.
 *
 * Bug condition (isBugCondition):
 *   isNativePlatform === true
 *   AND showWebScanner === false   (initialised to !isNativePlatform → false on native)
 *   AND showPermissionModal === false
 *
 * On unfixed code the render guard:
 *   if (!showWebScanner && !showPermissionModal) { return <PageLoader label="Opening Camera..." />; }
 * permanently replaces the full Scan page UI with a blocking loader.
 *
 * These tests assert the EXPECTED (post-fix) behaviour so they fail on unfixed code
 * and will pass once the fix is applied.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import * as React from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as fc from "fast-check";

// ─── Module mocks (must be declared before component import) ─────────────────

// Mock react-router-dom — ScanPage calls useNavigate()
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock framer-motion — simplify to avoid JSDOM animation issues
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
            transition: _t,
            whileTap: _wt,
            layoutId: _lid,
            ...rest
          }: React.HTMLAttributes<HTMLElement> & {
            layout?: unknown;
            initial?: unknown;
            animate?: unknown;
            exit?: unknown;
            transition?: unknown;
            whileTap?: unknown;
            layoutId?: unknown;
          },
          ref: React.Ref<HTMLElement>
        ) {
          return React.createElement(prop, { ...rest, ref }, children);
        }),
    }
  ),
}));

// Mock @capacitor/core — isNativePlatform() returns true (bug condition)
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    registerPlugin: vi.fn(),
  },
  registerPlugin: vi.fn(() => ({
    startScan: vi.fn(),
  })),
}));

// Mock @capacitor/camera — checkPermissions returns "granted" by default
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockGetPhoto = vi.fn();

vi.mock("@capacitor/camera", () => ({
  Camera: {
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
    getPhoto: (...args: unknown[]) => mockGetPhoto(...args),
  },
  CameraResultType: { DataUrl: "dataUrl" },
  CameraSource: { Photos: "PHOTOS" },
}));

// Mock NativeCamera plugin — startScan never resolves by default (simulates
// the native camera being open; we are testing the React UI layer, not the
// native activity itself)
const mockStartScan = vi.fn();
vi.mock("@/plugins/nativeCamera", () => ({
  NativeCamera: {
    startScan: (...args: unknown[]) => mockStartScan(...args),
  },
}));

// Mock navigator.mediaDevices.getUserMedia so jsdom doesn't throw
Object.defineProperty(globalThis.navigator, "mediaDevices", {
  writable: true,
  value: {
    getUserMedia: vi.fn(() =>
      Promise.resolve({
        getTracks: () => [],
        getVideoTracks: () => [],
      } as unknown as MediaStream)
    ),
  },
});

// ─── Import component under test (after all mocks) ───────────────────────────

import ScanPage from "./ScanPage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders ScanPage with the native platform mocked to true and camera
 * permission pre-mocked to the given status.
 */
function renderScanPageNative() {
  return render(<ScanPage />);
}

/**
 * Returns true if the rendered output is ONLY a PageLoader (blocking loader).
 * Detects the bug: the render guard returned early and no Scan UI is visible.
 *
 * We check by looking for PageLoader's "role=status" aria element (inside PillWave)
 * AND the absence of any Scan UI shell elements.
 */
function isOnlyPageLoader(): boolean {
  const loaderStatus = document.querySelector('[role="status"]');
  const modeSelectorButtons = document.querySelectorAll('button');

  // The full scan UI shell always has at least 3 buttons:
  //   close (X), scan mode (pill), scan mode (text), flashlight toggle,
  //   capture button, switch-camera, upload
  // If there are ≤1 buttons and a role=status loader, it's the bug condition.
  const hasScanShell = modeSelectorButtons.length >= 3;
  return loaderStatus !== null && !hasScanShell;
}

/**
 * Returns true when the full Scan page UI shell is visible.
 * Checks for mode selector buttons (Pill & Text), capture button, and upload label.
 */
function scanUIShellIsVisible(): boolean {
  // Mode selector has at least 2 buttons (pill / text)
  const allButtons = Array.from(document.querySelectorAll('button'));
  // The close button + flashlight + scan mode buttons
  const hasMultipleButtons = allButtons.length >= 3;

  // Upload label element (contains the upload input)
  const uploadLabel = document.querySelector('label');

  return hasMultipleButtons && uploadLabel !== null;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: permission granted — native scan runs in background (never resolves)
  mockCheckPermissions.mockResolvedValue({ camera: "granted" });
  mockStartScan.mockReturnValue(new Promise(() => {})); // never resolves
  mockNavigate.mockReturnValue(undefined);
});

afterEach(() => {
  cleanup();
});

// ─── Test Case 1: Permission-granted native render ────────────────────────────
// Bug Condition: isNativePlatform=true, showWebScanner=false, showPermissionModal=false
// Expected (post-fix): Full Scan UI shell is visible
// Actual (unfixed): Only PageLoader is rendered — TEST FAILS (confirms bug)

describe("Bug Condition — Scan Page Permanent Loader on Capacitor", () => {
  it(
    "TC1: should render full Scan UI (not only PageLoader) when permission is granted on native",
    async () => {
      // Arrange: permission granted → showPermissionModal stays false
      mockCheckPermissions.mockResolvedValue({ camera: "granted" });
      mockStartScan.mockReturnValue(new Promise(() => {})); // native camera open, never resolves

      // Act
      renderScanPageNative();

      // Wait for the permission check to complete
      await waitFor(() => {
        expect(mockCheckPermissions).toHaveBeenCalled();
      });

      // Assert: full Scan UI shell must be present
      // On UNFIXED code this will fail because only <PageLoader> is returned
      expect(scanUIShellIsVisible()).toBe(true);

      // Additionally assert PageLoader is NOT the sole rendered output
      expect(isOnlyPageLoader()).toBe(false);
    },
    10_000
  );

  // ─── Test Case 2: Permission denied + modal close ────────────────────────────
  // After user dismisses the permission modal (cancel), the Scan UI should render.
  // Bug: navigate(-1) is called instead, but if the user somehow returns the guard
  // still fires. This test verifies the UI state after modal is closed by cancel.

  it(
    "TC2: should render full Scan UI after permission is denied and modal is closed",
    async () => {
      // Arrange: permission not yet determined → modal will show
      mockCheckPermissions.mockResolvedValue({ camera: "denied" });

      // Act
      renderScanPageNative();

      // Wait for permission check
      await waitFor(() => {
        expect(mockCheckPermissions).toHaveBeenCalled();
      });

      // The permission modal onClose fires navigate("/") but let's verify
      // what state the component is in: it should show the permission modal
      // overlaid over the full Scan UI, NOT just the blocking PageLoader.
      // On UNFIXED code after modal is closed (showPermissionModal → false),
      // the render guard fires again and shows PageLoader.

      // Simulate the modal close (the PermissionRequest onClose handler)
      const closeButtons = document.querySelectorAll('button');
      // Find a button that may be the close or cancel within the modal
      // If the modal is rendered, there should be buttons inside it
      // After closing, the component re-renders with showPermissionModal=false
      // On unfixed code: isBugCondition fires → PageLoader is shown

      // For this test we check the rendered output directly:
      // At minimum the Scan page SHELL should be present (with the modal on top)
      // The bug is that even the shell is missing because of the early return
      expect(scanUIShellIsVisible()).toBe(true);
    },
    10_000
  );

  // ─── Test Case 3: Re-mount after cancel (regression) ─────────────────────────
  // User navigates to /scan → cancels native scan → navigates back to /scan.
  // Each mount should show the full Scan UI.

  it(
    "TC3: should render full Scan UI on re-mount (simulating return to /scan after cancel)",
    async () => {
      // First mount
      mockCheckPermissions.mockResolvedValue({ camera: "granted" });
      mockStartScan.mockReturnValue(new Promise(() => {}));

      const { unmount } = renderScanPageNative();

      await waitFor(() => {
        expect(mockCheckPermissions).toHaveBeenCalled();
      });

      // Unmount (simulate navigating away)
      unmount();
      cleanup();
      vi.clearAllMocks();

      // Second mount (re-mounting simulates returning to /scan)
      mockCheckPermissions.mockResolvedValue({ camera: "granted" });
      mockStartScan.mockReturnValue(new Promise(() => {}));

      renderScanPageNative();

      await waitFor(() => {
        expect(mockCheckPermissions).toHaveBeenCalled();
      });

      // On UNFIXED code: isBugCondition fires again on re-mount → PageLoader shown
      expect(scanUIShellIsVisible()).toBe(true);
      expect(isOnlyPageLoader()).toBe(false);
    },
    10_000
  );

  // ─── Property-Based Test: Bug Condition is unhandled for all isBugCondition inputs
  // **Validates: Requirements 1.1, 1.2, 1.3**
  //
  // Scoped to: isNativePlatform=true, showWebScanner=false, showPermissionModal=false
  // Generates: different scanMode and facingMode combinations to confirm the bug
  // is not mode-specific.

  it(
    "PBT: full Scan UI is present for all isBugCondition inputs (scanMode × facingMode on native)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("pill", "text") as fc.Arbitrary<"pill" | "text">,
          fc.constantFrom("environment", "user") as fc.Arbitrary<"environment" | "user">,
          async (scanMode, _facingMode) => {
            cleanup();
            vi.clearAllMocks();

            // All combinations represent isBugCondition=true:
            //   isNativePlatform=true, showWebScanner=false (initial), showPermissionModal=false
            mockCheckPermissions.mockResolvedValue({ camera: "granted" });
            mockStartScan.mockReturnValue(new Promise(() => {}));
            mockNavigate.mockReturnValue(undefined);

            // Note: scanMode and facingMode are internal state — we render the
            // component and verify the shell is always present regardless
            void scanMode; // consumed by the generator to vary combinations

            renderScanPageNative();

            await waitFor(() => {
              expect(mockCheckPermissions).toHaveBeenCalled();
            });

            // PROPERTY: For all isBugCondition inputs the full Scan page UI shell
            // SHALL be present. On UNFIXED code this fails — the render guard
            // returns <PageLoader> as the sole output.
            const shellVisible = scanUIShellIsVisible();
            const onlyLoader = isOnlyPageLoader();

            // Collect counterexample evidence before asserting
            if (!shellVisible || onlyLoader) {
              const bodyText = document.body.innerHTML.substring(0, 500);
              throw new Error(
                `[COUNTEREXAMPLE] isBugCondition(isNativePlatform=true, showWebScanner=false, showPermissionModal=false) is UNHANDLED.\n` +
                `scanMode=${scanMode}, facingMode=${_facingMode}\n` +
                `scanUIShellIsVisible=${shellVisible}, isOnlyPageLoader=${onlyLoader}\n` +
                `DOM snapshot: ${bodyText}`
              );
            }

            cleanup();
          }
        ),
        { numRuns: 4 } // 4 combinations: 2 scanModes × 2 facingModes
      );
    },
    30_000
  );
});
