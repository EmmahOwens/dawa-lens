import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { IntelligencePanel } from "./IntelligencePanel";
import { useApp } from "@/contexts/AppContext";
import { Navbar } from "./Navbar";

export default function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { isIntelligenceCollapsed } = useApp();

  if (isMobile) {
    return (
      <div className="h-screen bg-background overflow-hidden flex flex-col overscroll-none">
        {/* Transparent safe-top spacer for edge-to-edge */}
        <div className="h-[env(safe-area-inset-top,20px)] bg-background/60 backdrop-blur-2xl backdrop-saturate-[1.8] border-b border-white/10 sticky top-0 z-40 w-full gpu-accel" />
        
        <main className="flex-1 overflow-y-auto no-scrollbar px-3 safe-bottom pb-24 scroll-smooth">
          {children}
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        {/* Column 1: Sidebar */}
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />

          <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
            <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-12 lg:py-12">
               {children}
            </div>
          </main>
        </div>

        {/* Column 3: Intelligence Panel (Hidden on screens smaller than large) */}
        <div className={`hidden xl:block transition-all duration-500 ease-in-out ${isIntelligenceCollapsed ? "w-[70px]" : "w-[340px]"}`}>
           <IntelligencePanel />
        </div>
      </div>
    </SidebarProvider>
  );
}
