import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import type { User } from 'firebase/auth';
import { useConnectionStatus, useSetConnectionStatus } from '../../hooks/useConnectionStatus';
import { useEffect } from 'react';
import { api } from '../../services/adminApi';

interface AdminLayoutProps { user: User | null }

export function AdminLayout({ user }: AdminLayoutProps) {
  const isConnected = useConnectionStatus();
  const setConnected = useSetConnectionStatus();

  // Perform an initial health check so the topbar shows "Live" once the server
  // responds — this ensures all pages (not just Overview) show the correct status.
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await api.system.health();
        if (mounted) setConnected(true);
      } catch {
        // Server unreachable — keep as disconnected; Overview's feed will retry
      }
    };
    check();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
