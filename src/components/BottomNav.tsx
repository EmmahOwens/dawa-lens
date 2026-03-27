import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Clock, History, Settings } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/scan", icon: Camera, label: "Scan" },
  { to: "/reminders/new", icon: Clock, label: "Remind" },
  { to: "/history", icon: History, label: "History" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
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
