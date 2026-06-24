import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Phone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getOrder } from "@/lib/orders";
import { getShop, formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { LiveTrackView } from "@/components/tracking/LiveTrackView";
import { useTracking } from "@/lib/tracking";
import { geocodeSeed } from "@/lib/geo";
import { useDeliverySimulation } from "@/hooks/useDeliverySimulation";

export const Route = createFileRoute("/order/$orderId")({
  head: () => ({ meta: [{ title: "Track Order — NearCart" }] }),
  component: OrderPage,
});

function OrderPage() {
  const { orderId } = Route.useParams();
  const order = getOrder(orderId);
  const { ensureSession, getSession } = useTracking();
  const session = getSession(orderId);
  const sim = useDeliverySimulation(orderId, session);
  const autoStarted = useRef(false);

  const shop = order ? getShop(order.shopId) : undefined;

  // Create the shared tracking session for this order (once).
  useEffect(() => {
    if (!order) return;
    const pickup = shop
      ? { lat: shop.lat, lng: shop.lng, label: `${shop.emoji} ${shop.name}` }
      : { ...geocodeSeed(order.shopName), label: order.shopName };
    ensureSession(orderId, {
      pickup,
      drop: { ...geocodeSeed(order.address), label: order.address },
      status: "placed",
      riderName: "Ajay · ⭐ 4.7",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, orderId]);

  // Kick off a live demo ride once the session exists (single-device demo).
  useEffect(() => {
    if (session && !session.rider && !autoStarted.current) {
      autoStarted.current = true;
      const t = setTimeout(() => sim.start(), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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

  return (
    <AppShell hideNav>
      {session ? (
        <LiveTrackView
          session={session}
          controls={
            session.status !== "delivered" && (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-xl">
                  🛵
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold">{session.riderName}</p>
                  <p className="text-xs text-muted-foreground">
                    Your delivery partner
                  </p>
                </div>
                <Button variant="outline" size="icon" aria-label="Call rider">
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Setting up live tracking…
        </div>
      )}

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
