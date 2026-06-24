// Vertical 5-step status timeline shared by all roles.
import { CheckCircle2, Circle } from "lucide-react";
import { TRACK_STEPS, TRACK_ORDER, type TrackStatus } from "@/lib/tracking";
import { cn } from "@/lib/utils";

export function StatusTimeline({ status }: { status: TrackStatus }) {
  const currentIndex = TRACK_ORDER.indexOf(status);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      {TRACK_STEPS.map((step, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              {done ? (
                <CheckCircle2
                  className={cn("h-6 w-6", current ? "text-accent" : "text-primary")}
                />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground/40" />
              )}
              {i < TRACK_STEPS.length - 1 && (
                <span
                  className={cn(
                    "my-0.5 w-0.5 flex-1",
                    i < currentIndex ? "bg-primary" : "bg-border",
                  )}
                  style={{ minHeight: 18 }}
                />
              )}
            </div>
            <div className={cn("pb-3", !done && "opacity-50")}>
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
