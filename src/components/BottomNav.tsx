import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Bell, History, Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";

export default function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const { reminders, doseLogs, isProfessionalMode } = useApp();

  // Count reminders that haven't been logged today
  const pendingReminderCount = reminders.filter((r) => {
    if (!r.enabled) return false;
    return !doseLogs.some(
      (l) =>
        l.reminderId === r.id &&
        new Date(l.actionTime).toDateString() === new Date().toDateString()
    );
  }).length;

  const navItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/reminders", icon: Bell, label: t("nav.reminders", "Reminders"), badge: pendingReminderCount > 0 },
    { to: isProfessionalMode ? "/family" : "/history", icon: isProfessionalMode ? Users : History, label: isProfessionalMode ? "Family" : t("nav.history") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 mx-auto max-w-[22rem] md:hidden px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between rounded-[2rem] frost-nav px-4 py-2.5 relative gpu-accel">
        {/* Left Side Items */}
        <div className="flex flex-1 justify-around items-center">
          {navItems.slice(0, 2).map((item) => (
            <NavItem key={item.to} {...item} active={location.pathname === item.to} />
          ))}
        </div>

        {/* Central Scan Button */}
        <NavLink
          to="/scan"
          onClick={() => NativeService.haptics.impact(ImpactStyle.Medium)}
          className="relative flex h-14 w-14 items-center justify-center -mt-6"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="absolute h-full w-full rounded-full bg-primary shadow-[0_4px_14px_rgba(0,122,255,0.4)] flex items-center justify-center text-primary-foreground border-2 border-background gpu-accel"
          >
            <Camera size={24} strokeWidth={2.5} />
          </motion.div>
        </NavLink>

        {/* Right Side Items */}
        <div className="flex flex-1 justify-around items-center">
          {navItems.slice(2).map((item) => (
            <NavItem key={item.to} {...item} active={location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({ to, icon: Icon, label, active, badge }: { to: string, icon: any, label: string, active: boolean, badge?: boolean }) {
  return (
    <NavLink
      to={to}
      onClick={() => NativeService.haptics.impact(ImpactStyle.Light)}
      className="relative flex flex-col items-center justify-center w-12 h-12 group"
    >
      <div className="relative flex flex-col items-center">
        <Icon
          size={24}
          className={`relative z-10 transition-colors duration-300 ${active ? "text-primary dark:text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
          strokeWidth={active ? 2.5 : 2}
        />
        
        {badge && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background z-20"
          />
        )}

        {/* macOS Dock style dot indicator */}
        <AnimatePresence>
          {active && (
            <motion.div
              layoutId="nav-indicator"
              className="absolute -bottom-3 w-1 h-1 rounded-full bg-primary dark:bg-foreground"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            />
          )}
        </AnimatePresence>
      </div>
    </NavLink>
  );
}
