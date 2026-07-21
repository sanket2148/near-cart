import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/data";
import { listAllOrders, cancelOrder } from "@/lib/admin-data/api.functions";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersPage,
});

const STATUS_OPTIONS = [
  "created",
  "payment_failed",
  "paid",
  "cod_confirmed",
  "shop_accepted",
  "shop_rejected",
  "preparing",
  "ready_for_pickup",
  "partner_assigned",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
  "closed",
] as const;

// Mirrors admin-data/backend.server.ts's CANCELLABLE_STATUSES — client-side
// copy only disables the button early; the server re-checks for real.
const CANCELLABLE = new Set([
  "created",
  "paid",
  "cod_confirmed",
  "shop_accepted",
  "preparing",
  "ready_for_pickup",
  "partner_assigned",
]);

const TERMINAL_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  delivered: "outline",
  closed: "outline",
  cancelled: "destructive",
  refunded: "destructive",
  payment_failed: "destructive",
  shop_rejected: "destructive",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  return TERMINAL_VARIANT[status] ?? (CANCELLABLE.has(status) ? "default" : "secondary");
}

function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", statusFilter],
    queryFn: () => listAllOrders({ data: { status: statusFilter || undefined } }),
  });

  async function handleCancel(orderId: string) {
    setPendingId(orderId);
    try {
      await cancelOrder({ data: { orderId } });
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel order");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Orders</h2>
          <p className="text-xs text-muted-foreground">
            {orders.length} shown (most recent 200, or filtered)
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No orders match.</div>
        ) : (
          <div className="divide-y divide-border">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-sm">
                      #{order.id.slice(-6)} · {order.shopName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.customerName} · {formatINR(order.totalAmount)} ·{" "}
                      {new Date(order.placedAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  {CANCELLABLE.has(order.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/5"
                      disabled={pendingId === order.id}
                      onClick={() => handleCancel(order.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
