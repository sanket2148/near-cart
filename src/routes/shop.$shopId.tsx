import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Star, Clock, Bike, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { ShopReviews } from "@/components/ShopReviews";
import { CartBar } from "@/components/CartBar";
import { getShop, getShopProducts } from "@/lib/catalog/api.functions";
import type { Product } from "@/lib/data";
import { listWishlist, addToWishlist, removeFromWishlist } from "@/lib/wishlist/api.functions";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { VerificationBadge } from "@/components/VerificationBadge";

export const Route = createFileRoute("/shop/$shopId")({
  loader: async ({ params }) => {
    const shop = await getShop({ data: { shopId: params.shopId } });
    const products = shop ? await getShopProducts({ data: { shopId: params.shopId } }) : [];
    return { shop, products };
  },
  head: ({ loaderData }) => {
    const shop = loaderData?.shop;
    const title = shop ? `${shop.name} — NearCart` : "Shop — NearCart";
    const desc = shop
      ? `Order from ${shop.name} in ${shop.area}. ${shop.tagline}. Delivered in ${shop.etaMinutes} min.`
      : "Order from neighborhood shops on NearCart.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ShopPage,
});

function ShopPage() {
  const { shop, products } = Route.useLoaderData() as { shop: any; products: Product[] };
  const [query, setQuery] = useState("");
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

  if (!shop) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-lg font-semibold">Shop not found</p>
          <Link to="/" className="mt-3 inline-block font-semibold text-primary">
            ← Back to home
          </Link>
        </div>
      </AppShell>
    );
  }

  const categoriesInShop = Array.from(new Set(products.map((p) => p.category)));
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <AppShell subtitle={shop.area} wide>
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Shop header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-4 bg-gradient-hero p-4">
          {shop.logoUrl ? (
            <img
              src={shop.logoUrl}
              alt={shop.name}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-card"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-background text-4xl shadow-card">
              {shop.emoji}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold leading-tight">{shop.name}</h1>
              {shop.badgeTier && <VerificationBadge tier={shop.badgeTier} size="sm" />}
            </div>
            <p className="text-sm text-muted-foreground">{shop.tagline}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
              <span className="flex items-center gap-1 text-success">
                <Star className="h-3.5 w-3.5 fill-current" /> {shop.rating} ({shop.ratingCount})
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {shop.etaMinutes} min
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Bike className="h-3.5 w-3.5" /> {shop.distanceKm} km
              </span>
              {shop.isOpen && shop.openLabel && (
                <span className="flex items-center gap-1 text-primary">{shop.openLabel}</span>
              )}
            </div>
          </div>
        </div>
        {!shop.isOpen && (
          <div className="bg-destructive/10 px-4 py-2 text-center text-sm font-semibold text-destructive">
            {shop.openLabel ?? "This shop is currently closed"}
          </div>
        )}
      </div>

      {/* Search within shop */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
        <Search className="h-4 w-4 text-primary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search in ${shop.name.split(" ")[0]}…`}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Category chips */}
      {!query && categoriesInShop.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
          {categoriesInShop.map((c) => (
            <a
              key={c}
              href={`#cat-${c}`}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40"
            >
              {c}
            </a>
          ))}
        </div>
      )}

      {/* Products */}
      <div className="mt-4 space-y-5">
        {query ? (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {filtered.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                No matches found.
              </p>
            ) : (
              filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  wishlisted={wishlistedIds.has(p.id)}
                  onToggleWishlist={toggleWishlist}
                />
              ))
            )}
          </div>
        ) : (
          categoriesInShop.map((c) => (
            <section key={c} id={`cat-${c}`} className="scroll-mt-20">
              <h2 className={cn("mb-2.5 text-sm font-bold text-muted-foreground")}>{c}</h2>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {products
                  .filter((p) => p.category === c)
                  .map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      wishlisted={wishlistedIds.has(p.id)}
                      onToggleWishlist={toggleWishlist}
                    />
                  ))}
              </div>
            </section>
          ))
        )}
      </div>

      <ShopReviews shopId={shop.id} rating={shop.rating} ratingCount={shop.ratingCount} />

      <CartBar />
    </AppShell>
  );
}
