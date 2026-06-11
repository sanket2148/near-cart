import { createFileRoute } from "@tanstack/react-router";
import { IndianRupee, Wallet, PackageCheck, TrendingUp } from "lucide-react";
import { usePartner, jobEarning } from "@/lib/partner";
import { formatINR } from "@/lib/data";

export const Route = createFileRoute("/partner/earnings")({
  component: PartnerEarnings,
});

function PartnerEarnings() {
  const { jobs, stats } = usePartner();
  const completed = jobs
    .filter((j) => j.status === "delivered")
    .sort((a, b) => (b.completedAt ?? b.assignedAt) - (a.completedAt ?? a.assignedAt));

  const totalEarnings = completed.reduce((sum, j) => sum + jobEarning(j), 0);
  const totalTips = completed.reduce((sum, j) => sum + (j.tip ?? 0), 0);

  const tiles = [
    {
      label: "Today",
      value: formatINR(stats.earningsToday),
      icon: IndianRupee,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "This week",
      value: formatINR(stats.earningsWeek),
      icon: TrendingUp,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total earned",
      value: formatINR(totalEarnings),
      icon: Wallet,
      tone: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Deliveries",
      value: String(stats.totalDeliveries),
      icon: PackageCheck,
      tone: "text-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Earnings</h1>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.bg} ${t.tone}`}>
              <t.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-extrabold leading-none">{t.value}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      {totalTips > 0 && (
        <p className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm font-semibold">
          💝 Customers tipped you {formatINR(totalTips)} so far — great service!
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-bold">Payout history</h2>
        {completed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Complete deliveries to see payouts here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {completed.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {j.shopEmoji} {j.shopName} → {j.customerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{j.orderId.slice(-5)} · {j.distanceKm} km ·{" "}
                    {new Date(j.completedAt ?? j.assignedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                    {j.tip ? ` · tip ${formatINR(j.tip)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-extrabold text-primary">
                  +{formatINR(jobEarning(j))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
