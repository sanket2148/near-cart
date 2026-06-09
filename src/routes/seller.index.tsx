import { createFileRoute, Link } from "@tanstack/react-router";
import {
  IndianRupee,
  ShoppingBag,
  Bike,
  PackageX,
  ArrowRight,
  Bell,
  TrendingUp,
} from "lucide-react";
import { useSeller, STATUS_LABEL, timeAgo } from "@/lib/seller";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/seller/")({
  component: SellerDashboard,
});

function SellerDashboard() {
  const { shop, stats, orders, products } = useSeller();
  const newOrders = orders.filter((o) => o.status === "new").slice(0, 3);
  const activeDeliveries = orders.filter(
    (o) => o.status === "out_for_delivery" || o.status === "ready",
  );

  const tiles = [
    {
      label: "Revenue today",
      value: formatINR(stats.revenueToday),
      icon: IndianRupee,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "New orders",
      value: String(stats.newCount),
      icon: Bell,
      tone: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "In progress",
      value: String(stats.activeCount),
      icon: Bike,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Delivered today",
      value: String(stats.deliveredToday),
      icon: ShoppingBag,
      tone: "text-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Hello, {shop.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-muted-foreground">Here's what's happening today.</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.bg} ${t.tone}`}>
              <t.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-extrabold leading-none">{t.value}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      {/* New orders */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <Bell className="h-4 w-4 text-accent" /> New orders
          </h2>
          <Link to="/seller/orders" className="text-sm font-semibold text-primary">
            View all
          </Link>
        </div>

        {newOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No new orders right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {newOrders.map((o) => (
              <li key={o.id}>
                <Link
                  to="/seller/orders"
                  className="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-colors hover:bg-accent/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{o.customerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.lines.length} item{o.lines.length > 1 ? "s" : ""} · {timeAgo(o.placedAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-extrabold">{formatINR(o.total)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active deliveries */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="flex items-center gap-2 font-bold">
          <Bike className="h-4 w-4 text-primary" /> Active deliveries
        </h2>
        {activeDeliveries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No deliveries in progress.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {activeDeliveries.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">#{o.id.slice(-5)} · {o.customerName}</span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[o.status]}</span>
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  {STATUS_LABEL[o.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Low stock */}
      {stats.lowStock > 0 && (
        <Link
          to="/seller/products"
          className="flex items-center justify-between rounded-2xl border border-accent/30 bg-accent/5 p-4"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <PackageX className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">{stats.lowStock} item(s) out of stock</span>
              <span className="text-xs text-muted-foreground">Tap to update availability</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        <Button asChild variant="hero" size="lg">
          <Link to="/seller/products">
            <TrendingUp className="h-4 w-4" /> Add product
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/seller/orders">
            <ShoppingBag className="h-4 w-4" /> Manage orders
          </Link>
        </Button>
      </section>

      <p className="pt-1 text-center text-xs text-muted-foreground">
        {products.length} products listed · {shop.area}
      </p>
    </div>
  );
}
