/**
 * requestIdleCallback utility — adapted from lichobile's pattern.
 * Defers non-critical work to idle browser periods, keeping first paint fast.
 * Falls back to setTimeout(cb, 1) for browsers without native support.
 */

type IdleRequestCallback = (deadline?: IdleDeadline) => void;

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

const requestIdleCallback: (cb: IdleRequestCallback) => number =
  typeof (window as any).requestIdleCallback === 'function'
    ? (window as any).requestIdleCallback.bind(window)
    : (cb: IdleRequestCallback) => window.setTimeout(() => cb(), 1);

const cancelIdleCallback: (id: number) => void =
  typeof (window as any).cancelIdleCallback === 'function'
    ? (window as any).cancelIdleCallback.bind(window)
    : (id: number) => window.clearTimeout(id);

/**
 * Defer a function to run during idle time.
 * Use for non-critical initialization work that shouldn't block rendering.
 */
export function deferToIdle(fn: () => void): number {
  return requestIdleCallback(fn);
}
