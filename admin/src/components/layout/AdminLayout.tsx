import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import type { User } from 'firebase/auth';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { useSidebar } from '../../contexts/SidebarContext';

interface AdminLayoutProps { user: User | null }

export function AdminLayout({ user }: AdminLayoutProps) {
  const isConnected = useConnectionStatus();
  const { collapsed } = useSidebar();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-250"
        style={{ marginLeft: 0 }}
      >
        <AdminTopbar user={user} isConnected={isConnected} />
        <main className={`flex-1 overflow-y-auto thin-scroll transition-all duration-250 ${collapsed ? 'p-5' : 'p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
