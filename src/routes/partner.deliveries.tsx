import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  ChevronRight,
  Phone,
  MapPin,
  Store,
  ArrowRight,
  Banknote,
  Navigation2,
} from "lucide-react";
import {
  usePartner,
  JOB_STATUS_LABEL,
  JOB_ACTION_LABEL,
  nextJobStatus,
  jobEarning,
  timeAgo,
  type DeliveryJob,
  type JobStatus,
} from "@/lib/partner";
import { formatINR } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/partner/deliveries")({
  component: PartnerDeliveries,
});

type Filter = "new" | "active" | "completed";

const statusTone: Record<JobStatus, string> = {
  new: "bg-accent/15 text-accent",
  accepted: "bg-primary/10 text-primary",
  at_shop: "bg-primary/10 text-primary",
  picked_up: "bg-primary/15 text-primary",
  delivered: "bg-muted text-muted-foreground",
  declined: "bg-destructive/10 text-destructive",
};

function PartnerDeliveries() {
  const { jobs } = usePartner();
  const [filter, setFilter] = useState<Filter>("new");

  const filtered = jobs.filter((j) => {
    if (filter === "new") return j.status === "new";
    if (filter === "active")
      return ["accepted", "at_shop", "picked_up"].includes(j.status);
    return ["delivered", "declined"].includes(j.status);
  });

  const counts = {
    new: jobs.filter((j) => j.status === "new").length,
    active: jobs.filter((j) => ["accepted", "at_shop", "picked_up"].includes(j.status))
      .length,
    completed: jobs.filter((j) => ["delivered", "declined"].includes(j.status)).length,
  };

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "new", label: "New", count: counts.new },
    { id: "active", label: "Active", count: counts.active },
    { id: "completed", label: "Done", count: counts.completed },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Deliveries</h1>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
              filter === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1 text-xs">({t.count})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No deliveries here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({ job }: { job: DeliveryJob }) {
  const { acceptJob, declineJob, advanceJob } = usePartner();
  const [open, setOpen] = useState(job.status === "new");

  const next = nextJobStatus(job.status);
  const isActive = ["accepted", "at_shop", "picked_up"].includes(job.status);

  const handleAdvance = () => {
    advanceJob(job.id);
    const n = nextJobStatus(job.status);
    if (n === "delivered") {
      toast.success(`Delivered! You earned ${formatINR(jobEarning(job))}`);
    } else if (n) {
      toast.success(JOB_STATUS_LABEL[n]);
    }
  };

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold">
              {job.shopEmoji} {job.shopName}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                statusTone[job.status],
              )}
            >
              {JOB_STATUS_LABEL[job.status]}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            #{job.orderId.slice(-5)} · {job.distanceKm} km · {timeAgo(job.assignedAt)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-primary">
            +{formatINR(jobEarning(job))}
          </span>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {/* Route: pickup → drop */}
          <div className="space-y-3 rounded-xl bg-muted/50 p-3 text-sm">
            <p className="flex items-start gap-2">
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="block font-bold">Pickup · {job.shopName}</span>
                <span className="text-xs text-muted-foreground">{job.shopAddress}</span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="block font-bold">Drop · {job.customerName}</span>
                <span className="text-xs text-muted-foreground">{job.customerAddress}</span>
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <span>{job.customerPhone}</span>
              <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold">
                {job.itemCount} item{job.itemCount > 1 ? "s" : ""} · {job.paymentMethod}
              </span>
            </p>
          </div>

          {/* COD reminder */}
          {job.paymentMethod === "COD" && job.status !== "delivered" && job.status !== "declined" && (
            <p className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm font-semibold text-accent">
              <Banknote className="h-4 w-4" /> Collect {formatINR(job.orderValue)} cash on delivery
            </p>
          )}

          {/* Payout breakdown */}
          <div className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            <span className="text-muted-foreground">
              Delivery fee {formatINR(job.payout)}
              {job.tip ? ` + tip ${formatINR(job.tip)}` : ""}
            </span>
            <span className="font-extrabold text-primary">+{formatINR(jobEarning(job))}</span>
          </div>

          {/* Actions */}
          {job.status === "new" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  declineJob(job.id);
                  toast("Request declined");
                }}
              >
                <X className="h-4 w-4" /> Decline
              </Button>
              <Button
                variant="hero"
                onClick={() => {
                  acceptJob(job.id);
                  toast.success("Delivery accepted — head to the shop");
                }}
              >
                <Check className="h-4 w-4" /> Accept
              </Button>
            </div>
          ) : isActive && next ? (
            <div className="space-y-2">
              <Link
                to="/partner/track/$orderId"
                params={{ orderId: job.orderId }}
                className="block"
              >
                <Button variant="outline" className="w-full">
                  <Navigation2 className="h-4 w-4" /> Live navigation & map
                </Button>
              </Link>
              <Button variant="hero" className="w-full" onClick={handleAdvance}>
                {JOB_ACTION_LABEL[job.status]} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm font-semibold text-muted-foreground">
              {job.status === "delivered" ? "✓ Completed" : "Declined"}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
