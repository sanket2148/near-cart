import { Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/data";
import { ShoppingBag } from "lucide-react";

// Floating "view cart" bar shown above content when cart has items.
export function CartBar() {
  const { itemCount, subtotal } = useCart();
  if (itemCount === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 px-4">
      <Link
        to="/cart"
        className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between rounded-2xl bg-gradient-primary px-4 py-3 text-primary-foreground shadow-float transition-transform hover:scale-[1.01]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingBag className="h-5 w-5" />
          {itemCount} {itemCount === 1 ? "item" : "items"} · {formatINR(subtotal)}
        </span>
        <span className="text-sm font-bold">View Cart →</span>
      </Link>
    </div>
  );
}
