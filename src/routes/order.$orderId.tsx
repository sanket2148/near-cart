import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Phone, MapPin, Bike } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getOrder, type Order } from "@/lib/orders";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/order/$orderId")({
  head: () => ({ meta: [{ title: "Track Order — NearCart" }] }),
  component: OrderPage,
});

const steps: { key: Order["status"]; label: string; sub: string }[] = [
  { key: "placed", label: "Order placed", sub: "We've notified the shop" },
  { key: "accepted", label: "Shop accepted", sub: "Your order is confirmed" },
  { key: "preparing", label: "Preparing", sub: "Items are being packed" },
  { key: "out_for_delivery", label: "Out for delivery", sub: "Rider is on the way" },
  { key: "delivered", label: "Delivered", sub: "Enjoy! 🎉" },
];

function OrderPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setOrder(getOrder(orderId));
  }, [orderId]);

  // simulate live progress
  useEffect(() => {
    if (!order) return;
    const timers = [
      setTimeout(() => setStage(1), 1500),
      setTimeout(() => setStage(2), 4000),
      setTimeout(() => setStage(3), 7000),
      setTimeout(() => setStage(4), 11000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [order]);

  if (!order) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-lg font-semibold">Order not found</p>
          <Link to="/" className="mt-3 inline-block font-semibold text-primary">
            ← Back to home
          </Link>
        </div>
      </AppShell>
    );
  }

  const delivered = stage >= 4;

  return (
    <AppShell hideNav>
      {/* Status banner */}
      <div className="overflow-hidden rounded-3xl border border-border shadow-card">
        <div className="bg-gradient-primary p-5 text-primary-foreground">
          <p className="text-sm opacity-90">Order #{order.id}</p>
          <h1 className="mt-1 text-2xl font-extrabold">
            {delivered ? "Delivered!" : `Arriving in ~${order.etaMinutes} min`}
          </h1>
          <p className="mt-0.5 text-sm opacity-90">
            {order.shopEmoji} {order.shopName}
          </p>
        </div>

        {/* Map placeholder */}
        {!delivered && (
          <div className="relative flex h-32 items-center justify-center bg-gradient-hero">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle, var(--color-primary) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
            <Bike className="h-10 w-10 animate-bounce text-primary" />
          </div>
        )}
      </div>

      {/* Rider card */}
      {stage >= 3 && !delivered && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-xl">🛵</span>
          <div className="flex-1">
            <p className="text-sm font-bold">Ajay is on the way</p>
            <p className="text-xs text-muted-foreground">Your delivery partner · ⭐ 4.7</p>
          </div>
          <Button variant="outline" size="icon" aria-label="Call rider">
            <Phone className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Timeline */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        {steps.map((s, i) => {
          const done = i <= stage;
          const current = i === stage;
          return (
            <div key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                {done ? (
                  <CheckCircle2 className={cn("h-6 w-6", current ? "text-accent" : "text-primary")} />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground/40" />
                )}
                {i < steps.length - 1 && (
                  <span className={cn("my-0.5 w-0.5 flex-1", i < stage ? "bg-primary" : "bg-border")} style={{ minHeight: 20 }} />
                )}
              </div>
              <div className={cn("pb-3", !done && "opacity-50")}>
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery to */}
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="text-muted-foreground">{order.address}</span>
      </div>

      {/* Bill */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-bold">Order summary</h2>
        {order.lines.map((l) => (
          <div key={l.name} className="flex justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">
              {l.quantity} × {l.name}
            </span>
            <span>{formatINR(l.price * l.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-dashed border-border pt-2 text-base font-extrabold">
          <span>Total ({order.paymentMethod})</span>
          <span>{formatINR(order.total)}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link to="/orders" className="flex-1">
          <Button variant="outline" size="lg" className="w-full">
            My orders
          </Button>
        </Link>
        <Link to="/" className="flex-1">
          <Button variant="hero" size="lg" className="w-full">
            Order again
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
