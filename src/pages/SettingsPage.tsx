import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Shield, Trash2, Moon, Lock, 
  User, Mail, Database, CheckCircle2, ShieldCheck, ShieldAlert, RefreshCw
} from "@/lib/icons";
import { Bell, Smartphone, Clock, Zap, ExternalLink, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import pkg from "../../package.json";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { NativeService } from "@/services/nativeService";

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
    <div className="pb-8">
      {/* Back Button */}
      <motion.button 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-6 hover:text-foreground transition-colors group"
      >
        <div className="p-1.5 rounded-full bg-secondary group-hover:bg-secondary/80">
          <ArrowLeft size={14} />
        </div>
        {t("common.back")}
      </motion.button>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, preferences, and data security.
        </p>
      </motion.div>
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* 1. Profile Section */}
        <motion.div variants={itemVariants} className="premium-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <User size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                {userProfile?.name || "Anonymous User"}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-70">
                  {calculateAge(userProfile?.dateOfBirth || null) !== null 
                    ? `${calculateAge(userProfile?.dateOfBirth || null)} ${t("settings.years_old", { age: "" }).trim()}`
                    : "Age not set"}
                </p>
                {userProfile?.gender && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    userProfile.gender === "female"
                      ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                  }`}>
                    {userProfile.gender === "female" ? "Female · Nyabo" : "Male · Ssebo"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border/50 relative z-10">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User size={14} />
                <span>Gender</span>
              </div>
              <span className="font-medium text-foreground opacity-90 capitalize">
                {userProfile?.gender 
                  ? `${userProfile.gender} (${userProfile.gender === "female" ? "Addressed as Nyabo" : "Addressed as Ssebo"})`
                  : "Not specified"}
              </span>
            </div>
            {isLoggedIn && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail size={14} />
                  <span>Account</span>
                </div>
                <span className="font-medium text-foreground opacity-80">Synced with Cloud</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database size={14} />
                <span>Storage</span>
              </div>
              <span className="font-medium text-foreground opacity-80 uppercase tracking-tighter">
                {storageMode === "cloud" ? "Cloud Sync" : "Local Device Only"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* 2. Preferences */}
        <div className="grid grid-cols-1 gap-4">

          <motion.div variants={itemVariants} className="premium-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                <Moon size={18} />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("settings.appearance")}</h3>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight opacity-70">Theme Mode</p>
              </div>
            </div>
            <ThemeToggle id="theme-toggle" />
          </motion.div>

        </div>

        {/* 3. Security & Cloud */}
        <motion.div variants={itemVariants} className="premium-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-success/10 text-success">
                <Shield size={18} />
              </div>
              <h3 className="font-bold text-foreground">{t("settings.storage_privacy", "Storage & Security")}</h3>
            </div>
            {isLoggedIn && (
               <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-black uppercase tracking-widest">
                  <CheckCircle2 size={10} />
                  Protected
               </div>
            )}
          </div>

          {/* Remember Account Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 group transition-all hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Lock size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{t("settings.remember_me", "Remember Account")}</p>
                <p className="text-[10px] text-muted-foreground leading-tight uppercase font-bold tracking-tighter opacity-70">
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
          <div className="mt-3 p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3 transition-all hover:bg-muted/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                batteryExempt
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-amber-500/10 text-amber-500"
              }`}>
                {batteryExempt ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">Battery Optimization</p>
                  {batteryExempt !== null && (
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      batteryExempt
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}>
                      {batteryExempt ? "Exempt" : "Action Required"}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight uppercase font-bold tracking-tighter opacity-70 mt-0.5">
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
              className={`rounded-xl h-8 px-3 text-[10px] font-bold shrink-0 transition-colors ${
                batteryExempt
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  : "border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
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
        <motion.div variants={itemVariants} className="premium-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Notification & Reliability Center</h3>
                <p className="text-[11px] text-muted-foreground">
                  Ensure alarms fire on time when the app is closed, device is locked, or offline
                </p>
              </div>
            </div>

            {oemInfo && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
                <Smartphone size={11} />
                {oemInfo.isTranssion ? "Infinix / Tecno" : oemInfo.isXiaomi ? "Xiaomi / Redmi" : oemInfo.isSamsung ? "Samsung" : oemInfo.brand || "Android"}
              </div>
            )}
          </div>

          {/* Status Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col items-center text-center">
              <span className="text-[10px] text-muted-foreground font-semibold">Exact Alarms</span>
              <span className={`text-xs font-bold mt-0.5 ${exactAlarmsAllowed ? "text-emerald-500" : "text-amber-500"}`}>
                {exactAlarmsAllowed ? "Exact Timing" : "Approximate"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col items-center text-center">
              <span className="text-[10px] text-muted-foreground font-semibold">Battery Doze</span>
              <span className={`text-xs font-bold mt-0.5 ${batteryExempt ? "text-emerald-500" : "text-amber-500"}`}>
                {batteryExempt ? "Unrestricted" : "Optimized"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col items-center text-center">
              <span className="text-[10px] text-muted-foreground font-semibold">Guardian Mode</span>
              <span className={`text-xs font-bold mt-0.5 ${guardianActive ? "text-emerald-500" : "text-muted-foreground"}`}>
                {guardianActive ? "Active" : "Off"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col items-center text-center">
              <span className="text-[10px] text-muted-foreground font-semibold">Offline Engine</span>
              <span className="text-xs font-bold mt-0.5 text-emerald-500">
                Authoritative
              </span>
            </div>
          </div>

          {/* Action Buttons: Battery & Autostart */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleConfigureBattery}
              disabled={isCheckingBattery}
              className="flex-1 rounded-xl text-xs font-bold h-9 border-border hover:bg-muted"
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
                className="flex-1 rounded-xl text-xs font-bold h-9 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              >
                <ExternalLink size={13} className="mr-1" />
                Auto-Start Settings
              </Button>
            )}
          </div>

          {/* Adherence Guardian Service Toggle */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 transition-colors ${
                guardianActive ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
              }`}>
                <Zap size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">Continuous Adherence Guardian</p>
                  {guardianActive && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Running
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Keeps a lightweight protection service in the background to prevent aggressive task managers (Infinix Phone Master, Xiaomi MIUI) from killing alarms when you swipe away the app.
                </p>
              </div>
            </div>
            <Switch
              checked={guardianActive}
              disabled={isTogglingGuardian}
              onCheckedChange={handleToggleGuardian}
            />
          </div>

          {/* Diagnostic 10-Second Test Alarm */}
          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-primary shrink-0" />
                <p className="text-xs font-bold text-foreground">Alarm Diagnostic Tool</p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {testCountdown !== null
                  ? `⏰ Test alarm will ring in ${testCountdown}s! Lock your device now.`
                  : "Schedule a native test alarm in 10 seconds. Tap, then lock your device to verify."}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleTestAlarm}
              disabled={testCountdown !== null}
              className={`rounded-xl h-8 px-3 text-xs font-bold shrink-0 transition-all ${
                testCountdown !== null
                  ? "bg-amber-500 text-white animate-pulse"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {testCountdown !== null ? (
                `Ringing in ${testCountdown}s`
              ) : (
                <>
                  <Play size={11} className="mr-1 fill-current" />
                  Test (10s)
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* 4. Account Management */}
        <motion.div variants={itemVariants} className="premium-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-muted text-muted-foreground">
              <Lock size={18} />
            </div>
            <h3 className="font-bold text-foreground">{t("settings.account")}</h3>
          </div>

          {isLoggedIn ? (
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
              <div>
                <p className="text-xs font-bold text-foreground">{userProfile?.name?.split(' ')[0] || "User"}</p>
                <p className="text-[10px] text-muted-foreground">{t("settings.signed_in")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-10 px-6 text-[11px] font-black uppercase tracking-widest border-border/80 hover:bg-destructive/5 hover:text-destructive transition-colors"
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
              className="w-full rounded-2xl h-12 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/10" 
              onClick={() => navigate("/auth")}
            >
              Sign In to Dawa Lens
            </Button>
          )}
        </motion.div>

        {/* 5. Danger Zone */}
        <motion.div variants={itemVariants} className="p-6 rounded-3xl border border-destructive/10 bg-destructive/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <Trash2 size={18} />
            </div>
            <h3 className="font-bold text-destructive tracking-tight">{t("settings.danger_zone")}</h3>
          </div>
          
          <p className="text-[11px] text-muted-foreground mb-6 leading-relaxed">
            Deleting your data is permanent. All medications, logs, and profile information stored on this device will be erased.
          </p>
          
          <Button
            variant="destructive"
            className="w-full rounded-2xl h-12 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-destructive/10"
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
          Dawa Lens v{pkg.version} • Secure Health Data
        </p>
      </div>
    </div>
  );
}
