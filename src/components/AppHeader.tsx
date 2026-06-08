import { Link } from "@tanstack/react-router";
import { MapPin, ChevronDown, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { itemCount } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-lg shadow-card">
            🛒
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Near<span className="text-primary">Cart</span>
          </span>
        </Link>

        <button className="flex min-w-0 flex-1 items-center justify-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium text-foreground">
            {subtitle ?? "Koramangala, Bengaluru"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </button>

        <Link
          to="/cart"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent/10"
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
