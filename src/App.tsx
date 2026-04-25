import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { App as CapApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { scheduleReminders, checkMissedDoses } from "@/services/reminderService";
import AppShell from "@/components/AppShell";
import { preloadOCRModel } from "@/services/visionService";
import { ThemeProvider } from "@/components/ThemeProvider";
import OfflineOverlay from "@/components/OfflineOverlay";
import DawaGPT from "@/components/DawaGPT";
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen as CapSplashScreen } from '@capacitor/splash-screen';
import SplashScreen from "@/components/SplashScreen";
import PageTransition from "@/components/PageTransition";
import { AnimatePresence } from "framer-motion";
import { NotificationHandler } from "@/components/NotificationHandler";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ScanPage = lazy(() => import("@/pages/ScanPage"));
const ResultsPage = lazy(() => import("@/pages/ResultsPage"));
const MedicineInfoPage = lazy(() => import("@/pages/MedicineInfoPage"));
const AddReminderPage = lazy(() => import("@/pages/AddReminderPage"));
const RemindersPage = lazy(() => import("@/pages/RemindersPage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const InteractionsPage = lazy(() => import("@/pages/InteractionsPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const WelcomePage = lazy(() => import("@/pages/WelcomePage"));
const FamilyHubPage = lazy(() => import("@/pages/FamilyHubPage"));
const TravelCompanionPage = lazy(() => import("@/pages/TravelCompanionPage"));
const WellnessPage = lazy(() => import("@/pages/WellnessPage"));
const ReportPage = lazy(() => import("@/pages/ReportPage"));

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

const AppContent = () => {
  const { reminders, doseLogs, medicines, logDose, isInitializing } = useApp();

  useEffect(() => {
    if (!isInitializing && Capacitor.isNativePlatform()) {
      // Hide native splash screen once the app is ready
      CapSplashScreen.hide().catch(err => console.warn("Splash hide failed:", err));
    }
  }, [isInitializing]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Run once on mount
    checkMissedDoses(reminders, doseLogs, logDose);

    // Refresh reminders and check missed doses when app comes to foreground
    const handler = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        console.log('App became active, refreshing reminders and checking for updates...');
        scheduleReminders(reminders, doseLogs, medicines);
        checkMissedDoses(reminders, doseLogs, logDose);
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [reminders, doseLogs, medicines, logDose]);

  return null;
};

const App = () => {
  const location = useLocation();

  useEffect(() => {
    preloadOCRModel(); // Silently preload ~20MB Tesseract worker on startup

    const initNativeFeatures = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Notify the updater that the app is ready
          // This prevents auto-rollback to the previous version
          const result = await CapacitorUpdater.notifyAppReady();
          console.log("Capgo: App ready notification successful", result);
        } catch (e) {
          console.error("Capgo: App ready notification failed:", e);
        }

        CapacitorUpdater.addListener('updateAvailable', (info: any) => {
          console.log('Capgo update available!', info);
        });

        CapacitorUpdater.addListener('downloadComplete', async (info: any) => {
          console.log('Capgo download complete! Applying update...', info);
          try {
            await CapacitorUpdater.set({ id: info.version || info.id });
          } catch (err) {
            console.error('Failed to apply Capgo update:', err);
          }
        });

        try {
          await StatusBar.setStyle({ style: Style.Default });
          await StatusBar.setOverlaysWebView({ overlay: true });
          // Ensure it's transparent for edge-to-edge
          if (Capacitor.getPlatform() === 'android') {
            await StatusBar.setBackgroundColor({ color: '#00000000' });
          }
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
          <AppContent />
          <NotificationHandler />
          <OfflineOverlay />
          <Toaster richColors closeButton position="top-center" />
          <DawaGPT />
          <Suspense fallback={<SplashScreen />}>
            <Routes location={location}>
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
                        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
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
                        </Suspense>
                      </AnimatePresence>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
