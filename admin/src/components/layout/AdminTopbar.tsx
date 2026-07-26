import { useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { LogOut, Search, Bell } from '../../lib/icons';
import type { User } from 'firebase/auth';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useState } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/':              'Overview',
  '/users':         'User Management',
  '/medications':   'Medication Analytics',
  '/adherence':     'Adherence Tracker',
  '/ai-activity':   'AI Activity',
  '/system':        'System Health',
  '/notifications': 'Notifications',
};

const PAGE_SUBTITLES: Record<string, string> = {
  '/':              'Real-time platform insights',
  '/users':         'Manage and monitor user accounts',
  '/medications':   'Track medication data across users',
  '/adherence':     'Platform-wide dose adherence patterns',
  '/ai-activity':   'Monitor AI interactions and performance',
  '/system':        'Server health and infrastructure status',
  '/notifications': 'Broadcast and manage platform alerts',
};

interface AdminTopbarProps { user: User | null; isConnected: boolean }

export function AdminTopbar({ user, isConnected }: AdminTopbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = PAGE_TITLES[pathname] || 'Admin';
  const subtitle = PAGE_SUBTITLES[pathname] || '';
  const [search, setSearch] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate(`/users?search=${encodeURIComponent(q)}`);
    setSearch('');
  };

  const initials = (user?.displayName || user?.email || 'A')
    .split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-5 border-b border-border/50 bg-card/40 backdrop-blur-sm gap-4">
      {/* Left: page title */}
      <div className="flex flex-col min-w-0 shrink-0">
        <h1 className="text-[15px] font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5 hidden md:block">{subtitle}</p>
        )}
      </div>

      {/* Center: search */}
      <div className="flex-1 max-w-xs hidden md:block">
        <form onSubmit={handleSearch} className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            id="topbar-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-secondary/60 border border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
          />
        </form>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Live status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-secondary/40">
          <span className={isConnected ? 'live-dot' : 'inline-block w-2 h-2 rounded-full bg-muted-foreground'} />
          <span className="text-[10px] font-medium text-muted-foreground hidden sm:block">
            {isConnected ? 'Live' : 'Connecting…'}
          </span>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <button
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-border/60" />

        {/* User avatar + info */}
        <div className="flex items-center gap-2.5">
          {/* Info */}
          <div className="text-right hidden lg:block">
            <p className="text-xs font-semibold text-foreground leading-none">{user?.displayName || 'Admin'}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">{user?.email}</p>
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors shadow-inner">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Admin" className="w-full h-full rounded-xl object-cover" />
            ) : (
              <span className="text-xs font-bold text-primary">{initials}</span>
            )}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut(auth)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
