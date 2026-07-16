import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Shield, Trash2, Moon, Lock, Globe, Users, 
  ArrowRight, User, Mail, Database, Clock, CheckCircle2,
  Calendar
} from "@/lib/icons";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatDistanceToNow } from "date-fns";
import pkg from "../../package.json";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { requestGoogleAccess } from "@/services/googleCalendarService";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { 
    storageMode, setStorageMode, clearAllData, isLoggedIn, logoutUser, 
    userProfile, syncLocalToCloud, isProfessionalMode, setIsProfessionalMode,
    lastSyncTimestamp, updateUserProfile, rememberMe, setRememberMe,
    googleCalendarEnabled, setGoogleCalendarEnabled,
    googleClientId, setGoogleClientId,
    googleCalendarToken, setGoogleCalendarToken,
    googleCalendarTokenExpiry, setGoogleCalendarTokenExpiry,
    isGoogleCalendarTokenValid
  } = useApp();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleConnectCalendar = async () => {
    if (!googleClientId) {
      toast({
        title: "Client ID Required",
        description: "Please enter your Google Client ID to connect.",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Connecting...",
        description: "Please complete the Google authentication in the popup window."
      });
      const authResult = await requestGoogleAccess(googleClientId);
      setGoogleCalendarToken(authResult.accessToken);
      setGoogleCalendarTokenExpiry(Date.now() + authResult.expiresIn * 1000);
      setGoogleCalendarEnabled(true);
      
      toast({
        title: "Google Calendar Connected!",
        description: "Your reminders will now automatically sync."
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Connection Failed",
        description: err.message || "Failed to authenticate with Google.",
        variant: "destructive"
      });
    }
  };

  const handleDisconnectCalendar = () => {
    setGoogleCalendarToken(null);
    setGoogleCalendarTokenExpiry(null);
    setGoogleCalendarEnabled(false);
    toast({
      title: "Google Calendar Disconnected",
      description: "Local reminders will no longer sync to Google Calendar."
    });
  };

  const handleStorageModeChange = async (mode: "local" | "cloud") => {
    if (mode === "cloud" && !isLoggedIn) {
      toast({ 
        title: t("settings.login_required", "Login Required"), 
        description: t("settings.login_cloud_desc", "Please sign in to enable cloud synchronization."),
        variant: "destructive"
      });
      return;
    }

    setStorageMode(mode);
    
    if (mode === "cloud" && isLoggedIn) {
      toast({ title: t("settings.sync_start"), description: t("settings.sync_desc") });
      await syncLocalToCloud();
      toast({ title: t("settings.sync_complete") });
    } else {
      toast({ 
        title: t("settings.local_mode_active", "Local-Only Mode"), 
        description: t("settings.local_active_desc", "Data will now be stored only on this device.")
      });
    }
  };

  const handleLanguageChange = async (lang: string) => {
    i18n.changeLanguage(lang);
    if (isLoggedIn) {
      await updateUserProfile({ language: lang });
    }
    toast({ title: "Language Updated", description: `App language set to ${lang === 'en' ? 'English' : 'Swahili'}` });
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
    <div className="min-h-screen bg-background px-4 pt-4 pb-24">
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
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5 opacity-70">
                {calculateAge(userProfile?.dateOfBirth || null) !== null 
                  ? `${calculateAge(userProfile?.dateOfBirth || null)} ${t("settings.years_old", { age: "" }).trim()}`
                  : "Age not set"}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border/50 relative z-10">
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

        {/* 2. CHW / Professional Hub - Highlighted */}
        <motion.div 
          variants={itemVariants} 
          className={`premium-card border-primary/20 transition-all duration-500 ${isProfessionalMode ? 'bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5' : 'bg-card'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-colors ${isProfessionalMode ? 'bg-primary text-primary-foreground shadow-md' : 'bg-primary/10 text-primary'}`}>
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("settings.professional_hub")}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">CARING MODE</p>
              </div>
            </div>
            <Switch 
               id="professional-mode-switch"
               aria-label={t("settings.chw_label")}
               checked={isProfessionalMode} 
               onCheckedChange={(v) => {
                 setIsProfessionalMode(v);
                 toast({
                   title: v ? "Professional Mode Enabled" : "Professional Mode Disabled",
                   description: v ? "Manage multiple patients in the Client Hub." : "Returning to personal mode.",
                 });
               }}
            />
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {isProfessionalMode 
              ? "You are in Professional Mode. This allows you to manage health records and adherence for multiple clients or family members."
              : t("settings.chw_desc")}
          </p>
          
          <AnimatePresence>
            {isProfessionalMode && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="pt-4 border-t border-primary/10"
              >
                <Button 
                  variant="default" 
                  size="lg" 
                  onClick={() => navigate("/family")}
                  className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[11px] rounded-xl h-12 shadow-lg shadow-primary/20 group"
                >
                  Manage Patients <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 3. Preferences */}
        <div className="grid grid-cols-1 gap-4">
          <motion.div variants={itemVariants} className="premium-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Globe size={18} />
              </div>
              <h3 className="font-bold text-foreground">{t("settings.language_preferences")}</h3>
            </div>
            
            <div className="flex gap-2 p-1 bg-secondary/50 rounded-2xl">
              <button
                onClick={() => handleLanguageChange('en')}
                className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${i18n.language.startsWith('en') ? 'bg-background text-primary shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t("settings.english")}
              </button>
              <button
                onClick={() => handleLanguageChange('sw')}
                className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${i18n.language.startsWith('sw') ? 'bg-background text-primary shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t("settings.swahili")}
              </button>
            </div>
          </motion.div>

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

          {/* Google Calendar Sync Settings */}
          <motion.div variants={itemVariants} className="premium-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Google Calendar Sync</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight opacity-70">Notification Sync</p>
                </div>
              </div>
              <Switch 
                id="google-calendar-switch"
                aria-label="Google Calendar Sync Toggle"
                checked={googleCalendarEnabled}
                disabled={!googleCalendarToken}
                onCheckedChange={(v) => {
                  setGoogleCalendarEnabled(v);
                  toast({
                    title: v ? "Google Calendar Sync Enabled" : "Google Calendar Sync Disabled",
                    description: v ? "Reminders will be pushed to Google Calendar." : "Syncing paused."
                  });
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Link your medication schedules as recurring events on Google Calendar. This enables Google notifications across all your devices.
            </p>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Google Client ID</label>
                <input 
                  type="text" 
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="your-client-id.apps.googleusercontent.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
                <p className="text-[9px] text-muted-foreground leading-snug">
                  Setup a Web Application OAuth Client ID on Google Cloud Console. Set Authorized Redirect URI to match your host domain + <code className="bg-muted px-1 py-0.5 rounded text-[8px]">/google-callback.html</code>.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {googleCalendarToken ? (
                    isGoogleCalendarTokenValid() ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                        Active Connection
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500">
                        Token Expired
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                      Not Connected
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {googleCalendarToken && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDisconnectCalendar}
                      className="rounded-xl text-[10px] font-black uppercase tracking-widest px-4 h-9 border-border/80 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button 
                    variant={googleCalendarToken ? "outline" : "default"}
                    size="sm" 
                    disabled={!googleClientId}
                    onClick={handleConnectCalendar}
                    className="rounded-xl text-[10px] font-black uppercase tracking-widest px-4 h-9"
                  >
                    {googleCalendarToken ? "Reconnect" : "Connect"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 4. Security & Cloud */}
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
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 mb-6 group transition-all hover:bg-muted/50">
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

          <div className="space-y-3 mb-6">
            <button 
              onClick={() => handleStorageModeChange("local")}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${storageMode === "local" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-muted/30 hover:border-border"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-foreground">{t("settings.local_only")}</span>
                {storageMode === "local" && <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{t("settings.local_desc")}</p>
            </button>

            <button 
              onClick={() => handleStorageModeChange("cloud")}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${storageMode === "cloud" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-muted/30 hover:border-border"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-foreground">{t("settings.cloud_sync")}</span>
                {storageMode === "cloud" && <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{t("settings.cloud_desc")}</p>
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Last Synced: {lastSyncTimestamp ? formatDistanceToNow(new Date(lastSyncTimestamp), { addSuffix: true }) : "Never"}
              </span>
            </div>
            {isLoggedIn && (
              <button 
                onClick={() => syncLocalToCloud()}
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                Sync Now
              </button>
            )}
          </div>
        </motion.div>

        {/* 5. Account Management */}
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

        {/* 7. Danger Zone */}
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
