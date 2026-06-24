// Interactive Google Maps view for live delivery tracking.
// Renders pickup, drop and rider markers, draws the road route (Directions API
// via the JS SDK), fits bounds, and updates the rider marker as it moves.
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/maps";
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
  const lastRouteKey = useRef<string>("");
  const routeCb = useRef(onRouteComputed);
  routeCb.current = onRouteComputed;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Init map + base markers once.
  useEffect(() => {
    let cancelled = false;
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
          directionsRenderer.current = new maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#16a34a",
              strokeWeight: 5,
              strokeOpacity: 0.85,
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

  // Compute the route when endpoints are known/changed.
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

  // Move / create the rider marker.
  useEffect(() => {
    if (status !== "ready") return;
    const google = (window as any).google;
    if (!google?.maps) return;
    if (!rider) {
      riderMarker.current?.setMap(null);
      riderMarker.current = null;
      return;
    }
    if (!riderMarker.current) {
      riderMarker.current = new google.maps.Marker({
        position: rider,
        map: mapRef.current,
        title: "Delivery partner",
        zIndex: 999,
        label: { text: "🛵", fontSize: "20px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
    } else {
      riderMarker.current.setPosition(rider);
    }
    if (follow) mapRef.current?.panTo(rider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, rider?.lat, rider?.lng, follow]);

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
