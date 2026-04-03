import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Trash2, Moon, Bell, Lock, Eye, EyeOff, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { privacyMode, setPrivacyMode, clearAllData, isLoggedIn, logoutUser, userProfile } = useApp();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const diffMs = Date.now() - new Date(dob).getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-foreground mb-1"
      >
        {t("settings.title", "Settings")}
      </motion.h1>
      
      {userProfile && (
        <motion.p 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="text-sm text-muted-foreground mb-6"
        >
          {userProfile.name} • {calculateAge(userProfile.dateOfBirth)} years old
        </motion.p>
      )}

      <div className="space-y-3">
        {/* Language */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Globe size={14} /> {t("settings.language_preferences", "Language")}
          </h2>
          <div className="flex gap-2">
            <Button
              variant={i18n.language.startsWith('en') ? "default" : "outline"}
              onClick={() => handleLanguageChange('en')}
              className="px-6"
            >
              {t("settings.english", "English")}
            </Button>
            <Button
              variant={i18n.language.startsWith('sw') ? "default" : "outline"}
              onClick={() => handleLanguageChange('sw')}
              className="px-6"
            >
              {t("settings.swahili", "Kiswahili")}
            </Button>
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Moon size={14} /> Theme & Appearance
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-card-foreground font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">Choose your preferred theme</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Account */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock size={14} /> Account
          </h2>
          {isLoggedIn ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Signed in</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  logoutUser();
                  toast({ title: "Logged out" });
                }}
              >
                Log Out
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate("/auth")}>
              Sign In / Sign Up
            </Button>
          )}
        </div>

        {/* Privacy */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield size={14} /> Privacy
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-card-foreground font-medium">Local-Only Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">Data stays on this device only</p>
            </div>
            <Switch checked={privacyMode} onCheckedChange={setPrivacyMode} />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div>
              <p className="text-sm text-card-foreground font-medium">Encrypted Storage</p>
              <p className="text-xs text-muted-foreground mt-0.5">Medication data is encrypted at rest</p>
            </div>
            <span className="text-xs text-success font-medium bg-success/10 rounded-lg px-2 py-1">Active</span>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell size={14} /> Notifications
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-card-foreground font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">Receive reminders when app is closed</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if ("Notification" in window) {
                  const perm = await Notification.requestPermission();
                  toast({
                    title: perm === "granted" ? "Notifications enabled!" : "Notifications blocked",
                    description: perm === "granted" ? "You'll receive dose reminders" : "Please enable in browser settings",
                  });
                }
              }}
            >
              Enable
            </Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h2 className="text-sm font-semibold text-destructive mb-4 flex items-center gap-2">
            <Trash2 size={14} /> Danger Zone
          </h2>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (window.confirm("Delete all medication data? This cannot be undone.")) {
                clearAllData();
                toast({ title: "All data cleared", variant: "destructive" });
              }
            }}
          >
            Clear All Data
          </Button>
        </div>
      </div>
    </div>
  );
}
