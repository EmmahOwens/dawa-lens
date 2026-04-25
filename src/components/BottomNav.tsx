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
    <nav className="fixed bottom-4 left-0 right-0 z-50 mx-auto max-w-sm md:hidden px-4 pb-safe-bottom gpu-accel" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between rounded-full bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-[24px] backdrop-saturate-[180%] border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] px-4 py-3 relative">
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
          className="relative flex h-14 w-14 items-center justify-center -mt-8"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="absolute h-full w-full rounded-full bg-[#3b82f6] shadow-[0_4px_14px_rgba(59,130,246,0.4)] flex items-center justify-center text-white border-[3px] border-white dark:border-[#1C1C1E] gpu-accel"
          >
            <Camera size={26} strokeWidth={2.5} />
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
      <div className="relative flex flex-col items-center gap-1">
        <Icon
          size={22}
          className={`relative z-10 transition-colors duration-300 ${active ? "text-[#3b82f6] dark:text-[#60a5fa]" : "text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100"}`}
          strokeWidth={active ? 2.5 : 2.2}
        />
        
        {badge && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#1C1C1E] z-20"
          />
        )}

        <span className={`text-[10px] font-medium transition-colors duration-300 ${active ? "text-[#3b82f6] dark:text-[#60a5fa]" : "text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100"}`}>
          {label}
        </span>
      </div>
    </NavLink>
  );
}
