import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { IntelligencePanel } from "./IntelligencePanel";

export default function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-lg pb-24">{children}</main>
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
          <header className="h-16 flex items-center justify-between border-b border-border/50 px-6 bg-background/50 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent uppercase tracking-wider">
                Dawa Lens Core
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Optional: Add search or profile here */}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar">
            <div className="mx-auto w-full max-w-5xl p-6 lg:p-10">
               {children}
            </div>
          </main>
        </div>

        {/* Column 3: Intelligence Panel (Hidden on screens smaller than large) */}
        <div className="hidden xl:block">
           <IntelligencePanel />
        </div>
      </div>
    </SidebarProvider>
  );
}
