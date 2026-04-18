import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Clock, History, Settings, ShieldAlert, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";

export default function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const { medicines, isProfessionalMode } = useApp();

  const hasSafetyAlert = medicines.some(m => m.isConflict);

  const navItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: isProfessionalMode ? "/family" : "/history", icon: isProfessionalMode ? Users : History, label: isProfessionalMode ? "Family" : t("nav.history") },
    { to: "/interactions", icon: ShieldAlert, label: t("nav.safety"), badge: hasSafetyAlert },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 w-full md:hidden">
      <div className="flex items-center justify-between border-t border-border/50 bg-background/85 px-4 pt-2 pb-2 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl safe-bottom relative">
        {/* Left Side Items */}
        <div className="flex flex-1 justify-around items-center">
          {navItems.slice(0, 2).map((item) => (
            <NavItem key={item.to} {...item} active={location.pathname === item.to} />
          ))}
        </div>

        {/* Central Scan Button */}
        <NavLink
          to="/scan"
          className="relative flex h-14 w-14 items-center justify-center -mt-6"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="absolute h-full w-full rounded-full bg-primary shadow-[0_4px_14px_rgba(0,122,255,0.4)] flex items-center justify-center text-primary-foreground border-2 border-background"
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
