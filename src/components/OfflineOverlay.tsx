/**
 * OfflineOverlay — Route-aware offline blocker.
 *
 * Shows a full-screen blocking overlay when the device has no internet
 * connection. EXCEPTION: reminder routes (/reminders, /reminders/new) are
 * always accessible offline because all reminder operations are handled
 * locally first and synced to the cloud on reconnect.
 */
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Network } from "@capacitor/network";
import { useState } from "react";

/** Routes that are fully operational without internet. */
const OFFLINE_ALLOWED_ROUTES = ["/reminders", "/reminders/new"];

export default function OfflineOverlay() {
  const { isOnline } = useNetworkStatus();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

  // Do not block reminder routes — they operate fully offline.
  const isExemptRoute = OFFLINE_ALLOWED_ROUTES.some(
    (route) =>
      location.pathname === route ||
      location.pathname.startsWith(route + "/")
  );

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const status = await Network.getStatus();
      // If we're now connected, the useNetworkStatus hook will update isOnline
      // automatically via the listener. This button is just a manual nudge.
      if (!status.connected) {
        // Still offline — nothing to do, let the listener handle it
      }
    } finally {
      setRetrying(false);
    }
  };

  return (
    <AnimatePresence>
      {!isOnline && !isExemptRoute && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="mx-4 max-w-sm w-full rounded-3xl border border-border bg-card p-8 text-center shadow-2xl"
          >
            <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full bg-primary"
              />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <WifiOff size={32} />
              </div>
            </div>

            <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
              Connection Lost
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              This feature requires an internet connection. Your{" "}
              <span className="font-semibold text-foreground">reminders</span>{" "}
              are still accessible offline.
            </p>

            <Button
              onClick={handleRetry}
              disabled={retrying}
              className="group w-full rounded-xl transition-all duration-300 active:scale-[0.98]"
              size="lg"
            >
              <RefreshCw
                size={18}
                className={`mr-2 transition-transform ${retrying ? "animate-spin" : "group-hover:rotate-180"}`}
              />
              Try Again
            </Button>

            <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
              Offline Mode Active
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
