import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAdminAuth } from './hooks/useAdminAuth';
import { AdminLayout } from './components/layout/AdminLayout';
import { DesktopGuard } from './components/DesktopGuard';
import { AdminLogin } from './pages/AdminLogin';
import { Overview } from './pages/Overview';
import { Users } from './pages/Users';
import { Medications } from './pages/Medications';
import { Adherence } from './pages/Adherence';
import { AIActivity } from './pages/AIActivity';
import { SystemHealth } from './pages/SystemHealth';
import { Notifications } from './pages/Notifications';
import { ShieldCheck } from 'lucide-react';

function App() {
  const { user, isAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-primary animate-pulse" />
          </div>
          <p className="text-xs text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <>
        <AdminLogin />
        <Toaster theme="dark" position="top-right" richColors />
      </>
    );
  }

  return (
    <DesktopGuard>
      <BrowserRouter>
        <Routes>
          <Route element={<AdminLayout user={user} />}>
            <Route index element={<Overview />} />
            <Route path="/users" element={<Users />} />
            <Route path="/medications" element={<Medications />} />
            <Route path="/adherence" element={<Adherence />} />
            <Route path="/ai-activity" element={<AIActivity />} />
            <Route path="/system" element={<SystemHealth />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster theme="dark" position="top-right" richColors />
      </BrowserRouter>
    </DesktopGuard>
  );
}

export default App;
