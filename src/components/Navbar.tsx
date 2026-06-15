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
        "h-16 flex items-center justify-between px-8 bg-white/10 dark:bg-black/20 backdrop-blur-xl border-white/10 dark:border-white/5 sticky top-0 z-30 border-t-0 border-x-0 border-b",
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
