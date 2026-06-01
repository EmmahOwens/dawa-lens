import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { App as CapApp } from "@capacitor/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/contexts/AppContext";
import {
  scheduleReminders,
  checkMissedDoses,
} from "@/services/reminderService";
import AppShell from "@/components/AppShell";
import { preloadOCRModel } from "@/services/visionService";
import { deferToIdle } from "@/lib/idleCallback";
import { initLifecycle, onForeground, hasNetwork } from "@/lib/appLifecycle";
import { ThemeProvider } from "@/components/ThemeProvider";
import OfflineOverlay from "@/components/OfflineOverlay";
import DawaGPT from "@/components/DawaGPT";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { LocalNotifications } from "@capacitor/local-notifications";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import SplashScreen from "@/components/SplashScreen";
import PageLoader from "@/components/PageLoader";
import PageTransition from "@/components/PageTransition";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatePresence } from "framer-motion";
import { NotificationHandler } from "@/components/NotificationHandler";
import StoreUpdateModal from "@/components/StoreUpdateModal";
import { initLocalPersistence } from "@/services/localPersistence";
import pkg from "../package.json";
import { isNewerVersion, fetchLatestRelease } from "@/lib/update";

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
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));

const queryClient = new QueryClient();

// Guard for admin-only routes — requires isProfessional flag on UserProfile 
function AdminRoute({ children }: { children: React.ReactNode }) { 
  const { isLoggedIn, userProfile, isInitializing } = useApp(); 
  
  // Developer Backdoor: Check for a local storage flag to bypass auth/role checks
  const isDevAdmin = localStorage.getItem("dawa_dev_admin") === "true";

  if (isInitializing) return <SplashScreen />; 
  
  // Grant access if the dev flag is set, regardless of login status
  if (isDevAdmin) return <>{children}</>;

  if (!isLoggedIn) return <Navigate to="/auth" replace />; 
  if (!userProfile?.isProfessional) return <Navigate to="/" replace />; 
  return <>{children}</>; 
} 

// A wrapper to enforce onboarding redirect
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, needsOnboarding, hasSeenWelcome, isInitializing } =
    useApp();

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
    // Do NOT run until data is fully loaded — prevents false "missed" entries
    // when reminders/doseLogs are still empty on initial mount.
    if (!Capacitor.isNativePlatform() || isInitializing) return;

    // Run once when data is ready
    checkMissedDoses(reminders, doseLogs, logDose);
    scheduleReminders(reminders, doseLogs, medicines);

    // Refresh reminders and check missed doses when app comes to foreground.
    // Uses the lifecycle manager instead of a raw appStateChange listener
    // so all foreground callbacks are coordinated in one place.
    const unsubForeground = onForeground(() => {
      scheduleReminders(reminders, doseLogs, medicines);
      checkMissedDoses(reminders, doseLogs, logDose);
    });

    return unsubForeground;
  }, [reminders, doseLogs, medicines, logDose, isInitializing]);

  return null;
};

const App = () => {
  const location = useLocation();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({
    newVersion: "",
    downloadUrl: "",
  });
  const CURRENT_VERSION = pkg.version;

  // Initialize app lifecycle manager once on mount.
  // Handles foreground/background events and network tracking.
  useEffect(() => {
    return initLifecycle();
  }, []);

  useEffect(() => {
    // Defer heavy startup work to idle time so first paint is not blocked.
    // preloadOCRModel now runs entirely in a Web Worker (ocrWorker.ts).
    deferToIdle(preloadOCRModel);

    const checkForUpdate = async () => {
      try {
        const updateInfo = await fetchLatestRelease();
        if (!updateInfo) return;

        const { latestVersion, downloadUrl } = updateInfo;

        if (isNewerVersion(latestVersion, CURRENT_VERSION)) {
          setTimeout(() => {
            setUpdateData({
              newVersion: latestVersion,
              downloadUrl: downloadUrl,
            });
            setShowUpdateModal(true);
          }, 3000);
        }
      } catch (error) {
        console.error("Failed to check for updates:", error);
      }
    };
    // Only fetch update info when a network connection is available.
    deferToIdle(() => {
      if (hasNetwork()) checkForUpdate();
    });

    if (Capacitor.isNativePlatform()) {
      initLocalPersistence().catch(console.warn);
    }

    const initNativeFeatures = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Default });
          await StatusBar.setOverlaysWebView({ overlay: true });
          // Ensure it's transparent for edge-to-edge
          if (Capacitor.getPlatform() === "android") {
            await StatusBar.setBackgroundColor({ color: "#00000000" });
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

    const backListener = CapApp.addListener("backButton", () => {
      if (
        window.location.pathname === "/" ||
        window.location.pathname === "/welcome" ||
        window.location.pathname === "/auth"
      ) {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    });

    return () => {
      backListener.then((l) => l.remove());
    };
  }, [CURRENT_VERSION]);

  return (
    <ThemeProvider
      defaultTheme="system"
      storageKey="vite-ui-theme"
      attribute="class"
    >
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
              <ErrorBoundary name="AppRoot">
                <Routes location={location}>
                  {/* Full-screen pages — no AppShell */}
                  <Route
                    path="/scan"
                    element={
                      <ProtectedRoute>
                        <PageTransition>
                          <ScanPage />
                        </PageTransition>
                      </ProtectedRoute>
                    }
                  />
                  <Route 
                    path="/admin" 
                    element={ 
                      <AdminRoute> 
                        <AdminDashboard /> 
                      </AdminRoute> 
                    } 
                  />
                  <Route
                    path="/auth"
                    element={
                      <PageTransition>
                        <AuthPage />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/welcome"
                    element={
                      <PageTransition>
                        <WelcomePage />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/verify-email"
                    element={
                      <PageTransition>
                        <VerifyEmailPage />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/onboarding"
                    element={
                      <OnboardingRoute>
                        <PageTransition>
                          <OnboardingPage />
                        </PageTransition>
                      </OnboardingRoute>
                    }
                  />

                  {/* All other pages use AppShell with bottom nav */}
                  <Route
                    path="*"
                    element={
                      <ProtectedRoute>
                        <AppShell>
                            <AnimatePresence mode="wait">
                              <Suspense fallback={<PageLoader />}>
                                <ErrorBoundary name="ContentArea">
                                  <Routes
                                    location={location}
                                    key={location.pathname}
                                  >
                                    <Route
                                      path="/"
                                      element={
                                        <PageTransition>
                                          <Dashboard />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/results"
                                      element={
                                        <PageTransition>
                                          <ResultsPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/medicine/:name"
                                      element={
                                        <PageTransition>
                                          <MedicineInfoPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/search"
                                      element={
                                        <PageTransition>
                                          <MedicineInfoPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/reminders"
                                      element={
                                        <PageTransition>
                                          <RemindersPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/reminders/new"
                                      element={
                                        <PageTransition>
                                          <AddReminderPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/history"
                                      element={
                                        <PageTransition>
                                          <HistoryPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/interactions"
                                      element={
                                        <PageTransition>
                                          <InteractionsPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/family"
                                      element={
                                        <PageTransition>
                                          <FamilyHubPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/travel"
                                      element={
                                        <PageTransition>
                                          <TravelCompanionPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/wellness"
                                      element={
                                        <PageTransition>
                                          <WellnessPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/report"
                                      element={
                                        <PageTransition>
                                          <ReportPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="/settings"
                                      element={
                                        <PageTransition>
                                          <SettingsPage />
                                        </PageTransition>
                                      }
                                    />
                                    <Route
                                      path="*"
                                      element={
                                        <PageTransition>
                                          <NotFound />
                                        </PageTransition>
                                      }
                                    />
                                  </Routes>
                                </ErrorBoundary>
                              </Suspense>
                            </AnimatePresence>
                          </AppShell>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </AppProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
