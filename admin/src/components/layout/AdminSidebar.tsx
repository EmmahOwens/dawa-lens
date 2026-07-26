import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useSidebar } from '../../contexts/SidebarContext';
import {
  LayoutDashboard, Users, Pill, BarChart3,
  Bot, Monitor, Bell, ShieldCheck, Settings, LogOut, ChevronLeft, ChevronRight,
} from '../../lib/icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Overview' },
  { to: '/users',         icon: Users,           label: 'Users' },
  { to: '/medications',   icon: Pill,            label: 'Medications' },
  { to: '/adherence',     icon: BarChart3,       label: 'Adherence' },
  { to: '/ai-activity',   icon: Bot,             label: 'AI Activity' },
  { to: '/system',        icon: Monitor,         label: 'System Health' },
  { to: '/notifications', icon: Bell,            label: 'Notifications' },
];

const BOTTOM_NAV: { to: string; icon: typeof Settings; label: string }[] = [
  // Settings page not yet implemented — remove until route is added
];

export function AdminSidebar() {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className="glass-sidebar flex flex-col shrink-0 z-30 relative"
      style={{ width: collapsed ? '64px' : '232px' }}
    >
      {/* Logo + Toggle */}
      <div className={cn(
        'flex items-center h-16 border-b border-border/50 shrink-0 overflow-hidden',
        collapsed ? 'justify-center px-2' : 'px-4 gap-2.5'
      )}>
        {/* Logo icon */}
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
          <ShieldCheck size={17} className="text-white" />
        </div>

        {/* Logo text — hidden when collapsed */}
        {!collapsed && (
          <div className="flex-1 min-w-0 animate-fade-in">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">Dawa Lens</p>
            <p className="text-[10px] font-medium text-primary uppercase tracking-wider">Admin Console</p>
          </div>
        )}

        {/* Collapse toggle — shown only when expanded */}
        {!collapsed && (
          <button
            onClick={toggle}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0"
            title="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="flex justify-center py-3 border-b border-border/30">
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto no-scrollbar px-2">
        {!collapsed && (
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Navigation
          </p>
        )}

        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center py-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active left accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
                )}

                <Icon
                  size={18}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    collapsed ? 'mx-auto' : ''
                  )}
                />

                {/* Label — animated in/out */}
                {!collapsed && (
                  <span className="truncate">{label}</span>
                )}

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <span className="sidebar-tooltip">
                    {label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className={cn('border-t border-border/40 py-3 px-2 space-y-0.5')}>
        {BOTTOM_NAV.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className={cn(
              'group relative flex items-center py-2.5 rounded-xl text-sm font-medium',
              'text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-150 cursor-pointer overflow-hidden',
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            )}
          >
            <Icon size={18} className={cn('shrink-0', collapsed ? 'mx-auto' : '')} />
            {!collapsed && <span className="truncate">{label}</span>}
            {collapsed && <span className="sidebar-tooltip">{label}</span>}
          </div>
        ))}

        {/* Sign out */}
        <button
          onClick={() => signOut(auth)}
          className={cn(
            'group relative w-full flex items-center py-2.5 rounded-xl text-sm font-medium',
            'text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all duration-150 overflow-hidden',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          )}
          title="Sign out"
        >
          <LogOut size={18} className={cn('shrink-0', collapsed ? 'mx-auto' : '')} />
          {!collapsed && <span className="truncate">Sign Out</span>}
          {collapsed && <span className="sidebar-tooltip">Sign Out</span>}
        </button>

        {/* Version footer */}
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground/40 text-center pt-2 animate-fade-in">
            © {new Date().getFullYear()} Dawa Lens Admin
          </p>
        )}
      </div>
    </aside>
  );
}
