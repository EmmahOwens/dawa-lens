/**
 * OfflineOverlay — Route-aware offline blocker.
 *
 * Shows a full-screen blocking overlay when the device has no internet
 * connection. EXCEPTION: reminder routes (/reminders, /reminders/new) are
 * always accessible offline because all reminder operations are handled
 * locally first and synced to the cloud on reconnect.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { useState } from "react";

/** Routes that are fully operational without internet. */
const OFFLINE_ALLOWED_ROUTES = ["/reminders", "/reminders/new"];

export default function OfflineOverlay() {
  const { isOnline } = useNetworkStatus();
  const location = useLocation();
  const navigate = useNavigate();
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
      if (Capacitor.isNativePlatform()) {
        const status = await Network.getStatus();
        if (!status.connected) {
          // Still offline
        }
      } else {
        if (!navigator.onLine) {
          // Still offline
        }
      }
    } catch (err) {
      console.warn("[OfflineOverlay] Network retry check failed:", err);
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
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="max-w-sm w-full rounded-[20px] border border-border bg-card p-7 text-center shadow-xl"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
              <WifiOff size={26} />
            </div>

            <h2 className="mb-1.5 text-xl font-bold tracking-tight text-foreground">
              Connection Lost
            </h2>
            <p className="mb-6 text-xs leading-relaxed text-muted-foreground font-medium">
              This feature requires an internet connection. Your{" "}
              <span className="font-semibold text-foreground">reminders</span>{" "}
              remain fully accessible offline.
            </p>

            <div className="space-y-2.5">
              <Button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full h-11 rounded-full font-semibold text-xs active:scale-95 transition-all shadow-none"
              >
                <RefreshCw
                  size={15}
                  className={`mr-2 ${retrying ? "animate-spin" : ""}`}
                />
                Try Again
              </Button>

              <Button
                onClick={() => navigate("/reminders")}
                variant="outline"
                className="w-full h-11 rounded-full font-semibold text-xs border border-border active:scale-95 transition-all"
              >
                Go to Reminders
              </Button>
            </div>

            <p className="mt-5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Offline Mode Active
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
