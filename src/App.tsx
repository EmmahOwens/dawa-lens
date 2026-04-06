import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import AppShell from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import ScanPage from "@/pages/ScanPage";
import ResultsPage from "@/pages/ResultsPage";
import MedicineInfoPage from "@/pages/MedicineInfoPage";
import AddReminderPage from "@/pages/AddReminderPage";
import HistoryPage from "@/pages/HistoryPage";
import SettingsPage from "@/pages/SettingsPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/NotFound";
import InteractionsPage from "@/pages/InteractionsPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import OnboardingPage from "@/pages/OnboardingPage";
import WelcomePage from "@/pages/WelcomePage";
import { useApp } from "@/contexts/AppContext";
import { Navigate } from "react-router-dom";
import { preloadOCRModel } from "@/services/visionService";
import { ThemeProvider } from "@/components/ThemeProvider";
import OfflineOverlay from "@/components/OfflineOverlay";
import DawaGPT from "@/components/DawaGPT";

const queryClient = new QueryClient();

// A wrapper to enforce onboarding redirect
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, needsOnboarding, hasSeenWelcome, isInitializing } = useApp();
  
  if (isInitializing) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }
  
  if (!isLoggedIn) {
    if (!hasSeenWelcome) return <Navigate to="/welcome" replace />;
    return <Navigate to="/auth" replace />;
  }
  
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
}

// A wrapper to enforce authentication redirect for onboarding
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, needsOnboarding, isInitializing } = useApp();
  if (isInitializing) return <div className="h-screen w-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!isLoggedIn) return <Navigate to="/auth" replace />;
  if (!needsOnboarding) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => {
  useEffect(() => {
    preloadOCRModel(); // Silently preload ~20MB Tesseract worker on startup
  }, []);

  return (
  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme" attribute="class">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <OfflineOverlay />
          <DawaGPT />
          <Toaster richColors closeButton position="top-center" />
          <BrowserRouter>
            <Routes>
              {/* Full-screen pages — no AppShell */}
              <Route path="/scan" element={<ProtectedRoute><ScanPage /></ProtectedRoute>} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
              {/* All other pages use AppShell with bottom nav */}
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/results" element={<ResultsPage />} />
                        <Route path="/medicine/:name" element={<MedicineInfoPage />} />
                        <Route path="/search" element={<MedicineInfoPage />} />
                        <Route path="/reminders/new" element={<AddReminderPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/interactions" element={<InteractionsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
