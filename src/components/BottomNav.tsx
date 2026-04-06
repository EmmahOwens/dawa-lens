import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Clock, History, Settings, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";

export default function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const { medicines } = useApp();

  const hasSafetyAlert = medicines.some(m => m.isConflict);

  const navItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/history", icon: History, label: t("nav.history") },
    { to: "/interactions", icon: ShieldAlert, label: t("nav.safety"), badge: hasSafetyAlert },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <nav className="fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-lg md:hidden">
      <div className="flex items-center justify-between rounded-[2.5rem] border border-white/20 bg-background/60 px-2 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-3xl safe-bottom relative overflow-hidden">
        {/* Left Side Items */}
        <div className="flex flex-1 justify-around items-center">
          {navItems.slice(0, 2).map((item) => (
            <NavItem key={item.to} {...item} active={location.pathname === item.to} />
          ))}
        </div>

        {/* Central Scan Button */}
        <NavLink
          to="/scan"
          className="relative flex h-16 w-16 items-center justify-center -mt-8"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute h-full w-full rounded-full bg-primary shadow-[0_8px_20px_rgba(var(--primary),0.4)] flex items-center justify-center border-4 border-background"
          >
            <Camera size={28} className="text-primary-foreground" strokeWidth={2.5} />
            
            {/* Pulsing effect */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-white opacity-20"
            />
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
      className="relative flex flex-col items-center justify-center w-14 h-14 group"
    >
      <AnimatePresence>
        {active && (
          <motion.div
            layoutId="nav-bg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 rounded-full bg-primary/10"
          />
        )}
      </AnimatePresence>

      <div className="relative">
        <Icon
          size={24}
          className={`relative z-10 transition-colors duration-300 ${active ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"}`}
          strokeWidth={active ? 2.5 : 2}
        />
        
        {badge && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-background shadow-sm z-20"
          />
        )}
      </div>

      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="text-[9px] font-black uppercase tracking-widest text-primary mt-1 relative z-10"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  );
}
