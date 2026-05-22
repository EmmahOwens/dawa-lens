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

export const requestIdleCallback: (cb: IdleRequestCallback) => number =
  typeof (window as any).requestIdleCallback === 'function'
    ? (window as any).requestIdleCallback.bind(window)
    : (cb: IdleRequestCallback) => window.setTimeout(() => cb(), 1);

export const cancelIdleCallback: (id: number) => void =
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

/**
 * Defer a function with a maximum timeout.
 * The function will run during idle time OR after the timeout, whichever comes first.
 */
export function deferToIdleWithTimeout(fn: () => void, timeoutMs: number): number {
  if (typeof (window as any).requestIdleCallback === 'function') {
    return (window as any).requestIdleCallback(fn, { timeout: timeoutMs });
  }
  return window.setTimeout(fn, Math.min(timeoutMs, 100));
}
