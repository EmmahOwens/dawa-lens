import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { App as CapApp } from '@capacitor/app';
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
import StoreUpdateModal from "@/components/StoreUpdateModal";
import pkg from "../package.json";

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
    // Do NOT run until data is fully loaded — prevents false "missed" entries
    // when reminders/doseLogs are still empty on initial mount.
    if (!Capacitor.isNativePlatform() || isInitializing) return;

    // Run once when data is ready
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
  }, [reminders, doseLogs, medicines, logDose, isInitializing]);

  return null;
};

const App = () => {
  const location = useLocation();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({ newVersion: "", downloadUrl: "" });
  const CURRENT_VERSION = pkg.version;

  useEffect(() => {
    preloadOCRModel(); // Silently preload ~20MB Tesseract worker on startup

    const initNativeFeatures = async () => {
      if (Capacitor.isNativePlatform()) {
        // Check for manual APK updates (Orion Store Architecture)
        const checkForUpdate = async () => {
          try {
            // Replace this URL with where you actually host your version.json
            // Example format of version.json: 
            // { "latestVersion": "1.0.7", "downloadUrl": "https://example.com/app-release.apk" }
            const REMOTE_CONFIG_URL = "https://raw.githubusercontent.com/iammbayo/dawa-lens/main/public/version.json";
            
            const response = await fetch(REMOTE_CONFIG_URL, { cache: 'no-store' });
            if (!response.ok) return;

            const data = await response.json();
            
            // Basic semantic version string comparison
            if (data.latestVersion && data.latestVersion > CURRENT_VERSION) {
              setTimeout(() => {
                setUpdateData({ 
                  newVersion: data.latestVersion, 
                  downloadUrl: data.downloadUrl 
                });
                setShowUpdateModal(true);
              }, 3000);
            }
          } catch (error) {
            console.error("Failed to check for updates:", error);
          }
        };
        checkForUpdate();

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
          {showUpdateModal && (
            <StoreUpdateModal
              currentVersion={CURRENT_VERSION}
              newVersion={updateData.newVersion}
              downloadUrl={updateData.downloadUrl}
              onClose={() => setShowUpdateModal(false)}
            />
          )}
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
