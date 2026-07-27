import { Minus, Plus, Heart } from "lucide-react";
import type { Product } from "@/lib/data";
import { formatINR, LOW_STOCK_THRESHOLD } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

type Props = {
  product: Product;
  wishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
};

export function ProductCard({ product, wishlisted, onToggleWishlist }: Props) {
  const { add, setQty, qtyOf } = useCart();
  const qty = qtyOf(product.id);
  const out = !product.inStock;
  const lowStock = !out && product.stockQty != null && product.stockQty <= LOW_STOCK_THRESHOLD;

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card",
        out && "opacity-60",
      )}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-2xl">
          {product.emoji}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold leading-tight pr-5">{product.name}</h4>
        {lowStock ? (
          <p className="text-xs font-semibold text-destructive">Only {product.stockQty} left</p>
        ) : (
          <p className="text-xs text-muted-foreground">{product.unit}</p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-sm font-bold">{formatINR(product.price)}</span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatINR(product.mrp)}
            </span>
          )}
        </div>
      </div>

      {onToggleWishlist && (
        <button
          onClick={() => onToggleWishlist(product.id)}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-rose-500"
        >
          <Heart className={cn("h-4 w-4", wishlisted && "fill-rose-500 text-rose-500")} />
        </button>
      )}

      {out ? (
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
          Out of stock
        </span>
      ) : qty === 0 ? (
        <button
          onClick={() => add(product)}
          className="rounded-lg border border-primary bg-primary/5 px-4 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          ADD
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-primary px-1.5 py-1 text-primary-foreground">
          <button
            onClick={() => setQty(product.id, qty - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-primary-foreground/15"
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-5 text-center text-sm font-bold">{qty}</span>
          <button
            onClick={() => add(product)}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-primary-foreground/15"
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
