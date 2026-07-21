import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

// Shared across seller/partner/admin dashboards — previously each rebuilt
// nearly identical tile markup independently (see plan/tasks/decisions.md's
// UI/UX audit, 2026-07-19). One canonical style, adapted via props.
type Props = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  bg?: string;
};

export function StatCard({ icon: Icon, label, value, sub, tone = "text-primary", bg = "bg-primary/10" }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", bg, tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
