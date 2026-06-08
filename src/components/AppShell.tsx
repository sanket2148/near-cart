import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function AppShell({
  children,
  subtitle,
  hideNav,
}: {
  children: ReactNode;
  subtitle?: string;
  hideNav?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader subtitle={subtitle} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6 pt-4">{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
