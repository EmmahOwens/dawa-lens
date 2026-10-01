import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StoreUpdateModal from "../StoreUpdateModal";
import { Capacitor } from "@capacitor/core";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock("@capacitor/browser", () => ({
  Browser: {
    open: vi.fn(),
  },
}));

vi.mock("@/plugins/app-updater", () => ({
  default: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    downloadAndInstall: vi.fn(),
  },
}));

describe("StoreUpdateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render (returns null) on web platform / Vercel", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");

    const { container } = render(
      <StoreUpdateModal
        currentVersion="1.7.18"
        newVersion="1.7.19"
        downloadUrl="https://example.com/app.apk"
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/New Update Live!/i)).toBeNull();
  });

  it("does not render on non-Android platforms", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");

    const { container } = render(
      <StoreUpdateModal
        currentVersion="1.7.18"
        newVersion="1.7.19"
        downloadUrl="https://example.com/app.apk"
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders update overlay on native Android platform", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");

    render(
      <StoreUpdateModal
        currentVersion="1.7.18"
        newVersion="1.7.19"
        downloadUrl="https://example.com/app.apk"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("New Update Live!")).toBeInTheDocument();
    expect(screen.getByText("1.7.18")).toBeInTheDocument();
    expect(screen.getByText("1.7.19")).toBeInTheDocument();
    expect(screen.getByText(/Download v1.7.19/i)).toBeInTheDocument();
  });
});
