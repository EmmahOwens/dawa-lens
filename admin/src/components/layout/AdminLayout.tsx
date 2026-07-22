import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import type { User } from 'firebase/auth';
import { useRealtimeFeed } from '../../hooks/useRealtimeFeed';

interface AdminLayoutProps { user: User | null }

export function AdminLayout({ user }: AdminLayoutProps) {
  const { isConnected } = useRealtimeFeed(1); // minimal sub just for connection status

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
