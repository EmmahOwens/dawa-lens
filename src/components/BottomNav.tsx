import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Clock, History, Settings, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/scan", icon: Camera, label: t("nav.scan") },
    { to: "/history", icon: History, label: t("nav.history") },
    { to: "/interactions", icon: ShieldAlert, label: t("nav.safety") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <nav className="fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-lg md:hidden">
      <div className="flex items-center justify-around rounded-[3rem] border border-border/50 bg-card/70 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl safe-bottom relative overflow-hidden">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              className="relative flex flex-col items-center gap-1.5 px-4 py-1 group"
            >
              <div className={`absolute inset-0 rounded-full bg-primary/10 transition-all duration-300 scale-0 ${active ? 'scale-100' : 'group-hover:scale-75'}`} />
              <Icon
                size={24}
                className={`relative z-10 transition-all duration-300 ${active ? "text-primary scale-110" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.8 : 2}
              />
              <span
                className={`relative z-10 text-[10px] font-bold tracking-tight transition-all ${active ? "text-primary" : "text-muted-foreground opacity-70"}`}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
