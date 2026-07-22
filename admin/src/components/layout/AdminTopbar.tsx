import { useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/users': 'User Management',
  '/medications': 'Medication Analytics',
  '/adherence': 'Adherence Tracker',
  '/ai-activity': 'AI Activity',
  '/system': 'System Health',
  '/notifications': 'Notifications',
};

interface AdminTopbarProps { user: User | null; isConnected: boolean }

export function AdminTopbar({ user, isConnected }: AdminTopbarProps) {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Admin';
  const initials = (user?.displayName || user?.email || 'A')
    .split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border/50 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {/* Live status dot */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/60 bg-secondary/40">
          <span className={isConnected ? 'live-dot' : 'inline-block w-2 h-2 rounded-full bg-muted-foreground'} />
          <span className="text-[10px] font-medium text-muted-foreground">
            {isConnected ? 'Live' : 'Connecting…'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Admin info */}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-foreground leading-none">{user?.displayName || 'Admin'}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{user?.email}</p>
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Admin" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary">{initials}</span>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut(auth)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          title="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
