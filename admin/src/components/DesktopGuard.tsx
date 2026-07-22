import { Monitor } from 'lucide-react';

export function DesktopGuard({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Shown only on screens < 1024px */}
      <div className="flex lg:hidden h-screen flex-col items-center justify-center gap-4 p-8 text-center bg-background admin-grid-bg">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
          <Monitor size={28} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Desktop Only</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          The Dawa Lens Admin Console is optimised for desktop screens.
          Please open this URL on a desktop or laptop browser.
        </p>
      </div>
      {/* Shown only on screens ≥ 1024px */}
      <div className="hidden lg:flex h-screen w-screen">{children}</div>
    </>
  );
}
