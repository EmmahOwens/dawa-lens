/**
 * App Lifecycle Manager — adapted from lichobile's appMode.ts + app.ts pattern.
 * 
 * Tracks foreground/background state and provides hooks for lifecycle events.
 * When backgrounded: animations pause, polling stops, resources are freed.
 * When foregrounded: state refreshes, connections resume.
 */
import { App, type AppState } from '@capacitor/app';
import { Network, type ConnectionStatus } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

type LifecycleCallback = () => void;

let foreground = true;
let networkStatus: ConnectionStatus = { connected: true, connectionType: 'unknown' };

const onForegroundCallbacks: LifecycleCallback[] = [];
const onBackgroundCallbacks: LifecycleCallback[] = [];
const onNetworkChangeCallbacks: ((connected: boolean) => void)[] = [];

/**
 * Check if the app is currently in the foreground.
 */
export function isForeground(): boolean {
  return foreground;
}

/**
 * Check if the device has a network connection.
 */
export function hasNetwork(): boolean {
  return networkStatus.connected;
}

/**
 * Register a callback for when the app comes to the foreground.
 * Returns an unsubscribe function.
 */
export function onForeground(cb: LifecycleCallback): () => void {
  onForegroundCallbacks.push(cb);
  return () => {
    const idx = onForegroundCallbacks.indexOf(cb);
    if (idx !== -1) onForegroundCallbacks.splice(idx, 1);
  };
}

/**
 * Register a callback for when the app goes to the background.
 * Returns an unsubscribe function.
 */
export function onBackground(cb: LifecycleCallback): () => void {
  onBackgroundCallbacks.push(cb);
  return () => {
    const idx = onBackgroundCallbacks.indexOf(cb);
    if (idx !== -1) onBackgroundCallbacks.splice(idx, 1);
  };
}

/**
 * Register a callback for network status changes.
 * Returns an unsubscribe function.
 */
export function onNetworkChange(cb: (connected: boolean) => void): () => void {
  onNetworkChangeCallbacks.push(cb);
  return () => {
    const idx = onNetworkChangeCallbacks.indexOf(cb);
    if (idx !== -1) onNetworkChangeCallbacks.splice(idx, 1);
  };
}

/**
 * Initialize the lifecycle manager.
 * Call once at app startup. Safe to call in both native and web environments.
 */
export function initLifecycle(): () => void {
  const cleanupFns: (() => void)[] = [];

  // Track foreground/background state
  const appStatePromise = App.addListener('appStateChange', (state: AppState) => {
    if (state.isActive && !foreground) {
      foreground = true;
      onForegroundCallbacks.forEach(cb => {
        try { cb(); } catch (e) { console.warn('[Lifecycle] foreground callback error:', e); }
      });
    } else if (!state.isActive && foreground) {
      foreground = false;
      onBackgroundCallbacks.forEach(cb => {
        try { cb(); } catch (e) { console.warn('[Lifecycle] background callback error:', e); }
      });
    }
  });
  cleanupFns.push(() => appStatePromise.then(h => h.remove()));

  // Track network status
  if (Capacitor.isNativePlatform()) {
    Network.getStatus().then(s => { networkStatus = s; });

    const networkPromise = Network.addListener('networkStatusChange', (s) => {
      const wasConnected = networkStatus.connected;
      networkStatus = s;
      if (wasConnected !== s.connected) {
        onNetworkChangeCallbacks.forEach(cb => {
          try { cb(s.connected); } catch (e) { console.warn('[Lifecycle] network callback error:', e); }
        });
      }
    });
    cleanupFns.push(() => networkPromise.then(h => h.remove()));
  } else {
    // Web fallback
    networkStatus = { connected: navigator.onLine, connectionType: 'unknown' };

    const handleWebOnline = () => {
      const wasConnected = networkStatus.connected;
      networkStatus = { connected: true, connectionType: 'unknown' };
      if (!wasConnected) {
        onNetworkChangeCallbacks.forEach(cb => {
          try { cb(true); } catch (e) { console.warn('[Lifecycle] network callback error:', e); }
        });
      }
    };

    const handleWebOffline = () => {
      const wasConnected = networkStatus.connected;
      networkStatus = { connected: false, connectionType: 'unknown' };
      if (wasConnected) {
        onNetworkChangeCallbacks.forEach(cb => {
          try { cb(false); } catch (e) { console.warn('[Lifecycle] network callback error:', e); }
        });
      }
    };

    window.addEventListener('online', handleWebOnline);
    window.addEventListener('offline', handleWebOffline);

    cleanupFns.push(() => {
      window.removeEventListener('online', handleWebOnline);
      window.removeEventListener('offline', handleWebOffline);
    });
  }

  // Return cleanup function
  return () => {
    cleanupFns.forEach(fn => fn());
    onForegroundCallbacks.length = 0;
    onBackgroundCallbacks.length = 0;
    onNetworkChangeCallbacks.length = 0;
  };
}
