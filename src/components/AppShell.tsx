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
  const { state, isHydrated } = useLocation();

  // Offer the location prompt once, the first time we don't know where the
  // customer is — but never block browsing on it, and never nag: once
  // dismissed via "Maybe later" it stays quiet on every later page/nav
  // (dismissedAt persists across navigations, unlike this component's own
  // local locationModalOpen state, which resets on every remount). Still
  // unset by the time it matters is checkout's job to ask again — see
  // checkout.tsx. getNearbyShops already degrades gracefully (all active
  // shops, unsorted) with no coords set, so there's never a hard block.
  // Gated on isHydrated so a fresh full-page load doesn't briefly reopen
  // this for a user who already dismissed it or set a real location — see
  // isHydrated's doc comment in location.tsx for why that race exists.
  useEffect(() => {
    if (isHydrated && state.status === "unset" && !state.dismissedAt) setLocationModalOpen(true);
  }, [isHydrated, state.status, state.dismissedAt]);

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* Responsive Sidebar Drawer — hideNav means "focused single-task
          page, no navigation chrome at all" (checkout, order tracking,
          login gates), so it suppresses this too, not just BottomNav below.
          Previously only did the latter — the sidebar rendered unconditionally
          at md: widths regardless of hideNav, a real bug every hideNav
          caller's intent already assumed was handled. */}
      {!hideNav && <SidebarDrawer mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />}

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          subtitle={subtitle}
          wide={wide}
          onMenuClick={hideNav ? undefined : () => setMobileOpen(true)}
          onLocationClick={() => setLocationModalOpen(true)}
        />
        <main
          className={cn("mx-auto w-full flex-1 px-4 pb-6 pt-4", wide ? "max-w-6xl" : "max-w-2xl")}
        >
          {children}
        </main>
        {!hideNav && <BottomNav />}
      </div>

      <LocationModal open={locationModalOpen} onOpenChange={setLocationModalOpen} />
    </div>
  );
}
