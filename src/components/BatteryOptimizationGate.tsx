/**
 * BatteryOptimizationGate / ReliabilityCard
 *
 * Actionable, non-blocking readiness card on Android.
 * Replaces the previous impassable fullscreen modal lock.
 *
 * Checks:
 * 1. Notifications permission & channel unblocked state
 * 2. Exact alarm capability (SCHEDULE_EXACT_ALARM)
 * 3. Battery optimization exemption
 *
 * Design:
 * - Does NOT block app interaction or lock out the user.
 * - Displays a clear status breakdown (Ready / Degraded / Paused).
 * - Allows the user to continue in degraded mode or dismiss.
 * - Provides brand-tailored guidance (Xiaomi, Infinix, Samsung) without false claims of immunization.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { NativeAlarm, DeviceOemInfo, ReadinessCheckResult } from "@/plugins/nativeAlarm";
import { NativeService } from "@/services/nativeService";
import {
  BatteryCharging,
  ShieldAlert,
  Bell,
  BellOff,
  RefreshCw,
  ChevronDown,
  HelpCircle,
  ExternalLink,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
} from "lucide-react";

const DISMISSED_KEY = "reliability_card_dismissed_until";
const AUTOSTART_PROMPTED_KEY = "autostart_proactive_prompted_v1";

export default function BatteryOptimizationGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAndroid =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const [readiness, setReadiness] = useState<ReadinessCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showOemTips, setShowOemTips] = useState(false);
  const [oemInfo, setOemInfo] = useState<DeviceOemInfo | null>(null);
  const [autostartPrompted, setAutostartPrompted] = useState(false);
  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

  const fetchReadiness = useCallback(async () => {
    if (!isAndroid) return;
    try {
      setChecking(true);
      const res = await NativeAlarm.checkReadiness();
      setReadiness(res);
    } catch {
      // Fallback
      try {
        const legacy = await NativeAlarm.checkAllPermissions();
        setReadiness(legacy);
      } catch {}
    } finally {
      setChecking(false);
    }
  }, [isAndroid]);

  // ── Fetch OEM Brand Profiling ───────────────────────────────────────────
  useEffect(() => {
    if (!isAndroid) return;
    try {
      NativeService.getDeviceOemInfo?.()?.then?.((info) => {
        if (info) setOemInfo(info);
      });
    } catch {}
  }, [isAndroid]);

  // ── Initial Check & Dismissal Expiry ────────────────────────────────────
  useEffect(() => {
    if (!isAndroid) return;

    (async () => {
      const dismissedUntil = await NativeService.preferences.get(DISMISSED_KEY);
      if (typeof dismissedUntil === "number" && Date.now() < dismissedUntil) {
        setDismissed(true);
      }
      await fetchReadiness();
    })();
  }, [isAndroid, fetchReadiness]);

  // ── Proactive Autostart Prompt for Known-Problem OEMs ────────────────────
  // Xiaomi (MIUI/HyperOS) and Transsion (Infinix/Tecno/itel) and Vivo devices
  // require the user to manually enable "Autostart" in a proprietary settings menu.
  // This is THE primary reason users on these brands never receive background alarms.
  // We proactively open the autostart settings once per install, with an explanatory dialog.
  useEffect(() => {
    if (!isAndroid || !oemInfo) return;

    const isKnownAggressiveOem =
      oemInfo.isTranssion || oemInfo.isXiaomi || oemInfo.isVivo || oemInfo.isHuawei;
    if (!isKnownAggressiveOem) return;

    (async () => {
      const alreadyPrompted = await NativeService.preferences.get(AUTOSTART_PROMPTED_KEY);
      if (alreadyPrompted) {
        setAutostartPrompted(true);
        return;
      }

      // Wait for readiness check before deciding whether to prompt
      if (!readiness) return;
      if (readiness.batteryIgnored && readiness.isFullyCompliant) return;

      // Mark as prompted so this only fires once
      await NativeService.preferences.set(AUTOSTART_PROMPTED_KEY, true);
      setAutostartPrompted(true);

      // Show a brief dialog explaining the need, then open autostart settings
      try {
        const { value: proceed } = await import("@capacitor/dialog").then((m) =>
          m.Dialog.confirm({
            title: "Enable Background Alarms",
            message:
              `Your device (${oemInfo.brand || oemInfo.manufacturer}) requires Autostart permission ` +
              `for Dawa Lens to deliver medication reminders when the app is closed. ` +
              `We'll open the Autostart settings now — please enable Dawa Lens.`,
            okButtonTitle: "Open Settings",
            cancelButtonTitle: "Later",
          })
        );
        if (proceed) {
          await NativeAlarm.openAutostartSettings();
        }
      } catch {
        // Non-fatal; the banner remains visible as a fallback
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAndroid, oemInfo, readiness]);

  // ── Listen for App Foreground Resumes ────────────────────────────────────
  useEffect(() => {
    if (!isAndroid) return;

    const setupListener = async () => {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          fetchReadiness();
        }
      });
      listenerRef.current = handle;
    };

    setupListener();

    return () => {
      listenerRef.current?.remove();
    };
  }, [isAndroid, fetchReadiness]);

  const handleDismiss = async () => {
    // Aggressive OEMs with battery not exempted: only dismiss for 4 hours
    // so users are reminded more frequently to fix the setting.
    const isKnownAggressiveOem =
      oemInfo &&
      (oemInfo.isTranssion || oemInfo.isXiaomi || oemInfo.isVivo || oemInfo.isHuawei || oemInfo.isOppoRealme || oemInfo.isOnePlus);
    const dismissDurationMs =
      isKnownAggressiveOem && !readiness?.batteryIgnored
        ? 4 * 60 * 60 * 1000  // 4 hours for known OEMs without battery exemption
        : 24 * 60 * 60 * 1000; // 24 hours otherwise
    const until = Date.now() + dismissDurationMs;
    await NativeService.preferences.set(DISMISSED_KEY, until);
    setDismissed(true);
  };

  const openSettings = async () => {
    try {
      if (!readiness?.notificationsEnabled || readiness?.channelBlocked) {
        await NativeAlarm.openNotificationSettings();
      } else if (!readiness?.exactAlarmCanSchedule) {
        await NativeAlarm.openExactAlarmSettings();
      } else {
        await NativeAlarm.requestIgnoreBatteryOptimization();
      }
    } catch {
      try {
        await NativeAlarm.openBatteryOptimizationSettings();
      } catch {}
    }
  };

  const openAutostartSettings = async () => {
    try {
      await NativeAlarm.openAutostartSettings();
    } catch {
      try {
        await NativeAlarm.openBatteryOptimizationSettings();
      } catch {}
    }
  };

  const oemBrandLabel = oemInfo
    ? oemInfo.isTranssion
      ? "Infinix / Tecno"
      : oemInfo.isXiaomi
      ? "Xiaomi / Redmi / Poco"
      : oemInfo.isSamsung
      ? "Samsung"
      : oemInfo.isHuawei
      ? "Huawei"
      : oemInfo.isOppoRealme
      ? "Oppo / Realme"
      : oemInfo.isVivo
      ? "Vivo"
      : oemInfo.brand || oemInfo.manufacturer || "Android"
    : "Android";

  const shouldShowBanner =
    isAndroid &&
    readiness !== null &&
    !readiness.isFullyCompliant &&
    (!dismissed || readiness.status === "notifications_paused");

  return (
    <>
      {children}

      <AnimatePresence>
        {shouldShowBanner && (
          <motion.div
            key="reliability-banner"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-20 left-4 right-4 z-[999] max-w-lg mx-auto"
            role="region"
            aria-label="Notification & Reliability Status"
          >
            <div className="bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-4 text-foreground relative overflow-hidden">
              {/* Accent top stripe */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  readiness?.status === "notifications_paused"
                    ? "bg-destructive"
                    : !readiness?.exactAlarmCanSchedule
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
              />

              {/* Header row */}
              <div className="flex items-start justify-between gap-2 pt-1 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      readiness?.status === "notifications_paused"
                        ? "bg-destructive/15 text-destructive"
                        : !readiness?.exactAlarmCanSchedule
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-blue-500/15 text-blue-500"
                    }`}
                  >
                    {readiness?.status === "notifications_paused" ? (
                      <BellOff className="w-4 h-4" />
                    ) : !readiness?.exactAlarmCanSchedule ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <BatteryCharging className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-tight">
                      {readiness?.status === "notifications_paused"
                        ? "Notifications Paused"
                        : !readiness?.exactAlarmCanSchedule
                        ? "Degraded Timing Mode"
                        : "Optimize Alarm Reliability"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {readiness?.status === "notifications_paused"
                        ? "Notifications are disabled in system settings"
                        : !readiness?.exactAlarmCanSchedule
                        ? "Alarms will ring, but delivery window is approximate"
                        : "Prevent battery manager from delaying alarms"}
                    </p>
                  </div>
                </div>

                {readiness?.status !== "notifications_paused" && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Dismiss banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status pills */}
              <div className="grid grid-cols-3 gap-1.5 my-2.5 text-[10.5px]">
                <div
                  className={`p-1.5 rounded-lg border flex flex-col items-center text-center ${
                    readiness?.notificationsEnabled && !readiness?.channelBlocked
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  }`}
                >
                  <span className="font-semibold">Notifications</span>
                  <span>{readiness?.notificationsEnabled && !readiness?.channelBlocked ? "Active" : "Blocked"}</span>
                </div>

                <div
                  className={`p-1.5 rounded-lg border flex flex-col items-center text-center ${
                    readiness?.exactAlarmCanSchedule
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <span className="font-semibold">Exact Alarms</span>
                  <span>{readiness?.exactAlarmCanSchedule ? "Exact" : "Approximate"}</span>
                </div>

                <div
                  className={`p-1.5 rounded-lg border flex flex-col items-center text-center ${
                    readiness?.batteryIgnored
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  <span className="font-semibold">Battery Exemption</span>
                  <span>{readiness?.batteryIgnored ? "Unrestricted" : "Optimized"}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={openSettings}
                  disabled={checking}
                  className="flex-1 py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {readiness?.status === "notifications_paused"
                      ? "Fix Notification Settings"
                      : !readiness?.exactAlarmCanSchedule
                      ? "Allow Exact Alarms"
                      : "Unrestrict Battery"}
                  </span>
                </button>

                {/* Visible Autostart button for known-aggressive OEMs — no longer hidden in accordion */}
                {oemInfo && (oemInfo.isTranssion || oemInfo.isXiaomi || oemInfo.isVivo) && !readiness?.batteryIgnored && (
                  <button
                    type="button"
                    onClick={openAutostartSettings}
                    disabled={checking}
                    className="py-2 px-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Open Autostart Settings"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Autostart</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={fetchReadiness}
                  disabled={checking}
                  className="py-2 px-2.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                  title="Recheck status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Optional OEM Tips accordion */}
              <div className="mt-2 pt-2 border-t border-border/50 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowOemTips(!showOemTips)}
                  className="w-full text-muted-foreground hover:text-foreground flex items-center justify-between font-medium cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-muted-foreground" />
                    <span>Tips for {oemBrandLabel}</span>
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showOemTips ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showOemTips && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-1.5 text-muted-foreground bg-muted/40 p-2.5 rounded-xl overflow-hidden"
                    >
                      <p>
                        Some Android manufacturers close apps in the background. If you notice delayed reminders:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Set Dawa Lens battery usage to <strong>Unrestricted</strong> in Settings &gt; Apps.</li>
                        {(oemInfo?.isTranssion || oemInfo?.isXiaomi) && (
                          <li>
                            Enable <strong>Autostart</strong> in Phone Master or Security app.
                          </li>
                        )}
                        <li>Lock Dawa Lens in your phone's Recent Apps view.</li>
                      </ul>
                      <div className="pt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={openAutostartSettings}
                          className="text-primary hover:underline font-bold text-[10.5px] flex items-center gap-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Open Autostart Settings</span>
                        </button>
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
