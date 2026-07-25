import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Loader2, Star, Play, Square } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { ReviewForm } from "@/components/ReviewForm";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { getOrder, cancelOrder } from "@/lib/orders/api.functions";
import { getShop, getShopProducts } from "@/lib/catalog/api.functions";
import { getOrderTracking } from "@/lib/tracking-data/api.functions";
import { useLiveOrderEvents } from "@/lib/tracking-data/useLiveOrderEvents";
import { getReviewableOrder, getMyReviewForOrder } from "@/lib/reviews/api.functions";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveTrackView } from "@/components/tracking/LiveTrackView";
import { useTracking } from "@/lib/tracking";
import { geocodeSeed } from "@/lib/geo";
import { useDeliverySimulation } from "@/hooks/useDeliverySimulation";

export const Route = createFileRoute("/order/$orderId")({
  head: () => ({ meta: [{ title: "Track Order — NearCart" }] }),
  component: OrderPage,
});

type UiOrderStatus =
  "placed" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

// Kept active even while the SSE relay reports `live` — that flag only
// means the connection is open, not that real events are flowing (notably:
// before supabase/migrations/0010_realtime_publication.sql has been run).
// Much slower than the non-live fallback interval, so it stays cheap while
// the relay is genuinely working, but guarantees the page can't silently
// stall if it isn't.
const SAFETY_NET_POLL_MS = 45_000;

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

function OrderPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { addMany: addManyToCart } = useCart();
  const queryClient = useQueryClient();
  const [reordering, setReordering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Real Realtime relay (Phase 1 — see plan/tasks/decisions.md and
  // src/routes/api.live.order.$orderId.ts) supplements, not replaces, the
  // polling below: slows it way down (SAFETY_NET_POLL_MS) while the SSE
  // connection is healthy, and lets it resume at the exact original cadence
  // the moment it isn't. Gated on `user`, not `order` — the server route
  // performs its own ownership check independently once connected, so
  // there's no need to wait for this page's own order fetch to resolve first.
  const { live } = useLiveOrderEvents(orderId, Boolean(user), user?.id);
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId, user?.id],
    queryFn: () => getOrder({ data: { orderId } }),
    enabled: Boolean(user),
    // See orders.tsx for why this is polling, not websocket Realtime. `live`
    // only means the SSE connection is open — not that real events are
    // actually arriving (e.g. before the required ALTER PUBLICATION
    // migration is run, or if the relay silently stops delivering for any
    // other reason), so this deliberately keeps a slow safety-net poll
    // running rather than fully disabling polling — see SAFETY_NET_POLL_MS.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "delivered" || status === "cancelled") return false;
      if (!status) return 6000;
      return live ? SAFETY_NET_POLL_MS : 6000;
    },
  });
  const { data: shop } = useQuery({
    queryKey: ["shop", order?.shopId],
    queryFn: () => getShop({ data: { shopId: order!.shopId } }),
    enabled: Boolean(order),
  });
  const { ensureSession, getSession, setStatus, setRiderPosition } = useTracking();
  const session = getSession(orderId);
  const sim = useDeliverySimulation(orderId, session);

  // Create the shared tracking session for this order (once) — pickup/drop
  // only; status and rider position come from the real backend below.
  useEffect(() => {
    if (!order) return;
    const pickup = shop
      ? { lat: shop.lat, lng: shop.lng, label: `${shop.emoji} ${shop.name}` }
      : { ...geocodeSeed(order.shopName), label: order.shopName };
    ensureSession(orderId, {
      pickup,
      drop: { ...geocodeSeed(order.address), label: order.address },
      status: "placed",
      riderName: "Delivery partner",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, orderId]);

  // Real status + the assigned partner's real GPS position, replacing the
  // old fake auto-simulation — see plan/tasks/decisions.md (Phase H, and
  // the real-GPS follow-up) for why this is polling, not a websocket.
  const { data: tracking } = useQuery({
    queryKey: ["order-tracking", orderId],
    queryFn: () => getOrderTracking({ data: { orderId } }),
    enabled: Boolean(order),
    // Same safety-net reasoning as the `order` query above.
    refetchInterval: (query) =>
      query.state.data?.status === "delivered" ? false : live ? SAFETY_NET_POLL_MS : 5000,
  });

  useEffect(() => {
    if (!tracking || !session) return;
    setStatus(orderId, tracking.status);
    if (tracking.rider)
      setRiderPosition(orderId, { lat: tracking.rider.lat, lng: tracking.rider.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking, orderId, Boolean(session)]);

  const isDelivered = order?.status === "delivered";
  const { data: reviewable } = useQuery({
    queryKey: ["reviewable-order", orderId, user?.id],
    queryFn: () => getReviewableOrder({ data: { orderId } }),
    enabled: Boolean(user) && isDelivered,
  });
  const {
    data: myReview,
    isLoading: myReviewLoading,
    refetch: refetchMyReview,
  } = useQuery({
    queryKey: ["my-review", orderId, user?.id],
    queryFn: () => getMyReviewForOrder({ data: { orderId } }),
    enabled: Boolean(user) && isDelivered,
  });

  async function handleReorder() {
    if (!order) return;
    setReordering(true);
    try {
      // Re-fetch the shop's CURRENT real products rather than trusting the
      // order's historical price/stock snapshot — prices and availability
      // may have changed since this order was placed.
      const currentProducts = await getShopProducts({ data: { shopId: order.shopId } });
      const byId = new Map(currentProducts.map((p) => [p.id, p]));

      const toAdd: { product: (typeof currentProducts)[number]; quantity: number }[] = [];
      let unavailableCount = 0;
      for (const line of order.lines) {
        const current = byId.get(line.productId);
        if (!current || !current.inStock) {
          unavailableCount++;
          continue;
        }
        toAdd.push({ product: current, quantity: line.quantity });
      }
      const addedCount = toAdd.length;
      if (addedCount > 0) addManyToCart(toAdd);

      if (addedCount === 0) {
        toast.error("None of these items are available right now.");
        return;
      }
      if (unavailableCount > 0) {
        toast(
          `Added ${addedCount} item${addedCount > 1 ? "s" : ""} — ${unavailableCount} no longer available.`,
        );
      } else {
        toast.success("Added to cart!");
      }
      navigate({ to: "/cart" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reorder right now.");
    } finally {
      setReordering(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      await cancelOrder({ data: { orderId: order.id } });
      await queryClient.invalidateQueries({ queryKey: ["order", orderId, user?.id] });
      toast.success("Order cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel this order.");
    } finally {
      setCancelling(false);
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <h1 className="text-xl font-extrabold">Track order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to view this order.</p>
        <div className="mt-4">
          <EmailPasswordAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

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
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-xl">
                    🛵
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{session.riderName}</p>
                    <p className="text-xs text-muted-foreground">Your delivery partner</p>
                  </div>
                  <Button variant="outline" size="icon" aria-label="Call rider">
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
                {/* Demo / driver simulator — useful when previewing tracking
                    without a real partner sharing GPS. Cosmetic only: writes
                    to the local tracking store, does not push to the backend. */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={sim.running ? sim.stop : sim.start}
                >
                  {sim.running ? (
                    <>
                      <Square className="h-4 w-4" /> Stop demo ride
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Simulate driver (demo)
                    </>
                  )}
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Order summary</h2>
          <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        </div>
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

      {/* Review */}
      {isDelivered &&
        !myReviewLoading &&
        reviewable &&
        (myReview ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 className="text-sm font-bold">Your review</h2>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={
                    n <= myReview.shopRating
                      ? "h-4 w-4 fill-amber-400 text-amber-400"
                      : "h-4 w-4 text-muted-foreground"
                  }
                />
              ))}
            </div>
            {myReview.comment && (
              <p className="mt-2 text-sm text-muted-foreground">{myReview.comment}</p>
            )}
          </div>
        ) : (
          <ReviewForm
            orderId={order.id}
            shopName={reviewable.shopName}
            partnerId={reviewable.partnerId}
            onSubmitted={() => refetchMyReview()}
          />
        ))}

      {(order.status === "placed" || order.status === "accepted") && (
        <Button
          variant="outline"
          size="lg"
          className="mt-4 w-full text-destructive hover:text-destructive"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel order"}
        </Button>
      )}

      <div className="mt-4 flex gap-2">
        <Link to="/orders" className="flex-1">
          <Button variant="outline" size="lg" className="w-full">
            My orders
          </Button>
        </Link>
        <Button
          variant="hero"
          size="lg"
          className="flex-1"
          onClick={handleReorder}
          disabled={reordering}
        >
          {reordering ? <Loader2 className="h-4 w-4 animate-spin" /> : "Order again"}
        </Button>
      </div>
    </AppShell>
  );
}
