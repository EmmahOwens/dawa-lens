import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import type { User } from 'firebase/auth';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

interface AdminLayoutProps { user: User | null }

export function AdminLayout({ user }: AdminLayoutProps) {
  // Read connection state set by whichever page is currently active.
  // Overview sets this via useRealtimeFeed + usePolledStats success.
  // Once set to true it persists while navigating between pages.
  const isConnected = useConnectionStatus();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminTopbar user={user} isConnected={isConnected} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
