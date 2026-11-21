import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwipeToDismiss } from "../useSwipeToDismiss";

vi.mock("@/services/nativeService", () => ({
  NativeService: {
    haptics: {
      gesture: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

function makeTouchEvent(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  identifier = 1
): React.TouchEvent {
  const touch = { identifier, clientX, clientY } as Touch;
  return {
    currentTarget: el,
    touches: [touch],
    changedTouches: [touch],
  } as unknown as React.TouchEvent;
}

describe("useSwipeToDismiss", () => {
  it("writes live translate3d transforms directly and dismisses past threshold", () => {
    const onDismiss = vi.fn();
    const el = document.createElement("div");
    const { result } = renderHook(() => useSwipeToDismiss(onDismiss, 80));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(el, 100, 100));
      result.current.onTouchMove(makeTouchEvent(el, 100, 190));
    });

    expect(el.style.transform).toBe("translate3d(0, 90.0px, 0)");

    act(() => {
      result.current.onTouchEnd(makeTouchEvent(el, 100, 195));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("applies upward rubber-band damping and springs back when below threshold", () => {
    const onDismiss = vi.fn();
    const el = document.createElement("div");
    const { result } = renderHook(() => useSwipeToDismiss(onDismiss, 120));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(el, 100, 200));
      result.current.onTouchMove(makeTouchEvent(el, 100, 100)); // upward -100px
    });

    // Damped upward offset should be much smaller in magnitude than 100px
    const match = el.style.transform.match(/translate3d\(0,\s*(-?[\d.]+)px,\s*0\)/);
    expect(match).not.toBeNull();
    const appliedY = Number(match![1]);
    expect(appliedY).toBeLessThan(0);
    expect(Math.abs(appliedY)).toBeLessThan(40);

    act(() => {
      result.current.onTouchEnd(makeTouchEvent(el, 100, 100));
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(el.style.transform).toBe("translate3d(0, 0, 0)");
  });

  it("dismisses on fast downward flick even below distance threshold", () => {
    const onDismiss = vi.fn();
    const el = document.createElement("div");
    const { result } = renderHook(() => useSwipeToDismiss(onDismiss, 120));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(el, 100, 100));
      // 40px downward immediately (< 10ms) -> velocity > 0.11 px/ms
      result.current.onTouchEnd(makeTouchEvent(el, 100, 140));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
