import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Store, Bike, Package, IndianRupee, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatINR } from "@/lib/data";
import { getAdminStats } from "@/lib/admin-data/api.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getAdminStats(),
  });

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalShops = Object.values(stats.shopsByStatus).reduce((a, b) => a + b, 0);
  const totalPartners = Object.values(stats.partnersByStatus).reduce((a, b) => a + b, 0);
  const totalOrders = Object.values(stats.ordersByStatus).reduce((a, b) => a + b, 0);

  const orderChartData = Object.entries(stats.ordersByStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count }));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold">Overview</h2>
        <p className="text-xs text-muted-foreground">
          Live aggregate counts — computed on page load, not a stored time series. "Revenue" =
          confirmed order value (paid or COD-confirmed onward), not net-of-refunds.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={Store}
          label="Shops"
          value={String(totalShops)}
          sub={`${stats.shopsByStatus.approved ?? 0} approved`}
        />
        <StatCard
          icon={Bike}
          label="Partners"
          value={String(totalPartners)}
          sub={`${stats.partnersByStatus.active ?? 0} active`}
        />
        <StatCard icon={Package} label="Orders" value={String(totalOrders)} sub="last 2,000" />
        <StatCard
          icon={IndianRupee}
          label="Revenue today"
          value={formatINR(stats.revenueToday)}
          sub={`${formatINR(stats.revenueWeek)} this week`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Verification approval rate"
          value={
            stats.verificationApprovalRate == null
              ? "—"
              : `${Math.round(stats.verificationApprovalRate * 100)}%`
          }
        />
      </div>

      <Card className="mt-6 rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="text-sm font-bold">Orders by status</CardTitle>
        </CardHeader>
        <CardContent className="h-72 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orderChartData} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="status"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
