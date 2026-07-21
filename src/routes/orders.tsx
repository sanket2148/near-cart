import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { listOrders } from "@/lib/orders/api.functions";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function OrderCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My Orders — NearCart" }] }),
  component: OrdersPage,
});

type UiOrderStatus = "placed" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const STATUS_LABEL: Record<UiOrderStatus, string> = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<UiOrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  placed: "secondary",
  accepted: "secondary",
  preparing: "default",
  out_for_delivery: "default",
  delivered: "outline",
  cancelled: "destructive",
};

function isTerminal(status: UiOrderStatus): boolean {
  return status === "delivered" || status === "cancelled";
}

function OrdersPage() {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => listOrders(),
    enabled: Boolean(user),
    // No websocket Realtime yet (see plan/tasks/decisions.md, Phase H) — RLS
    // only grants `authenticated`, and the browser holds no real Supabase
    // session, so anon-key postgres_changes would just return zero rows.
    // Poll instead, and stop once every order is in a terminal state.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.length === 0) return 6000;
      return data.every((o) => isTerminal(o.status)) ? false : 6000;
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <h1 className="text-xl font-extrabold">My Orders</h1>
        <div className="mt-4 space-y-3">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      </AppShell>
    );
  }

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
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold leading-tight">{o.shopName}</p>
                  <Badge variant={STATUS_VARIANT[o.status]} className="shrink-0">
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </div>
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
