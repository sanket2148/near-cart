import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getOrders, type Order } from "@/lib/orders";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My Orders — NearCart" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    setOrders(getOrders());
  }, []);

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold">My Orders</h1>

      {orders.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-5xl">📦</p>
          <h2 className="mt-4 text-lg font-bold">No orders yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your past orders will appear here.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="hero" size="lg">
              Start shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to="/order/$orderId"
              params={{ orderId: o.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-float"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-hero text-2xl">
                {o.shopEmoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold leading-tight">{o.shopName}</p>
                <p className="text-xs text-muted-foreground">
                  #{o.id} · {o.lines.length} items · {formatINR(o.total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.placedAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
