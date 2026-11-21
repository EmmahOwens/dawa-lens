import { useRef, useCallback } from "react";
import { NativeService } from "@/services/nativeService";

/**
 * Native-feel swipe-down-to-dismiss hook with live GPU finger-tracking,
 * upward boundary damping, velocity-based flick dismissal (`> 0.11 px/ms`),
 * multi-touch protection, and zero per-frame React re-renders.
 *
 * Writes `transform: translate3d(...)` directly to the dragged element's inline style
 * (never an inherited CSS variable, never React state) so sheets stay locked at 120fps.
 *
 * @param onDismiss  Callback invoked when the user drags past threshold or flicks downward.
 * @param threshold  Vertical pixels required for slow drag dismissal (default 80 px).
 */
export function useSwipeToDismiss(onDismiss: () => void, threshold = 80) {
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const activeTouchId = useRef<number | null>(null);
  const isVerticalDrag = useRef<boolean>(false);
  const passedThreshold = useRef<boolean>(false);

  const resetTransform = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.transition = "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.transform = "translate3d(0, 0, 0)";
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Ignore additional fingers once a drag has started (multi-touch protection)
    if (activeTouchId.current !== null || e.touches.length === 0) return;
    const touch = e.touches[0];
    activeTouchId.current = touch.identifier;
    startY.current = touch.clientY;
    startX.current = touch.clientX;
    startTime.current = Date.now();
    isVerticalDrag.current = false;
    passedThreshold.current = false;

    const el = e.currentTarget as HTMLElement | null;
    if (el) {
      el.style.transition = "none";
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || startX.current === null) return;
      const touch = Array.from(e.touches).find((t) => t.identifier === activeTouchId.current);
      if (!touch) return;

      const deltaY = touch.clientY - startY.current;
      const deltaX = Math.abs(touch.clientX - startX.current);

      if (!isVerticalDrag.current) {
        if (Math.abs(deltaY) < 6 && deltaX < 6) return;
        if (deltaX > Math.abs(deltaY)) {
          // Horizontal gesture — yield to horizontal handlers
          activeTouchId.current = null;
          startY.current = null;
          startX.current = null;
          return;
        }
        isVerticalDrag.current = true;
      }

      // Apply smooth friction when dragging upward past boundary; 1:1 follow downward
      const offsetY =
        deltaY >= 0 ? deltaY : -Math.pow(Math.abs(deltaY), 0.72);

      const el = e.currentTarget as HTMLElement | null;
      if (el) {
        el.style.transform = `translate3d(0, ${offsetY.toFixed(1)}px, 0)`;
      }

      // Subtle tactile detent once finger crosses the dismissal threshold
      if (deltaY >= threshold && !passedThreshold.current) {
        passedThreshold.current = true;
        void NativeService.haptics.gesture("start");
      } else if (deltaY < threshold && passedThreshold.current) {
        passedThreshold.current = false;
      }
    },
    [threshold]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || startX.current === null) return;

      const touch =
        Array.from(e.changedTouches).find((t) => t.identifier === activeTouchId.current) ||
        e.changedTouches[0];

      const deltaY = touch.clientY - startY.current;
      const deltaX = Math.abs(touch.clientX - startX.current);
      const elapsed = Math.max(1, Date.now() - startTime.current);
      const velocity = deltaY / elapsed; // px/ms

      const el = e.currentTarget as HTMLElement | null;
      const isPrimarilyDownward = deltaY > 0 && deltaX < deltaY * 0.6;
      const shouldDismiss =
        isPrimarilyDownward && (deltaY > threshold || (deltaY > 24 && velocity > 0.11));

      startY.current = null;
      startX.current = null;
      activeTouchId.current = null;
      isVerticalDrag.current = false;
      passedThreshold.current = false;

      if (shouldDismiss) {
        void NativeService.haptics.gesture("end");
        onDismiss();
      } else {
        resetTransform(el);
      }
    },
    [onDismiss, threshold]
  );

  const onTouchCancel = useCallback((e: React.TouchEvent) => {
    startY.current = null;
    startX.current = null;
    activeTouchId.current = null;
    isVerticalDrag.current = false;
    passedThreshold.current = false;
    resetTransform(e.currentTarget as HTMLElement | null);
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
