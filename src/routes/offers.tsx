import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Percent, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listActiveCoupons } from "@/lib/offers/api.functions";
import { formatINR } from "@/lib/data";

export const Route = createFileRoute("/offers")({
  head: () => ({ meta: [{ title: "Offers & Coupons — NearCart" }] }),
  component: OffersPage,
});

function OffersPage() {
  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: () => listActiveCoupons(),
  });

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => toast.success(`Copied "${code}"`),
      () => toast.error("Couldn't copy the code."),
    );
  }

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold">Offers & Coupons</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Apply these at checkout to save on your order.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-5xl">🏷️</p>
          <h2 className="mt-4 text-lg font-bold">No active offers right now</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Check back soon — new offers show up here as they go live.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-card shadow-card"
            >
              <div className="flex items-start gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Percent className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold leading-tight">{c.title}</p>
                  {c.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.discountType === "percent"
                      ? `${c.discountValue}% off`
                      : `${formatINR(c.discountValue)} off`}
                    {c.minOrderAmount > 0 && ` · on orders above ${formatINR(c.minOrderAmount)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyCode(c.code)}
                className="flex w-full items-center justify-between border-t border-dashed border-primary/30 bg-primary/[0.04] px-4 py-2.5 text-sm font-bold text-primary"
              >
                <span className="tracking-wider">{c.code}</span>
                <span className="flex items-center gap-1 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
