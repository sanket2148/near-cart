import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useCart } from "@/lib/cart";
import { getShop, formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [{ title: "Your Cart — NearCart" }],
  }),
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { lines, shopId, subtotal, setQty, add, remove, itemCount } = useCart();
  const shop = shopId ? getShop(shopId) : undefined;

  if (itemCount === 0 || !shop) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-5xl">🛒</p>
          <h1 className="mt-4 text-xl font-bold">Your cart is empty</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add items from a shop near you to get started.
          </p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="hero" size="lg">
              Browse shops
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const deliveryFee = subtotal >= shop.freeAbove ? 0 : shop.deliveryFee;
  const handling = 9;
  const total = subtotal + deliveryFee + handling;

  return (
    <AppShell subtitle={shop.area}>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Continue shopping
      </Link>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-hero text-2xl">
          {shop.emoji}
        </span>
        <div>
          <h1 className="font-bold leading-tight">{shop.name}</h1>
          <p className="text-xs text-muted-foreground">Arriving in {shop.etaMinutes} min</p>
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 space-y-2.5">
        {lines.map(({ product, quantity }) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-xl">
              {product.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-semibold">{product.name}</h4>
              <p className="text-xs text-muted-foreground">
                {product.unit} · {formatINR(product.price)}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-primary px-1.5 py-1 text-primary-foreground">
              <button onClick={() => setQty(product.id, quantity - 1)} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-primary-foreground/15" aria-label="Decrease">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{quantity}</span>
              <button onClick={() => add(product)} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-primary-foreground/15" aria-label="Increase">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => remove(product.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Bill */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-bold">Bill details</h2>
        <Row label="Item total" value={formatINR(subtotal)} />
        <Row
          label="Delivery fee"
          value={deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)}
          accent={deliveryFee === 0}
        />
        <Row label="Handling charge" value={formatINR(handling)} />
        {deliveryFee > 0 && (
          <p className="mt-1 text-xs text-primary">
            Add {formatINR(shop.freeAbove - subtotal)} more for free delivery
          </p>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-border pt-3 text-base font-extrabold">
          <span>To pay</span>
          <span>{formatINR(total)}</span>
        </div>
      </div>

      <Button
        variant="hero"
        size="xl"
        className="mt-4 w-full"
        onClick={() => navigate({ to: "/checkout" })}
      >
        Proceed to checkout · {formatINR(total)}
      </Button>
    </AppShell>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-semibold text-primary" : "font-medium"}>{value}</span>
    </div>
  );
}
