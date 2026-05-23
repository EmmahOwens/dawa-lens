import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { motion, AnimatePresence } from "framer-motion";
import { NativeBiometric } from "@/plugins/nativeBiometric";

interface BiometricGateProps {
  children: React.ReactNode;
}

/**
 * BiometricGate — wraps protected content behind device biometrics.
 *
 * On native platforms: checks biometric availability on mount. If available,
 * immediately prompts for authentication and shows a blurred lock screen until
 * the user authenticates. Re-authenticates when the app returns from background.
 *
 * On web: renders children immediately (biometrics not available in browser).
 * Fails open if biometrics are not configured on the device.
 */
export default function BiometricGate({ children }: BiometricGateProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const authenticate = useCallback(async () => {
    if (!biometricAvailable || isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const { success } = await NativeBiometric.authenticate({
        reason: "Verify your identity to access your health data",
        fallbackTitle: "Use PIN / Password",
      });
      if (success) setIsLocked(false);
    } catch {
      setIsLocked(false); // Fail open — don't lock out the user
    } finally {
      setIsAuthenticating(false);
    }
  }, [biometricAvailable, isAuthenticating]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const init = async () => {
      try {
        const { available } = await NativeBiometric.isAvailable();
        setBiometricAvailable(available);
        if (available) {
          setIsLocked(true);
          // Slight delay so the UI renders before showing the system prompt
          setTimeout(authenticate, 300);
        }
      } catch {
        // Biometrics not available — proceed without lock
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount — authenticate is captured by closure intentionally

  // Re-lock when app returns from background
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !biometricAvailable) return;
    const listener = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive && !isLocked) {
        setIsLocked(true);
        setTimeout(authenticate, 300);
      }
    });
    return () => {
      listener.then((l) => l.remove());
    };
  }, [biometricAvailable, isLocked, authenticate]);

  // On web or when biometrics are unavailable, render children directly
  if (!Capacitor.isNativePlatform() || !biometricAvailable) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.1,
                type: "spring",
                stiffness: 300,
                damping: 25,
              }}
              className="flex flex-col items-center gap-6 text-center px-8"
            >
              {/* Lock icon */}
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-primary"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold text-foreground">Dawa Lens</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Authenticate to access your health data
                </p>
              </div>

              <button
                onClick={authenticate}
                disabled={isAuthenticating}
                className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm
                           disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-primary/25"
              >
                {isAuthenticating ? "Verifying…" : "Unlock with Biometrics"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
