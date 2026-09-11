import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileWatchdogResolveButton } from "../MobileWatchdogResolveButton";
import { NativeService } from "@/services/nativeService";

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    haptics: {
      impact: vi.fn(),
    },
  },
}));

describe("MobileWatchdogResolveButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders card variant by default with touch-friendly dimensions", () => {
    const handleClick = vi.fn();
    render(<MobileWatchdogResolveButton onClick={handleClick} />);

    const button = screen.getByRole("button", { name: /ask dawagpt to resolve/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("min-h-[48px]");

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(NativeService.haptics.impact).toHaveBeenCalled();
  });

  it("renders floating variant with conflict count badge", () => {
    const handleClick = vi.fn();
    render(
      <MobileWatchdogResolveButton
        variant="floating"
        conflictCount={13}
        onClick={handleClick}
      />
    );

    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("Watchdog Alert")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /ask dawagpt to resolve/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders compact variant with custom label", () => {
    const handleClick = vi.fn();
    render(
      <MobileWatchdogResolveButton
        variant="compact"
        label="Resolve Now"
        onClick={handleClick}
      />
    );

    const button = screen.getByRole("button", { name: /resolve now/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("min-h-[40px]");
  });
});
