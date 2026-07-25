import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CreditCard, Smartphone, Landmark, Banknote } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/lib/auth";
import { listOrders } from "@/lib/orders/api.functions";
import { formatINR } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payment Methods — NearCart" }] }),
  component: PaymentsPage,
});

const METHOD_META: Record<string, { label: string; icon: typeof CreditCard }> = {
  upi: { label: "UPI", icon: Smartphone },
  card: { label: "Card", icon: CreditCard },
  netbanking: { label: "Netbanking", icon: Landmark },
  cod: { label: "Cash on delivery", icon: Banknote },
};

function PaymentsPage() {
  const { user, loading: authLoading } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => listOrders(),
    enabled: Boolean(user),
  });

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
        <h1 className="text-xl font-extrabold">Payment Methods</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to see your payment history.</p>
        <div className="mt-4">
          <EmailPasswordAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold">Payment Methods</h1>

      <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground">
        NearCart doesn't store your card, UPI, or bank details — every order is paid for directly
        through Razorpay's secure checkout, and you choose UPI, card, netbanking, or cash on
        delivery fresh each time. Your payment history is below.
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-5xl">💳</p>
          <h2 className="mt-4 text-lg font-bold">No payments yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your order payments will show up here once you place one.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {orders.map((o) => {
            const meta = METHOD_META[o.paymentMethod] ?? {
              label: o.paymentMethod,
              icon: CreditCard,
            };
            const Icon = meta.icon;
            return (
              <Link
                key={o.id}
                to="/order/$orderId"
                params={{ orderId: o.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-float"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{o.shopName}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.placedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold">{formatINR(o.total)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
