import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { Camera, Search } from "@/lib/icons";

interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        "h-[52px] flex items-center justify-between px-6 bg-white/80 dark:bg-[#161617]/80 backdrop-blur-2xl border-b border-border/80 sticky top-0 z-30",
        className
      )}
    >
      {/* Left: Sidebar trigger & breadcrumb/status */}
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" />
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-foreground tracking-tight">
            Dawa Lens
          </span>
          <span className="text-[11px] font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60">
            Precision Health
          </span>
        </div>
      </div>

      {/* Right: Quick actions & ThemeToggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/scan")}
          className="hidden sm:inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-normal hover:brightness-105 active:scale-95 transition-all"
        >
          <Camera size={14} />
          <span>Scan Medicine</span>
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
