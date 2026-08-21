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
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    let listenerHandle: Awaited<ReturnType<typeof Network.addListener>> | null =
      null;
    let isCancelled = false;

    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Get initial native status
          const status = await Network.getStatus();
          if (!isCancelled) {
            setIsOnline(status.connected);
          }

          // Subscribe to changes
          const handle = await Network.addListener(
            "networkStatusChange",
            (s) => {
              if (!isCancelled) {
                setIsOnline(s.connected);
              }
            }
          );

          if (isCancelled) {
            try {
              handle.remove();
            } catch (e) {
              console.warn("[useNetworkStatus] handle.remove failed:", e);
            }
          } else {
            listenerHandle = handle;
          }
        } catch (err) {
          console.warn("[useNetworkStatus] Native network listener error, using web fallback:", err);
          if (!isCancelled) {
            setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
          }
        }
      } else {
        // Web fallback — navigator.onLine + browser events
        if (!isCancelled) {
          setIsOnline(navigator.onLine);
        }

        const onOnline = () => {
          if (!isCancelled) setIsOnline(true);
        };
        const onOffline = () => {
          if (!isCancelled) setIsOnline(false);
        };
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
      isCancelled = true;
      cleanup.then((fn) => fn?.()).catch(() => {});
      if (listenerHandle) {
        try {
          listenerHandle.remove();
        } catch (e) {
          console.warn("[useNetworkStatus] listener removal error:", e);
        }
      }
    };
  }, []);

  return { isOnline };
}

