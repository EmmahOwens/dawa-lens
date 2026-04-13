import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { IntelligencePanel } from "./IntelligencePanel";
import { useApp } from "@/contexts/AppContext";

export default function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { isIntelligenceCollapsed } = useApp();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background selection:bg-primary/10">
        <main className="mx-auto max-w-lg px-4 pt-6 pb-32">{children}</main>
        <BottomNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        {/* Column 1: Sidebar */}
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/80 px-6 bg-background/70 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="h-4 w-px bg-border" />
              <span className="text-[15px] font-semibold text-foreground tracking-tight">
                Dawa Lens Core
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Optional: Add search or profile here */}
            </div>
          </header>

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
