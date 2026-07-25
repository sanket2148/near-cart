import { Link } from "@tanstack/react-router";
import { MapPin, ChevronDown, ShoppingBag, Menu } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocation } from "@/lib/location";
import { cn } from "@/lib/utils";

export function AppHeader({
  subtitle,
  onMenuClick,
  onLocationClick,
  wide,
}: {
  subtitle?: string;
  onMenuClick?: () => void;
  onLocationClick?: () => void;
  wide?: boolean;
}) {
  const { itemCount } = useCart();
  const { state } = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className={cn("mx-auto flex items-center justify-between gap-3 px-4 py-3", wide ? "max-w-6xl" : "max-w-2xl")}>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent/10 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-lg shadow-card">
            🛒
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Near<span className="text-primary">Cart</span>
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 justify-center">
          <button
            onClick={onLocationClick}
            className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/40"
          >
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium text-foreground">
              {subtitle ?? state.label ?? "Set delivery location"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <Link
          to="/cart"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent/10"
          aria-label="View cart"
        >
          <ShoppingBag className="h-5 w-5" />
          {itemCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
