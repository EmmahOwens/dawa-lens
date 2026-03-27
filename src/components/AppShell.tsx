import { ReactNode } from "react";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-lg pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
