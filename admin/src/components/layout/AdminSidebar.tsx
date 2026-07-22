import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Pill, BarChart3,
  Bot, Server, Bell, ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Overview' },
  { to: '/users',         icon: Users,           label: 'Users' },
  { to: '/medications',   icon: Pill,            label: 'Medications' },
  { to: '/adherence',     icon: BarChart3,       label: 'Adherence' },
  { to: '/ai-activity',   icon: Bot,             label: 'AI Activity' },
  { to: '/system',        icon: Server,          label: 'System Health' },
  { to: '/notifications', icon: Bell,            label: 'Notifications' },
];

export function AdminSidebar() {
  return (
    <aside className="glass-sidebar w-60 min-h-full flex flex-col shrink-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <ShieldCheck className="w-4.5 h-4.5 text-white" size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">Dawa Lens</p>
          <p className="text-[10px] font-medium text-primary uppercase tracking-wider">Admin Console</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Navigation
        </p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground/50 text-center">
          © {new Date().getFullYear()} Dawa Lens Admin
        </p>
      </div>
    </aside>
  );
}
