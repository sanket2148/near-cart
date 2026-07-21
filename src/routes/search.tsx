import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { ShopCard } from "@/components/ShopCard";
import { CartBar } from "@/components/CartBar";
import { searchCatalog } from "@/lib/catalog/api.functions";
import { listWishlist, addToWishlist, removeFromWishlist } from "@/lib/wishlist/api.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — NearCart" },
      { name: "description", content: "Search products and shops near you on NearCart." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const { data } = useQuery({
    queryKey: ["search", term],
    queryFn: () => searchCatalog({ data: { query: term } }),
    enabled: term.length > 0,
  });
  const matchedShops = term ? (data?.shops ?? []) : [];
  const matchedProducts = term ? (data?.products ?? []).slice(0, 20) : [];

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: wishlist = [] } = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: () => listWishlist(),
    enabled: Boolean(user),
  });
  const wishlistedIds = new Set(wishlist.map((w) => w.productId));

  async function toggleWishlist(productId: string) {
    if (!user) {
      toast("Log in to save items to your wishlist.");
      return;
    }
    const alreadyIn = wishlistedIds.has(productId);
    try {
      if (alreadyIn) {
        await removeFromWishlist({ data: { productId } });
      } else {
        await addToWishlist({ data: { productId } });
      }
      await queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
    } catch {
      toast.error("Couldn't update your wishlist.");
    }
  }

  return (
    <AppShell wide>
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
        <SearchIcon className="h-4 w-4 text-primary" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search milk, paracetamol, croissant…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {!term && (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p className="text-3xl">🔎</p>
          <p className="mt-2">Find anything across shops near you.</p>
        </div>
      )}

      {term && matchedShops.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2.5 text-sm font-bold text-muted-foreground">Shops</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {matchedShops.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        </section>
      )}

      {term && matchedProducts.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2.5 text-sm font-bold text-muted-foreground">Products</h2>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {matchedProducts.map((p) => (
              <div key={p.id}>
                <ProductCard
                  product={p}
                  wishlisted={wishlistedIds.has(p.id)}
                  onToggleWishlist={toggleWishlist}
                />
                {p.shopName && (
                  <Link
                    to="/shop/$shopId"
                    params={{ shopId: p.shopId }}
                    className="mt-1 block pl-2 text-xs text-muted-foreground"
                  >
                    from <span className="font-semibold text-primary">{p.shopName}</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {term && matchedShops.length === 0 && matchedProducts.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">No results for “{q}”.</p>
      )}

      <CartBar />
    </AppShell>
  );
}
