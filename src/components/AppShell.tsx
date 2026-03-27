import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-4">
            <SidebarTrigger />
            <span className="ml-3 text-sm font-semibold text-foreground">MedRemind</span>
          </header>
          <main className="flex-1 mx-auto w-full max-w-4xl p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
