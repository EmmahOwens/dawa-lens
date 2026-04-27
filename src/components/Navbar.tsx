import { SidebarTrigger } from "@/components/ui/sidebar";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  return (
    <header
      className={cn(
        "h-16 flex items-center justify-between border-b border-white/20 dark:border-white/10 px-8 bg-white/40 dark:bg-black/40 backdrop-blur-xl backdrop-saturate-150 sticky top-0 z-30 shadow-sm gpu-accel",
        className
      )}
    >
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
  );
}
