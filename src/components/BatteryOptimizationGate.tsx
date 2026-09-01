/**
 * BatteryOptimizationGate
 *
 * Renders a fullscreen, non-dismissible overlay on Android until the OS confirms
 * that Dawa Lens is exempt from battery optimization. This is mandatory because
 * Android's Doze mode and per-app OEM battery management (Infinix Phone Master,
 * Xiaomi Security Center, Samsung Device Care) silently suppress AlarmManager alarms,
 * background sync, quotes, and offline dose reminders.
 *
 * Universal 5-Pillar OEM Support:
 *  - Automatically detects device manufacturer (Transsion/Infinix, Xiaomi, Samsung, Huawei, Oppo, Vivo).
 *  - Tailors the step-by-step instructions to the user's specific phone brand.
 *  - Deep links directly into OEM-specific managers (Phone Master Auto-Start, Security Center).
 *  - Shows visual instructions on locking the app in Recent Tasks (prevents recents swipe force-stop).
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { NativeAlarm, DeviceOemInfo } from "@/plugins/nativeAlarm";
import { NativeService } from "@/services/nativeService";
import {
  BatteryCharging,
  ShieldCheck,
  Bell,
  RefreshCw,
  ChevronDown,
  HelpCircle,
  ExternalLink,
  Lock,
  Smartphone,
  CheckCircle2,
} from "lucide-react";

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
  const [oemInfo, setOemInfo] = useState<DeviceOemInfo | null>(null);
  const [autostartOpened, setAutostartOpened] = useState(false);
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

  // ── Fetch OEM Brand Profiling ───────────────────────────────────────────
  useEffect(() => {
    if (!isAndroid) return;
    try {
      NativeService.getDeviceOemInfo?.()?.then?.((info) => {
        if (info) setOemInfo(info);
      });
    } catch {
      // ignore
    }
  }, [isAndroid]);

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
    setAutostartOpened(true);
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

  const oemBrandLabel = oemInfo?.isTranssion
    ? "Infinix / Tecno"
    : oemInfo?.isXiaomi
    ? "Xiaomi / Redmi / Poco"
    : oemInfo?.isSamsung
    ? "Samsung Galaxy"
    : oemInfo?.isHuawei
    ? "Huawei / Honor"
    : oemInfo?.isOppoRealme
    ? "Oppo / Realme"
    : oemInfo?.isVivo
    ? "Vivo / iQOO"
    : oemInfo?.manufacturer
    ? oemInfo.manufacturer.toUpperCase()
    : "Android";

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
                className="w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-2 border-amber-500/30 flex items-center justify-center mb-5 shadow-2xl shadow-amber-500/20 backdrop-blur-md"
              >
                <BatteryCharging className="w-10 h-10 text-amber-500" strokeWidth={2} />
              </motion.div>

              {/* Title & Description */}
              <h1 className="text-2xl font-black tracking-tight text-foreground mb-1.5">
                Mandatory Permission
              </h1>
              <p className="text-xs uppercase font-bold tracking-widest text-amber-500 mb-2">
                Disable Battery Optimization & Enable Autostart
              </p>

              {/* Detected OEM Tag */}
              {oemInfo && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-semibold mb-3">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{oemBrandLabel} Detected</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                To guarantee medication reminders, daily wisdom quotes, and offline dose alarms trigger exactly on time even when your screen is locked, offline, or swiped away, Android requires background permissions.
              </p>

              {/* Benefits Checklist */}
              <div className="w-full space-y-2 mb-4">
                {[
                  { icon: Bell, title: "100% Reliable Reminders & Quotes", desc: "Never miss scheduled doses or daily wisdom alerts" },
                  { icon: ShieldCheck, title: "Offline & Deep Sleep Delivery", desc: "Exact hardware alarms fire on time in Doze mode" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 bg-muted/40 border border-border/60 rounded-2xl p-3 text-left shadow-sm backdrop-blur-sm"
                  >
                    <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{title}</h4>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Brand-Specific 2-Step Card for Transsion / Xiaomi */}
              {(oemInfo?.isTranssion || oemInfo?.isXiaomi) && (
                <div className="w-full bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 mb-4 text-left">
                  <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Recommended for {oemInfo?.isTranssion ? "Infinix / Tecno" : "Xiaomi"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                    {oemInfo?.isTranssion
                      ? "1. Turn ON Auto-Start in Phone Master. 2. Set Battery to Unrestricted. 3. Lock Dawa Lens in Recent Apps."
                      : "1. Enable Autostart in Security Center. 2. Set Battery Saver to No Restrictions."}
                  </p>
                  <button
                    type="button"
                    onClick={openAutostartSettings}
                    disabled={checking}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-500 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>
                      {autostartOpened
                        ? "Re-open Auto-Start Settings"
                        : oemInfo?.isTranssion
                        ? "Open Phone Master (Auto-Start)"
                        : "Open Security Center (Autostart)"}
                    </span>
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full space-y-2.5">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={openSettings}
                  disabled={checking}
                  className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75"
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
                  className="w-full py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
                  <span>I already turned it off (Recheck)</span>
                </button>
              </div>

              {/* Brand OEM Guide Toggle */}
              <div className="w-full mt-3 border-t border-border/40 pt-2.5">
                <button
                  type="button"
                  onClick={() => setShowOemTips(!showOemTips)}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Manufacturer-specific instructions</span>
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={openAutostartSettings}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Autostart</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try { await NativeService.openExactAlarmSettings(); } catch (e) {}
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Exact Alarms</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try { await NativeService.openAppInfoSettings(); } catch (e) {}
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-muted/80 hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>App Info</span>
                        </button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <p><strong className="text-foreground">Infinix / Tecno:</strong> Phone Master &gt; Auto-start management &gt; Enable <em>Dawa Lens</em>. Then swipe down on Dawa Lens card in Recent Tasks and tap the <strong>Padlock</strong> icon.</p>
                        <p><strong className="text-foreground">Xiaomi / Redmi / Poco:</strong> Security app &gt; Manage apps &gt; Dawa Lens &gt; <em>Autostart ON</em> and Battery saver &gt; <em>No restrictions</em>.</p>
                        <p><strong className="text-foreground">Samsung:</strong> Settings &gt; Apps &gt; Dawa Lens &gt; Battery &gt; Select <em>Unrestricted</em>.</p>
                        <p><strong className="text-foreground">Huawei / Honor:</strong> Optimizer / Settings &gt; Battery &gt; App launch &gt; Set Dawa Lens to <em>Manage manually</em> (enable all 3 switches).</p>
                        <p><strong className="text-foreground">Oppo / Realme / OnePlus:</strong> Settings &gt; Battery &gt; More settings &gt; App battery management &gt; Allow <em>Background activity</em> & <em>Auto-launch</em>.</p>
                        <p><strong className="text-foreground">Vivo / iQOO:</strong> Settings &gt; Battery &gt; High background power consumption &gt; Enable <em>Dawa Lens</em>.</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-500 text-[10.5px] pt-1 border-t border-border/30">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span><strong>Tip:</strong> In Recent Apps, pull down on the Dawa Lens card to lock it in memory.</span>
                      </div>
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

