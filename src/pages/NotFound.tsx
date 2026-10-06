import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Search, ArrowRight } from "@/lib/icons";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[18px] border border-border bg-card p-8 sm:p-10 text-center">
        <div className="w-14 h-14 rounded-[16px] bg-[#f5f5f7] dark:bg-[#272729] border border-border flex items-center justify-center text-primary mx-auto mb-5">
          <Search size={26} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
          Error 404
        </span>
        <h1 className="text-3xl font-bold tracking-[-0.022em] text-foreground mb-2">
          Page Not Found
        </h1>
        <p className="text-sm font-normal text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
          The requested page could not be located. It may have been moved or removed.
        </p>
        <Button asChild className="w-full h-11 rounded-full text-sm font-semibold active:scale-95 transition-transform">
          <Link to="/" className="inline-flex items-center justify-center gap-2">
            Return to Dashboard
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
