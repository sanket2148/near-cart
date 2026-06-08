import { Link } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, ClipboardList } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/orders", label: "Orders", icon: ClipboardList },
] as const;

export function BottomNav() {
  const { itemCount } = useCart();
  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="group relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground transition-colors data-[status=active]:text-primary"
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {to === "/cart" && itemCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {itemCount}
                </span>
              )}
            </span>
            <span className={cn("text-[11px] font-medium")}>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
