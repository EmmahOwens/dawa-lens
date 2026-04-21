import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial status
    const checkInitialStatus = async () => {
      const status = await Network.getStatus();
      setIsOffline(!status.connected);
    };
    checkInitialStatus();

    // Listen for changes
    const listener = Network.addListener("networkStatusChange", (status) => {
      setIsOffline(!status.connected);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  const handleRetry = async () => {
    const status = await Network.getStatus();
    if (status.connected) {
      setIsOffline(false);
    }
  };

  return (
    <AnimatePresence>
      {isOffline && (
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
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
              Oops! It looks like you're currently offline. Please check your internet connection to continue using Dawa Lens.
            </p>

            <Button
              onClick={handleRetry}
              className="group w-full rounded-xl transition-all duration-300 active:scale-[0.98]"
              size="lg"
            >
              <RefreshCw size={18} className="mr-2 transition-transform group-hover:rotate-180" />
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
