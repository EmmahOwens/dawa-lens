import * as React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BatteryOptimizationGate from "./BatteryOptimizationGate";
import { Capacitor } from "@capacitor/core";
import { NativeAlarm } from "@/plugins/nativeAlarm";
import { NativeService } from "@/services/nativeService";
import { App as CapApp } from "@capacitor/app";

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

vi.mock("@/plugins/nativeAlarm", () => ({
  NativeAlarm: {
    isBatteryOptimizationIgnored: vi.fn(),
    requestIgnoreBatteryOptimization: vi.fn(),
  },
}));

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    preferences: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

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
            ...props
          }: Record<string, unknown> & { children?: React.ReactNode },
          ref: React.Ref<HTMLElement>
        ) {
          return React.createElement(
            prop as string,
            { ...props, ref },
            children
          );
        }),
    }
  ),
}));

describe("BatteryOptimizationGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children without blocking overlay on web or non-Android platform", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mandatory Permission/i)).not.toBeInTheDocument();
  });

  it("shows blocking overlay on Android when battery optimization is NOT ignored", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.isBatteryOptimizationIgnored).mockResolvedValue({ ignored: false });

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByText(/Mandatory Permission/i)).toBeInTheDocument();
    expect(screen.getByText(/Disable Battery Optimization/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Turn Off Battery Optimization/i })).toBeInTheDocument();
  });

  it("triggers requestIgnoreBatteryOptimization when user taps the turn off button", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.isBatteryOptimizationIgnored).mockResolvedValue({ ignored: false });
    vi.mocked(NativeAlarm.requestIgnoreBatteryOptimization).mockResolvedValue(undefined as any);

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Turn Off Battery Optimization/i })).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /Turn Off Battery Optimization/i });
    fireEvent.click(button);

    expect(NativeAlarm.requestIgnoreBatteryOptimization).toHaveBeenCalledTimes(1);
  });

  it("hides overlay when battery optimization is confirmed as ignored", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.isBatteryOptimizationIgnored).mockResolvedValue({ ignored: true });

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(NativeService.preferences.set).toHaveBeenCalledWith("battery_optimization_exempt", true);
  });

  it("rechecks status when app state changes to active and dismisses overlay once exempt", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.isBatteryOptimizationIgnored).mockResolvedValueOnce({ ignored: false });

    let appStateCallback: (state: { isActive: boolean }) => void = () => {};
    vi.mocked(CapApp.addListener).mockImplementation((event: string, cb: any) => {
      if (event === "appStateChange") {
        appStateCallback = cb;
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Simulate user toggling setting in OS and returning to app
    vi.mocked(NativeAlarm.isBatteryOptimizationIgnored).mockResolvedValueOnce({ ignored: true });

    await act(async () => {
      appStateCallback({ isActive: true });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
