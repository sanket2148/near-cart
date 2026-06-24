import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Crosshair, Store } from "lucide-react";
import { useSeller } from "@/lib/seller";
import { useTracking } from "@/lib/tracking";
import { getShop } from "@/lib/data";
import { geocodeSeed } from "@/lib/geo";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { LiveTrackView } from "@/components/tracking/LiveTrackView";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/seller/track/$orderId")({
  component: SellerTrack,
});

function SellerTrack() {
  const { orderId } = Route.useParams();
  const { orders, shop, partners } = useSeller();
  const order = orders.find((o) => o.id === orderId);
  const { ensureSession, getSession, updatePickup } = useTracking();
  const session = getSession(orderId);

  const ownShop = getShop(shop.id);
  const partner = partners.find((p) => p.id === order?.partnerId);

  const live = useLiveLocation((pos) =>
    updatePickup(orderId, { ...pos, label: `${shop.emoji} ${shop.name} (current location)` }),
  );

  useEffect(() => {
    if (!order) return;
    const pickup = ownShop
      ? { lat: ownShop.lat, lng: ownShop.lng, label: `${shop.emoji} ${shop.name}` }
      : { ...geocodeSeed(shop.name), label: `${shop.emoji} ${shop.name}` };
    ensureSession(orderId, {
      pickup,
      drop: { ...geocodeSeed(order.address), label: order.address },
      status:
        order.status === "out_for_delivery"
          ? "in_transit"
          : order.status === "delivered"
            ? "delivered"
            : order.status === "ready"
              ? "ready"
              : "placed",
      riderName: partner?.name ?? "Awaiting partner",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, orderId]);

  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">Order not found</p>
        <Link to="/seller/orders" className="mt-3 inline-block font-semibold text-primary">
          ← Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/seller/orders"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <h1 className="text-xl font-extrabold">Track delivery</h1>
      <p className="text-sm text-muted-foreground">
        {order.customerName} · #{order.id.slice(-5)}
      </p>

      {session ? (
        <LiveTrackView
          session={session}
          controls={
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Store className="h-4 w-4 text-primary" /> Pickup location
              </p>
              <p className="text-xs text-muted-foreground">
                Confirm where the rider should collect this order. You can pin your
                shop's exact GPS position.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  live.start();
                  toast("Getting your location…");
                }}
              >
                <Crosshair className="h-4 w-4" /> Use my current location
              </Button>
              {live.error && (
                <p className="text-xs font-medium text-destructive">{live.error}</p>
              )}
            </div>
          }
        />
      ) : (
        <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}
