import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Trash2, Moon, Bell, Lock, Globe, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { storageMode, setStorageMode, clearAllData, isLoggedIn, logoutUser, userProfile, syncLocalToCloud, isProfessionalMode, setIsProfessionalMode } = useApp();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const handleStorageModeChange = async (mode: "local" | "cloud") => {
    setStorageMode(mode);
    if (mode === "cloud" && isLoggedIn) {
      toast({ title: t("settings.sync_start"), description: t("settings.sync_desc") });
      await syncLocalToCloud();
      toast({ title: t("settings.sync_complete") });
    }
  };

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
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-foreground mb-1"
      >
        {t("settings.title")}
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
            <Globe size={14} /> {t("settings.language_preferences")}
          </h2>
          <div className="flex gap-2">
            <Button
              variant={i18n.language.startsWith('en') ? "default" : "outline"}
              onClick={() => handleLanguageChange('en')}
              className="px-6"
            >
              {t("settings.english")}
            </Button>
            <Button
              variant={i18n.language.startsWith('sw') ? "default" : "outline"}
              onClick={() => handleLanguageChange('sw')}
              className="px-6"
            >
              {t("settings.swahili")}
            </Button>
          </div>
        </div>

        {/* CHW Mode */}
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={60} className="text-primary" />
          </div>
          <h2 className="text-sm font-black text-primary mb-4 flex items-center gap-2 uppercase tracking-tighter">
            <Users size={16} /> Professional Mode
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-bold">Community Health Worker (CHW)</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed max-w-[200px]">Enable this if you manage medications for multiple clients/patients.</p>
            </div>
            <Switch 
               checked={isProfessionalMode} 
               onCheckedChange={setIsProfessionalMode}
            />
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Moon size={14} /> {t("settings.appearance")}
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-card-foreground font-medium">{t("settings.dark_mode")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.theme_desc")}</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Account */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock size={14} /> {t("settings.account")}
          </h2>
          {isLoggedIn ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("settings.signed_in")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  logoutUser();
                  toast({ title: t("settings.logout") });
                }}
              >
                {t("settings.logout")}
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate("/auth")}>
              {t("settings.login_btn")}
            </Button>
          )}
        </div>

        {/* Privacy & Storage */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield size={14} /> {t("settings.storage_privacy")}
          </h2>
          
          <div className="space-y-4">
            <div 
              onClick={() => handleStorageModeChange("local")}
              className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${storageMode === "local" ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">{t("settings.local_only")}</p>
                {storageMode === "local" && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.local_desc")}</p>
            </div>

            <div 
              onClick={() => handleStorageModeChange("cloud")}
              className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${storageMode === "cloud" ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">{t("settings.cloud_sync")}</p>
                {storageMode === "cloud" && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.cloud_desc")}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-card-foreground font-medium">{t("settings.encrypted")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.encrypted_desc")}</p>
            </div>
            <span className="text-xs text-success font-medium bg-success/10 rounded-lg px-2 py-1">{t("settings.active")}</span>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell size={14} /> {t("settings.notifications")}
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-card-foreground font-medium">{t("settings.push_notifs")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.push_desc")}</p>
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
              {t("settings.enable")}
            </Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h2 className="text-sm font-semibold text-destructive mb-4 flex items-center gap-2">
            <Trash2 size={14} /> {t("settings.danger_zone")}
          </h2>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (window.confirm(t("settings.confirm_delete"))) {
                clearAllData();
                toast({ title: t("settings.data_cleared"), variant: "destructive" });
              }
            }}
          >
            {t("settings.clear_data")}
          </Button>
        </div>
      </div>
    </div>
  );
}
