/**
 * useNetworkStatus — Reactive network connectivity hook.
 *
 * Uses @capacitor/network on native platforms for accurate status.
 * Falls back to navigator.onLine on the web.
 *
 * Returns `isOnline: boolean` — true when a network connection is detected.
 */
import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { Capacitor } from "@capacitor/core";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let listenerHandle: Awaited<ReturnType<typeof Network.addListener>> | null =
      null;

    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        // Get initial native status
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        // Subscribe to changes
        listenerHandle = await Network.addListener(
          "networkStatusChange",
          (s) => {
            setIsOnline(s.connected);
          }
        );
      } else {
        // Web fallback — navigator.onLine + browser events
        setIsOnline(navigator.onLine);

        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

        return () => {
          window.removeEventListener("online", onOnline);
          window.removeEventListener("offline", onOffline);
        };
      }
    };

    const cleanup = init();

    return () => {
      cleanup.then((fn) => fn?.());
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);

  return { isOnline };
}
