import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Clock, History, Settings, ShieldAlert } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/scan", icon: Camera, label: "Scan" },
  { to: "/history", icon: History, label: "History" },
  { to: "/interactions", icon: ShieldAlert, label: "Safety" },
  { to: "/settings", icon: Settings, label: "Options" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg md:hidden">
      <div className="flex items-center justify-around rounded-2xl border border-border bg-card/80 py-2 shadow-lg backdrop-blur-xl safe-bottom">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors"
            >
              <Icon
                size={22}
                className={active ? "text-primary" : "text-muted-foreground"}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
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
