import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { IntelligencePanel } from "./IntelligencePanel";
import { useApp } from "@/contexts/AppContext";
import { Heart } from "lucide-react";

export default function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { isIntelligenceCollapsed } = useApp();

  if (isMobile) {
    return (
      <div className="h-screen bg-background overflow-hidden flex flex-col overscroll-none">
        {/* Transparent safe-top spacer for edge-to-edge */}
        <div className="h-[env(safe-area-inset-top,20px)] bg-background/20 backdrop-blur-[100px] backdrop-saturate-[120%] sticky top-0 z-40 w-full gpu-accel" />
        
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
          <header className="h-16 flex items-center justify-between border-b border-border/20 px-8 bg-background/20 backdrop-blur-[100px] backdrop-saturate-[120%] sticky top-0 z-30 shadow-sm gpu-accel">
            <div className="flex items-center gap-6">
              <SidebarTrigger className="hover:bg-primary/10 hover:text-primary transition-colors" />
              <div className="h-6 w-px bg-border/60" />
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-foreground tracking-tight">
                  Dawa Lens Core
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                  System Active
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted transition-colors cursor-pointer w-64">
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                <span className="text-xs">Search medicines or logs...</span>
                <span className="ml-auto text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border border-border shadow-sm">⌘K</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
                  <div className="absolute top-0 right-0 h-2.5 w-2.5 bg-destructive border-2 border-background rounded-full" />
                  <Heart size={16} />
                </div>
              </div>
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
