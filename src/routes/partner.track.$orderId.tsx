import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ArrowLeft, Navigation2, Radio, Play, Square, ArrowRight, ExternalLink } from "lucide-react";
import { usePartner, nextJobStatus, JOB_ACTION_LABEL } from "@/lib/partner";
import { useTracking } from "@/lib/tracking";
import { geocodeSeed } from "@/lib/geo";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useDeliverySimulation } from "@/hooks/useDeliverySimulation";
import { pushPartnerLocation } from "@/lib/tracking-data/api.functions";
import { LiveTrackView } from "@/components/tracking/LiveTrackView";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/partner/track/$orderId")({
  component: PartnerTrack,
});

const LOCATION_PUSH_MIN_INTERVAL_MS = 8000;

function PartnerTrack() {
  const { orderId } = Route.useParams();
  const { jobs, profile, advanceJob } = usePartner();
  const job = jobs.find((j) => j.orderId === orderId);
  const { ensureSession, getSession, setRiderPosition } = useTracking();
  const session = getSession(orderId);
  const lastPushRef = useRef(0);

  const live = useLiveLocation((pos) => {
    // Cosmetic local echo so this partner's own map updates instantly...
    setRiderPosition(orderId, pos);
    // ...and throttled real push so the customer's poll picks it up too.
    if (!profile.id) return;
    const now = Date.now();
    if (now - lastPushRef.current < LOCATION_PUSH_MIN_INTERVAL_MS) return;
    lastPushRef.current = now;
    void pushPartnerLocation({ data: { lat: pos.lat, lng: pos.lng } });
  });
  const sim = useDeliverySimulation(orderId, session);

  useEffect(() => {
    if (!job) return;
    ensureSession(orderId, {
      pickup: { ...geocodeSeed(job.shopAddress), label: `${job.shopEmoji} ${job.shopName}` },
      drop: { ...geocodeSeed(job.customerAddress), label: job.customerAddress },
      status: job.status === "picked_up" ? "in_transit" : "ready",
      riderName: profile.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, orderId]);

  if (!job) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">Job not found</p>
        <Link to="/partner/deliveries" className="mt-3 inline-block font-semibold text-primary">
          ← Back to deliveries
        </Link>
      </div>
    );
  }

  const next = nextJobStatus(job.status);
  const mapsUrl = session
    ? `https://www.google.com/maps/dir/?api=1&origin=${session.pickup.lat},${session.pickup.lng}&destination=${session.drop.lat},${session.drop.lng}&travelmode=driving`
    : "#";

  return (
    <div className="space-y-4">
      <Link
        to="/partner/deliveries"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to deliveries
      </Link>

      <h1 className="text-xl font-extrabold">Live navigation</h1>

      {session ? (
        <LiveTrackView
          session={session}
          follow
          controls={
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              {/* GPS sharing */}
              {live.watching ? (
                <Button variant="outline" className="w-full" onClick={live.stop}>
                  <Square className="h-4 w-4" /> Stop sharing location
                </Button>
              ) : (
                <Button variant="hero" className="w-full" onClick={live.start}>
                  <Radio className="h-4 w-4" /> Share my live location
                </Button>
              )}

              {live.error && (
                <p className="text-xs font-medium text-destructive">{live.error}</p>
              )}
              {live.watching && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Broadcasting live GPS{live.accuracy ? ` · ±${Math.round(live.accuracy)}m` : ""}
                </p>
              )}

              {/* Demo movement (when GPS isn't available) */}
              {!live.watching && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={sim.running ? sim.stop : sim.start}
                >
                  {sim.running ? (
                    <>
                      <Square className="h-4 w-4" /> Stop demo ride
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Simulate ride (demo)
                    </>
                  )}
                </Button>
              )}

              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4" /> Open in Google Maps
                </Button>
              </a>

              {/* Advance order status — this is the real backend action now
                  (same one JobCard on /partner/deliveries calls), not just a
                  local tracking-store write. */}
              {next ? (
                <Button
                  variant="accent"
                  className="w-full"
                  onClick={() => {
                    advanceJob(job.id);
                    toast.success(JOB_ACTION_LABEL[job.status] ?? "Status updated");
                  }}
                >
                  {JOB_ACTION_LABEL[job.status]} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-primary">
                  <Navigation2 className="h-4 w-4" /> Delivery completed
                </p>
              )}
            </div>
          }
        />
      ) : (
        <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}
