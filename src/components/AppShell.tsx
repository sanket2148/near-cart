import { useState, type ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { SidebarDrawer } from "./SidebarDrawer";

export function AppShell({
  children,
  subtitle,
  hideNav,
}: {
  children: ReactNode;
  subtitle?: string;
  hideNav?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* Responsive Sidebar Drawer */}
      <SidebarDrawer mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader subtitle={subtitle} onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6 pt-4">{children}</main>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
