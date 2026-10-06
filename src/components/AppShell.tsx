import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { IntelligencePanel } from "./IntelligencePanel";
import { useApp } from "@/contexts/AppContext";
import { Navbar } from "./Navbar";
import { PatientContextBanner } from "./PatientContextBanner";

export default function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { isIntelligenceCollapsed } = useApp();

  if (isMobile) {
    return (
      <div className="h-[100dvh] min-h-[100dvh] bg-background flex flex-col overscroll-none relative overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar overscroll-y-contain">
          {/* Safe-top spacer for edge-to-edge screens with notch */}
          <div className="h-[env(safe-area-inset-top,0px)] bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-b border-border/80 sticky top-0 z-40 w-full shrink-0" />
          <PatientContextBanner />
          <main className="px-4 sm:px-6 safe-mobile-dock-bottom pt-2 w-full max-w-2xl mx-auto">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="h-[100dvh] min-h-[100dvh] flex w-full bg-background overflow-hidden">
        {/* Column 1: Apple Desktop Sidebar */}
        <AppSidebar />

        {/* Column 2: Content Canvas */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto no-scrollbar">
            <Navbar />
            <PatientContextBanner />
            <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-12 lg:py-10">
              {children}
            </div>
          </main>
        </div>

        {/* Column 3: Intelligence Panel */}
        <div
          className={`hidden xl:block transition-all duration-300 ease-in-out border-l border-border bg-[#f5f5f7] dark:bg-[#161617] ${
            isIntelligenceCollapsed ? "w-[70px]" : "w-[340px]"
          }`}
        >
          <IntelligencePanel />
        </div>
      </div>
    </SidebarProvider>
  );
}
