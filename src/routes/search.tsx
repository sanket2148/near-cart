import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { ShopCard } from "@/components/ShopCard";
import { CartBar } from "@/components/CartBar";
import { products, shops, getShop } from "@/lib/data";

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

  const matchedShops = term
    ? shops.filter(
        (s) => s.name.toLowerCase().includes(term) || s.category.includes(term),
      )
    : [];
  const matchedProducts = term
    ? products.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 20)
    : [];

  return (
    <AppShell>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
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
          <div className="space-y-3">
            {matchedShops.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        </section>
      )}

      {term && matchedProducts.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2.5 text-sm font-bold text-muted-foreground">Products</h2>
          <div className="space-y-2.5">
            {matchedProducts.map((p) => {
              const shop = getShop(p.shopId);
              return (
                <div key={p.id}>
                  <ProductCard product={p} />
                  {shop && (
                    <Link
                      to="/shop/$shopId"
                      params={{ shopId: shop.id }}
                      className="mt-1 block pl-2 text-xs text-muted-foreground"
                    >
                      from <span className="font-semibold text-primary">{shop.name}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {term && matchedShops.length === 0 && matchedProducts.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No results for “{q}”.
        </p>
      )}

      <CartBar />
    </AppShell>
  );
}
