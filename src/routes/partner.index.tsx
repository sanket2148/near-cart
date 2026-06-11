import { createFileRoute, Link } from "@tanstack/react-router";
import {
  IndianRupee,
  Bike,
  PackageCheck,
  Bell,
  ArrowRight,
  MapPin,
  Banknote,
  Wallet,
} from "lucide-react";
import { usePartner, JOB_STATUS_LABEL, jobEarning, timeAgo } from "@/lib/partner";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/partner/")({
  component: PartnerDashboard,
});

function PartnerDashboard() {
  const { profile, stats, jobs } = usePartner();
  const newJobs = jobs.filter((j) => j.status === "new").slice(0, 3);

  const tiles = [
    {
      label: "Earnings today",
      value: formatINR(stats.earningsToday),
      icon: IndianRupee,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "New requests",
      value: String(stats.newCount),
      icon: Bell,
      tone: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Delivered today",
      value: String(stats.deliveredToday),
      icon: PackageCheck,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "This week",
      value: formatINR(stats.earningsWeek),
      icon: Wallet,
      tone: "text-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">
          Hello, {profile.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.online
            ? "You're online — new delivery requests will appear here."
            : "You're offline. Go online to receive delivery requests."}
        </p>
      </div>

      {/* Stat tiles */}
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

      {/* Active delivery */}
      {stats.activeJob && (
        <Link
          to="/partner/deliveries"
          className="block rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-card"
        >
          <p className="flex items-center gap-2 text-xs font-bold text-primary">
            <Bike className="h-4 w-4" /> Active delivery ·{" "}
            {JOB_STATUS_LABEL[stats.activeJob.status]}
          </p>
          <p className="mt-2 text-sm font-bold">
            {stats.activeJob.shopEmoji} {stats.activeJob.shopName} →{" "}
            {stats.activeJob.customerName}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {stats.activeJob.customerAddress}
          </p>
          {stats.codToCollect > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
              <Banknote className="h-3.5 w-3.5" /> Collect {formatINR(stats.codToCollect)} cash
            </p>
          )}
          <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary">
            Continue delivery <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      {/* New requests */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <Bell className="h-4 w-4 text-accent" /> New requests
          </h2>
          <Link to="/partner/deliveries" className="text-sm font-semibold text-primary">
            View all
          </Link>
        </div>

        {newJobs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No new requests right now. Stay online!
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {newJobs.map((j) => (
              <li key={j.id}>
                <Link
                  to="/partner/deliveries"
                  className="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-colors hover:bg-accent/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {j.shopEmoji} {j.shopName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {j.distanceKm} km · {j.itemCount} item{j.itemCount > 1 ? "s" : ""} ·{" "}
                      {timeAgo(j.assignedAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-primary">
                      +{formatINR(jobEarning(j))}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        <Button asChild variant="hero" size="lg">
          <Link to="/partner/deliveries">
            <Bike className="h-4 w-4" /> Deliveries
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/partner/earnings">
            <IndianRupee className="h-4 w-4" /> Earnings
          </Link>
        </Button>
      </section>

      <p className="pt-1 text-center text-xs text-muted-foreground">
        {stats.totalDeliveries} deliveries completed · {profile.area}
      </p>
    </div>
  );
}
