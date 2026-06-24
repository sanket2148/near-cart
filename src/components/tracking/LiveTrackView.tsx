// Composite live-tracking view shared by buyer, seller and partner.
// Renders the map, ETA/distance summary, the route endpoints and the
// 5-step status timeline. Role-specific controls slot in via `controls`.
import { Clock, Navigation, Store, MapPin } from "lucide-react";
import { DeliveryMap } from "./DeliveryMap";
import { StatusTimeline } from "./StatusTimeline";
import { TRACK_STATUS_LABEL, type TrackSession } from "@/lib/tracking";
import { useTracking } from "@/lib/tracking";
import type { ReactNode } from "react";

function fmtKm(km: number | null): string {
  if (km == null) return "—";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function LiveTrackView({
  session,
  follow = false,
  controls,
}: {
  session: TrackSession;
  follow?: boolean;
  controls?: ReactNode;
}) {
  const { setRouteInfo } = useTracking();
  const delivered = session.status === "delivered";

  return (
    <div className="space-y-4">
      {/* ETA banner */}
      <div className="overflow-hidden rounded-2xl border border-border shadow-card">
        <div className="bg-gradient-primary p-4 text-primary-foreground">
          <p className="text-xs opacity-90">Order #{session.orderId.slice(-6)}</p>
          <h2 className="mt-0.5 text-2xl font-extrabold">
            {delivered
              ? "Delivered!"
              : session.etaMinutes != null
                ? `Arriving in ~${session.etaMinutes} min`
                : "Preparing your order"}
          </h2>
          <div className="mt-2 flex gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {delivered ? "Completed" : `${session.etaMinutes ?? "—"} min`}
            </span>
            <span className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4" />
              {fmtKm(session.remainingKm)} away
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <DeliveryMap
        pickup={{ ...session.pickup, label: session.pickup.label }}
        drop={{ ...session.drop, label: session.drop.label }}
        rider={session.rider}
        follow={follow}
        className="relative h-72 w-full overflow-hidden rounded-2xl border border-border shadow-card"
        onRouteComputed={({ distanceKm, durationMin }) =>
          setRouteInfo(session.orderId, distanceKm, durationMin)
        }
      />

      {/* Current status pill */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {!delivered && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            )}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-sm font-bold">
            {TRACK_STATUS_LABEL[session.status]}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{session.riderName}</span>
      </div>

      {/* Route endpoints */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
        <p className="flex items-start gap-2">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block text-xs font-bold text-muted-foreground">
              PICKUP
            </span>
            {session.pickup.label}
          </span>
        </p>
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            <span className="block text-xs font-bold text-muted-foreground">
              DROP
            </span>
            {session.drop.label}
          </span>
        </p>
      </div>

      {controls}

      {/* Timeline */}
      <StatusTimeline status={session.status} />
    </div>
  );
}
