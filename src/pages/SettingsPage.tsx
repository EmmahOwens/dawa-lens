import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Shield, Trash2, Moon, Lock, 
  User, Mail, Database, CheckCircle2, ShieldCheck, ShieldAlert, RefreshCw,
  Bell, Smartphone, Clock, Zap, ExternalLink, Play, ChevronDown, Sparkles,
  Droplets, Eye, Heart, Activity
} from "@/lib/icons";
import { toast as sonnerToast } from "sonner";
import { soundService } from "@/services/soundService";
import {
  getMovementQuote,
  getMindfulnessQuote,
  getNutritionQuote,
  getEyeRestQuote,
  getOutdoorResetQuote,
  getWindDownQuote,
  getHydrationQuote,
} from "@/services/quotesService";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMoodTheme, MOOD_THEME_META, type MoodLevel } from "@/hooks/useMoodTheme";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { NativeService } from "@/services/nativeService";
import { NotificationSoundSettings } from "@/components/settings/NotificationSoundSettings";
import {
  EDITORIAL_EASE,
  EditorialEyebrow,
} from "@/components/editorial/EditorialPrimitives";

function AdaptiveMoodThemeCard() {
  const { toast } = useToast();
  const { moodThemeEnabled, setMoodThemeEnabled, moodMeta } = useMoodTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary transition-colors">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground">Adaptive Mood Theme</h3>
              {moodThemeEnabled && moodMeta && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <span>{moodMeta.emoji}</span>
                  <span>{moodMeta.themeName}</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight opacity-70">
              {moodThemeEnabled
                ? moodMeta
                  ? `Synced with today's "${moodMeta.label}" mood check-in`
                  : "Adapts UI colors to your daily logged mood"
                : "Using default Dawa Lens palette"}
            </p>
          </div>
        </div>
        <Switch
          id="adaptive-mood-theme-switch"
          aria-label="Toggle adaptive mood theme"
          checked={moodThemeEnabled}
          onCheckedChange={(enabled) => {
            setMoodThemeEnabled(enabled);
            toast({
              title: enabled ? "Adaptive Mood Theme Enabled" : "Adaptive Mood Theme Disabled",
              description: enabled
                ? "UI colors will adapt to your daily mood check-in."
                : "Restored standard Dawa Lens theme colors.",
            });
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-border/40">
        {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => {
          const info = MOOD_THEME_META[level];
          const isActive = moodThemeEnabled && moodMeta?.val === level;
          return (
            <div
              key={level}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-[9px] font-bold uppercase tracking-tighter transition-all ${
                isActive
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-muted/20 border-border/40 text-muted-foreground/80"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${info.swatchClass}`} />
              <span className="truncate">{info.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { 
    storageMode, clearAllData, isLoggedIn, logoutUser, 
    userProfile, updateUserProfile, rememberMe, setRememberMe,
  } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [batteryExempt, setBatteryExempt] = useState<boolean | null>(null);
  const [isCheckingBattery, setIsCheckingBattery] = useState(false);
  const batteryTimersRef = useRef<NodeJS.Timeout[]>([]);

  const [oemInfo, setOemInfo] = useState<{
    brand: string;
    manufacturer: string;
    isTranssion: boolean;
    isXiaomi: boolean;
    isSamsung: boolean;
  } | null>(null);
  const [guardianActive, setGuardianActive] = useState(false);
  const [exactAlarmsAllowed, setExactAlarmsAllowed] = useState(true);
  const [isTogglingGuardian, setIsTogglingGuardian] = useState(false);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [showOemGuidance, setShowOemGuidance] = useState(false);
  const testTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkBatteryStatus = useCallback(async () => {
    const isIgnored = await NativeService.isBatteryOptimizationIgnored();
    setBatteryExempt(isIgnored);
    return isIgnored;
  }, []);

  const fetchReliabilityData = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    try {
      const [info, running, canExact] = await Promise.all([
        NativeService.getDeviceOemInfo?.(),
        NativeService.isGuardianServiceRunning?.(),
        NativeService.canScheduleExactAlarms?.(),
      ]);
      if (info) setOemInfo(info);
      if (running !== undefined) setGuardianActive(running);
      if (canExact !== undefined) setExactAlarmsAllowed(canExact);
    } catch (e) {
      console.warn("Failed to fetch reliability data:", e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    checkBatteryStatus();
    fetchReliabilityData();

    let removeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive && isMounted) {
          checkBatteryStatus();
          fetchReliabilityData();
        }
      }).then((handle) => {
        removeListener = () => handle?.remove?.();
      });
    }

    const onFocus = () => {
      if (isMounted) {
        checkBatteryStatus();
        fetchReliabilityData();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      isMounted = false;
      removeListener?.();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      batteryTimersRef.current.forEach(clearTimeout);
      if (testTimerRef.current) clearInterval(testTimerRef.current);
    };
  }, [checkBatteryStatus, fetchReliabilityData]);

  const handleToggleGuardian = async (enabled: boolean) => {
    setIsTogglingGuardian(true);
    try {
      if (enabled) {
        const success = await NativeService.startGuardianService();
        setGuardianActive(success);
        if (success) {
          toast({
            title: "Adherence Guardian Activated",
            description: "Continuous foreground protection is now active to prevent aggressive battery killers from closing Dawa Lens.",
          });
        }
      } else {
        await NativeService.stopGuardianService();
        setGuardianActive(false);
        toast({
          title: "Adherence Guardian Paused",
          description: "Foreground adherence service stopped.",
        });
      }
    } catch (e) {
      console.warn("Failed to toggle guardian service:", e);
    } finally {
      setIsTogglingGuardian(false);
    }
  };

  const handleTestAlarm = async () => {
    if (testCountdown !== null) return;
    const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
    if (!isNativeAndroid) {
      toast({
        title: "Test Alarm (Android Native)",
        description: "On Android, this schedules an authoritative native alarm for 10 seconds to verify lockscreen/background wakeups.",
      });
      return;
    }

    try {
      const scheduled = await NativeService.scheduleTestAlarm(10);
      if (scheduled) {
        setTestCountdown(10);
        toast({
          title: "Test Alarm Scheduled! (10s)",
          description: "Lock your phone or close the app now. Your test alarm will ring in 10 seconds.",
        });

        let current = 10;
        testTimerRef.current = setInterval(() => {
          current -= 1;
          if (current <= 0) {
            if (testTimerRef.current) clearInterval(testTimerRef.current);
            testTimerRef.current = null;
            setTestCountdown(null);
          } else {
            setTestCountdown(current);
          }
        }, 1000);
      } else {
        toast({
          title: "Scheduling Failed",
          description: "Could not schedule the native test alarm. Check exact alarm permissions.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.warn("Test alarm error:", err);
    }
  };

  const previewIndexRef = useRef(0);
  const handlePreviewWellnessReminder = () => {
    const previews = [
      {
        title: "🚶 Posture & Movement Break",
        body: getMovementQuote(),
        category: "quotes" as const,
      },
      {
        title: "🧘 Mindful Breath & Stress Reset",
        body: getMindfulnessQuote(),
        category: "quotes" as const,
      },
      {
        title: "🥗 Balanced Fuel & Nutrition",
        body: getNutritionQuote(),
        category: "quotes" as const,
      },
      {
        title: "👁️ 20-20-20 Eye Rest Break",
        body: getEyeRestQuote(),
        category: "quotes" as const,
      },
      {
        title: "☀️ Daylight & Fresh Air Pause",
        body: getOutdoorResetQuote(),
        category: "quotes" as const,
      },
      {
        title: "💧 Hydration Reminder",
        body: getHydrationQuote(new Date(), 0),
        category: "hydration" as const,
      },
      {
        title: "🌙 Wind-Down & Sleep Preparation",
        body: getWindDownQuote(),
        category: "quotes" as const,
      },
    ];

    const current = previews[previewIndexRef.current % previews.length];
    previewIndexRef.current++;
    soundService.tryPlayForCategory(current.category);
    sonnerToast.info(current.title, {
      description: current.body,
      duration: 5000,
    });
  };

  const handleConfigureAutostart = async () => {
    toast({
      title: "Opening Auto-Start Settings",
      description: "Enable 'Auto-start' / 'Secondary launch' for Dawa Lens so reminders ring when the app is killed.",
    });
    const launched = await NativeService.openAutostartSettings();
    if (!launched) {
      await NativeService.openBatteryOptimizationSettings();
    }
  };

  const handleConfigureBattery = async () => {
    setIsCheckingBattery(true);
    batteryTimersRef.current.forEach(clearTimeout);
    batteryTimersRef.current = [];

    const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
    if (isNativeAndroid) {
      toast({
        title: "Device Battery Settings",
        description: "Select 'Unrestricted' or 'No restrictions' for Dawa Lens to ensure timely medication reminders.",
      });

      await NativeService.openBatteryOptimizationSettings();

      // Poll periodically to catch return from settings or dialog dismissal
      [800, 1600, 3000, 5000].forEach((delay, idx, arr) => {
        const timer = setTimeout(async () => {
          const ignored = await checkBatteryStatus();
          if (idx === arr.length - 1) {
            setIsCheckingBattery(false);
            if (ignored) {
              toast({
                title: "Battery Optimization Unrestricted",
                description: "Background alarms are now fully protected and reliable.",
              });
            }
          }
        }, delay);
        batteryTimersRef.current.push(timer);
      });
    } else {
      toast({
        title: "Battery Optimization (Android)",
        description: "On Android devices, this opens device settings to allow unrestricted background alarms and reminders.",
      });
      setIsCheckingBattery(false);
    }
  };


  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      if (isNaN(birthDate.getTime())) return null;
      const diffMs = Date.now() - birthDate.getTime();
      const ageDt = new Date(diffMs);
      return Math.abs(ageDt.getUTCFullYear() - 1970);
    } catch (e) {
      return null;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full pt-2 sm:pt-4 pb-12">
      {/* Editorial Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
        className="mb-6"
      >
        <EditorialEyebrow
          index="01"
          label="System Preferences"
          dotColor="bg-primary"
          className="mb-2"
        />
        <h1 className="editorial-display text-[32px] sm:text-[40px] font-medium text-foreground leading-[1.02] mb-2">
          {t("settings.title")}
        </h1>
        <p className="text-[14px] text-muted-foreground max-w-lg">
          Manage your profile, adaptive visual theme, alarm reliability, and data security.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        {/* 1. Luminous Clinical Sapphire Profile Spotlight Card */}
        <motion.div
          variants={itemVariants}
          className="editorial-panel-dark rounded-[26px] p-6 sm:p-7 text-white"
        >
          <div className="editorial-grain" aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="editorial-glass-dark w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0">
                <User size={28} />
              </div>
              <div className="min-w-0">
                <p className="editorial-mono text-[9.5px] text-sky-200/75 mb-1">
                  Active Health Profile
                </p>
                <h2 className="editorial-display text-[24px] sm:text-[28px] font-medium text-white truncate">
                  {userProfile?.name || "Anonymous User"}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="editorial-mono text-[10px] text-white/70">
                    {calculateAge(userProfile?.dateOfBirth || null) !== null
                      ? `${calculateAge(userProfile?.dateOfBirth || null)} ${t("settings.years_old", { age: "" }).trim()}`
                      : "Age not set"}
                  </span>
                  {userProfile?.gender && (
                    <span className="editorial-glass-dark inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2.5 py-0.5 rounded-full text-sky-100">
                      {userProfile.gender.toLowerCase() === "female" ? "Female · Nyabo" : "Male · Ssebo"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4 border-t border-white/15">
              <div className="editorial-glass-dark rounded-2xl px-4 py-3">
                <p className="editorial-mono text-[9px] text-white/55 mb-1 flex items-center gap-1.5">
                  <User size={11} /> Gender
                </p>
                <p className="text-[13px] font-medium text-white capitalize truncate">
                  {userProfile?.gender
                    ? `${userProfile.gender} (${userProfile.gender.toLowerCase() === "female" ? "Addressed as Nyabo" : "Addressed as Ssebo"})`
                    : "Not specified"}
                </p>
              </div>
              {isLoggedIn && (
                <div className="editorial-glass-dark rounded-2xl px-4 py-3">
                  <p className="editorial-mono text-[9px] text-white/55 mb-1 flex items-center gap-1.5">
                    <Mail size={11} /> Account
                  </p>
                  <p className="text-[13px] font-medium text-emerald-200">Synced with Cloud</p>
                </div>
              )}
              <div className="editorial-glass-dark rounded-2xl px-4 py-3">
                <p className="editorial-mono text-[9px] text-white/55 mb-1 flex items-center gap-1.5">
                  <Database size={11} /> Storage
                </p>
                <p className="text-[13px] font-medium text-white">
                  {storageMode === "cloud" ? "Cloud Sync" : "Local Device Only"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 2. Preferences Bento Grid */}
        <div className="grid grid-cols-1 gap-4">
          <motion.div
            variants={itemVariants}
            className="editorial-bento p-5 sm:p-6 bg-gradient-to-br from-amber-50/80 via-card to-orange-50/30 dark:from-amber-950/35 dark:via-card dark:to-orange-950/15 border-amber-500/25 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Moon size={18} />
              </div>
              <div>
                <h3 className="text-[15.5px] font-medium text-foreground">{t("settings.appearance")}</h3>
                <p className="editorial-mono text-[9.5px] text-muted-foreground mt-0.5">Theme Mode</p>
              </div>
            </div>
            <ThemeToggle id="theme-toggle" />
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="editorial-bento p-5 sm:p-6 bg-gradient-to-br from-indigo-50/80 via-card to-sky-50/35 dark:from-indigo-950/35 dark:via-card dark:to-sky-950/20 border-indigo-500/25"
          >
            <AdaptiveMoodThemeCard />
          </motion.div>
        </div>

        {/* 3. Security & Cloud */}
        <motion.div variants={itemVariants} className="editorial-card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-1.5">
              <EditorialEyebrow
                index="02"
                label="Storage & Privacy"
                dotColor="bg-emerald-500"
              />
              <h3 className="editorial-display text-[22px] font-medium text-foreground">
                {t("settings.storage_privacy", "Storage & Security")}
              </h3>
            </div>
            {isLoggedIn && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 editorial-mono text-[9.5px]">
                <CheckCircle2 size={11} />
                Protected
              </div>
            )}
          </div>

          {/* Remember Account Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/50 border border-border/60 group transition-colors hover:border-primary/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Lock size={15} />
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">{t("settings.remember_me", "Remember Account")}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Stay logged in across sessions
                </p>
              </div>
            </div>
            <Switch
              checked={rememberMe}
              onCheckedChange={(v) => {
                setRememberMe(v);
                toast({
                  title: v ? "Persistence Enabled" : "Persistence Disabled",
                  description: v ? "You will stay logged in next time." : "You will be logged out when the app closes.",
                });
              }}
            />
          </div>

          {/* Android Battery Optimization & Reliability Quick Status */}
          <div className="mt-3 p-4 rounded-2xl bg-secondary/50 border border-border/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl border shrink-0 flex items-center justify-center transition-colors ${
                batteryExempt
                  ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400"
              }`}>
                {batteryExempt ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-medium text-foreground">Battery Optimization</p>
                  {batteryExempt !== null && (
                    <span className={`text-[9.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      batteryExempt
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    }`}>
                      {batteryExempt ? "Exempt" : "Action Required"}
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">
                  {batteryExempt
                    ? "Unrestricted · Background alarms & reminders protected"
                    : "Recommended for highest reliability during deep sleep"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isCheckingBattery}
              className={`rounded-full h-8 px-3.5 text-[11px] font-medium shrink-0 transition-colors ${
                batteryExempt
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  : "border-amber-500/35 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              }`}
              onClick={handleConfigureBattery}
            >
              {isCheckingBattery ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" />
                  Checking…
                </span>
              ) : batteryExempt ? (
                "Manage"
              ) : (
                "Configure"
              )}
            </Button>
          </div>
        </motion.div>

        {/* 4. Notification & Background Reliability Center */}
        <motion.div variants={itemVariants} className="editorial-card p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="space-y-1.5">
              <EditorialEyebrow
                index="03"
                label="Reliability Telemetry"
                dotColor="bg-primary"
              />
              <h3 className="editorial-display text-[22px] font-medium text-foreground">
                Notification &amp; Reliability Center
              </h3>
              <p className="text-[13px] text-muted-foreground">
                Ensure alarms fire on time when the app is closed, device is locked, or offline.
              </p>
            </div>

            {oemInfo && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary editorial-mono text-[9.5px] shrink-0">
                <Smartphone size={11} />
                {oemInfo.isTranssion ? "Infinix / Tecno" : oemInfo.isXiaomi ? "Xiaomi / Redmi" : oemInfo.isSamsung ? "Samsung" : oemInfo.brand || "Android"}
              </div>
            )}
          </div>

          {/* Color-Tinted Reliability Status Bento Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
            <div className={`editorial-bento p-3.5 text-center bg-gradient-to-br ${
              exactAlarmsAllowed
                ? "from-emerald-50/85 via-card to-emerald-50/25 dark:from-emerald-950/35 dark:via-card dark:to-emerald-950/15 border-emerald-500/25"
                : "from-amber-50/85 via-card to-amber-50/25 dark:from-amber-950/35 dark:via-card dark:to-amber-950/15 border-amber-500/25"
            }`}>
              <span className="editorial-mono text-[9px] text-muted-foreground block">Exact Alarms</span>
              <span className={`text-[13px] font-semibold mt-1 block ${exactAlarmsAllowed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {exactAlarmsAllowed ? "Exact Timing" : "Approximate"}
              </span>
            </div>

            <div className={`editorial-bento p-3.5 text-center bg-gradient-to-br ${
              batteryExempt
                ? "from-teal-50/85 via-card to-teal-50/25 dark:from-teal-950/35 dark:via-card dark:to-teal-950/15 border-teal-500/25"
                : "from-amber-50/85 via-card to-amber-50/25 dark:from-amber-950/35 dark:via-card dark:to-amber-950/15 border-amber-500/25"
            }`}>
              <span className="editorial-mono text-[9px] text-muted-foreground block">Battery Doze</span>
              <span className={`text-[13px] font-semibold mt-1 block ${batteryExempt ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`}>
                {batteryExempt ? "Unrestricted" : "Optimized"}
              </span>
            </div>

            <div className={`editorial-bento p-3.5 text-center bg-gradient-to-br ${
              guardianActive
                ? "from-sky-50/85 via-card to-sky-50/25 dark:from-sky-950/35 dark:via-card dark:to-sky-950/15 border-sky-500/25"
                : "from-slate-50/85 via-card to-slate-50/25 dark:from-slate-900/40 dark:via-card dark:to-slate-950/15 border-border/80"
            }`}>
              <span className="editorial-mono text-[9px] text-muted-foreground block">Guardian Mode</span>
              <span className={`text-[13px] font-semibold mt-1 block ${guardianActive ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground"}`}>
                {guardianActive ? "Active" : "Off"}
              </span>
            </div>

            <div className="editorial-bento p-3.5 text-center bg-gradient-to-br from-indigo-50/85 via-card to-blue-50/25 dark:from-indigo-950/35 dark:via-card dark:to-blue-950/15 border-indigo-500/25">
              <span className="editorial-mono text-[9px] text-muted-foreground block">Offline Engine</span>
              <span className="text-[13px] font-semibold mt-1 block text-indigo-600 dark:text-indigo-400">
                Authoritative
              </span>
            </div>
          </div>

          {/* Action Buttons: Battery & Autostart */}
          <div className="flex flex-wrap gap-2.5 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleConfigureBattery}
              disabled={isCheckingBattery}
              className="flex-1 rounded-full text-xs font-medium h-9 border-border hover:bg-secondary"
            >
              {isCheckingBattery ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" />
                  Checking…
                </span>
              ) : batteryExempt ? (
                "Battery: Unrestricted ✓"
              ) : (
                "Unrestrict Battery"
              )}
            </Button>

            {(!oemInfo || oemInfo.isTranssion || oemInfo.isXiaomi) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConfigureAutostart}
                className="flex-1 rounded-full text-xs font-medium h-9 border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              >
                <ExternalLink size={13} className="mr-1.5" />
                Auto-Start Settings
              </Button>
            )}
          </div>

          {/* OEM Optimization Guide for aggressive device managers (Infinix, Tecno, Xiaomi) */}
          {(!oemInfo || oemInfo.isTranssion || oemInfo.isXiaomi) && (
            <div className="mb-4 p-4 rounded-2xl bg-secondary/50 border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setShowOemGuidance(!showOemGuidance)}
                className="w-full text-foreground flex items-center justify-between font-medium cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Smartphone size={14} className="text-amber-500" />
                  <span>
                    {oemInfo?.isTranssion
                      ? "Infinix / Tecno (Phone Master & XOS Setup Guide)"
                      : oemInfo?.isXiaomi
                      ? "Xiaomi / Redmi (MIUI & HyperOS Setup Guide)"
                      : "Device Background Reliability Tips"}
                  </span>
                </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showOemGuidance ? "rotate-180" : ""}`} />
              </button>

              {showOemGuidance && (
                <div className="mt-3 pt-3 border-t border-border/50 text-muted-foreground space-y-2 text-[11.5px]">
                  {oemInfo?.isTranssion ? (
                    <>
                      <p className="text-foreground font-medium">
                        To guarantee offline dose alarms ring when Dawa Lens is in the background or closed:
                      </p>
                      <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                        <li>
                          <strong>Enable Auto-start in Phone Master:</strong> Tap the <em>Auto-Start Settings</em> button above to launch Phone Master &gt; Toolbox &gt; <em>Auto-start management</em> &gt; switch <strong>Dawa Lens ON</strong>.
                        </li>
                        <li>
                          <strong>Lock Dawa Lens in Recent Apps:</strong> Open your phone&apos;s Recent Apps view (swipe up &amp; hold), then tap the <strong>Padlock</strong> icon above Dawa Lens so it is not force-stopped when clearing apps.
                        </li>
                        <li>
                          <strong>Disable Screen-off Push Block:</strong> Go to phone <em>Settings &gt; Battery Lab (Power Marathon) &gt; Advanced Settings</em> and turn <strong>OFF</strong> &quot;Screen off push block&quot;.
                        </li>
                      </ol>
                    </>
                  ) : (
                    <>
                      <p className="text-foreground font-medium">
                        To guarantee offline reminders ring when the app is closed:
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
                        <li>
                          Set Battery Saver to <strong>No restrictions</strong> in App info.
                        </li>
                        <li>
                          Enable <strong>Autostart</strong> in Security app &gt; Permissions &gt; Autostart.
                        </li>
                        <li>
                          Lock Dawa Lens in your Recent Apps view with the padlock icon.
                        </li>
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Adherence Guardian Service Toggle */}
          <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl border shrink-0 flex items-center justify-center transition-colors ${
                guardianActive
                  ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 border-primary/20 text-primary"
              }`}>
                <Zap size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-medium text-foreground">Continuous Adherence Guardian</p>
                  {guardianActive && (
                    <span className="editorial-mono text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      Running
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  Keeps a lightweight protection service in the background to prevent aggressive task managers from killing alarms when you swipe away the app.
                </p>
              </div>
            </div>
            <Switch
              checked={guardianActive}
              disabled={isTogglingGuardian}
              onCheckedChange={handleToggleGuardian}
            />
          </div>

          {/* Daily Health & Wellness Reminders Color-Tinted Bento Grid */}
          <div className="mb-4 p-4 sm:p-5 rounded-2xl bg-secondary/40 border border-border/60">
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <Heart size={15} className="text-rose-500" />
                <h4 className="text-[13px] font-medium text-foreground">Active Daily Wellness Reminders</h4>
              </div>
              <span className="editorial-mono text-[9px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                7 Daily Touchpoints
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground mb-3.5 leading-relaxed">
              Dawa Lens delivers evidence-informed wellness nudges throughout your day to support circulation, posture, recovery, eyesight, and calm alongside your medication schedule:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-50/80 via-card to-card dark:from-cyan-950/35 dark:via-card dark:to-card border border-cyan-500/20 flex items-start gap-2.5">
                <Droplets size={15} className="text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-[12px]">Hydration &amp; Metabolism</p>
                  <p className="text-[11px] text-muted-foreground">08:00 &amp; 18:00 · Flushes waste &amp; assists drug dissolution</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50/80 via-card to-card dark:from-emerald-950/35 dark:via-card dark:to-card border border-emerald-500/20 flex items-start gap-2.5">
                <Activity size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-[12px]">Movement &amp; Posture Break</p>
                  <p className="text-[11px] text-muted-foreground">10:00 · Spinal decompression &amp; circulation boost</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50/80 via-card to-card dark:from-amber-950/35 dark:via-card dark:to-card border border-amber-500/20 flex items-start gap-2.5">
                <Sparkles size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-[12px]">Balanced Fuel &amp; Nutrition</p>
                  <p className="text-[11px] text-muted-foreground">12:00 · GI protection &amp; stable midday stamina</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50/80 via-card to-card dark:from-blue-950/35 dark:via-card dark:to-card border border-blue-500/20 flex items-start gap-2.5">
                <Eye size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-[12px]">20-20-20 Eye Rest</p>
                  <p className="text-[11px] text-muted-foreground">14:00 · Relaxes ciliary muscles &amp; screens strain</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-50/80 via-card to-card dark:from-violet-950/35 dark:via-card dark:to-card border border-violet-500/20 flex items-start gap-2.5">
                <Zap size={15} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-[12px]">Mindful Breath &amp; Stress Reset</p>
                  <p className="text-[11px] text-muted-foreground">16:00 · 4-7-8 breathing &amp; cortisol regulation</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50/80 via-card to-card dark:from-indigo-950/35 dark:via-card dark:to-card border border-indigo-500/20 flex items-start gap-2.5">
                <Moon size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-[12px]">Wind-Down &amp; Sleep Hygiene</p>
                  <p className="text-[11px] text-muted-foreground">21:30 · Screen dimming &amp; overnight cellular repair</p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">Hear audio chimes &amp; toast preview:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewWellnessReminder}
                className="h-8 px-3 text-xs font-medium rounded-full hover:bg-secondary"
              >
                <Play size={11} className="mr-1.5 fill-current text-primary" />
                Preview Sample
              </Button>
            </div>
          </div>

          {/* Diagnostic 10-Second Test Alarm */}
          <div className="p-4 rounded-2xl bg-primary/[0.06] border border-primary/20 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-primary shrink-0" />
                <p className="text-[13px] font-medium text-foreground">Alarm Diagnostic Tool</p>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {testCountdown !== null
                  ? `Test alarm will ring in ${testCountdown}s — lock your device now.`
                  : "Schedule a native test alarm in 10 seconds. Tap, then lock your device to verify."}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleTestAlarm}
              disabled={testCountdown !== null}
              className={`rounded-full h-9 px-4 text-xs font-medium shrink-0 transition-all ${
                testCountdown !== null
                  ? "bg-amber-500 text-white animate-pulse"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
              }`}
            >
              {testCountdown !== null ? (
                `Ringing in ${testCountdown}s`
              ) : (
                <>
                  <Play size={11} className="mr-1.5 fill-current" />
                  Test (10s)
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* 5. Notification Sounds & Audio Tones */}
        <motion.div variants={itemVariants} className="editorial-card p-6 sm:p-7">
          <EditorialEyebrow
            index="04"
            label="Audio & Chimes"
            dotColor="bg-sky-500"
            className="mb-4"
          />
          <NotificationSoundSettings />
        </motion.div>

        {/* 6. Account Management */}
        <motion.div variants={itemVariants} className="editorial-card p-6 sm:p-7">
          <div className="space-y-1.5 mb-5">
            <EditorialEyebrow
              index="05"
              label="Session"
              dotColor="bg-indigo-500"
            />
            <h3 className="editorial-display text-[22px] font-medium text-foreground">
              {t("settings.account")}
            </h3>
          </div>

          {isLoggedIn ? (
            <div className="flex items-center justify-between bg-secondary/50 p-4 rounded-2xl border border-border/60">
              <div>
                <p className="text-[14px] font-medium text-foreground">{userProfile?.name?.split(' ')[0] || "User"}</p>
                <p className="text-[12px] text-muted-foreground">{t("settings.signed_in")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-9 px-4 text-xs font-medium border-border hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-95"
                onClick={() => {
                  logoutUser();
                  toast({ title: t("settings.logout") });
                  navigate("/");
                }}
              >
                {t("settings.logout")}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full rounded-full h-11 text-[14px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 active:scale-95"
              onClick={() => navigate("/auth")}
            >
              Sign In to Dawa Lens
            </Button>
          )}
        </motion.div>

        {/* 7. Danger Zone */}
        <motion.div variants={itemVariants} className="editorial-bento p-6 sm:p-7 bg-gradient-to-br from-rose-50/75 via-card to-card dark:from-rose-950/35 dark:via-card dark:to-card border-destructive/25">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-destructive/15 border border-destructive/25 text-destructive flex items-center justify-center shrink-0">
              <Trash2 size={17} />
            </div>
            <h3 className="editorial-display text-[20px] font-medium text-destructive">
              {t("settings.danger_zone")}
            </h3>
          </div>

          <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">
            Deleting your data is permanent. All medications, logs, and profile information stored on this device will be erased.
          </p>

          <Button
            variant="destructive"
            className="w-full rounded-full h-11 text-[13.5px] font-medium active:scale-95"
            onClick={() => setClearDialogOpen(true)}
          >
            {t("settings.clear_data")}
          </Button>
        </motion.div>
      </motion.div>

      {/* Clear All Data Confirmation Dialog */}
      <ConfirmationDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Delete All Data"
        description="All your medications, dose logs, and profile information will be permanently deleted from this device. This cannot be undone."
        variant="critical"
        dangerBadgeLabel="Permanent & Irreversible"
        confirmLabel="Yes, Delete Everything"
        itemList={["All medications", "All dose logs", "Profile information"]}
        onConfirm={async () => {
          await clearAllData();
          toast({ title: t("settings.data_cleared"), variant: "destructive" });
        }}
      />



      <div className="mt-12 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-30">
          Dawa Lens • Secure Health Data
        </p>
      </div>
    </div>
  );
}
