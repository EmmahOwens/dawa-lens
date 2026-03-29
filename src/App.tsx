import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
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
import { preloadOCRModel } from "@/services/visionService";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    preloadOCRModel(); // Silently preload ~20MB Tesseract worker on startup
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            {/* Scan page is full-screen, no shell */}
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/auth" element={<AuthPage />} />
            {/* All other pages use AppShell with bottom nav */}
            <Route
              path="*"
              element={
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
              }
            />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
