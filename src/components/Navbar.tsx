import { SidebarTrigger } from "@/components/ui/sidebar";
import { Heart } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        "h-16 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] px-8 bg-white/50 dark:bg-[#0a0a0a]/60 blur-frost sticky top-0 z-30 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]",
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


    </header>
  );
}
