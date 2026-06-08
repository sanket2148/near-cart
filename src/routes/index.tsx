import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ShopCard } from "@/components/ShopCard";
import { CartBar } from "@/components/CartBar";
import { categories, shops } from "@/lib/data";
import heroImg from "@/assets/hero.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NearCart — Order from shops near you, delivered fast" },
      {
        name: "description",
        content:
          "Discover grocery, pharmacy, bakery, hardware and more from neighborhood shops near you. Order online and get hyperlocal delivery in minutes.",
      },
      { property: "og:title", content: "NearCart — Your neighborhood, delivered" },
      {
        property: "og:description",
        content: "Order from local shops near you and get fast hyperlocal delivery.",
      },
      { property: "og:image", content: heroImg },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [active, setActive] = useState<string | null>(null);

  const visibleShops = active ? shops.filter((s) => s.category === active) : shops;
  const openShops = [...visibleShops].sort((a, b) => Number(b.isOpen) - Number(a.isOpen));

  return (
    <AppShell>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border border-border shadow-card">
        <div className="relative">
          <img
            src={heroImg}
            alt="Neighborhood shops and a delivery rider"
            width={1280}
            height={800}
            className="h-40 w-full object-cover sm:h-52"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h1 className="text-2xl font-extrabold leading-tight text-background">
              Your neighborhood, delivered
            </h1>
            <p className="text-sm text-background/85">Shops near you · arriving in minutes</p>
          </div>
        </div>
      </section>

      {/* Search */}
      <button
        onClick={() => navigate({ to: "/search" })}
        className="mt-4 flex w-full items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground shadow-card"
      >
        <Search className="h-4 w-4 text-primary" />
        Search for products or shops…
      </button>

      {/* Categories */}
      <section className="mt-5">
        <h2 className="mb-3 text-base font-bold">Shop by category</h2>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
          {categories.map((c) => {
            const isActive = active === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActive(isActive ? null : c.id)}
                className={cn(
                  "flex w-[72px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all",
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-2xl",
                    isActive ? "bg-primary/15" : "bg-secondary",
                  )}
                >
                  {c.emoji}
                </span>
                <span className="text-center text-[11px] font-semibold leading-tight">
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Shops */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">
            {active ? categories.find((c) => c.id === active)?.name : "Shops near you"}
          </h2>
          {active && (
            <button onClick={() => setActive(null)} className="text-sm font-semibold text-primary">
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {openShops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
          {openShops.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No shops in this category yet.
            </p>
          )}
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/sell" className="font-semibold text-primary">
          Own a shop? Partner with NearCart →
        </Link>
      </p>

      <CartBar />
    </AppShell>
  );
}
