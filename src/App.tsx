import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
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
import RemindersPage from "@/pages/RemindersPage";
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
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import SplashScreen from "@/components/SplashScreen";
import PageTransition from "@/components/PageTransition";
import { AnimatePresence } from "framer-motion";

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
  const location = useLocation();

  useEffect(() => {
    preloadOCRModel(); // Silently preload ~20MB Tesseract worker on startup

    const initNativeFeatures = async () => {
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
        try {
          await StatusBar.setStyle({ style: Style.Default });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch (e) {
          console.warn("StatusBar setup ignored:", e);
        }
        try {
          await Keyboard.setAccessoryBarVisible({ isVisible: false });
        } catch (e) {
          console.warn("Keyboard setup ignored:", e);
        }
      }
    };
    initNativeFeatures();

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
          <DawaGPT />
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {/* Full-screen pages — no AppShell */}
              <Route path="/scan" element={<ProtectedRoute><PageTransition><ScanPage /></PageTransition></ProtectedRoute>} />
              <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
              <Route path="/welcome" element={<PageTransition><WelcomePage /></PageTransition>} />
              <Route path="/verify-email" element={<PageTransition><VerifyEmailPage /></PageTransition>} />
              <Route path="/onboarding" element={<OnboardingRoute><PageTransition><OnboardingPage /></PageTransition></OnboardingRoute>} />
              {/* All other pages use AppShell with bottom nav */}
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <AnimatePresence mode="wait">
                        <Routes location={location} key={location.pathname}>
                          <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
                          <Route path="/results" element={<PageTransition><ResultsPage /></PageTransition>} />
                          <Route path="/medicine/:name" element={<PageTransition><MedicineInfoPage /></PageTransition>} />
                          <Route path="/search" element={<PageTransition><MedicineInfoPage /></PageTransition>} />
                          <Route path="/reminders" element={<PageTransition><RemindersPage /></PageTransition>} />
                          <Route path="/reminders/new" element={<PageTransition><AddReminderPage /></PageTransition>} />
                          <Route path="/history" element={<PageTransition><HistoryPage /></PageTransition>} />
                          <Route path="/interactions" element={<PageTransition><InteractionsPage /></PageTransition>} />
                          <Route path="/family" element={<PageTransition><FamilyHubPage /></PageTransition>} />
                          <Route path="/travel" element={<PageTransition><TravelCompanionPage /></PageTransition>} />
                          <Route path="/wellness" element={<PageTransition><WellnessPage /></PageTransition>} />
                          <Route path="/report" element={<PageTransition><ReportPage /></PageTransition>} />
                          <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
                          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
                        </Routes>
                      </AnimatePresence>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AnimatePresence>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
