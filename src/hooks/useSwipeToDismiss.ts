import { useRef, useCallback } from "react";

/**
 * Hook that returns touch event handlers for swipe-down-to-dismiss behaviour.
 * Attach the returned handlers to the draggable panel element.
 *
 * @param onDismiss  Callback invoked when the user completes a sufficient downward swipe.
 * @param threshold  Vertical pixels that must be covered in a single swipe gesture
 *                   before the sheet is dismissed (default 80 px).
 */
export function useSwipeToDismiss(onDismiss: () => void, threshold = 80) {
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || startX.current === null) return;

      const deltaY = e.changedTouches[0].clientY - startY.current;
      const deltaX = Math.abs(e.changedTouches[0].clientX - startX.current);

      // Only dismiss if the gesture is primarily vertical and downward
      if (deltaY > threshold && deltaX < deltaY * 0.6) {
        onDismiss();
      }

      startY.current = null;
      startX.current = null;
    },
    [onDismiss, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
