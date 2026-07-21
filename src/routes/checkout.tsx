import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Wallet, Check, Clock, Zap, Loader2, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmailOtpAuth } from "@/components/EmailOtpAuth";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useLocation } from "@/lib/location";
import { formatINR } from "@/lib/data";
import { getShop } from "@/lib/catalog/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { placeOrder as placeOrderFn, quoteOrder as quoteOrderFn } from "@/lib/orders/api.functions";
import { verifyPayment as verifyPaymentFn } from "@/lib/payments/api.functions";
import { openRazorpayCheckout } from "@/lib/payments/checkout-widget";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — NearCart" }] }),
  component: CheckoutPage,
});

const payments = [
  { id: "upi", label: "UPI", hint: "GPay, PhonePe, Paytm" },
  { id: "card", label: "Card", hint: "Credit / Debit" },
  { id: "cod", label: "Cash on Delivery", hint: "Pay at your door" },
] as const;

function CheckoutPage() {
  const navigate = useNavigate();
  const { lines, shopId, subtotal, itemCount, clear } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { state: locationState } = useLocation();
  const { data: shop } = useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => getShop({ data: { shopId: shopId! } }),
    enabled: Boolean(shopId),
  });

  const [address, setAddress] = useState("Home · 12, 5th Cross, Koramangala, Bengaluru");
  const [slot, setSlot] = useState<"now" | "later">("now");
  const [payment, setPayment] = useState<(typeof payments)[number]["id"]>("upi");
  const [placing, setPlacing] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);

  if (itemCount === 0 || !shop) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-lg font-semibold">Nothing to check out</p>
          <Link to="/" className="mt-3 inline-block font-semibold text-primary">
            ← Browse shops
          </Link>
        </div>
      </AppShell>
    );
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

  const deliveryFee = subtotal >= shop.freeAbove ? 0 : shop.deliveryFee;
  const handling = 9;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee + handling - discount);

  if (!user) {
    return (
      <AppShell subtitle={shop.area} hideNav>
        <Link
          to="/cart"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to cart
        </Link>
        <h1 className="text-xl font-extrabold">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} item{itemCount > 1 ? "s" : ""} · {formatINR(total)} — log in to place your
          order. Your cart stays exactly as it is.
        </p>
        <div className="mt-4">
          <EmailOtpAuth
            title="Log in to continue"
            subtitle="We'll only use this to send order updates."
            onSuccess={() => toast.success("Logged in!")}
          />
        </div>
      </AppShell>
    );
  }

  async function handleApplyCoupon() {
    if (!shop || !couponInput.trim()) return;
    setApplyingCoupon(true);
    try {
      const quote = await quoteOrderFn({
        data: {
          shopId: shop.id,
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          couponCode: couponInput.trim(),
        },
      });
      if (quote.couponError) {
        toast.error(quote.couponError);
        setAppliedCoupon(null);
      } else {
        const code = couponInput.trim().toUpperCase();
        setAppliedCoupon({ code, discountAmount: quote.discountAmount / 100 });
        toast.success(`"${code}" applied — ${formatINR(quote.discountAmount / 100)} off`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't apply coupon.");
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
  }

  async function handlePlaceOrder() {
    if (!shop || !user) return;
    setPlacing(true);
    try {
      const order = await placeOrderFn({
        data: {
          shopId: shop.id,
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          paymentMethod: payment,
          addressText: address,
          lat: locationState.coords?.lat ?? shop.lat,
          lng: locationState.coords?.lng ?? shop.lng,
          couponCode: appliedCoupon?.code,
        },
      });

      // Real gateway path (Phase F — only kicks in once RAZORPAY_KEY_ID/
      // RAZORPAY_KEY_SECRET are configured server-side; absent today, so
      // this branch is currently unreachable and unverified against a live
      // gateway — see plan/tasks/decisions.md).
      if (order.payment?.required) {
        await openRazorpayCheckout({
          keyId: order.payment.keyId,
          amount: order.payment.amount,
          currency: order.payment.currency,
          razorpayOrderId: order.payment.razorpayOrderId,
          shopName: shop.name,
          email: user.email,
          onSuccess: async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
            try {
              await verifyPaymentFn({
                data: { orderId: order.id, razorpayOrderId, razorpayPaymentId, razorpaySignature },
              });
              clear();
              toast.success("Payment successful!");
              navigate({ to: "/order/$orderId", params: { orderId: order.id } });
            } catch {
              toast.error("Payment verification failed — contact support if you were charged.");
            } finally {
              setPlacing(false);
            }
          },
          onDismiss: () => {
            // The order row already exists (unpaid) — there's no retry-payment
            // UI yet (Phase F scaffold, see plan/tasks/decisions.md), so this
            // is honest about the order being stuck rather than implying a
            // retry path that doesn't exist.
            toast.info("Payment cancelled. Your order wasn't confirmed — please place it again.");
            setPlacing(false);
          },
        });
        return;
      }

      clear();
      toast.success("Order placed!");
      navigate({ to: "/order/$orderId", params: { orderId: order.id } });
      setPlacing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order. Please try again.");
      setPlacing(false);
    }
  }

  return (
    <AppShell subtitle={shop.area} hideNav>
      <Link
        to="/cart"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to cart
      </Link>

      <h1 className="text-xl font-extrabold">Checkout</h1>

      {/* Address */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold">
          <MapPin className="h-4 w-4 text-primary" /> Delivery address
        </div>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
        />
      </section>

      {/* Slot */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Clock className="h-4 w-4 text-primary" /> Delivery time
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SlotButton
            active={slot === "now"}
            onClick={() => setSlot("now")}
            icon={<Zap className="h-4 w-4" />}
            title="Now"
            sub={`~${shop.etaMinutes} min`}
          />
          <SlotButton
            active={slot === "later"}
            onClick={() => setSlot("later")}
            icon={<Clock className="h-4 w-4" />}
            title="Schedule"
            sub="Pick a slot"
          />
        </div>
      </section>

      {/* Payment */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Wallet className="h-4 w-4 text-primary" /> Payment method
        </div>
        <div className="space-y-2">
          {payments.map((p) => (
            <button
              key={p.id}
              onClick={() => setPayment(p.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                payment === p.id ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div>
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.hint}</p>
              </div>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border",
                  payment === p.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {payment === p.id && <Check className="h-3 w-3" />}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Coupon */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Tag className="h-4 w-4 text-primary" /> Coupon
        </div>
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div>
              <p className="text-sm font-bold text-primary">{appliedCoupon.code}</p>
              <p className="text-xs text-muted-foreground">
                {formatINR(appliedCoupon.discountAmount)} off applied
              </p>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Remove coupon"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleApplyCoupon}
              disabled={applyingCoupon || !couponInput.trim()}
            >
              {applyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        )}
      </section>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <div>
          <p className="text-xs text-muted-foreground">
            Total payable{discount > 0 && ` · ${formatINR(discount)} saved`}
          </p>
          <p className="text-xl font-extrabold">{formatINR(total)}</p>
        </div>
        <Button variant="hero" size="xl" onClick={handlePlaceOrder} disabled={placing}>
          {placing ? "Placing…" : "Place Order"}
        </Button>
      </div>
    </AppShell>
  );
}

function SlotButton({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-lg border p-3 transition-colors",
        active ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <span
        className={cn("flex items-center gap-1.5 text-sm font-semibold", active && "text-primary")}
      >
        {icon} {title}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}
