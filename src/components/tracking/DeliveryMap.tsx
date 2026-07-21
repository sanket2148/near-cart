// Interactive Google Maps view for live delivery tracking.
// Renders pickup, drop and rider markers, draws the road route (Directions API
// via the JS SDK), fits bounds, and animates the rider marker smoothly.
//
// Rider animation:
//  - New target positions are lerp'd from the previous position over ~1s so
//    a 3-second GPS push doesn't teleport the marker across the map.
//  - Bearing is computed between the previous and next fix and the marker
//    icon is rotated to face the direction of travel.
//  - As the rider moves we recompute a dynamic "remaining" polyline from the
//    live rider position → drop, so the remaining road path shrinks in real
//    time (throttled to avoid spamming the Directions API).
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, onMapsAuthFailure } from "@/lib/maps";
import { Loader2, MapPinned } from "lucide-react";
import type { LatLng } from "@/lib/geo";

type Props = {
  pickup: LatLng & { label?: string };
  drop: LatLng & { label?: string };
  rider?: LatLng | null;
  showRoute?: boolean;
  follow?: boolean;
  className?: string;
  onRouteComputed?: (info: { distanceKm: number; durationMin: number }) => void;
};

const RIDER_LERP_MS = 1000;
const REMAINING_ROUTE_MIN_INTERVAL_MS = 4000;

function bearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function DeliveryMap({
  pickup,
  drop,
  rider,
  showRoute = true,
  follow = false,
  className,
  onRouteComputed,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pickupMarker = useRef<any>(null);
  const dropMarker = useRef<any>(null);
  const riderMarker = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  const remainingRenderer = useRef<any>(null);
  const lastRouteKey = useRef<string>("");
  const lastRemainingAt = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const currentRiderPos = useRef<LatLng | null>(null);
  const currentHeading = useRef<number>(0);
  const routeCb = useRef(onRouteComputed);
  routeCb.current = onRouteComputed;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Init map + base markers once.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onMapsAuthFailure(() => {
      if (!cancelled) setStatus("error");
    });
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !divRef.current) return;
        const maps = google.maps;
        const map = new maps.Map(divRef.current, {
          center: pickup,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        mapRef.current = map;

        pickupMarker.current = new maps.Marker({
          position: pickup,
          map,
          title: pickup.label || "Pickup",
          label: { text: "🏪", fontSize: "18px" },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: "#16a34a",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        dropMarker.current = new maps.Marker({
          position: drop,
          map,
          title: drop.label || "Drop",
          label: { text: "📍", fontSize: "18px" },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: "#ea580c",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        if (showRoute) {
          // Full pickup → drop route (drawn once, faded).
          directionsRenderer.current = new maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#16a34a",
              strokeWeight: 4,
              strokeOpacity: 0.35,
            },
          });
          // Remaining rider → drop route (updated as rider moves).
          remainingRenderer.current = new maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#16a34a",
              strokeWeight: 6,
              strokeOpacity: 0.95,
            },
          });
        }

        const bounds = new maps.LatLngBounds();
        bounds.extend(pickup);
        bounds.extend(drop);
        map.fitBounds(bounds, 56);

        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      unsubscribe();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update pickup/drop positions if they change.
  useEffect(() => {
    if (status !== "ready") return;
    pickupMarker.current?.setPosition(pickup);
    dropMarker.current?.setPosition(drop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pickup.lat, pickup.lng, drop.lat, drop.lng]);

  // Compute the full pickup → drop route once endpoints are known.
  useEffect(() => {
    if (status !== "ready" || !showRoute) return;
    const google = (window as any).google;
    if (!google?.maps) return;
    const key = `${pickup.lat},${pickup.lng}|${drop.lat},${drop.lng}`;
    if (key === lastRouteKey.current) return;
    lastRouteKey.current = key;

    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: pickup,
        destination: drop,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, st: string) => {
        if (st === "OK" && result) {
          directionsRenderer.current?.setDirections(result);
          const leg = result.routes?.[0]?.legs?.[0];
          if (leg && routeCb.current) {
            routeCb.current({
              distanceKm: (leg.distance?.value ?? 0) / 1000,
              durationMin: Math.round((leg.duration?.value ?? 0) / 60),
            });
          }
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, showRoute, pickup.lat, pickup.lng, drop.lat, drop.lng]);

  // Animate rider marker to new target with lerp + bearing rotation, and
  // periodically recompute the remaining polyline from rider → drop.
  useEffect(() => {
    if (status !== "ready") return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (!rider) {
      riderMarker.current?.setMap(null);
      riderMarker.current = null;
      remainingRenderer.current?.set("directions", null);
      currentRiderPos.current = null;
      return;
    }

    const makeIcon = (heading: number) => ({
      // Arrow shape that we can rotate to reflect direction of travel.
      path: "M 0,-8 L 5,6 L 0,3 L -5,6 Z",
      fillColor: "#2563eb",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 1.6,
      rotation: heading,
      anchor: new google.maps.Point(0, 0),
    });

    if (!riderMarker.current) {
      // First fix — place immediately, no animation.
      currentRiderPos.current = rider;
      riderMarker.current = new google.maps.Marker({
        position: rider,
        map: mapRef.current,
        title: "Delivery partner",
        zIndex: 999,
        icon: makeIcon(0),
      });
      if (follow) mapRef.current?.panTo(rider);
      updateRemainingRoute(google, rider, drop);
      return;
    }

    const from = currentRiderPos.current ?? rider;
    const to = rider;
    // Only update heading if the marker actually moved a meaningful amount.
    const moved =
      Math.abs(from.lat - to.lat) > 1e-7 || Math.abs(from.lng - to.lng) > 1e-7;
    const heading = moved ? bearing(from, to) : currentHeading.current;
    currentHeading.current = heading;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const startTs = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTs) / RIDER_LERP_MS);
      const lat = from.lat + (to.lat - from.lat) * t;
      const lng = from.lng + (to.lng - from.lng) * t;
      riderMarker.current?.setPosition({ lat, lng });
      riderMarker.current?.setIcon(makeIcon(heading));
      if (follow) mapRef.current?.panTo({ lat, lng });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        currentRiderPos.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    if (showRoute) updateRemainingRoute(google, to, drop);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, rider?.lat, rider?.lng, follow, drop.lat, drop.lng, showRoute]);

  function updateRemainingRoute(google: any, from: LatLng, to: LatLng) {
    if (!remainingRenderer.current) return;
    const now = Date.now();
    if (now - lastRemainingAt.current < REMAINING_ROUTE_MIN_INTERVAL_MS) return;
    lastRemainingAt.current = now;
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: from,
        destination: to,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, st: string) => {
        if (st === "OK" && result) remainingRenderer.current?.setDirections(result);
      },
    );
  }

  return (
    <div className={className ?? "relative h-64 w-full overflow-hidden rounded-2xl"}>
      <div ref={divRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
          {status === "loading" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs font-medium">Loading map…</span>
            </>
          ) : (
            <>
              <MapPinned className="h-6 w-6" />
              <span className="px-6 text-center text-xs font-medium">
                Map couldn't load. Check your connection and try again.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
