import { useState, useEffect, useRef } from "react";
import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { Pin, PinOff, PanelLeftClose, PanelLeft, History, Star, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MENU_SECTIONS, type NavigationItem } from "@/lib/navigation";
import { useAuth } from "@/lib/auth";

// --- Types & Storage Keys ---
const STORAGE_KEYS = {
  collapsed: "nearcart-sidebar-collapsed",
  pinned: "nearcart-sidebar-pinned",
  recent: "nearcart-sidebar-recent",
};

type Props = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function SidebarDrawer({ mobileOpen, onMobileOpenChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Load collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.collapsed);
    if (stored) {
      setCollapsed(JSON.parse(stored));
    }
  }, []);

  const toggleCollapsed = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem(STORAGE_KEYS.collapsed, JSON.stringify(nextState));
  };

  return (
    <>
      {/* Mobile Drawer (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0 border-r border-border bg-card">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-extrabold tracking-tight">
                Near<span className="text-primary">Cart</span> Menu
              </span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <SidebarContent isMobile onClose={() => onMobileOpenChange(false)} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-card transition-all duration-300 z-30 shrink-0",
          collapsed ? "w-[76px]" : "w-[260px]",
        )}
      >
        {/* Toggle Collapse Button */}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted text-muted-foreground z-40 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between py-4">
          <SidebarContent collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

function SidebarContent({
  collapsed = false,
  isMobile = false,
  onClose,
}: {
  collapsed?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [recentPaths, setRecentPaths] = useState<{ label: string; path: string }[]>([]);

  // --- Load localStorage on mount ---
  useEffect(() => {
    try {
      const storedPinned = localStorage.getItem(STORAGE_KEYS.pinned);
      if (storedPinned) setPinnedIds(JSON.parse(storedPinned));

      const storedRecent = localStorage.getItem(STORAGE_KEYS.recent);
      if (storedRecent) setRecentPaths(JSON.parse(storedRecent));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // --- Track recently visited pages ---
  useEffect(() => {
    // Exclude root and static asset paths
    if (
      currentPath === "/cart" ||
      currentPath === "/orders" ||
      currentPath === "/settings" ||
      currentPath === "/addresses"
    ) {
      const labelMap: Record<string, string> = {
        "/cart": "Cart",
        "/orders": "Orders",
        "/settings": "Settings",
        "/addresses": "Addresses",
      };
      const label = labelMap[currentPath];
      if (label) {
        setRecentPaths((prev) => {
          const next = [
            { label, path: currentPath },
            ...prev.filter((p) => p.path !== currentPath),
          ].slice(0, 3);
          localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(next));
          return next;
        });
      }
    }
  }, [currentPath]);

  // --- Pin / Unpin handlers ---
  const togglePin = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isPinned = pinnedIds.includes(id);
    let nextPinned = [];
    if (isPinned) {
      nextPinned = pinnedIds.filter((x) => x !== id);
    } else {
      nextPinned = [...pinnedIds, id].slice(0, 5); // limit to 5 pinned items
    }
    setPinnedIds(nextPinned);
    localStorage.setItem(STORAGE_KEYS.pinned, JSON.stringify(nextPinned));
  };

  // --- Keyboard navigation inside items ---
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const focusable = menuContainerRef.current?.querySelectorAll<
        HTMLAnchorElement | HTMLButtonElement
      >("a[href], button:not([disabled])");
      if (!focusable) return;

      const activeEl = document.activeElement as any;
      const index = Array.from(focusable).indexOf(activeEl);

      if (e.key === "ArrowDown") {
        const nextIdx = index + 1 < focusable.length ? index + 1 : 0;
        focusable[nextIdx].focus();
      } else {
        const prevIdx = index - 1 >= 0 ? index - 1 : focusable.length - 1;
        focusable[prevIdx].focus();
      }
    }
  };

  // --- Get Flat list of standard items for pinning lookup ---
  const allFlatItems = MENU_SECTIONS.flatMap((s) => s.items);
  const pinnedItems = allFlatItems.filter((item) => pinnedIds.includes(item.id));

  return (
    <div
      ref={menuContainerRef}
      onKeyDown={handleKeyDown}
      className={cn("flex flex-col gap-5 px-3 h-full", collapsed && "items-center px-1")}
    >
      <TooltipProvider>
        {/* User profile section — reflects real auth state (useAuth()), not
            the hardcoded "Sanket Kumar / sanket@nearcart.com" placeholder
            this used to always show regardless of whether anyone was
            actually logged in, which is what made this sidebar contradict
            pages like checkout.tsx that check the real session. */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl bg-muted/40 border border-border/40 p-3 transition-all",
            collapsed
              ? "w-11 h-11 justify-center rounded-xl p-0 bg-transparent border-0"
              : "w-full",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-hero text-lg font-bold shadow-sm">
            {user ? "🧑‍💻" : <User className="h-4.5 w-4.5" />}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              {user ? (
                <span className="block truncate text-xs font-bold leading-none text-foreground">
                  {user.email}
                </span>
              ) : (
                <span className="block truncate text-xs font-bold leading-none text-muted-foreground">
                  Not logged in
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pinned / Pinned favorites section */}
        {pinnedItems.length > 0 && !collapsed && (
          <div className="space-y-1.5 w-full">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 flex items-center gap-1.5">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> Favorites
            </span>
            <div className="space-y-0.5">
              {pinnedItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  currentPath={currentPath}
                  isPinned
                  onTogglePin={(e) => togglePin(item.id, e)}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recently visited chips */}
        {recentPaths.length > 0 && !collapsed && (
          <div className="space-y-1.5 w-full">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 flex items-center gap-1">
              <History className="h-3 w-3" /> Recent
            </span>
            <div className="flex flex-wrap gap-1 px-2">
              {recentPaths.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className="rounded-lg bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Main navigation list */}
        <div className="flex-1 w-full space-y-4">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <span className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-wider px-2.5">
                  {section.title}
                </span>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    currentPath={currentPath}
                    isPinned={pinnedIds.includes(item.id)}
                    onTogglePin={(e) => togglePin(item.id, e)}
                    onClose={onClose}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Log out (real session) if logged in; otherwise a "Log in" link —
            never both claim "Log Out" and require login on the next page,
            which is the exact contradiction this fixes. */}
        <div className="w-full border-t border-border/55 pt-3 mb-2 flex justify-center">
          {user ? (
            collapsed ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4.5 w-4.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Log Out</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full text-xs font-bold text-destructive hover:bg-destructive/10 justify-start h-8 px-2.5 rounded-xl gap-2"
              >
                <LogOut className="h-4 w-4" /> Log Out
              </Button>
            )
          ) : collapsed ? (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Link
                  to="/settings"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-primary hover:bg-primary/10 transition-colors"
                >
                  <User className="h-4.5 w-4.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Log In</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              asChild
              className="w-full text-xs font-bold text-primary hover:bg-primary/10 justify-start h-8 px-2.5 rounded-xl gap-2"
            >
              <Link to="/settings" onClick={onClose}>
                <User className="h-4 w-4" /> Log In
              </Link>
            </Button>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}

function SidebarItem({
  item,
  currentPath,
  isPinned,
  onTogglePin,
  onClose,
  collapsed = false,
  isSubmenu = false,
}: {
  item: NavigationItem;
  currentPath: string;
  isPinned: boolean;
  onTogglePin: (e: React.MouseEvent) => void;
  onClose?: () => void;
  collapsed?: boolean;
  isSubmenu?: boolean;
}) {
  const Icon = item.icon;
  const isActive = currentPath === item.path;

  const btnContent = (
    <Link
      to={item.path}
      onClick={onClose}
      className={cn(
        "group relative flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all duration-200 border border-transparent select-none",
        isActive
          ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        isSubmenu && "py-1 text-[11px]",
        collapsed && "justify-center p-2.5",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon
          className={cn(
            "h-4.5 w-4.5 shrink-0",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </div>

      {/* Pin action button — visible on hover, on keyboard focus (group-focus-within), and always once pinned */}
      {!collapsed && (
        <button
          onClick={onTogglePin}
          aria-label={isPinned ? "Unfavorite" : "Favorite"}
          className={cn(
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 p-0.5 rounded-md hover:bg-muted-foreground/15 text-muted-foreground hover:text-foreground transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            isPinned && "opacity-100 text-amber-500 hover:text-amber-600",
          )}
          title={isPinned ? "Unfavorite" : "Favorite"}
        >
          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <div className="w-full flex justify-center">{btnContent}</div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{item.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return btnContent;
}
