import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MapPin, Wallet, Check, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useCart } from "@/lib/cart";
import { getShop, formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { saveOrder, newOrderId, buildLines } from "@/lib/orders";
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
  const shop = shopId ? getShop(shopId) : undefined;

  const [address, setAddress] = useState("Home · 12, 5th Cross, Koramangala, Bengaluru");
  const [slot, setSlot] = useState<"now" | "later">("now");
  const [payment, setPayment] = useState<(typeof payments)[number]["id"]>("upi");
  const [placing, setPlacing] = useState(false);

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

  const deliveryFee = subtotal >= shop.freeAbove ? 0 : shop.deliveryFee;
  const handling = 9;
  const total = subtotal + deliveryFee + handling;

  function placeOrder() {
    if (!shop) return;
    setPlacing(true);
    const id = newOrderId();
    setTimeout(() => {
      saveOrder({
        id,
        shopId: shop.id,
        shopName: shop.name,
        shopEmoji: shop.emoji,
        lines: buildLines(lines),
        subtotal,
        deliveryFee,
        handling,
        total,
        paymentMethod: payments.find((p) => p.id === payment)!.label,
        address,
        etaMinutes: shop.etaMinutes,
        placedAt: Date.now(),
        status: "placed",
      });
      clear();
      toast.success("Order placed!");
      navigate({ to: "/order/$orderId", params: { orderId: id } });
    }, 700);
  }

  return (
    <AppShell subtitle={shop.area} hideNav>
      <Link to="/cart" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
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
                  payment === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {payment === p.id && <Check className="h-3 w-3" />}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <div>
          <p className="text-xs text-muted-foreground">Total payable</p>
          <p className="text-xl font-extrabold">{formatINR(total)}</p>
        </div>
        <Button variant="hero" size="xl" onClick={placeOrder} disabled={placing}>
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
      <span className={cn("flex items-center gap-1.5 text-sm font-semibold", active && "text-primary")}>
        {icon} {title}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}
