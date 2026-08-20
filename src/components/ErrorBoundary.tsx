import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "@/lib/icons";
import { isChunkLoadError } from "@/lib/lazyWithRetry";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
  /** When this value changes, the error state is automatically cleared.
   *  Pass `location.pathname` to reset errors on navigation. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.name || "ErrorBoundary"}:`, error, errorInfo);

    if (isChunkLoadError(error)) {
      const lastReload = Number(sessionStorage.getItem("error_boundary_chunk_reload_ts") || 0);
      const now = Date.now();
      if (now - lastReload > 10000 && (typeof navigator === "undefined" || navigator.onLine)) {
        sessionStorage.setItem("error_boundary_chunk_reload_ts", String(now));
        window.location.reload();
      }
    }
  }

  public componentDidUpdate(prevProps: Props) {
    // Auto-clear error state when the resetKey changes (e.g. route navigation)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    try {
      sessionStorage.removeItem("error_boundary_chunk_reload_ts");
      sessionStorage.removeItem("vite_preload_reload_ts");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    try {
      sessionStorage.removeItem("error_boundary_chunk_reload_ts");
      sessionStorage.removeItem("vite_preload_reload_ts");
    } catch {
      // ignore
    }
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunk = isChunkLoadError(this.state.error);

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
          <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${
            isChunk ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}>
            {isChunk ? <RefreshCw size={36} /> : <AlertCircle size={40} />}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground mb-2">
            {isChunk ? "New Version Available" : "Something went wrong"}
          </h2>
          <p className="text-muted-foreground font-medium mb-8 max-w-[320px] text-sm leading-relaxed">
            {isChunk 
              ? "A fresh update of Dawa Lens was just deployed. Please reload the app to get the latest features."
              : this.state.error?.message || "An unexpected error occurred while rendering this page."}
          </p>
          
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <Button 
              onClick={this.handleReset}
              className="h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px] gap-2"
            >
              <RefreshCw size={14} />
              {isChunk ? "Update & Reload" : "Reload Application"}
            </Button>
            <Button 
              variant="outline"
              onClick={this.handleGoHome}
              className="h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px] gap-2 border-border"
            >
              <Home size={14} />
              Return to Dashboard
            </Button>
          </div>
          
          {import.meta.env.DEV && (
            <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border text-left overflow-auto max-w-full">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Stack Trace (Dev Only)</p>
              <pre className="text-[10px] text-destructive font-mono whitespace-pre-wrap">
                {this.state.error?.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

