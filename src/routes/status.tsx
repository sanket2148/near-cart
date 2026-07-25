import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Loader2 } from "lucide-react";
import { getSystemStatus } from "@/lib/status/api.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "System Status — NearCart" },
      { name: "description", content: "Live status of NearCart's core services." },
    ],
  }),
  component: StatusPage,
});

const OVERALL_COPY: Record<string, { label: string; className: string }> = {
  operational: { label: "All systems operational", className: "bg-success/10 text-success" },
  degraded: { label: "Degraded performance", className: "bg-amber-500/10 text-amber-600" },
  down: { label: "Service disruption", className: "bg-destructive/10 text-destructive" },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  operational: <CheckCircle2 className="h-4 w-4 text-success" />,
  degraded: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  down: <XCircle className="h-4 w-4 text-destructive" />,
  not_configured: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABEL: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not configured",
};

// Deliberately NOT wrapped in AppShell — a status page needs to load
// independently of the rest of the app (including the catalog/location
// queries AppShell's nav depends on), since it's exactly what someone
// checks *during* an incident that might affect other parts of the app.
function StatusPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["system-status"],
    queryFn: () => getSystemStatus(),
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-lg font-extrabold">
          Near<span className="text-primary">Cart</span>
        </span>
        <span className="text-sm text-muted-foreground">Status</span>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div
            className={cn(
              "mb-4 rounded-2xl p-4 text-center text-sm font-bold shadow-card",
              OVERALL_COPY[data.overall].className,
            )}
          >
            {OVERALL_COPY[data.overall].label}
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {data.services.map((service) => (
              <li key={service.name} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{service.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{service.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                  {STATUS_ICON[service.status]}
                  <span>{STATUS_LABEL[service.status]}</span>
                  {service.latencyMs != null && (
                    <span className="text-muted-foreground">({service.latencyMs}ms)</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Last checked {new Date(dataUpdatedAt).toLocaleTimeString()} — refreshes automatically
          </p>
        </>
      )}
    </div>
  );
}
