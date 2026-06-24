import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  ChevronRight,
  Phone,
  MapPin,
  Bike,
  ArrowRight,
  Navigation2,
} from "lucide-react";
import {
  useSeller,
  STATUS_LABEL,
  nextStatus,
  timeAgo,
  type SellerOrder,
  type SellerOrderStatus,
} from "@/lib/seller";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/orders")({
  component: SellerOrders,
});

type Filter = "active" | "new" | "completed";

const statusTone: Record<SellerOrderStatus, string> = {
  new: "bg-accent/15 text-accent",
  accepted: "bg-primary/10 text-primary",
  preparing: "bg-primary/10 text-primary",
  ready: "bg-primary/10 text-primary",
  out_for_delivery: "bg-primary/15 text-primary",
  delivered: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

function SellerOrders() {
  const { orders } = useSeller();
  const [filter, setFilter] = useState<Filter>("new");

  const filtered = orders.filter((o) => {
    if (filter === "new") return o.status === "new";
    if (filter === "active")
      return ["accepted", "preparing", "ready", "out_for_delivery"].includes(o.status);
    return ["delivered", "rejected"].includes(o.status);
  });

  const counts = {
    new: orders.filter((o) => o.status === "new").length,
    active: orders.filter((o) =>
      ["accepted", "preparing", "ready", "out_for_delivery"].includes(o.status),
    ).length,
    completed: orders.filter((o) => ["delivered", "rejected"].includes(o.status)).length,
  };

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "new", label: "New", count: counts.new },
    { id: "active", label: "Active", count: counts.active },
    { id: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Orders</h1>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
              filter === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1 text-xs">({t.count})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No orders here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: SellerOrder }) {
  const { acceptOrder, rejectOrder, advanceOrder, assignPartner, partners } = useSeller();
  const [open, setOpen] = useState(order.status === "new");

  const partner = partners.find((p) => p.id === order.partnerId);
  const next = nextStatus(order.status);
  const needsPartner =
    (order.status === "ready" || order.status === "preparing") && !order.partnerId;

  const handleAdvance = () => {
    if (order.status === "ready" && !order.partnerId) {
      toast.error("Assign a delivery partner first");
      return;
    }
    advanceOrder(order.id);
    const n = order.status === "new" ? "accepted" : nextStatus(order.status);
    if (n) toast.success(`Order marked ${STATUS_LABEL[n]}`);
  };

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold">{order.customerName}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                statusTone[order.status],
              )}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            #{order.id.slice(-5)} · {order.lines.length} items · {timeAgo(order.placedAt)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-extrabold">{formatINR(order.total)}</span>
          <ChevronRight
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {/* Items */}
          <ul className="space-y-1.5">
            {order.lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{l.emoji}</span>
                  <span>
                    {l.name}{" "}
                    <span className="text-muted-foreground">× {l.quantity}</span>
                  </span>
                </span>
                <span className="font-medium">{formatINR(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>

          {/* Customer */}
          <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{order.address}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <span>{order.phone}</span>
              <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold">
                {order.paymentMethod}
              </span>
            </p>
          </div>

          {/* Delivery partner */}
          {order.status !== "new" && order.status !== "rejected" && (
            <div className="rounded-xl border border-border p-3">
              <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Bike className="h-4 w-4 text-primary" /> Delivery partner
              </p>
              {partner ? (
                <p className="mt-2 text-sm">
                  <span className="font-bold">{partner.name}</span> · {partner.vehicle} · ⭐{" "}
                  {partner.rating}
                  <span className="block text-xs text-muted-foreground">{partner.phone}</span>
                </p>
              ) : (
                <Select onValueChange={(v) => { assignPartner(order.id, v); toast.success("Partner assigned"); }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Assign a delivery partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={!p.available}>
                        {p.name} · {p.vehicle} {p.available ? "" : "(busy)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Live tracking */}
          {["ready", "out_for_delivery", "delivered"].includes(order.status) && (
            <Link
              to="/seller/track/$orderId"
              params={{ orderId: order.id }}
              className="block"
            >
              <Button variant="outline" className="w-full">
                <Navigation2 className="h-4 w-4" /> Track delivery on map
              </Button>
            </Link>
          )}


          {/* Actions */}
          {order.status === "new" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => { rejectOrder(order.id); toast("Order rejected"); }}
              >
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button
                variant="hero"
                onClick={() => { acceptOrder(order.id); toast.success("Order accepted"); }}
              >
                <Check className="h-4 w-4" /> Accept
              </Button>
            </div>
          ) : next ? (
            <Button
              variant="hero"
              className="w-full"
              disabled={needsPartner && order.status === "ready"}
              onClick={handleAdvance}
            >
              Mark as {STATUS_LABEL[next]} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <p className="text-center text-sm font-semibold text-muted-foreground">
              {order.status === "delivered" ? "✓ Completed" : "Rejected"}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
