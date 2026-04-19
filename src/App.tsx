import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { App as CapApp } from '@capacitor/app';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/contexts/AppContext";
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
import FamilyHubPage from "@/pages/FamilyHubPage";
import TravelCompanionPage from "@/pages/TravelCompanionPage";
import WellnessPage from "@/pages/WellnessPage";
import ReportPage from "@/pages/ReportPage";
import { preloadOCRModel } from "@/services/visionService";
import { ThemeProvider } from "@/components/ThemeProvider";
import OfflineOverlay from "@/components/OfflineOverlay";
import DawaGPT from "@/components/DawaGPT";
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import SplashScreen from "@/components/SplashScreen";

const queryClient = new QueryClient();

// A wrapper to enforce onboarding redirect
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, needsOnboarding, hasSeenWelcome, isInitializing } = useApp();
  
  if (isInitializing) {
    return <SplashScreen />;
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
  if (isInitializing) return <SplashScreen />;
  if (!isLoggedIn) return <Navigate to="/auth" replace />;
  if (!needsOnboarding) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => {
  useEffect(() => {
    preloadOCRModel(); // Silently preload ~20MB Tesseract worker on startup

    const initNativePermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Camera.requestPermissions();
        } catch (e) {
          console.warn("Camera permission request ignored:", e);
        }
        try {
          await LocalNotifications.requestPermissions();
        } catch (e) {
          console.warn("LocalNotifications permission request ignored:", e);
        }
      }
    };
    initNativePermissions();

    const backListener = CapApp.addListener('backButton', () => {
      if (window.location.pathname === '/' || window.location.pathname === '/welcome' || window.location.pathname === '/auth') {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, []);

  return (
  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme" attribute="class">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <OfflineOverlay />
          <Toaster richColors closeButton position="top-center" />
          <BrowserRouter>
            <DawaGPT />
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
                        <Route path="/family" element={<FamilyHubPage />} />
                        <Route path="/travel" element={<TravelCompanionPage />} />
                        <Route path="/wellness" element={<WellnessPage />} />
                        <Route path="/report" element={<ReportPage />} />
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
