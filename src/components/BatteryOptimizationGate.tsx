/**
 * BatteryOptimizationGate
 *
 * Renders a fullscreen, non-dismissible overlay on Android until the OS confirms
 * that Dawa Lens is exempt from battery optimization. This is mandatory because
 * Android's Doze mode and per-app battery management can silently suppress
 * AlarmManager alarms, background sync, quotes, and offline dose reminders.
 *
 * Flow:
 *  1. On mount, check if already exempt -> if yes, stay hidden forever.
 *  2. If not exempt, show blocking overlay.
 *  3. "Open Settings" button calls `requestIgnoreBatteryOptimization()` which
 *     triggers the OS system dialog / battery optimization settings.
 *  4. On every App foreground resume (user returning from Settings) or interval poll,
 *     re-check status.
 *  5. When the OS reports the app is whitelisted, the overlay dismisses and the
 *     state is persisted.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { NativeAlarm } from "@/plugins/nativeAlarm";
import { NativeService } from "@/services/nativeService";
import { BatteryCharging, ShieldCheck, Bell, RefreshCw, ChevronDown, HelpCircle, Sparkles, ExternalLink } from "lucide-react";

const PREF_KEY = "battery_optimization_exempt";

async function checkIgnored(): Promise<boolean> {
  try {
    const { ignored } = await NativeAlarm.isBatteryOptimizationIgnored();
    return Boolean(ignored);
  } catch {
    return false;
  }
}

export default function BatteryOptimizationGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAndroid =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const [resolved, setResolved] = useState(!isAndroid);
  const [exempt, setExempt] = useState(!isAndroid);
  const [checking, setChecking] = useState(false);
  const [showOemTips, setShowOemTips] = useState(false);
  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const pollTimersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    pollTimersRef.current.forEach(clearTimeout);
    pollTimersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearTimers();
      listenerRef.current?.remove();
    };
  }, []);

  // ── Initial Check ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAndroid) return;

    let isMounted = true;

    (async () => {
      // 1. Quick cache check
      const cached = await NativeService.preferences.get(PREF_KEY);
      if (cached === true && isMounted) {
        const stillIgnored = await checkIgnored();
        if (stillIgnored && isMounted) {
          setExempt(true);
          setResolved(true);
          return;
        }
        await NativeService.preferences.remove(PREF_KEY);
      }

      // 2. Query OS PowerManager
      const ignored = await checkIgnored();
      if (isMounted) {
        setExempt(ignored);
        setResolved(true);
        if (ignored) {
          await NativeService.preferences.set(PREF_KEY, true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isAndroid]);

  // ── Foreground Listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isAndroid) return;

    let isMounted = true;

    (async () => {
      try {
        const handle = await CapApp.addListener("appStateChange", async ({ isActive }) => {
          if (!isActive || !isMounted) return;
          const ignored = await checkIgnored();
          if (ignored && isMounted) {
            setExempt(true);
            await NativeService.preferences.set(PREF_KEY, true);
          }
        });
        if (isMounted) {
          listenerRef.current = handle;
        } else {
          handle?.remove?.();
        }
      } catch (e) {
        console.warn("Failed to register appStateChange listener:", e);
      }
    })();

    return () => {
      isMounted = false;
      listenerRef.current?.remove?.();
    };
  }, [isAndroid]);

  // ── Trigger OS Settings + Polling ────────────────────────────────────────
  const openSettings = useCallback(async () => {
    setChecking(true);
    clearTimers();

    try {
      await NativeAlarm.requestIgnoreBatteryOptimization();
    } catch (e) {
      console.warn("Failed to request battery optimization:", e);
    }

    // Poll at multiple intervals to catch instant dialog responses
    const intervals = [600, 1200, 2000, 3500, 5000];
    intervals.forEach((delay, idx) => {
      const timer = setTimeout(async () => {
        const ignored = await checkIgnored();
        if (ignored) {
          setExempt(true);
          await NativeService.preferences.set(PREF_KEY, true);
          clearTimers();
        }
        if (idx === intervals.length - 1) {
          setChecking(false);
        }
      }, delay);
      pollTimersRef.current.push(timer);
    });
  }, []);

  const openAutostartSettings = useCallback(async () => {
    setChecking(true);
    try {
      await NativeService.openAutostartSettings();
    } finally {
      setTimeout(() => setChecking(false), 800);
    }
  }, []);

  const manualRecheck = useCallback(async () => {
    setChecking(true);
    try {
      const ignored = await checkIgnored();
      if (ignored) {
        setExempt(true);
        await NativeService.preferences.set(PREF_KEY, true);
      }
    } finally {
      setTimeout(() => setChecking(false), 500);
    }
  }, []);

  return (
    <>
      {children}

      <AnimatePresence>
        {isAndroid && resolved && !exempt && (
          <motion.div
            key="battery-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 overflow-y-auto"
            aria-modal="true"
            role="dialog"
            aria-label="Battery optimization required"
          >
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-amber-500/10 blur-[130px]" />
              <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full bg-primary/15 blur-[120px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center my-auto">
              {/* Animated Battery Icon Badge */}
              <motion.div
                animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-2 border-amber-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-amber-500/20 backdrop-blur-md"
              >
                <BatteryCharging className="w-10 h-10 text-amber-500" strokeWidth={2} />
              </motion.div>

              {/* Title & Description */}
              <h1 className="text-2xl font-black tracking-tight text-foreground mb-2">
                Mandatory Permission
              </h1>
              <p className="text-xs uppercase font-bold tracking-widest text-amber-500 mb-3">
                Disable Battery Optimization & Enable Autostart
              </p>

              <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                To guarantee medication reminders, daily wisdom quotes, and offline safety alerts trigger exactly on time even when your screen is locked or the app is killed, Android requires battery optimization to be turned off.
              </p>

              {/* Benefits Checklist */}
              <div className="w-full space-y-2 mb-6">
                {[
                  { icon: Bell, title: "100% Reliable Reminders & Quotes", desc: "Never miss scheduled doses or daily wisdom alerts" },
                  { icon: ShieldCheck, title: "Offline & Deep Sleep Delivery", desc: "Exact hardware alarms fire on time in Doze mode" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 bg-muted/40 border border-border/60 rounded-2xl p-3.5 text-left shadow-sm backdrop-blur-sm"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2.5">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={openSettings}
                  disabled={checking}
                  className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75"
                  id="battery-gate-open-settings"
                >
                  {checking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Exemption…</span>
                    </>
                  ) : (
                    <>
                      <BatteryCharging className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Turn Off Battery Optimization</span>
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={manualRecheck}
                  disabled={checking}
                  className="w-full py-2.5 text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
                  <span>I already turned it off (Recheck)</span>
                </button>
              </div>

              {/* Brand OEM Guide Toggle */}
              <div className="w-full mt-4 border-t border-border/40 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOemTips(!showOemTips)}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Samsung, Xiaomi, Tecno, or Huawei guide</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOemTips ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showOemTips && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2.5 text-left text-[11px] text-muted-foreground bg-muted/60 rounded-xl p-3 space-y-2 border border-border/50 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={openAutostartSettings}
                        className="w-full py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Phone Manager / Autostart</span>
                      </button>
                      <p><strong className="text-foreground">Samsung:</strong> Apps &gt; Dawa Lens &gt; Battery &gt; Select <em>Unrestricted</em>.</p>
                      <p><strong className="text-foreground">Xiaomi / Redmi / Poco:</strong> App info &gt; Battery saver &gt; Select <em>No restrictions</em> & enable <em>Autostart</em>.</p>
                      <p><strong className="text-foreground">Tecno / Infinix:</strong> Phone Master &gt; Auto-start management &gt; Enable <em>Dawa Lens</em>.</p>
                      <p><strong className="text-foreground">Huawei / Honor:</strong> Battery &gt; App launch &gt; Set Dawa Lens to <em>Manage manually</em>.</p>
                      <p><strong className="text-foreground">Oppo / Vivo:</strong> App info &gt; Battery &gt; Allow <em>Background activity</em> & <em>Auto-launch</em>.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
