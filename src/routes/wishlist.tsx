import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Heart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmailOtpAuth } from "@/components/EmailOtpAuth";
import { useAuth } from "@/lib/auth";
import { listWishlist, removeFromWishlist } from "@/lib/wishlist/api.functions";
import { formatINR } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — NearCart" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { add } = useCart();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: () => listWishlist(),
    enabled: Boolean(user),
  });

  async function remove(productId: string) {
    try {
      await removeFromWishlist({ data: { productId } });
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user?.id] });
    } catch {
      toast.error("Couldn't remove this item.");
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <h1 className="text-xl font-extrabold">Wishlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to save products for later.</p>
        <div className="mt-4">
          <EmailOtpAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold">Wishlist</h1>

      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-5xl">🤍</p>
          <h2 className="mt-4 text-lg font-bold">No saved products yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the heart on any product to save it here.
          </p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="hero" size="lg">
              Browse shops
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {items.map((item) => (
            <div
              key={item.wishlistId}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-2xl">
                {item.emoji ?? "🛍️"}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold leading-tight">{item.name}</h4>
                <Link
                  to="/shop/$shopId"
                  params={{ shopId: item.shopId }}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  {item.shopName}
                </Link>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-sm font-bold">{formatINR(item.priceAmount)}</span>
                  {item.mrpAmount && item.mrpAmount > item.priceAmount && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatINR(item.mrpAmount)}
                    </span>
                  )}
                  {!item.inStock && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Out of stock
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {item.inStock && (
                  <Button
                    size="sm"
                    variant="hero"
                    onClick={() =>
                      add({
                        id: item.productId,
                        shopId: item.shopId,
                        name: item.name,
                        emoji: item.emoji ?? "🛍️",
                        price: item.priceAmount,
                        mrp: item.mrpAmount ?? undefined,
                        unit: item.unit ?? "",
                        category: "",
                        inStock: item.inStock,
                      })
                    }
                  >
                    Add
                  </Button>
                )}
                <button
                  onClick={() => remove(item.productId)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
