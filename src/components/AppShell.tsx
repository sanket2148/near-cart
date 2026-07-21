import { useEffect, useState, type ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { SidebarDrawer } from "./SidebarDrawer";
import { LocationModal } from "./LocationModal";
import { useLocation } from "@/lib/location";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  subtitle,
  hideNav,
  wide,
}: {
  children: ReactNode;
  subtitle?: string;
  hideNav?: boolean;
  /** Grid-shaped pages (shop/product browsing) benefit from more width on desktop; forms/lists stay at the default narrow column. */
  wide?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const { state } = useLocation();

  // Offer the location prompt once, the first time we don't know where the
  // customer is — but never block browsing on it. getNearbyShops already
  // degrades gracefully (all active shops, unsorted) with no coords set.
  useEffect(() => {
    if (state.status === "unset") setLocationModalOpen(true);
  }, [state.status]);

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* Responsive Sidebar Drawer */}
      <SidebarDrawer mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          subtitle={subtitle}
          wide={wide}
          onMenuClick={() => setMobileOpen(true)}
          onLocationClick={() => setLocationModalOpen(true)}
        />
        <main className={cn("mx-auto w-full flex-1 px-4 pb-6 pt-4", wide ? "max-w-6xl" : "max-w-2xl")}>
          {children}
        </main>
        {!hideNav && <BottomNav />}
      </div>

      <LocationModal open={locationModalOpen} onOpenChange={setLocationModalOpen} />
    </div>
  );
}
