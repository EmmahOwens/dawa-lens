import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BottomNav from "../BottomNav";

// Mock framer-motion to avoid animation issues in tests
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

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.home": "Home",
        "nav.reminders": "Reminders",
        "nav.history": "History",
        "nav.settings": "Settings",
      };
      return translations[key] || key;
    },
  }),
}));

const mockAppState = {
  reminders: [],
  doseLogs: [],
  isProfessionalMode: false,
};

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => mockAppState,
}));

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    haptics: {
      impact: vi.fn(),
    },
  },
}));

describe("BottomNav", () => {
  beforeEach(() => {
    mockAppState.isProfessionalMode = false;
  });

  it("renders standard navigation links including History and Settings", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BottomNav />
      </MemoryRouter>
    );

    const historyLink = screen.getByRole("link", { name: /History/i });
    expect(historyLink).toBeInTheDocument();
    expect(historyLink).toHaveAttribute("href", "/history");

    const settingsLink = screen.getByRole("link", { name: /Settings/i });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute("href", "/settings");

    // Must not link to Family
    expect(screen.queryByRole("link", { name: /Family/i })).toBeNull();
  });

  it("does not replace History with Family even if isProfessionalMode is true", () => {
    mockAppState.isProfessionalMode = true;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <BottomNav />
      </MemoryRouter>
    );

    const historyLink = screen.getByRole("link", { name: /History/i });
    expect(historyLink).toBeInTheDocument();
    expect(historyLink).toHaveAttribute("href", "/history");

    expect(screen.queryByRole("link", { name: /Family/i })).toBeNull();
  });
});
