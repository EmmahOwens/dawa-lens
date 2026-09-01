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
    checkReadiness: vi.fn(),
    checkAllPermissions: vi.fn(),
    isBatteryOptimizationIgnored: vi.fn(),
    requestIgnoreBatteryOptimization: vi.fn(),
    openBatteryOptimizationSettings: vi.fn(),
    openAutostartSettings: vi.fn(),
    openExactAlarmSettings: vi.fn(),
    openNotificationSettings: vi.fn(),
  },
}));

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    preferences: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    getDeviceOemInfo: vi.fn().mockResolvedValue({
      manufacturer: "transsion",
      brand: "infinix",
      model: "hot 10",
      isTranssion: true,
      isXiaomi: false,
      isSamsung: false,
      isHuawei: false,
      isOppoRealme: false,
      isOnePlus: false,
      isVivo: false,
      isAsus: false,
    }),
    openAutostartSettings: vi.fn().mockResolvedValue(true),
    openExactAlarmSettings: vi.fn().mockResolvedValue(true),
    openAppInfoSettings: vi.fn().mockResolvedValue(true),
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
    vi.mocked(NativeService.getDeviceOemInfo).mockResolvedValue({
      manufacturer: "transsion",
      brand: "infinix",
      model: "hot 10",
      isTranssion: true,
      isXiaomi: false,
      isSamsung: false,
      isHuawei: false,
      isOppoRealme: false,
      isOnePlus: false,
      isVivo: false,
      isAsus: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children without banner on web or non-Android platform", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("renders children always (non-blocking) and shows reliability banner on Android when not fully compliant", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.checkReadiness).mockResolvedValue({
      notificationsEnabled: true,
      channelBlocked: false,
      exactAlarmCanSchedule: false,
      batteryIgnored: false,
      status: "degraded_inexact",
      isFullyCompliant: false,
    });

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    // App content MUST remain accessible and never be blocked!
    expect(screen.getByTestId("app-content")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /Notification & Reliability Status/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Degraded Timing Mode/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Allow Exact Alarms/i })).toBeInTheDocument();
  });

  it("triggers settings when action button is tapped", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.checkReadiness).mockResolvedValue({
      notificationsEnabled: true,
      channelBlocked: false,
      exactAlarmCanSchedule: true,
      batteryIgnored: false,
      status: "ready_exact",
      isFullyCompliant: false,
    });
    vi.mocked(NativeAlarm.requestIgnoreBatteryOptimization).mockResolvedValue(undefined as any);

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Unrestrict Battery/i })).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /Unrestrict Battery/i });
    fireEvent.click(button);

    expect(NativeAlarm.requestIgnoreBatteryOptimization).toHaveBeenCalledTimes(1);
  });

  it("hides banner when readiness is confirmed as fully compliant", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.checkReadiness).mockResolvedValue({
      notificationsEnabled: true,
      channelBlocked: false,
      exactAlarmCanSchedule: true,
      batteryIgnored: true,
      status: "ready_exact",
      isFullyCompliant: true,
    });

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    expect(screen.getByTestId("app-content")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });

  it("allows user to dismiss banner without blocking access to app", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeService.preferences.get).mockResolvedValue(null);
    vi.mocked(NativeAlarm.checkReadiness).mockResolvedValue({
      notificationsEnabled: true,
      channelBlocked: false,
      exactAlarmCanSchedule: false,
      batteryIgnored: false,
      status: "degraded_inexact",
      isFullyCompliant: false,
    });

    render(
      <BatteryOptimizationGate>
        <div data-testid="app-content">Protected Content</div>
      </BatteryOptimizationGate>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Dismiss banner/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Dismiss banner/i }));

    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(NativeService.preferences.set).toHaveBeenCalled();
  });
});
